import { api } from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  meta: Record<string, unknown>;
  readAt: string | null;
  isRead: boolean;
  createdAt: string;
}

export const listNotifications = (limit?: number) =>
  api.get<Notification[]>(`/api/notifications${limit ? `?limit=${limit}` : ''}`);

export const getUnreadCount = () =>
  api.get<{ count: number }>('/api/notifications/unread-count');

export const markRead = (ids: string[]) =>
  api.post<void>('/api/notifications/mark-read', { ids });

export const markAllRead = () =>
  api.post<void>('/api/notifications/mark-all-read', {});

export const dismissNotification = (id: string) =>
  api.delete<void>(`/api/notifications/${id}`);
