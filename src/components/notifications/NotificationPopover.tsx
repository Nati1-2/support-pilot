import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, ExternalLink, AlertTriangle, Info, CheckCircle2, Truck } from 'lucide-react';
import { AppNotification } from '../../types';
import { api } from '../../lib/api';
import { formatRelativeTime } from '../../lib/utils';

interface NotificationPopoverProps {
  onNavigateTicket?: (ticketId: string) => void;
}

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({ onNavigateTicket }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (e) {
      console.warn('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (e) {
      console.warn(e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent':
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'webhook':
        return <Truck className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <Info className="w-3.5 h-3.5 text-neutral-500" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-dropdown border border-neutral-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-100 bg-neutral-50/50">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-neutral-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-medium bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-neutral-500 hover:text-neutral-900 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400">
                No notifications right now
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkRead(notif.id)}
                  className={`p-3 text-left transition-colors cursor-pointer hover:bg-neutral-50 flex items-start gap-2.5 ${
                    !notif.read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${!notif.read ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                      {notif.title}
                    </p>
                    <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">{notif.message}</p>
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
