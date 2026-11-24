import React, { useState, useEffect } from 'react';
import {
  Globe,
  Sun,
  Moon,
  Play,
  Bell,
  Lock,
  Shield,
  History,
  Download,
  HelpCircle,
  Info,
  FileText,
  LogOut,
  User,
} from 'lucide-react';
import { RAINBOW_LOGO_PATH, type LanguageCode, type UserProfile, type VideoItem } from '../types';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  updatePrivateSettings,
  updateUserProfileData,
  fetchBlockedUsers,
  toggleBlockUser,
  fetchSearchHistory,
  clearSearchHistory,
  fetchWatchHistory,
  clearWatchHistory,
  submitSupportTicket,
} from '../services/firestoreService';
import { PWAInstallButton } from '../components/PWAInstallButton';

type SettingsSection =
  | 'account'
  | 'language'
  | 'appearance'
  | 'playback'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'history'
  | 'support'
  | 'about'
  | 'legal';

interface SettingsPageProps {
  onSignOutSuccess: () => void;
  onSignInClick: () => void;
  onWatch: (videoId: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onSignOutSuccess,
  onSignInClick,
  onWatch,
}) => {
  const {
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    autoplay,
    setAutoplay,
    shortsAutoplay,
    setShortsAutoplay,
    dataSaver,
    setDataSaver,
    notificationPrefs,
    setNotificationPrefs,
    showToast,
  } = useApp();
  const {
    firebaseUser,
    profile,
    privateSettings,
    resendVerificationEmail,
    resetPassword,
    logout,
  } = useAuth();

  const [section, setSection] = useState<SettingsSection>('language');
  const [blockedList, setBlockedList] = useState<UserProfile[]>([]);
  const [searchHist, setSearchHist] = useState<{ id: string; query: string }[]>([]);
  const [watchHist, setWatchHist] = useState<VideoItem[]>([]);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMsg, setSupportMsg] = useState('');
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'community' | 'copyright'>('terms');

  useEffect(() => {
    if (!firebaseUser) return;
    if (section === 'privacy') {
      fetchBlockedUsers(firebaseUser.uid).then(setBlockedList);
    } else if (section === 'history') {
      fetchSearchHistory(firebaseUser.uid).then(setSearchHist);
      fetchWatchHistory(firebaseUser.uid).then(setWatchHist);
    }
  }, [section, firebaseUser]);

  const handleLanguageChange = async (code: LanguageCode) => {
    setLanguage(code);
    if (firebaseUser) {
      await updatePrivateSettings(firebaseUser.uid, { language: code });
    }
  };

  const handleThemeChange = async (next: 'light' | 'dark') => {
    setTheme(next);
    if (firebaseUser) {
      await updatePrivateSettings(firebaseUser.uid, { theme: next });
    }
  };

  const handleExportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'Rainbow (Powered by NK)',
      profile,
      settings: privateSettings,
      searchHistory: searchHist,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rainbow-data-${profile?.username || 'account'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'account', label: t.accountSettings, icon: User },
    { id: 'language', label: t.languageSettings, icon: Globe },
    { id: 'appearance', label: t.appearanceSettings, icon: theme === 'dark' ? Moon : Sun },
    { id: 'playback', label: t.playbackSettings, icon: Play },
    { id: 'notifications', label: t.notificationSettings, icon: Bell },
    { id: 'privacy', label: t.privacySettings, icon: Lock },
    { id: 'security', label: t.securitySettings, icon: Shield },
    { id: 'history', label: t.dataControls, icon: History },
    { id: 'support', label: t.helpAndSupport, icon: HelpCircle },
    { id: 'about', label: t.aboutRainbow, icon: Info },
    { id: 'legal', label: t.termsOfService, icon: FileText },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold font-display mb-6">{t.settings}</h1>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Settings Sidebar */}
        <div className="md:col-span-4 lg:col-span-3 space-y-1">
          {sections.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings Panel */}
        <div className="md:col-span-8 lg:col-span-9 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-6">
          {section === 'account' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t.accountSettings}</h2>
              {!firebaseUser ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-500">{t.signInToContinue}</p>
                  <button
                    type="button"
                    onClick={onSignInClick}
                    className="px-4 py-2 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                  >
                    {t.signIn}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      <p className="text-xs text-neutral-500">{t.displayNamePlaceholder}</p>
                      <p className="font-semibold mt-0.5">{profile?.displayName}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      <p className="text-xs text-neutral-500">{t.usernamePlaceholder}</p>
                      <p className="font-semibold mt-0.5">@{profile?.username}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      <p className="text-xs text-neutral-500">{t.emailPassword}</p>
                      <p className="font-semibold mt-0.5">{firebaseUser.email || '—'}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      <p className="text-xs text-neutral-500">{t.phoneOtp}</p>
                      <p className="font-semibold mt-0.5">{firebaseUser.phoneNumber || '—'}</p>
                    </div>
                  </div>

                  {firebaseUser.email && !firebaseUser.emailVerified && (
                    <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-3">
                      <span className="text-xs">{t.verifyEmailNotice}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await resendVerificationEmail();
                          showToast(t.verificationSent, 'success');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold shrink-0"
                      >
                        {t.resendVerification}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {section === 'language' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t.languageSettings}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const active = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`p-3 rounded-xl border text-start transition-colors ${
                        active
                          ? 'border-neutral-950 dark:border-white bg-neutral-950 dark:bg-white text-white dark:text-neutral-950'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <p className="text-sm font-semibold">{lang.nativeName}</p>
                      <p
                        className={`text-xs ${
                          active ? 'opacity-80' : 'text-neutral-500'
                        }`}
                      >
                        {lang.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t.appearanceSettings}</h2>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-4 rounded-xl border flex items-center gap-3 ${
                    theme === 'light'
                      ? 'border-neutral-950 bg-neutral-100 dark:bg-neutral-800 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                  <span className="text-sm">{t.lightMode}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-4 rounded-xl border flex items-center gap-3 ${
                    theme === 'dark'
                      ? 'border-white bg-neutral-800 text-white font-semibold'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                  <span className="text-sm">{t.darkMode}</span>
                </button>
              </div>
            </div>
          )}

          {section === 'playback' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t.playbackSettings}</h2>
              <div className="space-y-3">
                {[
                  {
                    label: t.autoplayNext,
                    checked: autoplay,
                    onChange: async (v: boolean) => {
                      setAutoplay(v);
                      if (firebaseUser) await updatePrivateSettings(firebaseUser.uid, { autoplay: v });
                    },
                  },
                  {
                    label: t.shortsAutoplay,
                    checked: shortsAutoplay,
                    onChange: async (v: boolean) => {
                      setShortsAutoplay(v);
                      if (firebaseUser)
                        await updatePrivateSettings(firebaseUser.uid, { shortsAutoplay: v });
                    },
                  },
                  {
                    label: t.dataSaver,
                    checked: dataSaver,
                    onChange: async (v: boolean) => {
                      setDataSaver(v);
                      if (firebaseUser) await updatePrivateSettings(firebaseUser.uid, { dataSaver: v });
                    },
                  },
                ].map((row) => (
                  <label
                    key={row.label}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                  >
                    <span className="text-sm font-medium">{row.label}</span>
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) => row.onChange(e.target.checked)}
                      className="w-4 h-4 accent-neutral-950 dark:accent-white"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t.notificationSettings}</h2>
              <div className="space-y-3">
                {(
                  [
                    { key: 'followers', label: t.followers },
                    { key: 'likes', label: t.like },
                    { key: 'comments', label: t.comments },
                    { key: 'replies', label: t.reply },
                    { key: 'uploads', label: t.videos },
                    { key: 'system', label: t.announcements },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs[item.key]}
                      onChange={async (e) => {
                        const updated = { ...notificationPrefs, [item.key]: e.target.checked };
                        setNotificationPrefs(updated);
                        if (firebaseUser) {
                          await updatePrivateSettings(firebaseUser.uid, {
                            notificationPrefs: updated,
                          });
                        }
                      }}
                      className="w-4 h-4 accent-neutral-950 dark:accent-white"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {section === 'privacy' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">{t.privacySettings}</h2>
              {profile && firebaseUser && (
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                    <span className="text-sm font-medium">{t.privateAccount}</span>
                    <input
                      type="checkbox"
                      checked={profile.isPrivate}
                      onChange={(e) =>
                        updateUserProfileData(firebaseUser.uid, { isPrivate: e.target.checked })
                      }
                      className="w-4 h-4 accent-neutral-950 dark:accent-white"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                    <span className="text-sm font-medium">{t.savedPublicly}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(profile.showSavedPublicly)}
                      onChange={(e) =>
                        updateUserProfileData(firebaseUser.uid, {
                          showSavedPublicly: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-neutral-950 dark:accent-white"
                    />
                  </label>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold mb-2.5">{t.blockedAccounts}</h3>
                {blockedList.length === 0 ? (
                  <p className="text-xs text-neutral-500">{t.noResults}</p>
                ) : (
                  <div className="space-y-2">
                    {blockedList.map((u) => (
                      <div
                        key={u.uid}
                        className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800"
                      >
                        <span className="text-sm font-medium">{u.displayName}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!firebaseUser) return;
                            await toggleBlockUser(firebaseUser.uid, u.uid);
                            setBlockedList((prev) => prev.filter((item) => item.uid !== u.uid));
                          }}
                          className="text-xs font-semibold px-3 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700"
                        >
                          {t.unblockUser}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'security' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t.securitySettings}</h2>
              {firebaseUser ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs space-y-1">
                    <p>
                      <span className="text-neutral-500">UID:</span>{' '}
                      <span className="font-mono">{firebaseUser.uid}</span>
                    </p>
                    <p>
                      <span className="text-neutral-500">Providers:</span>{' '}
                      {firebaseUser.providerData.map((p) => p.providerId).join(', ') || 'phone'}
                    </p>
                    <p>
                      <span className="text-neutral-500">Last sign-in:</span>{' '}
                      {firebaseUser.metadata.lastSignInTime}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {firebaseUser.email && (
                      <button
                        type="button"
                        onClick={async () => {
                          await resetPassword(firebaseUser.email!);
                          showToast(t.resetPasswordSent, 'success');
                        }}
                        className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
                      >
                        {t.forgotPassword}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        onSignOutSuccess();
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t.signOut}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">{t.signInToContinue}</p>
              )}
            </div>
          )}

          {section === 'history' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">{t.dataControls}</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleExportData}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.exportMyData}</span>
                </button>
                {firebaseUser && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await clearSearchHistory(firebaseUser.uid);
                        localStorage.removeItem('rainbow_search_history');
                        setSearchHist([]);
                        showToast(t.clearHistory, 'info');
                      }}
                      className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
                    >
                      {t.clearHistory} ({t.searchHistorySetting})
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await clearWatchHistory(firebaseUser.uid);
                        setWatchHist([]);
                        showToast(t.clearHistory, 'info');
                      }}
                      className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
                    >
                      {t.clearHistory} ({t.viewingHistorySetting})
                    </button>
                  </>
                )}
              </div>

              {watchHist.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-2">{t.viewingHistorySetting}</h3>
                  <div className="space-y-2">
                    {watchHist.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onWatch(v.id)}
                        className="w-full text-start p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        {v.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'support' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t.helpAndSupport}</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!firebaseUser) {
                    onSignInClick();
                    return;
                  }
                  await submitSupportTicket(firebaseUser.uid, supportSubject, supportMsg);
                  setSupportSubject('');
                  setSupportMsg('');
                  showToast(t.reportSubmitted, 'success');
                }}
                className="space-y-3 max-w-lg"
              >
                <input
                  type="text"
                  required
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm"
                />
                <textarea
                  rows={4}
                  required
                  value={supportMsg}
                  onChange={(e) => setSupportMsg(e.target.value)}
                  placeholder={t.descriptionLabel}
                  className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm resize-none"
                />
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                >
                  {t.sendMessage}
                </button>
              </form>
            </div>
          )}

          {section === 'about' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">{t.aboutRainbow}</h2>
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col items-center text-center space-y-3">
                <div className="w-20 h-20 rounded-full p-1 rainbow-ring-border">
                  <img
                    src={RAINBOW_LOGO_PATH}
                    alt="Rainbow"
                    className="w-full h-full rounded-full object-cover bg-white"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold font-display">{t.appName}</h3>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {t.poweredByNk}
                  </p>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 pt-2">
                    {t.founderLabel}: {t.founderName}
                  </p>
                  <p className="text-xs font-semibold tracking-wider text-neutral-500 pt-2">
                    {t.fromNk}
                  </p>
                </div>
                <div className="pt-2 w-full max-w-xs">
                  <PWAInstallButton />
                </div>
              </div>
            </div>
          )}

          {section === 'legal' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 w-fit">
                {(
                  [
                    { id: 'terms', label: t.termsOfService },
                    { id: 'privacy', label: t.privacyPolicy },
                    { id: 'community', label: t.communityGuidelines },
                    { id: 'copyright', label: t.copyrightPolicy },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLegalTab(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      legalTab === item.id
                        ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-sm text-neutral-700 dark:text-neutral-300 space-y-3 leading-relaxed">
                {legalTab === 'terms' && (
                  <>
                    <h3 className="font-bold text-base">{t.termsOfService}</h3>
                    <p>
                      Welcome to Rainbow, operated by NK. By accessing or using Rainbow, you agree
                      to upload only content you own or are licensed to share, respect other
                      community members, and comply with applicable laws.
                    </p>
                    <p>
                      NK reserves the right to restrict or remove content or accounts that violate
                      these terms or our Community Guidelines.
                    </p>
                  </>
                )}
                {legalTab === 'privacy' && (
                  <>
                    <h3 className="font-bold text-base">{t.privacyPolicy}</h3>
                    <p>
                      Rainbow isolates personally identifiable information (email, phone number,
                      birth year, and private preferences) in protected user records accessible only
                      to the account owner and authorized moderators.
                    </p>
                    <p>
                      You can export your account data or clear your search and watch history at any
                      time from Settings.
                    </p>
                  </>
                )}
                {legalTab === 'community' && (
                  <>
                    <h3 className="font-bold text-base">{t.communityGuidelines}</h3>
                    <p>
                      Rainbow prohibits harassment, hate speech, non-consensual content, spam,
                      dangerous activities, and child endangerment. Accounts under 18 are protected
                      with mutual-follower-only direct messaging restrictions.
                    </p>
                  </>
                )}
                {legalTab === 'copyright' && (
                  <>
                    <h3 className="font-bold text-base">{t.copyrightPolicy}</h3>
                    <p>
                      Creators must hold the rights to videos, audio, and images uploaded to
                      Rainbow. Verified copyright reports are reviewed by Rainbow Moderation and
                      infringing material is promptly removed.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
