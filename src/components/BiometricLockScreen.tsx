import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Fingerprint, ShieldCheck, LogOut, Sun, Moon, Globe, Lock, RotateCw } from 'lucide-react';
import ChallanTrackLogo from './ChallanTrackLogo';
import { verifyBiometricCredential } from '../lib/biometrics';
import { triggerHaptic } from '../lib/haptics';
import { Language } from '../lib/translations';
import { usePrefersReducedMotion } from './MotionPrimitives';

interface BiometricLockScreenProps {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  lang: Language;
  onLangChange: (lang: Language) => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark', origin?: { x: number; y: number }) => void;
  onUnlocked: () => void;
  onSignOut: () => void;
}

export default function BiometricLockScreen({
  userId,
  userEmail,
  userName,
  lang,
  onLangChange,
  theme,
  onThemeChange,
  onUnlocked,
  onSignOut,
}: BiometricLockScreenProps) {
  const [verifying, setVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const busyRef = useRef(false);

  const displayName = (userName || userEmail?.split('@')[0] || 'ChallanTrack User').trim();
  const displayInitial = displayName.charAt(0).toUpperCase() || 'C';

  const handleAuthenticate = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    triggerHaptic('single');
    setVerifying(true);
    setErrorMsg(null);

    const res = await verifyBiometricCredential(userId);
    if (res.success) {
      setVerifiedSuccess(true);
      setVerifying(false);
      triggerHaptic('double');
      window.setTimeout(() => {
        onUnlocked();
      }, reducedMotion ? 80 : 280);
    } else {
      busyRef.current = false;
      setVerifying(false);
      triggerHaptic([120, 80, 120]);
      setErrorMsg(
        lang === 'bn'
          ? 'বায়োমেট্রিক যাচাইকরণ বাতিল বা অসম্পূর্ণ হয়েছে। আবার চেষ্টা করুন।'
          : 'Biometric verification was cancelled or did not match. Try again.'
      );
    }
  }, [userId, onUnlocked, lang, reducedMotion]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      handleAuthenticate();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [handleAuthenticate]);

  const statusHeadline = verifiedSuccess
    ? lang === 'bn'
      ? 'যাচাই সম্পন্ন'
      : 'Vault Unlocked'
    : verifying
      ? lang === 'bn'
        ? 'পরিচয় যাচাই চলছে'
        : 'Verifying Identity'
      : errorMsg
        ? lang === 'bn'
          ? 'পুনরায় যাচাই করুন'
          : 'Verification Required'
        : lang === 'bn'
          ? 'খতিয়ান আনলক করুন'
          : 'Unlock Ledger';

  const statusSubtitle = verifiedSuccess
    ? lang === 'bn'
      ? 'আপনার খতিয়ান প্রস্তুত করা হচ্ছে'
      : 'Opening your workspace'
    : verifying
      ? lang === 'bn'
        ? 'ডিভাইস পাসকি বা সেন্সর নিশ্চিত করুন'
        : 'Confirm with Face ID, Touch ID, or passkey'
      : lang === 'bn'
        ? 'নিরাপদ প্রবেশের জন্য বায়োমেট্রিক সেন্সর স্পর্শ করুন'
        : 'Touch sensor or tap below to verify access';

  return (
    <div
      id="biometric_auth_view"
      className="min-h-[100dvh] app-canvas-bg text-slate-900 dark:text-slate-100 flex flex-col justify-between px-5 py-6 sm:p-8 no-select transition-colors relative overflow-hidden"
    >
      <div className="app-ambient-backdrop" aria-hidden="true">
        <div className="app-ambient-grid" />
        <div className="app-ambient-noise" />
      </div>

      {/* Top Utility Row (Desktop & Tablet) */}
      <header className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Lock className="w-3.5 h-3.5 stroke-[1.35]" />
          <span className={lang === 'bn' ? 'text-xs font-bold' : 'micro-mono-label font-semibold'}>
            {lang === 'bn' ? 'সুরক্ষিত খতিয়ান' : 'Protected Ledger'}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              triggerHaptic('single');
              const iconEl = e.currentTarget.querySelector('svg');
              const rect = (iconEl ?? e.currentTarget).getBoundingClientRect();
              onThemeChange(theme === 'dark' ? 'light' : 'dark', {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              });
            }}
            className="touch-press px-3.5 py-2 surface-glass-interactive border rounded-full text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-2 text-xs font-semibold"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 stroke-[1.3]" />
            ) : (
              <Moon className="w-3.5 h-3.5 stroke-[1.3]" />
            )}
            <span>{theme === 'dark' ? (lang === 'bn' ? 'লাইট' : 'Light') : (lang === 'bn' ? 'ডার্ক' : 'Dark')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              onLangChange(lang === 'bn' ? 'en' : 'bn');
            }}
            className="touch-press px-3.5 py-2 surface-glass-interactive border rounded-full font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 stroke-[1.3]" />
            <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
          </button>
        </div>
      </header>

      {/* Center Architectural Vault Stage */}
      <main className="relative z-10 w-full max-w-sm mx-auto flex flex-col items-center text-center my-auto py-8 space-y-8 animate-reveal">
        <ChallanTrackLogo size="lg" variant="compact" />

        {/* Interactive Biometric Ring & Sensor Orb */}
        <div className="relative flex flex-col items-center">
          <div className="relative flex items-center justify-center w-36 h-36">
            {/* Soft Ambient Radial Glow */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-1 rounded-full blur-2xl transition-opacity duration-300 ${
                verifying || verifiedSuccess ? 'opacity-90' : 'opacity-55'
              }`}
              style={{
                background: verifiedSuccess
                  ? 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, transparent 72%)'
                  : 'radial-gradient(circle, var(--accent-glow) 0%, transparent 72%)',
              }}
            />

            {/* Precision Concentric Hairline Ring + Active Scan Sweep (zero dots) */}
            <svg
              aria-hidden="true"
              viewBox="0 0 144 144"
              className={`pointer-events-none absolute inset-0 w-full h-full ${
                verifying && !reducedMotion ? 'animate-spin' : ''
              }`}
              style={verifying && !reducedMotion ? { animationDuration: '1.6s' } : undefined}
            >
              <circle
                cx="72"
                cy="72"
                r="66"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-slate-900/[0.08] dark:text-white/[0.1]"
              />
              {(verifying || verifiedSuccess) && (
                <circle
                  cx="72"
                  cy="72"
                  r="66"
                  fill="none"
                  stroke={verifiedSuccess ? '#10b981' : 'var(--accent-color)'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={verifiedSuccess ? '415 415' : '96 319'}
                  className="transition-all duration-300"
                />
              )}
            </svg>

            <button
              type="button"
              onClick={handleAuthenticate}
              disabled={verifying || verifiedSuccess}
              aria-label={lang === 'bn' ? 'বায়োমেট্রিক দিয়ে আনলক করুন' : 'Authenticate with Biometrics'}
              className={`touch-press relative w-28 h-28 rounded-full border flex items-center justify-center transition-all duration-200 cursor-pointer focus-visible:outline-none ${
                verifiedSuccess
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-500 shadow-lg scale-[1.03]'
                  : verifying
                    ? 'surface-hero-glass text-[var(--accent-color)] scale-[0.98]'
                    : 'surface-hero-glass text-slate-950 dark:text-white hover:scale-[1.02]'
              }`}
            >
              {verifiedSuccess ? (
                <ShieldCheck className="w-11 h-11 stroke-[1.35]" />
              ) : (
                <Fingerprint className="w-11 h-11 stroke-[1.2]" />
              )}
            </button>
          </div>

          <div className="mt-6 space-y-1.5">
            <h1 className="text-2xl sm:text-[26px] font-display font-extrabold text-slate-950 dark:text-white tracking-tight text-balance">
              {statusHeadline}
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 max-w-[260px] mx-auto leading-relaxed">
              {statusSubtitle}
            </p>
          </div>
        </div>

        {/* Clean Unboxed Identity Lockup (Zero indicator dots) */}
        <div className="w-full pt-5 border-t border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center gap-3">
          <div
            aria-hidden="true"
            className="w-9 h-9 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-display font-bold text-sm flex items-center justify-center shrink-0"
          >
            {displayInitial}
          </div>
          <div className="text-left min-w-0">
            <div className="text-sm font-bold text-slate-950 dark:text-white truncate leading-tight">
              {displayName}
            </div>
            {userEmail && (
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {userEmail}
              </div>
            )}
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="w-full px-4 py-3 rounded-2xl bg-ledger-red-subtle border border-ledger-red-subtle text-xs font-semibold text-ledger-red leading-relaxed"
          >
            {errorMsg}
          </div>
        )}
      </main>

      {/* Bottom Thumb-Zone Actions */}
      <footer className="relative z-10 w-full max-w-sm mx-auto space-y-2.5 pb-2">
        <button
          type="button"
          onClick={handleAuthenticate}
          disabled={verifying || verifiedSuccess}
          className="touch-press w-full py-3.5 px-6 rounded-full text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-65 whitespace-nowrap shrink-0"
          style={{
            backgroundColor: verifiedSuccess ? '#10b981' : 'var(--accent-color)',
            boxShadow: '0 14px 32px -10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.28)',
          }}
        >
          {verifiedSuccess ? (
            <>
              <ShieldCheck className="w-4 h-4 stroke-[1.5]" />
              <span>{lang === 'bn' ? 'আনলক হচ্ছে...' : 'Unlocking...'}</span>
            </>
          ) : verifying ? (
            <>
              <RotateCw className={`w-4 h-4 stroke-[1.5] ${reducedMotion ? '' : 'animate-spin'}`} />
              <span>{lang === 'bn' ? 'যাচাই চলছে...' : 'Verifying...'}</span>
            </>
          ) : errorMsg ? (
            <>
              <Fingerprint className="w-4 h-4 stroke-[1.5]" />
              <span>{lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}</span>
            </>
          ) : (
            <>
              <Fingerprint className="w-4 h-4 stroke-[1.5]" />
              <span>{lang === 'bn' ? 'বায়োমেট্রিক দিয়ে খুলুন' : 'Authenticate'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('double');
            onSignOut();
          }}
          className="touch-press w-full py-2.5 text-slate-500 hover:text-ledger-red dark:text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 stroke-[1.3]" />
          <span>{lang === 'bn' ? 'অন্য অ্যাকাউন্ট / লগআউট' : 'Switch Account'}</span>
        </button>
      </footer>
    </div>
  );
}
