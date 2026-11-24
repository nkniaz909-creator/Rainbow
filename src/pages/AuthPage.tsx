import React, { useState } from 'react';
import { Phone, Mail, Lock, User, KeyRound, Calendar, ArrowRight } from 'lucide-react';
import type { ConfirmationResult } from 'firebase/auth';
import { RAINBOW_LOGO_PATH } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { t, showToast } = useApp();
  const {
    signInWithGoogle,
    registerWithEmail,
    loginWithEmail,
    resetPassword,
    sendPhoneOtp,
    confirmPhoneOtp,
  } = useAuth();

  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  const [isRegister, setIsRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthYear, setBirthYear] = useState('');

  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [phoneDisplayName, setPhoneDisplayName] = useState('');
  const [phoneBirthYear, setPhoneBirthYear] = useState('');

  const handleGoogle = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      if (isRegister) {
        const parsedYear = birthYear ? Number(birthYear) : undefined;
        await registerWithEmail({
          email: email.trim(),
          password,
          displayName: displayName.trim() || email.split('@')[0],
          username: username.trim() || email.split('@')[0],
          birthYear: parsedYear,
        });
        showToast(t.verificationSent, 'success');
      } else {
        await loginWithEmail(email.trim(), password);
      }
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg(t.emailPlaceholder);
      return;
    }
    setErrorMsg(null);
    setBusy(true);
    try {
      await resetPassword(email.trim());
      showToast(t.resetPasswordSent, 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const formatted = phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`;
      const conf = await sendPhoneOtp(formatted, 'rainbow-recaptcha-container');
      setConfirmation(conf);
      showToast(t.sendOtp, 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      const parsedYear = phoneBirthYear ? Number(phoneBirthYear) : undefined;
      await confirmPhoneOtp(confirmation, otpCode.trim(), {
        displayName: phoneDisplayName.trim() || undefined,
        birthYear: parsedYear,
      });
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-7rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full p-0.5 rainbow-ring-border mb-3">
            <img
              src={RAINBOW_LOGO_PATH}
              alt="Rainbow"
              className="w-full h-full rounded-full object-cover bg-white"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-xl font-bold font-display">
            {tab === 'email' && isRegister ? t.createAccount : t.welcomeBack}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t.poweredByNk}
          </p>
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full h-11 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium text-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
        >
          <span className="w-4 h-4 rounded-full rainbow-ring-border inline-block shrink-0" />
          <span>{t.googleSignIn}</span>
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          <span className="text-xs text-neutral-400">or</span>
          <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        </div>

        {/* Auth method switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('phone');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'phone'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{t.phoneOtp}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('email');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'email'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{t.emailPassword}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {tab === 'phone' ? (
          !confirmation ? (
            <form onSubmit={handleSendOtp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t.phoneOtp}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute start-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.phoneNumberPlaceholder}
                    className="w-full h-10 ps-9 pe-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t.displayNamePlaceholder}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute start-3 top-3" />
                  <input
                    type="text"
                    value={phoneDisplayName}
                    onChange={(e) => setPhoneDisplayName(e.target.value)}
                    placeholder={t.displayNamePlaceholder}
                    className="w-full h-10 ps-9 pe-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t.birthYearLabel}
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-neutral-400 absolute start-3 top-3" />
                  <input
                    type="number"
                    min={1920}
                    max={new Date().getFullYear()}
                    value={phoneBirthYear}
                    onChange={(e) => setPhoneBirthYear(e.target.value)}
                    placeholder="2000"
                    className="w-full h-10 ps-9 pe-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
                  />
                </div>
              </div>

              <div id="rainbow-recaptcha-container" />

              <button
                type="submit"
                disabled={busy}
                className="w-full h-10 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
              >
                <span>{t.sendOtp}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t.otpCodePlaceholder}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-neutral-400 absolute start-3 top-3" />
                  <input
                    type="text"
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full h-10 ps-9 pe-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm font-mono tracking-widest outline-none focus:border-neutral-400"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full h-10 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {t.verifyOtp}
              </button>
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                className="w-full text-xs text-neutral-500 hover:underline"
              >
                {t.cancelText}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {isRegister && (
              <>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute start-3 top-3" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t.displayNamePlaceholder}
                    className="w-full h-10 ps-9 pe-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
                />
                <div className="relative">
                  <Calendar className="w-4 h-4 text-neutral-400 absolute start-3 top-3" />
                  <input
                    type="number"
                    min={1920}
                    max={new Date().getFullYear()}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder={t.birthYearLabel}
                    className="w-full h-10 ps-9 pe-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute start-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full h-10 ps-9 pe-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute start-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full h-10 ps-9 pe-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
              />
            </div>

            {!isRegister && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                >
                  {t.forgotPassword}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-10 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {isRegister ? t.registerBtn : t.loginBtn}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegister((v) => !v);
                setErrorMsg(null);
              }}
              className="w-full text-xs text-neutral-600 dark:text-neutral-400 hover:underline pt-1"
            >
              {isRegister ? t.switchToLogin : t.switchToRegister}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
