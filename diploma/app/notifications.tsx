import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type SectionListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL } from '@/constants/api';
import { useNotifications } from '@/contexts/notifications';
import {
  mapNotificationDtoList,
  type NotificationItem,
  type NotificationListSection,
} from '@/types/notifications';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { formatNotificationTime, groupNotificationsBySections } from '@/utils/notifications';

export default function NotificationsScreen() {
  const { decrementUnreadCount, refreshUnreadCount } = useNotifications();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFriendRequest, setSelectedFriendRequest] = useState<NotificationItem | null>(null);
  const [friendRequestAction, setFriendRequestAction] = useState<'accept' | 'decline' | null>(null);

  const sections = useMemo(() => groupNotificationsBySections(items), [items]);

  const selectedFriendshipId = useMemo(
    () => getFriendshipIdFromNotification(selectedFriendRequest),
    [selectedFriendRequest],
  );

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
      .then((next) => {
        setItems(next);
        void refreshUnreadCount();
      })
      .catch((error) => console.warn('[Notifications] Failed to load notifications:', error));
  }, [loadFromServer, refreshUnreadCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await loadFromServer();
      setItems(next);
      await refreshUnreadCount();
    } finally {
      setRefreshing(false);
    }
  }, [loadFromServer, refreshUnreadCount]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    const response = await fetchWithAuth(`${BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message ?? 'Не вдалося оновити сповіщення');
    }

    setItems((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    );
    decrementUnreadCount();
  }, [decrementUnreadCount]);

  const handleNotificationPress = useCallback((item: NotificationItem) => {
    if (item.type !== 'FRIEND_REQUEST') return;

    const friendshipId = getFriendshipIdFromNotification(item);
    if (friendshipId === null) {
      Alert.alert('Заявка недоступна', 'У цьому сповіщенні немає ID заявки в друзі.');
      return;
    }

    setSelectedFriendRequest(item);
  }, []);

  const handleFriendRequestAction = useCallback(
    async (action: 'accept' | 'decline') => {
      if (!selectedFriendRequest || selectedFriendshipId === null) return;

      try {
        setFriendRequestAction(action);
        const response = await fetchWithAuth(
          `${BASE_URL}/friends/requests/${selectedFriendshipId}/${action}`,
          { method: 'PATCH' },
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.message ?? 'Не вдалося обробити заявку');
        }

        await markNotificationRead(selectedFriendRequest.id);
        setSelectedFriendRequest(null);
        const message = action === 'accept' ? 'Заявку прийнято.' : 'Заявку відхилено.';
        Alert.alert('Готово', message);
      } catch (error: any) {
        Alert.alert('Помилка', error?.message ?? 'Спробуйте ще раз пізніше.');
      } finally {
        setFriendRequestAction(null);
      }
    },
    [markNotificationRead, selectedFriendRequest, selectedFriendshipId],
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<NotificationItem, NotificationListSection>) => (
      <TouchableOpacity
        style={[styles.row, item.type === 'FRIEND_REQUEST' && styles.pressableRow]}
        activeOpacity={item.type === 'FRIEND_REQUEST' ? 0.65 : 1}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.rowMain}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
        </View>
        <Text style={styles.itemTime}>{formatNotificationTime(item.createdAt)}</Text>
      </TouchableOpacity>
    ),
    [handleNotificationPress],
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

      <Modal
        visible={Boolean(selectedFriendRequest)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedFriendRequest(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedFriendRequest(null)}>
          <Pressable style={styles.friendRequestModal} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Заявка в друзі</Text>
            <Text style={styles.modalBody}>{selectedFriendRequest?.title}</Text>
            {!!selectedFriendRequest?.subtitle && (
              <Text style={styles.modalHint}>{selectedFriendRequest.subtitle}</Text>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.declineButton]}
                activeOpacity={0.7}
                disabled={friendRequestAction !== null}
                onPress={() => handleFriendRequestAction('decline')}
              >
                <Text style={styles.declineButtonText}>
                  {friendRequestAction === 'decline' ? 'Відхиляємо...' : 'Відхилити'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.acceptButton]}
                activeOpacity={0.7}
                disabled={friendRequestAction !== null}
                onPress={() => handleFriendRequestAction('accept')}
              >
                <Text style={styles.acceptButtonText}>
                  {friendRequestAction === 'accept' ? 'Приймаємо...' : 'Прийняти'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.7}
              disabled={friendRequestAction !== null}
              onPress={() => setSelectedFriendRequest(null)}
            >
              <Text style={styles.cancelButtonText}>Скасувати</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function getFriendshipIdFromNotification(item: NotificationItem | null): number | null {
  const raw = item?.metadata?.friendshipId;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
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
  pressableRow: {
    borderRadius: 10,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  friendRequestModal: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  modalTitle: {
    textAlign: 'center',
    fontFamily: 'Space Grotesk',
    fontSize: 24,
    fontWeight: '700',
    color: '#19395A',
  },
  modalBody: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 17,
    fontWeight: '600',
    color: '#173753',
    lineHeight: 24,
  },
  modalHint: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#6A8298',
    lineHeight: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalActionButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    borderWidth: 1,
    borderColor: '#E4E9F0',
    backgroundColor: '#FFFFFF',
  },
  acceptButton: {
    backgroundColor: '#9D8DF1',
  },
  declineButtonText: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '700',
    color: '#19395A',
  },
  acceptButtonText: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 4,
  },
  cancelButtonText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    color: '#6A8298',
  },
});
