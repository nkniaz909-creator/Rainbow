import React, { useState, useEffect, useCallback } from 'react';
import type { AppRoute, NotificationItem, UserProfile } from './types';
import { AppProvider, useApp } from './contexts/AppContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { NavigationShell } from './components/NavigationShell';
import { HomePage } from './pages/HomePage';
import { ShortsPage } from './pages/ShortsPage';
import { UploadPage } from './pages/UploadPage';
import { WatchPage } from './pages/WatchPage';
import { FeedPage } from './pages/FeedPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { MessagesPage } from './pages/MessagesPage';
import { SearchPage } from './pages/SearchPage';
import { StudioPage } from './pages/StudioPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import { subscribeNotifications } from './services/firestoreService';

const RainbowAppContent: React.FC = () => {
  const { t, loadingCount, loadingProgress, toasts } = useApp();
  const { firebaseUser, authReady } = useAuth();

  const [route, setRoute] = useState<AppRoute>('home');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [messagePeer, setMessagePeer] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Deep link support (?v=videoId, ?u=userId)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('v');
    const u = params.get('u');
    if (v) {
      setSelectedVideoId(v);
      setRoute('watch');
    } else if (u) {
      setSelectedUserId(u);
      setRoute('profile');
    }
  }, []);

  // Real-time notifications listener for authenticated user
  useEffect(() => {
    if (!firebaseUser) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeNotifications(firebaseUser.uid, setNotifications);
    return () => unsub();
  }, [firebaseUser]);

  const navigate = useCallback(
    (
      nextRoute: AppRoute,
      params?: { videoId?: string; userId?: string; search?: string }
    ) => {
      if (params?.videoId) setSelectedVideoId(params.videoId);
      if (params?.userId) setSelectedUserId(params.userId);
      if (typeof params?.search === 'string') setSearchQuery(params.search);
      if (nextRoute !== 'messages') setMessagePeer(null);
      setRoute(nextRoute);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const handleWatch = useCallback(
    (videoId: string) => {
      navigate('watch', { videoId });
    },
    [navigate]
  );

  const handleCreatorClick = useCallback(
    (userId: string) => {
      navigate('profile', { userId });
    },
    [navigate]
  );

  const handleSearchSubmit = useCallback(
    (q: string) => {
      navigate('search', { search: q });
    },
    [navigate]
  );

  const handleOpenNotification = useCallback(
    (n: NotificationItem) => {
      if (n.targetType === 'video' && n.targetId) {
        handleWatch(n.targetId);
      } else if (n.targetType === 'user' && n.targetId) {
        handleCreatorClick(n.targetId);
      } else if (n.targetType === 'post') {
        navigate('feed');
      }
    },
    [handleWatch, handleCreatorClick, navigate]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <LoadingScreen
        visible={!authReady || loadingCount > 0}
        progress={loadingProgress}
        label={!authReady ? t.loading : undefined}
      />

      <NavigationShell
        route={route}
        onNavigate={navigate}
        unreadNotifications={unreadCount}
        searchQuery={searchQuery}
        onSearchSubmit={handleSearchSubmit}
      >
        {route === 'home' && (
          <HomePage
            onWatch={handleWatch}
            onCreatorClick={handleCreatorClick}
            onUploadClick={() => navigate('upload')}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'following' && (
          <HomePage
            followingOnly
            onWatch={handleWatch}
            onCreatorClick={handleCreatorClick}
            onUploadClick={() => navigate('upload')}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'shorts' && (
          <ShortsPage
            onCreatorClick={handleCreatorClick}
            onUploadClick={() => navigate('upload')}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'upload' && (
          <UploadPage
            onSuccess={(vid) => handleWatch(vid)}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'watch' && selectedVideoId && (
          <WatchPage
            videoId={selectedVideoId}
            onWatch={handleWatch}
            onCreatorClick={handleCreatorClick}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'feed' && (
          <FeedPage
            onWatch={handleWatch}
            onCreatorClick={handleCreatorClick}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'profile' && (
          <ProfilePage
            targetUserId={selectedUserId || firebaseUser?.uid || ''}
            onWatch={handleWatch}
            onMessageUser={(user) => {
              setMessagePeer(user);
              setRoute('messages');
            }}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'notifications' && (
          <NotificationsPage
            notifications={notifications}
            onOpenTarget={handleOpenNotification}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'messages' && (
          <MessagesPage
            initialPeer={messagePeer}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'search' && (
          <SearchPage
            queryText={searchQuery}
            onSearch={handleSearchSubmit}
            onWatch={handleWatch}
            onCreatorClick={handleCreatorClick}
          />
        )}

        {route === 'studio' && (
          <StudioPage
            onWatch={handleWatch}
            onUploadClick={() => navigate('upload')}
            onSignInClick={() => navigate('auth')}
          />
        )}

        {route === 'settings' && (
          <SettingsPage
            onSignOutSuccess={() => navigate('home')}
            onSignInClick={() => navigate('auth')}
            onWatch={handleWatch}
          />
        )}

        {route === 'auth' && (
          <AuthPage onSuccess={() => navigate('home')} />
        )}

        {route === 'admin' && <AdminPage />}
      </NavigationShell>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-5 end-4 z-50 space-y-2 max-w-xs w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg border ${
                toast.type === 'error'
                  ? 'bg-red-600 text-white border-red-700'
                  : toast.type === 'success'
                  ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 border-neutral-800 dark:border-neutral-200'
                  : 'bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white border-neutral-200 dark:border-neutral-800'
              }`}
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AuthProvider>
          <RainbowAppContent />
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
