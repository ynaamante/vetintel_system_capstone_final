import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { ownerNotificationsApi } from '../services/api';
import type { OwnerNotification } from '../services/api';

type NotificationContext = {
  notifications: OwnerNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};
const Context = createContext<NotificationContext | null>(null);
export function OwnerNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const currentToken = useRef(token);
  currentToken.current = token;
  const revision = useRef(0);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!token) return;
    const requestRevision = ++revision.current;
    setLoading(true);
    try {
      const rows = await ownerNotificationsApi.list(token);
      if (currentToken.current !== token || revision.current !== requestRevision) return;
      setNotifications(rows); setError('');
      const pending = rows.filter(row => !row.received).map(row => row.id);
      if (pending.length) {
        await ownerNotificationsApi.acknowledge(token, pending);
        if (currentToken.current === token && revision.current === requestRevision) setNotifications(items => items.map(row => pending.includes(row.id) ? { ...row, received: true } : row));
      }
    } catch (failure: any) {
      if (currentToken.current === token && revision.current === requestRevision) setError(failure.message || 'Unable to load clinic notifications.');
    } finally {
      if (currentToken.current === token && revision.current === requestRevision) setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    setNotifications([]); setError(''); setLoading(false);
    if (!token) return;
    refresh();
    const timer = setInterval(() => { if (!['background', 'inactive'].includes(AppState.currentState)) refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); revision.current++; };
  }, [token, refresh]);
  const markRead = useCallback(async (id: string) => {
    if (!token) return;
    await ownerNotificationsApi.markRead(token, id);
    if (currentToken.current === token) { revision.current++; setNotifications(rows => rows.map(row => row.id === id ? { ...row, read: true, received: true } : row)); setLoading(false); }
  }, [token]);
  const markAllRead = useCallback(async () => {
    if (!token) return;
    const result = await ownerNotificationsApi.markAllRead(token);
    if (currentToken.current === token) { revision.current++; setNotifications(rows => rows.map(row => result.ids.includes(row.id) ? { ...row, read: true, received: true } : row)); setLoading(false); }
  }, [token]);
  return <Context.Provider value={{ notifications, unreadCount: notifications.filter(row => !row.read).length, loading, error, refresh, markRead, markAllRead }}>{children}</Context.Provider>;
}
export function useOwnerNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('OwnerNotificationsProvider is required.');
  return context;
}
