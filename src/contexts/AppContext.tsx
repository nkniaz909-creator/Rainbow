import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { LanguageCode, ThemeMode, NotificationPrefs } from '../types';
import { isRtlLanguage } from '../i18n/languages';
import { TRANSLATIONS, type TranslationKeys } from '../i18n/translations';

interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface AppContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  isRtl: boolean;
  t: TranslationKeys;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  autoplay: boolean;
  setAutoplay: (val: boolean) => void;
  shortsAutoplay: boolean;
  setShortsAutoplay: (val: boolean) => void;
  dataSaver: boolean;
  setDataSaver: (val: boolean) => void;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: (prefs: NotificationPrefs) => void;
  isOnline: boolean;
  loadingCount: number;
  loadingProgress: number | null;
  startLoading: (progress?: number) => void;
  setLoadingProgressValue: (progress: number | null) => void;
  stopLoading: () => void;
  toasts: ToastMessage[];
  showToast: (text: string, type?: 'info' | 'success' | 'error') => void;
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  followers: true,
  likes: true,
  comments: true,
  replies: true,
  uploads: true,
  system: true,
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('rainbow_language') as LanguageCode | null;
    return saved && TRANSLATIONS[saved] ? saved : 'en';
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('rainbow_theme') as ThemeMode | null;
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });

  const [autoplay, setAutoplayState] = useState<boolean>(() => {
    const saved = localStorage.getItem('rainbow_autoplay');
    return saved === null ? true : saved === 'true';
  });

  const [shortsAutoplay, setShortsAutoplayState] = useState<boolean>(() => {
    const saved = localStorage.getItem('rainbow_shorts_autoplay');
    return saved === null ? true : saved === 'true';
  });

  const [dataSaver, setDataSaverState] = useState<boolean>(() => {
    const saved = localStorage.getItem('rainbow_data_saver');
    return saved === 'true';
  });

  const [notificationPrefs, setNotificationPrefsState] = useState<NotificationPrefs>(() => {
    try {
      const saved = localStorage.getItem('rainbow_notif_prefs');
      return saved ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(saved) } : DEFAULT_NOTIF_PREFS;
    } catch {
      return DEFAULT_NOTIF_PREFS;
    }
  });

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [loadingCount, setLoadingCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isRtl = isRtlLanguage(language);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    localStorage.setItem('rainbow_language', language);
  }, [language, isRtl]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('rainbow_theme', theme);
  }, [theme]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    if (TRANSLATIONS[lang]) {
      setLanguageState(lang);
    }
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setAutoplay = useCallback((val: boolean) => {
    setAutoplayState(val);
    localStorage.setItem('rainbow_autoplay', String(val));
  }, []);

  const setShortsAutoplay = useCallback((val: boolean) => {
    setShortsAutoplayState(val);
    localStorage.setItem('rainbow_shorts_autoplay', String(val));
  }, []);

  const setDataSaver = useCallback((val: boolean) => {
    setDataSaverState(val);
    localStorage.setItem('rainbow_data_saver', String(val));
  }, []);

  const setNotificationPrefs = useCallback((prefs: NotificationPrefs) => {
    setNotificationPrefsState(prefs);
    localStorage.setItem('rainbow_notif_prefs', JSON.stringify(prefs));
  }, []);

  const startLoading = useCallback((progress?: number) => {
    setLoadingCount((c) => c + 1);
    if (typeof progress === 'number') {
      setLoadingProgress(progress);
    }
  }, []);

  const setLoadingProgressValue = useCallback((progress: number | null) => {
    setLoadingProgress(progress);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((c) => Math.max(0, c - 1));
    setLoadingProgress(null);
  }, []);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        isRtl,
        t,
        theme,
        setTheme,
        toggleTheme,
        autoplay,
        setAutoplay,
        shortsAutoplay,
        setShortsAutoplay,
        dataSaver,
        setDataSaver,
        notificationPrefs,
        setNotificationPrefs,
        isOnline,
        loadingCount,
        loadingProgress,
        startLoading,
        setLoadingProgressValue,
        stopLoading,
        toasts,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
