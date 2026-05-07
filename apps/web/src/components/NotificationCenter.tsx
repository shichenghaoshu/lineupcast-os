"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
} from "lucide-react";
import {
  type Notification,
  type NotificationType,
  subscribe,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  clearAll,
} from "@/lib/notifications";

const typeConfig: Record<
  NotificationType,
  { icon: typeof CheckCircle; color: string; bgClass: string }
> = {
  success: {
    icon: CheckCircle,
    color: "var(--accent-green)",
    bgClass: "bg-emerald-500/15 border-emerald-500/30",
  },
  error: {
    icon: AlertCircle,
    color: "var(--accent-red)",
    bgClass: "bg-red-500/15 border-red-500/30",
  },
  warning: {
    icon: AlertTriangle,
    color: "var(--accent-amber)",
    bgClass: "bg-amber-500/15 border-amber-500/30",
  },
  info: {
    icon: Info,
    color: "var(--accent-blue)",
    bgClass: "bg-blue-500/15 border-blue-500/30",
  },
};

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

/* ------------------------------------------------------------------ */
/* Toast container (fixed, top-right)                                  */
/* ------------------------------------------------------------------ */
export function ToastContainer() {
  const [toasts, setToasts] = useState<Notification[]>([]);

  useEffect(() => {
    return subscribe((all) => {
      // Show the newest notification as a toast (last 5 seconds)
      const recent = all.filter(
        (n) => !n.read && Date.now() - n.timestamp < 5000 && n.autoDismiss !== false
      );
      setToasts(recent.slice(0, 3));
    });
  }, []);

  const handleDismiss = useCallback((id: string) => {
    dismissNotification(id);
  }, []);

  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const config = typeConfig[toast.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur-sm ${config.bgClass} max-w-sm`}
            >
              <Icon
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: config.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {toast.title}
                </p>
                {toast.message && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDismiss(toast.id)}
                className="shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notification Bell + Dropdown                                        */
/* ------------------------------------------------------------------ */
export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribe((all) => {
      setNotifications(all);
      setUnreadCount(all.filter((n) => !n.read).length);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkAsRead = useCallback((id: string) => {
    markAsRead(id);
  }, []);

  const handleMarkAll = useCallback(() => {
    markAllAsRead();
  }, []);

  const handleClear = useCallback(() => {
    clearAll();
    setOpen(false);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-red)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-3 py-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                通知
              </span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--accent-blue)]"
                    title="全部已读"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={handleClear}
                    className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--accent-red)]"
                    title="清除全部"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
                  <Bell className="mb-2 h-8 w-8 opacity-30" />
                  <p className="text-sm">暂无通知</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const config = typeConfig[notification.type];
                  const Icon = config.icon;
                  return (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-3 border-b border-[var(--border-color)] px-3 py-2.5 transition-colors ${
                        notification.read
                          ? "bg-transparent"
                          : "bg-[var(--bg-card)]/50"
                      } hover:bg-[var(--bg-card)]`}
                    >
                      <Icon
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: config.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            notification.read
                              ? "text-[var(--text-secondary)]"
                              : "font-medium text-[var(--text-primary)]"
                          }`}
                        >
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {notification.message}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="shrink-0 rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--accent-green)]"
                          title="标为已读"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
