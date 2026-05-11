import { BASE_URL } from '@/constants/api';
import { mapNotificationDto, type NotificationItem } from '@/types/notifications';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { getAccessToken } from '@/utils/session';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type NotificationsContextValue = {
  unreadCount: number;
  latestNotification: NotificationItem | null;
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState<NotificationItem | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    const response = await fetchWithAuth(`${BASE_URL}/notifications/unread-count`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) return;

    const count = Number(data?.count);
    if (Number.isFinite(count)) {
      setUnreadCount(Math.max(0, count));
    }
  }, []);

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    let socket: Socket | null = null;
    let disposed = false;

    const connect = async () => {
      if (disposed || socket?.connected) return;

      const token = await getAccessToken();
      if (!token) return;

      socket = io(`${BASE_URL}/notifications`, {
        transports: ['websocket'],
        auth: { token },
      });

      socket.on('connect', () => {
        console.log('[Notifications] Socket connected:', socket?.id);
        void refreshUnreadCount();
      });

      socket.on('notification:new', (payload) => {
        const notification = mapNotificationDto(payload);
        console.log('[Notifications] Realtime notification received:', notification);
        setLatestNotification(notification);
        setUnreadCount((current) => current + 1);
      });

      socket.on('connect_error', (error) => {
        console.warn('[Notifications] Socket connect error:', error.message);
      });

      socket.on('disconnect', (reason) => {
        console.log('[Notifications] Socket disconnected:', reason);
      });
    };

    void connect();
    const retryTimer = setInterval(() => {
      void connect();
    }, 3000);

    return () => {
      disposed = true;
      clearInterval(retryTimer);
      socket?.disconnect();
    };
  }, [refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, latestNotification, refreshUnreadCount, decrementUnreadCount }),
    [decrementUnreadCount, latestNotification, refreshUnreadCount, unreadCount],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }

  return context;
}