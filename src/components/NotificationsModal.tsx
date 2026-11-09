import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Clock, FileText, Info, X } from 'lucide-react';
import { db } from '../db/database';
import { NotificationItem } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  userId: string;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  userId,
}) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    db.markAllNotificationsAsRead(userId);
  };

  const handleNotificationClick = (n: NotificationItem) => {
    db.markNotificationAsRead(n.id);
    const targetUrl = n.actionUrl || (n.type === 'correction' ? '/attendance?tab=corrections' : undefined);
    if (targetUrl) {
      onClose();
      navigate(targetUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-end p-4 sm:p-6">
      <div className="bg-white rounded-2xl max-w-md w-full border border-[#ded8cb] shadow-2xl animate-in slide-in-from-right duration-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-[#f0ece1] flex items-center justify-between bg-[#faf9f5]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#CAA05C]" />
            <h3 className="font-bold text-sm text-[#1c2120]">Notifications & Alerts</h3>
            {notifications.filter((n) => !n.isRead).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#CAA05C] text-[#171c1b] text-[10px] font-bold">
                {notifications.filter((n) => !n.isRead).length} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] font-semibold text-[#CAA05C] hover:underline cursor-pointer"
            >
              Mark all read
            </button>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-3 overflow-y-auto space-y-2 flex-1">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-[#7e8884] text-xs">
              No notifications at this time.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
                  n.isRead
                    ? 'bg-[#faf9f5] border-[#ece7dc] text-[#55605d]'
                    : 'bg-[#edf7f1] border-[#c2e8d3] text-[#1c2120] font-medium'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-xs text-[#1c2120]">{n.title}</h4>
                  <span className="text-[10px] text-[#717b77] whitespace-nowrap font-mono">
                    {new Date(n.createdAt).toLocaleTimeString('en-US', {
                      timeZone: 'Asia/Dhaka',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#414b47]">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
