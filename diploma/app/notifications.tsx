import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
  type SectionListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL } from '@/constants/api';
import {
  mapNotificationDtoList,
  type NotificationItem,
  type NotificationListSection,
} from '@/types/notifications';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { formatNotificationTime, groupNotificationsBySections } from '@/utils/notifications';

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => groupNotificationsBySections(items), [items]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/settings');
  };

  const loadFromServer = useCallback(async (): Promise<NotificationItem[]> => {
    const response = await fetchWithAuth(`${BASE_URL}/notifications`);
    const data = await response.json().catch(() => []);

    if (!response.ok || !Array.isArray(data)) {
      throw new Error('Не вдалося завантажити сповіщення');
    }

    return mapNotificationDtoList(data);
  }, []);

  useEffect(() => {
    void loadFromServer()
      .then(setItems)
      .catch((error) => console.warn('[Notifications] Failed to load notifications:', error));
  }, [loadFromServer]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await loadFromServer();
      setItems(next);
    } finally {
      setRefreshing(false);
    }
  }, [loadFromServer]);

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<NotificationItem, NotificationListSection>) => (
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
        </View>
        <Text style={styles.itemTime}>{formatNotificationTime(item.createdAt)}</Text>
      </View>
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: NotificationListSection }) => (
      <View style={styles.sectionHeaderWrap}>
        <Text style={styles.sectionHeader}>{section.title}</Text>
      </View>
    ),
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <Pressable onPress={handleBack} style={styles.backAbs} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#19395A" />
        </Pressable>
        <Text style={styles.pageTitle}>Сповіщення</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ItemSeparatorComponent={Divider}
        SectionSeparatorComponent={SectionSpacer}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9D8DF1" />}
        ListEmptyComponent={
          <Text style={styles.empty}>Поки немає сповіщень</Text>
        }
      />
    </SafeAreaView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function SectionSpacer() {
  return <View style={styles.sectionSpacer} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    justifyContent: 'center',
    minHeight: 48,
  },
  backAbs: {
    position: 'absolute',
    left: 16,
    top: 8,
    zIndex: 1,
    padding: 8,
  },
  pageTitle: {
    fontFamily: 'Space Grotesk',
    fontSize: 22,
    fontWeight: '700',
    color: '#19395A',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionHeaderWrap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sectionHeader: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA8B4',
  },
  sectionSpacer: {
    height: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontFamily: 'Inter',
    fontSize: 17,
    fontWeight: '500',
    color: '#19395A',
    lineHeight: 24,
  },
  itemSubtitle: {
    marginTop: 6,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: '#6A8298',
    lineHeight: 20,
  },
  itemTime: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA8B4',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E4E9F0',
  },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#9CA8B4',
  },
});
