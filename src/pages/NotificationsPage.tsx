import React from 'react';
import { Bell, CheckCheck, User } from 'lucide-react';
import type { NotificationItem } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { markNotificationRead, markAllNotificationsRead } from '../services/firestoreService';
import { formatRelativeTime, isSafeMediaUrl } from '../utils/format';

interface NotificationsPageProps {
  notifications: NotificationItem[];
  onOpenTarget: (n: NotificationItem) => void;
  onSignInClick: () => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications,
  onOpenTarget,
  onSignInClick,
}) => {
  const { t, language } = useApp();
  const { firebaseUser } = useAuth();

  if (!firebaseUser) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
          <Bell className="w-8 h-8 mx-auto mb-3 text-neutral-500" />
          <h2 className="text-lg font-bold mb-2">{t.authRequired}</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {t.signInToContinue}
          </p>
          <button
            type="button"
            onClick={onSignInClick}
            className="px-5 py-2.5 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold"
          >
            {t.signIn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-display">{t.notifications}</h1>
        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={() => markAllNotificationsRead(notifications)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{t.markAllRead}</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-12 text-center text-sm text-neutral-500">
          {t.noNotifications}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={async () => {
                if (!n.read) await markNotificationRead(n.id);
                onOpenTarget(n);
              }}
              className={`w-full flex items-start gap-3 p-4 text-start transition-colors ${
                n.read
                  ? 'bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  : 'bg-neutral-100/80 dark:bg-neutral-800/60'
              }`}
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                {isSafeMediaUrl(n.actorPhotoURL) ? (
                  <img
                    src={n.actorPhotoURL}
                    alt={n.actorName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-4 h-4 text-neutral-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{n.actorName}</span>{' '}
                  <span className="text-neutral-700 dark:text-neutral-300">{n.message}</span>
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  {formatRelativeTime(n.createdAt, language)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
