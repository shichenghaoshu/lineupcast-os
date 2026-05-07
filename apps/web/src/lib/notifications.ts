"use client";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  autoDismiss?: boolean;
}

type Listener = (notifications: Notification[]) => void;

let notifications: Notification[] = [];
const listeners: Set<Listener> = new Set();

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function notifyListeners() {
  const snapshot = [...notifications];
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener([...notifications]);
  return () => {
    listeners.delete(listener);
  };
}

export function getNotifications(): Notification[] {
  return [...notifications];
}

export function getUnreadCount(): number {
  return notifications.filter((n) => !n.read).length;
}

export function addNotification(
  type: NotificationType,
  title: string,
  message?: string,
  autoDismiss = true
): string {
  const id = generateId();
  const notification: Notification = {
    id,
    type,
    title,
    message,
    timestamp: Date.now(),
    read: false,
    autoDismiss,
  };
  notifications = [notification, ...notifications];
  notifyListeners();

  if (autoDismiss) {
    setTimeout(() => {
      dismissNotification(id);
    }, 5000);
  }

  return id;
}

export function dismissNotification(id: string): void {
  notifications = notifications.filter((n) => n.id !== id);
  notifyListeners();
}

export function markAsRead(id: string): void {
  notifications = notifications.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  notifyListeners();
}

export function markAllAsRead(): void {
  notifications = notifications.map((n) => ({ ...n, read: true }));
  notifyListeners();
}

export function clearAll(): void {
  notifications = [];
  notifyListeners();
}
