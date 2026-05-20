import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mapChatPreviewDtoList, type ChatPreviewItem } from '@/types/chats';
import { fetchConversations } from '@/utils/chatApi';
import { mapConversationToPreview } from '@/utils/chatMappers';
import { filterChatsByQuery, formatChatTime } from '@/utils/chats';
import { getCurrentUserId } from '@/utils/currentUser';

const TAB_BAR_BOTTOM_OFFSET = 18;
const ACTIVE_RING = '#D9B5F5';

export default function ChatsTabScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ChatPreviewItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const filtered = useMemo(() => filterChatsByQuery(items, searchQuery), [items, searchQuery]);

  const loadFromServer = useCallback(async (): Promise<ChatPreviewItem[]> => {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      throw new Error('Увійдіть у акаунт, щоб переглянути повідомлення');
    }

    const conversations = await fetchConversations();
    const previews = conversations
      .map((conversation) => mapConversationToPreview(conversation, currentUserId))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return mapChatPreviewDtoList(previews);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const next = await loadFromServer();
      setItems(next);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Не вдалося завантажити чати';
      setLoadError(message);
    } finally {
      setRefreshing(false);
    }
  }, [loadFromServer]);

  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  const renderItem = useCallback(({ item }: { item: ChatPreviewItem }) => {
    const avatarUri = item.participantAvatarUrl;
    return (
      <Pressable
        style={styles.row}
        onPress={() => {
          router.push({ pathname: '/chat/[conversationId]', params: { conversationId: item.id } });
        }}
        android_ripple={{ color: '#EFEAF8' }}
      >
        <View style={styles.avatarRing}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.activityBadge}>
            <Text style={styles.activityEmoji}>{item.activityStatusEmoji}</Text>
          </View>
        </View>

        <View style={styles.rowMain}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.participantName}
          </Text>
          <Text style={styles.rowMessage} numberOfLines={1}>
            {item.lastMessageText}
          </Text>
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.rowTime}>{formatChatTime(item.lastMessageAt)}</Text>
        </View>
      </Pressable>
    );
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={RowDivider}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + TAB_BAR_BOTTOM_OFFSET + 12 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9D8DF1" />}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Повідомлення</Text>
            <View style={styles.headerDivider} />

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={26} color="#173753" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Пошук"
                placeholderTextColor="#7C8B98"
                style={styles.searchInput}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loadError ?? (searchQuery.trim() ? 'Немає діалогів за вашим запитом' : 'Поки що немає повідомлень')}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

function RowDivider() {
  return <View style={styles.rowDivider} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  title: {
    fontFamily: 'Space Grotesk',
    fontSize: 28,
    fontWeight: '700',
    color: '#19395A',
    textAlign: 'center',
    marginTop: 10,
  },
  headerDivider: {
    marginTop: 18,
    height: 2,
    backgroundColor: '#E4E9F0',
  },
  searchWrap: {
    marginTop: 18,
    height: 56,
    borderWidth: 1,
    borderColor: '#173753',
    borderRadius: 28,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '500',
    color: '#173753',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: ACTIVE_RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    backgroundColor: '#9D8DF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadge: {
    position: 'absolute',
    right: -5,
    bottom: 0,
    width: 25,
    height: 25,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ACTIVE_RING,
  },
  activityEmoji: {
    fontSize: 12,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 22,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: 'Inter',
    fontSize: 19,
    fontWeight: '500',
    color: '#173753',
    lineHeight: 24,
  },
  rowMessage: {
    marginTop: 4,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '400',
    color: '#2A3F55',
    lineHeight: 21,
  },
  rowRight: {
    marginLeft: 12,
  },
  rowTime: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
    color: '#344D66',
  },
  rowDivider: {
    height: 2,
    backgroundColor: '#E4E9F0',
    marginLeft: 78,
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#8FA0B0',
  },
});
