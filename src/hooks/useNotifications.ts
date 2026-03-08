"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  AppNotification,
  clearAllNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
} from "@/services/notificationService";

export function useNotifications() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToNotifications(
      userProfile.uid,
      (data) => {
        setItems(data.items);
        setUnreadCount(data.unreadCount);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  const markOneAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await markAllNotificationsAsRead();
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  };

  const clearAll = async () => {
    await clearAllNotifications();
    setItems([]);
    setUnreadCount(0);
  };

  return { items, unreadCount, loading, markOneAsRead, markAllAsRead, clearAll };
}
