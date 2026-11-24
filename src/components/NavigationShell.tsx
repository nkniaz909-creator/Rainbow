import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  PlaySquare,
  Plus,
  Users,
  User,
  Search,
  Bell,
  MessageSquare,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Newspaper,
  Sun,
  Moon,
  LogIn,
  X,
  Clock,
} from 'lucide-react';
import { RAINBOW_LOGO_PATH, type AppRoute } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchSearchHistory, saveSearchHistoryItem } from '../services/firestoreService';
import { isSafeMediaUrl } from '../utils/format';
import { PWAInstallButton } from './PWAInstallButton';

interface NavigationShellProps {
  route: AppRoute;
  onNavigate: (route: AppRoute, params?: { videoId?: string; userId?: string; search?: string }) => void;
  unreadNotifications: number;
  searchQuery: string;
  onSearchSubmit: (q: string) => void;
  children: React.ReactNode;
}

export const NavigationShell: React.FC<NavigationShellProps> = ({
  route,
  onNavigate,
  unreadNotifications,
  searchQuery,
  onSearchSubmit,
  children,
}) => {
  const { t, theme, toggleTheme, isOnline } = useApp();
  const { firebaseUser, profile, isAdmin } = useAuth();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentHistory, setRecentHistory] = useState<string[]>([]);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!firebaseUser) {
      try {
        const local = JSON.parse(localStorage.getItem('rainbow_search_history') || '[]') as string[];
        setRecentHistory(local);
      } catch {
        setRecentHistory([]);
      }
      return;
    }
    fetchSearchHistory(firebaseUser.uid).then((items) => {
      setRecentHistory(items.map((i) => i.query));
    });
  }, [firebaseUser, route]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerSearch = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setShowSuggestions(false);
    if (firebaseUser) {
      saveSearchHistoryItem(firebaseUser.uid, clean);
    } else {
      const updated = [clean, ...recentHistory.filter((x) => x !== clean)].slice(0, 10);
      localStorage.setItem('rainbow_search_history', JSON.stringify(updated));
      setRecentHistory(updated);
    }
    onSearchSubmit(clean);
  };

  const sidebarPrimary = [
    { id: 'home' as AppRoute, label: t.home, icon: Home },
    { id: 'shorts' as AppRoute, label: t.shorts, icon: PlaySquare },
    { id: 'upload' as AppRoute, label: t.upload, icon: Plus },
    { id: 'following' as AppRoute, label: t.following, icon: Users },
    { id: 'feed' as AppRoute, label: t.feed, icon: Newspaper },
  ];

  const sidebarSecondary = [
    { id: 'messages' as AppRoute, label: t.messages, icon: MessageSquare },
    { id: 'notifications' as AppRoute, label: t.notifications, icon: Bell, badge: unreadNotifications },
    { id: 'studio' as AppRoute, label: t.studio, icon: LayoutDashboard },
    { id: 'profile' as AppRoute, label: t.profile, icon: User },
    { id: 'settings' as AppRoute, label: t.settings, icon: Settings },
  ];

  const filteredSuggestions = localSearch.trim()
    ? recentHistory.filter((h) => h.toLowerCase().includes(localSearch.toLowerCase()))
    : recentHistory.slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50">
      {!isOnline && (
        <div className="bg-red-600 text-white text-xs font-medium text-center py-1.5 px-4">
          {t.offlineNotice}
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md px-3 md:px-6 flex items-center justify-between gap-3 md:gap-8">
        {/* Zone 1: Brand */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 shrink-0 focus-visible:outline-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-white rounded-lg"
        >
          <div className="w-8 h-8 rounded-full p-0.5 rainbow-ring-border shrink-0">
            <img
              src={RAINBOW_LOGO_PATH}
              alt="Rainbow"
              className="w-full h-full object-cover rounded-full bg-white"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            {t.appName}
          </span>
        </button>

        {/* Zone 2: Search Bar */}
        <div ref={searchBoxRef} className="relative flex-1 max-w-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              triggerSearch(localSearch);
            }}
            className="flex items-center w-full rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3.5 h-9 focus-within:border-neutral-400 dark:focus-within:border-neutral-600 transition-colors"
          >
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="search"
              value={localSearch}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-transparent px-2.5 text-sm outline-none placeholder:text-neutral-400"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-11 inset-x-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg py-1.5 z-40">
              {filteredSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setLocalSearch(item);
                    triggerSearch(item);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-start hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
          <PWAInstallButton compact />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t.lightMode : t.darkMode}
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            aria-label={t.notifications}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 end-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('messages')}
            aria-label={t.messages}
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {firebaseUser ? (
            <button
              type="button"
              onClick={() => onNavigate('profile', { userId: firebaseUser.uid })}
              aria-label={t.profile}
              className="w-9 h-9 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0"
            >
              {isSafeMediaUrl(profile?.photoURL) ? (
                <img
                  src={profile?.photoURL}
                  alt={profile?.displayName || t.profile}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-4 h-4 text-neutral-500" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('auth')}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t.signIn}</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-e border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto justify-between">
          <div className="space-y-6">
            <nav className="space-y-1">
              {sidebarPrimary.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
              <nav className="space-y-1">
                {sidebarSecondary.map((item) => {
                  const Icon = item.icon;
                  const active = route === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        item.id === 'profile' && firebaseUser
                          ? onNavigate('profile', { userId: firebaseUser.uid })
                          : onNavigate(item.id)
                      }
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-mono tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigate('admin')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      route === 'admin'
                        ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t.admin}</span>
                  </button>
                )}
              </nav>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 px-3 text-xs text-neutral-500 dark:text-neutral-400 space-y-2.5">
            <PWAInstallButton />
            <div className="space-y-1">
              <p className="font-semibold text-neutral-700 dark:text-neutral-300">{t.appName}</p>
              <p>{t.poweredByNk}</p>
              <p>{t.fromNk}</p>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 exact items: Home, Shorts, Upload centered, Following, Profile) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-5 items-center px-1">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 ${
            route === 'home' ? 'text-neutral-950 dark:text-white font-semibold' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] truncate max-w-[64px]">{t.home}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('shorts')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 ${
            route === 'shorts' ? 'text-neutral-950 dark:text-white font-semibold' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          <PlaySquare className="w-5 h-5" />
          <span className="text-[10px] truncate max-w-[64px]">{t.shorts}</span>
        </button>

        {/* Centered Upload */}
        <button
          type="button"
          onClick={() => onNavigate('upload')}
          aria-label={t.upload}
          className="flex flex-col items-center justify-center h-full"
        >
          <span className="w-10 h-10 rounded-full p-0.5 rainbow-ring-border flex items-center justify-center shadow-sm">
            <span className="w-full h-full rounded-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('following')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 ${
            route === 'following' ? 'text-neutral-950 dark:text-white font-semibold' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] truncate max-w-[64px]">{t.following}</span>
        </button>

        <button
          type="button"
          onClick={() =>
            firebaseUser
              ? onNavigate('profile', { userId: firebaseUser.uid })
              : onNavigate('auth')
          }
          className={`flex flex-col items-center justify-center h-full gap-0.5 ${
            route === 'profile' ? 'text-neutral-950 dark:text-white font-semibold' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] truncate max-w-[64px]">{t.profile}</span>
        </button>
      </nav>
    </div>
  );
};
