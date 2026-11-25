import React, { useState, useEffect } from 'react';
import { Customer, UserSettings, ImportProgress, Transaction, UserTagConfig } from '../types';
import { 
  Moon, Sun, Cloud, Download, Upload, LogOut, CheckCircle2, Languages, AlertTriangle, X, RotateCcw, Trash2, Contrast, Clock, RefreshCw, Palette, Check, Pipette, Fingerprint, Archive, Lock, FileSpreadsheet, Sliders, Minus, Plus, Keyboard, Vibrate, MoveHorizontal, Volume2, Search, SquarePen, Bell, CircleDotDashed, ChartPie, Grid2X2, Gauge, ChevronRight
} from 'lucide-react';
import { isPhoneticSearchEnabled, setPhoneticSearchEnabled } from '../lib/phonetics';
import {
  PRESET_ACCENTS,
  getSavedAccentColor,
  applyAccentColor,
  THEME_PALETTES,
  getSavedThemePalette,
  getSavedThemeIntensity,
  applyThemePalette,
  BACKGROUND_TEXTURES,
  BackgroundTextureId,
  getSavedBackgroundTexture,
  getSavedBackgroundTextureIntensity,
  getSavedBackgroundTextureSegments,
  applyBackgroundTexture
} from '../lib/accentTheme';
import { isBiometricEnabled, registerBiometricCredential, setBiometricEnabledState } from '../lib/biometrics';
import { isKeypadSoundEnabled, setKeypadSoundEnabled, playKeypadClick } from '../lib/sounds';
import { auth } from '../firebase';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { translations, formatNumber, Language } from '../lib/translations';
import { triggerHaptic, isIOSDevice, isHapticsEnabled } from '../lib/haptics';
import { showNotification } from '../lib/notifications';
import { isCustomKeypadEnabled, setCustomKeypadEnabledState } from './CalculatorKeypad';
import ScrollSafeSlider from './ScrollSafeSlider';
import { SpotlightCard, CircularGauge, areTransitionsDisabled, setTransitionsDisabled } from './MotionPrimitives';
import ModalPortal, { useModalScrollLock } from './ModalPortal';
import ManageTagsModal from './ManageTagsModal';
import { DEFAULT_TAG_CONFIG, TAG_LIMITS, getTagCounts, useTagConfig } from '../lib/tagSystem';

interface SettingsManagerProps {
  theme: 'light' | 'dark';
  trashCustomers: Customer[];
  restoreCustomer: (customerId: string) => Promise<void>;
  permanentlyDeleteCustomer: (customerId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  swipeGesturesEnabled: boolean;
  onSwipeGesturesToggle: (val: boolean) => void;
  settings: UserSettings | null;
  updateTheme: (theme: 'light' | 'dark', origin?: { x: number; y: number }) => Promise<void>;
  customers: Customer[];
  exportBackup: () => Promise<any>;
  rebuildMonthlySummaries?: () => Promise<void>;
  onSignOut: () => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  deferredPrompt: any;
  onInstallComplete: () => void;
  importLedgerData: (backupData: any, choice: 'merge' | 'clear' | 'skip', onProgress?: (progress: ImportProgress) => void) => Promise<void>;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userPhotoURL?: string | null;
  archivedStatements?: Transaction[];
  updateStatementAutoMerge?: (enabled: boolean, keepCount: number, onProgress?: (p: any) => void) => Promise<number>;
  onUpdateStatementAutoMerge?: (enabled: boolean, keepCount: number, onProgress?: (p: any) => void) => Promise<number>;
  exportArchivedStatements?: () => Promise<any[]>;
  onExportArchivedStatements?: () => Promise<any[]>;
  onLockBiometricSession?: () => void;
  onUpdateDisplayName?: (newName: string) => Promise<void> | void;
  showDashboardReminders?: boolean;
  onToggleDashboardReminders?: (val: boolean) => void;
  showTagChart?: boolean;
  onToggleTagChart?: (val: boolean) => void;
  tagConfig?: UserTagConfig;
  saveTagConfig?: (nextConfig: UserTagConfig) => Promise<void>;
}

const SettingsManager = React.memo(function SettingsManager({
  theme,
  trashCustomers,
  restoreCustomer,
  permanentlyDeleteCustomer,
  emptyTrash,
  swipeGesturesEnabled,
  onSwipeGesturesToggle,
  settings,
  updateTheme,
  customers,
  exportBackup,
  onSignOut,
  lang,
  onLangChange,
  deferredPrompt,
  onInstallComplete,
  importLedgerData,
  userId,
  userEmail,
  userName,
  userPhotoURL,
  archivedStatements = [],
  updateStatementAutoMerge,
  onUpdateStatementAutoMerge,
  exportArchivedStatements,
  onExportArchivedStatements,
  onLockBiometricSession,
  onUpdateDisplayName,
  showDashboardReminders = true,
  onToggleDashboardReminders,
  showTagChart = true,
  onToggleTagChart,
  tagConfig,
  saveTagConfig
}: SettingsManagerProps) {
  const resolvedUpdateAutoMerge = updateStatementAutoMerge || onUpdateStatementAutoMerge;
  const resolvedExportArchived = exportArchivedStatements || onExportArchivedStatements;
  const t = translations[lang];
  const storeTagConfig = useTagConfig();
  const effectiveTagConfig = tagConfig || storeTagConfig || DEFAULT_TAG_CONFIG;
  const [showManageTagsModal, setShowManageTagsModal] = useState(false);
  const [deferredReady, setDeferredReady] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768 || areTransitionsDisabled();
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (deferredReady) return;
    let timerId: number | null = null;
    const rafId = window.requestAnimationFrame(() => {
      timerId = window.setTimeout(() => {
        React.startTransition(() => {
          setDeferredReady(true);
        });
      }, 500);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [deferredReady]);
  const [profileImgError, setProfileImgError] = useState(false);
  const resolvedPhotoURL =
    userPhotoURL ||
    auth.currentUser?.photoURL ||
    auth.currentUser?.providerData?.find((p) => p?.photoURL)?.photoURL ||
    null;

  useEffect(() => {
    setProfileImgError(false);
  }, [resolvedPhotoURL]);

  const effectiveDisplayName =
    (userName || auth.currentUser?.displayName || '').trim() ||
    (userId === 'local-guest-session'
      ? (lang === 'bn' ? 'গেস্ট অ্যাকাউন্ট' : 'Guest')
      : (lang === 'bn' ? 'ব্যবহারকারী' : 'User'));

  const resolvedAccountEmail =
    userEmail || settings?.email || (userId === 'local-guest-session' ? 'guest@challantrack.local' : '');

  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const openEditNameModal = () => {
    triggerHaptic('single');
    setEditNameInput(effectiveDisplayName);
    setShowEditNameModal(true);
  };

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editNameInput.trim();
    if (!trimmed) {
      toast.error(lang === 'bn' ? 'দয়া করে একটি বৈধ নাম লিখুন' : 'Please enter a valid name');
      return;
    }
    if (savingDisplayName) return;
    setSavingDisplayName(true);
    try {
      await onUpdateDisplayName?.(trimmed);
      triggerHaptic('double');
      setShowEditNameModal(false);
      toast.success(
        lang === 'bn'
          ? 'অ্যাকাউন্টের নাম আপডেট হয়েছে'
          : 'Account name updated'
      );
    } catch {
      toast.error(
        lang === 'bn'
          ? 'নাম আপডেট করতে সমস্যা হয়েছে'
          : 'Failed to update account name'
      );
    } finally {
      setSavingDisplayName(false);
    }
  };

  const [hapticsOn, setHapticsOn] = useState(() => isHapticsEnabled());
  const [customKeypadOn, setCustomKeypadOn] = useState(() => isCustomKeypadEnabled());
  const [keypadSoundOn, setKeypadSoundOn] = useState(() => isKeypadSoundEnabled());
  const [searchBanglaInEnglish, setSearchBanglaInEnglish] = useState(() => isPhoneticSearchEnabled());
  const [confirmAction, setConfirmAction] = useState<any>(null);
  const [biometricOn, setBiometricOn] = useState(() => isBiometricEnabled(settings?.uid));
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    const handleToggle = (e: any) => {
      if (e.detail?.enabled !== undefined) {
        setSearchBanglaInEnglish(e.detail.enabled);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'search_bangla_in_english' || !e.key) {
        setSearchBanglaInEnglish(isPhoneticSearchEnabled());
      }
    };
    window.addEventListener('phonetic-search-toggle', handleToggle);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('phonetic-search-toggle', handleToggle);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggleSearchBanglaInEnglish = () => {
    triggerHaptic('single');
    const nextVal = !searchBanglaInEnglish;
    setSearchBanglaInEnglish(nextVal);
    setPhoneticSearchEnabled(nextVal);
  };

  // Auto-Merge Ledger Statements state
  const snapToMultipleOfFive = (raw: number | string | undefined, fallback = 15) => {
    const num = typeof raw === 'number' ? raw : parseInt(String(raw || ''), 10);
    const base = !isNaN(num) && num > 0 ? num : fallback;
    return Math.max(5, Math.min(500, Math.round(base / 5) * 5));
  };
  const [showAutoMergeWarning, setShowAutoMergeWarning] = useState(false);
  const [keepCountInput, setKeepCountInput] = useState<string>(() =>
    String(snapToMultipleOfFive(settings?.statementKeepCount, 15))
  );
  const [archivingBusy, setArchivingBusy] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState<{
    percent: number;
    current: number;
    total: number;
    customerName?: string;
    archivedSoFar: number;
    message: string;
  } | null>(null);
  const [archiveElapsedSeconds, setArchiveElapsedSeconds] = useState(0);
  const [exportingArchive, setExportingArchive] = useState(false);

  useEffect(() => {
    const nextBio = isBiometricEnabled(settings?.uid);
    setBiometricOn((prev) => (prev === nextBio ? prev : nextBio));
    if (settings?.statementKeepCount) {
      const nextKeep = String(snapToMultipleOfFive(settings.statementKeepCount, 15));
      setKeepCountInput((prev) => (prev === nextKeep ? prev : nextKeep));
    }
  }, [settings?.uid, settings?.statementKeepCount]);

  useEffect(() => {
    let timer: any;
    if (archivingBusy) {
      setArchiveElapsedSeconds(0);
      timer = setInterval(() => {
        setArchiveElapsedSeconds(s => s + 1);
      }, 1000);
    } else {
      setArchiveElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [archivingBusy]);

  const openConfirmAction = (action: any) => {
    setConfirmAction(action);
    window.history.pushState({ ...window.history.state, modal: 'settingsConfirmAction' }, '');
  };

  const closeConfirmAction = () => {
    setConfirmAction(null);
    if (window.history.state?.modal === 'settingsConfirmAction') {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (confirmAction && window.history.state?.modal !== 'settingsConfirmAction') {
        setConfirmAction(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [confirmAction]);

  const [hapticIntensity, setHapticIntensity] = useState(() => 
    parseInt(localStorage.getItem('haptic_intensity') || '3')
  );

  const [importState, setImportState] = useState<{
    showModal: boolean;
    backupData: any;
    choice: 'merge' | 'clear' | 'skip';
    confirmText: string;
    loading: boolean;
  }>({
    showModal: false,
    backupData: null,
    choice: 'merge',
    confirmText: '',
    loading: false
  });

  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [customAccent, setCustomAccent] = useState(getSavedAccentColor);
  const [currentThemePalette, setCurrentThemePalette] = useState(getSavedThemePalette);
  const [surfaceIntensity, setSurfaceIntensity] = useState<number>(getSavedThemeIntensity);
  const [bgTexture, setBgTexture] = useState<BackgroundTextureId>(getSavedBackgroundTexture);
  const [bgTextureIntensity, setBgTextureIntensity] = useState<number>(getSavedBackgroundTextureIntensity);
  const [bgTextureSegments, setBgTextureSegments] = useState<number>(getSavedBackgroundTextureSegments);
  const [transitionsOff, setTransitionsOff] = useState<boolean>(() => areTransitionsDisabled());

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.hex) setCustomAccent(e.detail.hex);
    };
    const themeHandler = (e: any) => {
      if (e.detail?.paletteId) setCurrentThemePalette(e.detail.paletteId);
      if (e.detail?.intensity !== undefined) setSurfaceIntensity(e.detail.intensity);
    };
    const bgTexHandler = (e: any) => {
      if (e.detail?.texture) setBgTexture(e.detail.texture);
      if (e.detail?.intensity !== undefined) setBgTextureIntensity(e.detail.intensity);
      if (e.detail?.segments !== undefined) setBgTextureSegments(e.detail.segments);
    };
    const transitionsHandler = (e: any) => {
      if (e.detail?.disabled !== undefined) setTransitionsOff(Boolean(e.detail.disabled));
    };
    window.addEventListener('accent-color-changed', handler);
    window.addEventListener('theme-palette-changed', themeHandler);
    window.addEventListener('background-texture-changed', bgTexHandler);
    window.addEventListener('transitions-toggle-changed', transitionsHandler);
    return () => {
      window.removeEventListener('accent-color-changed', handler);
      window.removeEventListener('theme-palette-changed', themeHandler);
      window.removeEventListener('background-texture-changed', bgTexHandler);
      window.removeEventListener('transitions-toggle-changed', transitionsHandler);
    };
  }, []);

  useEffect(() => {
    let timer: any;
    if (importState.loading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [importState.loading]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    triggerHaptic('single');
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || !Array.isArray(json.customers) || !Array.isArray(json.ledgerTransactions)) {
          toast.error(lang === 'bn' ? 'অকার্যকর ব্যাকআপ ফাইল!' : 'Invalid backup file structure!');
          return;
        }
        setImportState({
          showModal: true,
          backupData: json,
          choice: 'merge',
          confirmText: '',
          loading: false
        });
        triggerHaptic('single');
      } catch (err) {
        toast.error(lang === 'bn' ? 'ফাইলটি পড়তে সমস্যা হয়েছে!' : 'Failed to parse JSON file!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Scroll lock when modal is active
  useModalScrollLock(Boolean(confirmAction || importState.showModal || showAutoMergeWarning || showEditNameModal));

  useEffect(() => {
    if (!confirmAction && !importState.showModal && !showAutoMergeWarning && !showEditNameModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showEditNameModal && !savingDisplayName) {
        setShowEditNameModal(false);
      } else if (confirmAction) {
        closeConfirmAction();
      } else if (importState.showModal && !importState.loading) {
        setImportState(prev => ({ ...prev, showModal: false }));
      } else if (showAutoMergeWarning && !archivingBusy) {
        setShowAutoMergeWarning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmAction, importState.showModal, importState.loading, showAutoMergeWarning, archivingBusy, showEditNameModal, savingDisplayName]);

  const handleToggleBiometric = async () => {
    if (biometricBusy) return;
    triggerHaptic('single');
    const uid = userId || auth.currentUser?.uid || settings?.uid || 'local-guest-session';
    const uName = userName || auth.currentUser?.displayName || settings?.email || 'ChallanTrack Owner';

    if (biometricOn) {
      setBiometricEnabledState(false, uid);
      setBiometricOn(false);
      toast.success(
        lang === 'bn'
          ? 'বায়োমেট্রিক লগইন বন্ধ করা হয়েছে'
          : 'Biometric authentication disabled'
      );
      return;
    }

    setBiometricBusy(true);
    try {
      const res = await registerBiometricCredential(uid, uName);
      if (res.success) {
        setBiometricOn(true);
        triggerHaptic('double');
        toast.success(
          lang === 'bn'
            ? 'বায়োমেট্রিক লগইন সফলভাবে চালু হয়েছে!'
            : 'Biometric authentication enabled!'
        );
      } else {
        toast.error(
          lang === 'bn'
            ? 'বায়োমেট্রিক নিবন্ধন বাতিল করা হয়েছে'
            : 'Biometric registration was cancelled'
        );
      }
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleDownloadArchivedRecords = async (format: 'json' | 'csv') => {
    if (!resolvedExportArchived) return;
    setExportingArchive(true);
    triggerHaptic('single');
    try {
      const records = await resolvedExportArchived();
      if (!records || records.length === 0) {
        toast.error(
          lang === 'bn'
            ? 'আর্কাইভে কোনো পুরনো লেনদেন নেই'
            : 'No archived transactions found to download'
        );
        return;
      }

      const dateStamp = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        const payload = {
          archiveExportTimestamp: new Date().toISOString(),
          readOnlyNotice: 'Archived statement records from ChallanTrack (disconnected from live ledger)',
          totalArchivedRecords: records.length,
          records
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ChallanTrack_Archived_Statements_${dateStamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const headers = ['Date', 'Customer Name', 'Type', 'Amount (BDT)', 'Description'];
        const rows = records.map((r: any) => [
          new Date(r.date).toISOString(),
          `"${String(r.customerName || '').replace(/"/g, '""')}"`,
          r.type,
          r.amount,
          `"${String(r.description || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ChallanTrack_Archived_Statements_${dateStamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      triggerHaptic('double');
      toast.success(
        lang === 'bn'
          ? 'আর্কাইভকৃত লেনদেন সফলভাবে ডাউনলোড হয়েছে'
          : 'Archived transaction records downloaded'
      );
    } catch (err) {
      console.warn('Archive export failed:', err);
      toast.error(lang === 'bn' ? 'ডাউনলোড ব্যর্থ হয়েছে' : 'Failed to download archive');
    } finally {
      setExportingArchive(false);
    }
  };

  const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem('install_card_dismissed') === 'true');
  const [isInstallingApp, setIsInstallingApp] = useState(false);
  const [isAppInstalledNow, setIsAppInstalledNow] = useState(false);
  const isStandalone = isAppInstalledNow || (typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as any).standalone === true
  ));

  useEffect(() => {
    const onInstalled = () => {
      setIsAppInstalledNow(true);
      onInstallComplete();
    };
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('challan-app-installed', onInstalled);
    return () => {
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('challan-app-installed', onInstalled);
    };
  }, [onInstallComplete]);

  const handleInstallAppClick = async () => {
    triggerHaptic('single');
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).__deferredInstallPrompt : null);
    if (promptEvent && typeof promptEvent.prompt === 'function') {
      setIsInstallingApp(true);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        onInstallComplete();
        if (choice?.outcome === 'accepted') {
          setIsAppInstalledNow(true);
          triggerHaptic('double');
          toast.success(
            lang === 'bn'
              ? 'অ্যাপ ইনস্টল শুরু হয়েছে! কিছুক্ষণের মধ্যে হোম স্ক্রিনে অ্যাপ তৈরি হবে।'
              : 'App installation started! Challan Track will appear on your home screen.'
          );
        } else {
          toast.info(
            lang === 'bn'
              ? 'ইনস্টল বাতিল করা হয়েছে। আপনি চাইলে আবার চেষ্টা করতে পারেন।'
              : 'Install cancelled. You can install anytime from Settings or browser menu.'
          );
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
        onInstallComplete();
        toast.info(
          lang === 'bn'
            ? 'ব্রাউজার মেনু (⋮) থেকে "Install app" বা "Add to Home screen" নির্বাচন করুন।'
            : 'Open your browser menu (⋮) and tap "Install app" or "Add to Home screen".'
        );
      } finally {
        setIsInstallingApp(false);
      }
      return;
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    toast.info(
      isIos
        ? (lang === 'bn'
            ? 'Safari-তে নিচের Share বোতামে ট্যাপ করে "Add to Home Screen" নির্বাচন করুন।'
            : 'In Safari, tap Share and choose "Add to Home Screen".')
        : (lang === 'bn'
            ? 'Chrome মেনু (⋮) খুলে "Install app" বা "Add to Home screen" চাপুন।'
            : 'Open your browser menu (⋮) and tap "Install app" or "Add to Home screen".')
    );
  };

  const toggleHaptics = () => {
    const newVal = !hapticsOn;
    setHapticsOn(newVal);
    localStorage.setItem('haptics', String(newVal));
    if (newVal) triggerHaptic('single');
  };

  const changeHapticIntensity = (val: number) => {
    setHapticIntensity(val);
    localStorage.setItem('haptic_intensity', String(val));
    triggerHaptic('single');
  };

  const handleBackupExport = async () => {
    setExporting(true);
    try {
      const backupData = await exportBackup();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileName = `ChallanTrack_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerHaptic('double');
      showNotification(lang === 'bn' ? 'ডাউনলোড সম্পন্ন হয়েছে' : 'Download Complete', {
        body: lang === 'bn' ? `${fileName} ব্যাকআপ ফাইল সফলভাবে ডাউনলোড হয়েছে` : `${fileName} backup downloaded successfully.`,
        icon: '/icon-192.png'
      });
      toast.success(lang === 'bn' ? 'ব্যাকআপ সফলভাবে ডাউনলোড করা হয়েছে' : 'Backup downloaded successfully');
    } catch (e) {
      console.warn("Backup export failed:", e);
      toast.error(lang === 'bn' ? 'ব্যাকআপ তৈরি ব্যর্থ হয়েছে' : 'Backup export failed');
    } finally {
      setExporting(false);
    }
  };

  const activeTheme = theme;

  const sectionEyebrow = lang === 'bn'
    ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 px-1'
    : 'micro-mono-label text-slate-500 dark:text-slate-400 font-semibold px-1';

  return (
    <div className="space-y-6 no-select">
      {/* Open Editorial Header */}
      <div className="px-1 pt-1 flex items-end justify-between gap-4">
        <div>
          <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1' : 'micro-mono-label text-slate-500 dark:text-slate-400 block mb-1'}>
            {lang === 'bn' ? 'সিস্টেম কনফিগারেশন' : 'Workspace & System'}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white leading-tight">
            {lang === 'bn' ? 'সেটিংস ও পছন্দসমূহ' : 'Settings'}
          </h1>
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {formatNumber(customers.length, lang)} · {formatNumber(settings?.transactionsCount || 0, lang)}
          </span>
        </div>
      </div>

      {/* SECTION 0: ACCOUNT PROFILE & LOG OUT */}
      <div>
        <div className="space-y-2">
          <SpotlightCard className="surface-glass border rounded-[26px] p-4 sm:p-5 flex items-center gap-4">
            {resolvedPhotoURL && !profileImgError ? (
              <img
                src={resolvedPhotoURL}
                alt={effectiveDisplayName}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setProfileImgError(true)}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border border-slate-900/10 dark:border-white/15 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-display font-bold text-lg sm:text-xl flex items-center justify-center shrink-0 shadow-xs">
                {effectiveDisplayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div
                className={
                  lang === 'bn'
                    ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 leading-tight'
                    : 'micro-mono-label text-slate-500 dark:text-slate-400 font-semibold leading-tight'
                }
              >
                {lang === 'bn' ? 'অ্যাকাউন্ট মালিক' : 'Owner Account'}
              </div>

              <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950 dark:text-white tracking-tight truncate leading-snug">
                  {effectiveDisplayName}
                </h2>
                <button
                  type="button"
                  onClick={openEditNameModal}
                  aria-label={lang === 'bn' ? 'নাম পরিবর্তন করুন' : 'Edit account name'}
                  title={lang === 'bn' ? 'নাম পরিবর্তন করুন' : 'Edit account name'}
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer touch-press"
                  style={{ color: 'var(--accent-color)' }}
                >
                  <SquarePen className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>

              {resolvedAccountEmail && (
                <div className="mt-0.5 text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                  {resolvedAccountEmail}
                </div>
              )}
            </div>
          </SpotlightCard>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('double');
              onSignOut();
            }}
            className="surface-glass border rounded-[20px] w-full py-2.5 px-5 flex items-center justify-center gap-2 cursor-pointer touch-press hover:bg-rose-500/[0.06] dark:hover:bg-rose-500/[0.09] transition-colors"
          >
            <span className="font-display text-sm font-bold text-ledger-red tracking-tight">
              {lang === 'bn' ? 'লগআউট' : 'Log out'}
            </span>
            <LogOut className="w-4 h-4 stroke-[1.75] text-ledger-red" />
          </button>
        </div>
      </div>

      {/* SECTION 1: APPEARANCE & THEME */}
      <div className="space-y-2.5">
        <div className={sectionEyebrow}>
          {lang === 'bn' ? 'অ্যাপিয়ারেন্স ও থিম' : 'Appearance & Theme'}
        </div>

        <div>
          <SpotlightCard className="surface-glass border rounded-[28px] divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] overflow-hidden">
            {/* Language Switcher */}
            <div className="p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Languages className="w-4 h-4 stroke-[1.25]" />
                  <span>{t.displayLang}</span>
                </h2>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'BN' : 'EN'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('single');
                    onLangChange('en');
                  }}
                  className={`py-3 px-4 rounded-2xl text-center transition-all cursor-pointer touch-press ${
                    lang === 'en'
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 border-2 border-slate-950 dark:border-white font-bold shadow-md'
                      : 'bg-white/45 dark:bg-white/[0.04] hover:bg-white/75 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] font-semibold'
                  }`}
                >
                  <span className="text-sm font-bold block">{t.english}</span>
                  <span className="text-[11px] opacity-65 block mt-0.5">English System</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('single');
                    onLangChange('bn');
                  }}
                  className={`py-3 px-4 rounded-2xl text-center transition-all cursor-pointer touch-press ${
                    lang === 'bn'
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 border-2 border-slate-950 dark:border-white font-bold shadow-md'
                      : 'bg-white/45 dark:bg-white/[0.04] hover:bg-white/75 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] font-semibold'
                  }`}
                >
                  <span className="text-sm font-bold block">{t.bangla}</span>
                  <span className="text-[11px] opacity-65 block mt-0.5">বাংলা সংস্করণ</span>
                </button>
              </div>
            </div>

            {/* Theme Lighting & Surface Palettes */}
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Contrast className="w-4 h-4 stroke-[1.25]" />
                  <span>{t.themeMode}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'bn'
                    ? 'চালান ট্র্যাককে আপনার সুবিধাজনক আলোতে রূপ দিন। কাজের ক্ষেত্র উজ্জ্বল রোদে বা রাতে চোখের সুরক্ষায় আরামদায়ক থিম ব্যবহার করুন।'
                    : 'Tailor Challan Track to the most comforting view. Perfect for outdoor sunny fields or dark indoor offices.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    triggerHaptic('single');
                    const rect = e.currentTarget.getBoundingClientRect();
                    updateTheme('light', { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                  }}
                  className={`py-2.5 px-3 rounded-full flex items-center justify-center gap-2 cursor-pointer transition-all touch-press ${
                    activeTheme === 'light'
                      ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white font-bold shadow-md'
                      : 'bg-white/45 dark:bg-white/[0.04] hover:bg-white/75 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] font-semibold'
                  }`}
                >
                  <Sun className="w-4 h-4 stroke-[1.25]" />
                  <span className="text-xs font-semibold">{t.lightMode}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    triggerHaptic('single');
                    const rect = e.currentTarget.getBoundingClientRect();
                    updateTheme('dark', { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                  }}
                  className={`py-2.5 px-3 rounded-full flex items-center justify-center gap-2 cursor-pointer transition-all touch-press ${
                    activeTheme === 'dark'
                      ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white font-bold shadow-md'
                      : 'bg-white/45 dark:bg-white/[0.04] hover:bg-white/75 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] font-semibold'
                  }`}
                >
                  <Moon className="w-4 h-4 stroke-[1.25]" />
                  <span className="text-xs font-semibold">{t.darkMode}</span>
                </button>
              </div>

              {/* Theme Surface Palette Selector */}
              <div className="pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-3">
                <span className={`block text-slate-500 dark:text-slate-400 font-semibold ${lang === 'bn' ? 'text-[11px] tracking-normal' : 'micro-mono-label'}`}>
                  {lang === 'bn' ? 'থিম কালার প্যালেট নির্বাচন করুন' : 'Choose Theme Surface Palette'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {THEME_PALETTES.map((palette) => {
                    const isSelected = currentThemePalette === palette.id;
                    return (
                      <button
                        key={palette.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('single');
                          setCurrentThemePalette(palette.id);
                          applyThemePalette(palette.id, surfaceIntensity);
                        }}
                        className={`p-3 rounded-2xl flex flex-col gap-1 text-left transition-all cursor-pointer touch-press ${
                          isSelected
                            ? 'border-2 border-slate-950 dark:border-white bg-slate-950/[0.06] dark:bg-white/[0.11] shadow-sm font-bold'
                            : 'border border-slate-900/[0.08] dark:border-white/[0.08] hover:bg-white/70 dark:hover:bg-white/[0.07] bg-white/40 dark:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center -space-x-1">
                            {palette.previewSwatches.map((hex, idx) => (
                              <span
                                key={idx}
                                className="w-4 h-4 rounded-full border border-white/50 dark:border-black/40"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 dark:text-white stroke-[1.5]" />}
                        </div>
                        <span className="text-xs font-semibold truncate text-slate-900 dark:text-white mt-0.5">
                          {lang === 'bn' ? palette.nameBn : palette.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {lang === 'bn' ? palette.descBn : palette.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Minimal Surface Shade Slider */}
                <div className="pt-1.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className={`font-semibold ${lang === 'bn' ? 'text-[11px] tracking-normal' : 'micro-mono-label'}`}>
                      {lang === 'bn' ? 'শেড' : 'Shade'}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums">{formatNumber(surfaceIntensity, lang)}%</span>
                  </div>
                  <ScrollSafeSlider
                    min={0}
                    max={100}
                    step={1}
                    value={surfaceIntensity}
                    ariaLabel={lang === 'bn' ? 'শেড' : 'Shade'}
                    onChange={(val) => {
                      triggerHaptic('tick');
                      setSurfaceIntensity(val);
                      applyThemePalette(currentThemePalette, val);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Background Texture */}
            <div className="p-5 space-y-4">
              <div className="space-y-0.5">
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Grid2X2 className="w-4 h-4 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'ব্যাকগ্রাউন্ড টেক্সচার' : 'Background Texture'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'ব্যাকগ্রাউন্ড প্যাটার্ন, উজ্জ্বলতা ও দূরত্ব আপনার পছন্দমতো সাজান'
                    : 'Choose canvas texture style, brightness, and pattern spacing'}
                </p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {BACKGROUND_TEXTURES.map((tex) => {
                  const isSelected = bgTexture === tex.id;
                  const swatchColor = activeTheme === 'dark' ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.34)';
                  const previewStyle: React.CSSProperties =
                    tex.id === 'dotted'
                      ? { backgroundImage: `radial-gradient(${swatchColor} 1.25px, transparent 1.25px)`, backgroundSize: '8px 8px' }
                      : tex.id === 'grid'
                      ? { backgroundImage: `linear-gradient(to right, ${swatchColor} 1px, transparent 1px), linear-gradient(to bottom, ${swatchColor} 1px, transparent 1px)`, backgroundSize: '10px 10px' }
                      : tex.id === 'cross'
                      ? {
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 3v6M3 6h6' stroke='${activeTheme === 'dark' ? 'rgba(255,255,255,0.48)' : 'rgba(15,23,42,0.4)'}' stroke-width='1.1' stroke-linecap='round'/%3E%3C/svg%3E")`,
                          backgroundSize: '12px 12px',
                        }
                      : tex.id === 'diagonal'
                      ? { backgroundImage: `repeating-linear-gradient(-45deg, ${swatchColor} 0px, ${swatchColor} 1px, transparent 1px, transparent 8px)` }
                      : tex.id === 'diamond'
                      ? {
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath d='M7 0L14 7L7 14L0 7Z' fill='none' stroke='${activeTheme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.32)'}' stroke-width='0.9'/%3E%3C/svg%3E")`,
                          backgroundSize: '14px 14px',
                        }
                      : {};

                  return (
                    <button
                      key={tex.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setBgTexture(tex.id);
                        applyBackgroundTexture(tex.id, bgTextureIntensity, bgTextureSegments);
                      }}
                      className={`p-2 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer touch-press ${
                        isSelected
                          ? 'border-2 border-slate-950 dark:border-white bg-slate-950/[0.06] dark:bg-white/[0.11] shadow-sm font-bold'
                          : 'border border-slate-900/[0.08] dark:border-white/[0.08] hover:bg-white/70 dark:hover:bg-white/[0.07] bg-white/40 dark:bg-white/[0.03]'
                      }`}
                    >
                      <span
                        className="w-full h-8 rounded-xl border border-slate-900/[0.07] dark:border-white/[0.08] bg-white/60 dark:bg-black/25 flex items-center justify-center overflow-hidden"
                        style={previewStyle}
                      >
                        {tex.id === 'none' && (
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </span>
                      <span className="text-[11px] font-semibold truncate max-w-full text-slate-900 dark:text-white">
                        {lang === 'bn' ? tex.nameBn : tex.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {bgTexture !== 'none' && (
                <div className="pt-1 space-y-3">
                  {/* Texture Brightness Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className={`font-semibold ${lang === 'bn' ? 'text-[11px] tracking-normal' : 'micro-mono-label'}`}>
                        {lang === 'bn' ? 'উজ্জ্বলতা' : 'Brightness'}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums">{formatNumber(bgTextureIntensity, lang)}%</span>
                    </div>
                    <ScrollSafeSlider
                      min={0}
                      max={100}
                      step={1}
                      value={bgTextureIntensity}
                      ariaLabel={lang === 'bn' ? 'উজ্জ্বলতা' : 'Brightness'}
                      onChange={(val) => {
                        triggerHaptic('tick');
                        setBgTextureIntensity(val);
                        applyBackgroundTexture(bgTexture, val, bgTextureSegments);
                      }}
                    />
                  </div>

                  {/* Texture Segments / Spacing Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className={`font-semibold ${lang === 'bn' ? 'text-[11px] tracking-normal' : 'micro-mono-label'}`}>
                        {lang === 'bn' ? 'সেগমেন্ট দূরত্ব' : 'Segments Spacing'}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums">{formatNumber(bgTextureSegments, lang)}px</span>
                    </div>
                    <ScrollSafeSlider
                      min={12}
                      max={56}
                      step={2}
                      value={bgTextureSegments}
                      ariaLabel={lang === 'bn' ? 'সেগমেন্ট দূরত্ব' : 'Segments Spacing'}
                      onChange={(val) => {
                        triggerHaptic('tick');
                        setBgTextureSegments(val);
                        applyBackgroundTexture(bgTexture, bgTextureIntensity, val);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Custom Accent Color */}
            <div className="p-5 space-y-3.5">
              <div className="space-y-0.5">
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'কাস্টম অ্যাকসেন্ট কালার' : 'Custom Accent Color'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'অ্যাপের প্রধান হাইলাইট ও গ্রাফের রঙ পছন্দমতো বেছে নিন' : 'Personalize highlights, focus rings, and metric colors'}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_ACCENTS.map((preset) => {
                  const isSelected = customAccent.toLowerCase() === preset.lightHex.toLowerCase() ||
                                     customAccent.toLowerCase() === preset.previewHex.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setCustomAccent(preset.lightHex);
                        applyAccentColor(preset.lightHex);
                      }}
                      className={`px-3 py-2.5 rounded-full flex items-center gap-2 text-left transition-all cursor-pointer touch-press ${
                        isSelected
                          ? 'border-2 border-slate-950 dark:border-white bg-slate-950/[0.06] dark:bg-white/[0.11] shadow-sm font-bold'
                          : 'border border-slate-900/[0.08] dark:border-white/[0.08] hover:bg-white/70 dark:hover:bg-white/[0.07] bg-white/40 dark:bg-white/[0.03]'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/15 dark:border-white/25 shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: preset.previewHex }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[2.2]" />}
                      </span>
                      <span className="text-xs truncate text-slate-900 dark:text-white">
                        {lang === 'bn' ? preset.nameBn : preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'বর্তমান হেক্স:' : 'Active Hex:'}{' '}
                  <strong className="text-slate-950 dark:text-white">{customAccent}</strong>
                </span>
                <label className="relative flex items-center gap-1.5 px-3.5 py-2 bg-white/60 hover:bg-white/85 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] border border-slate-900/[0.08] dark:border-white/[0.1] rounded-full cursor-pointer text-slate-900 dark:text-white font-semibold transition-colors touch-press">
                  <input
                    type="color"
                    value={customAccent}
                    onChange={(e) => {
                      const hex = e.target.value;
                      setCustomAccent(hex);
                      applyAccentColor(hex);
                    }}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <Pipette className="w-3.5 h-3.5 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'রঙের চাকা বা হেক্স' : 'Color Spectrum'}</span>
                </label>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>

      {deferredReady ? (
        <div className="space-y-8 [content-visibility:auto] [contain-intrinsic-size:auto_1400px]">
      {/* SECTION 2: INTERACTION, KEYPAD & SECURITY */}
      <div className="space-y-2.5">
        <div className={sectionEyebrow}>
          {lang === 'bn' ? 'ইন্টার‍্যাকশন ও নিরাপত্তা' : 'Interaction & Security'}
        </div>

        <div>
          <SpotlightCard className="surface-glass border rounded-[28px] divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] overflow-hidden">
            {/* Dashboard Upcoming Reminders Toggle */}
            <div className="p-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'ড্যাশবোর্ডে আসন্ন রিমাইন্ডার' : 'Dashboard Upcoming Reminders'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn'
                    ? 'হোম স্ক্রিনের গ্রিটিং অংশে আসন্ন রিমাইন্ডার দেখান'
                    : 'Show upcoming reminders inside the dashboard greet section'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showDashboardReminders}
                onClick={() => {
                  triggerHaptic('single');
                  onToggleDashboardReminders?.(!showDashboardReminders);
                }}
                className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  showDashboardReminders ? 'bg-slate-950 dark:bg-white' : 'bg-slate-900/15 dark:bg-white/15'
                }`}
              >
                <div className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                  showDashboardReminders
                    ? 'translate-x-6 bg-white dark:bg-slate-950'
                    : 'translate-x-0 bg-white dark:bg-slate-200'
                }`} />
              </button>
            </div>

            {/* Dashboard Tag Intelligence Chart Toggle */}
            <div className="flex items-center justify-between p-5 gap-4">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <ChartPie className="w-4 h-4 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'ড্যাশবোর্ডে ট্যাগ বিশ্লেষণ চার্ট' : 'Dashboard Tag Intelligence'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn'
                    ? 'হোম স্ক্রিনে ট্যাগভিত্তিক হিসাব প্রবাহ ও পাই চার্ট দেখান'
                    : 'Show tag distribution donut and breakdown on the dashboard'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showTagChart}
                onClick={() => {
                  triggerHaptic('single');
                  onToggleTagChart?.(!showTagChart);
                }}
                className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  showTagChart ? 'bg-slate-950 dark:bg-white' : 'bg-slate-900/15 dark:bg-white/15'
                }`}
              >
                <div className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                  showTagChart
                    ? 'translate-x-6 bg-white dark:bg-slate-950'
                    : 'translate-x-0 bg-white dark:bg-slate-200'
                }`} />
              </button>
            </div>

            {/* Manage Tags (Enable/Disable Defaults + Custom Tags & Image Logos) */}
            {(() => {
              const dueCounts = getTagCounts(effectiveTagConfig, 'due');
              const payCounts = getTagCounts(effectiveTagConfig, 'payment');
              return (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('single');
                    setShowManageTagsModal(true);
                  }}
                  className="w-full flex items-center justify-between p-5 gap-4 text-left hover:bg-slate-900/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer touch-press"
                >
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                      <CircleDotDashed className="w-4 h-4 stroke-[1.25]" />
                      <span>{lang === 'bn' ? 'ট্যাগ ব্যবস্থাপনা' : 'Manage Tags'}</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === 'bn'
                        ? `বকেয়া ${formatNumber(dueCounts.enabledCount, 'bn')}/${formatNumber(TAG_LIMITS.due.maxEnabled, 'bn')} ও আদায় ${formatNumber(payCounts.enabledCount, 'bn')}/${formatNumber(TAG_LIMITS.payment.maxEnabled, 'bn')}টি সক্রিয় — কাস্টম ট্যাগ ও লোগো যোগ করুন`
                        : `${dueCounts.enabledCount}/${TAG_LIMITS.due.maxEnabled} due · ${payCounts.enabledCount}/${TAG_LIMITS.payment.maxEnabled} payment active — customize tags & logos`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>{lang === 'bn' ? 'সাজান' : 'Customize'}</span>
                    <ChevronRight className="w-4 h-4 stroke-[1.5]" />
                  </div>
                </button>
              );
            })()}
            {/* Haptic Feedback */}
            <div className="p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Vibrate className="w-4 h-4 stroke-[1.25]" />
                    <span>{lang === 'bn' ? 'ভাইব্রেশন' : 'Haptic Feedback'}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn' ? 'বাটনে চাপ দিলে হালকা ভাইব্রেশন হবে' : 'Vibrate on button press'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleHaptics}
                  className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                    hapticsOn ? 'bg-slate-950 dark:bg-white' : 'bg-slate-900/15 dark:bg-white/15'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                    hapticsOn
                      ? 'translate-x-6 bg-white dark:bg-slate-950'
                      : 'translate-x-0 bg-white dark:bg-slate-200'
                  }`} />
                </button>
              </div>

              {hapticsOn && !isIOSDevice() && (
                <div className="pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-900 dark:text-white">
                    <span>{t.hapticIntensity}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {hapticIntensity === 1 ? t.intensitySoft
                       : hapticIntensity === 2 ? t.intensityMedium
                       : hapticIntensity === 3 ? t.intensityFirm
                       : hapticIntensity === 4 ? t.intensityStrong
                       : t.intensityMax}
                    </span>
                  </div>
                  <ScrollSafeSlider
                    min={1}
                    max={5}
                    step={1}
                    value={hapticIntensity}
                    ariaLabel={t.hapticIntensity}
                    onChange={(val) => changeHapticIntensity(val)}
                  />
                  <div className="flex justify-between text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 px-1">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                </div>
              )}
              {hapticsOn && isIOSDevice() && (
                <div className="pt-2.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {lang === 'bn'
                    ? 'আইওএস ডিভাইসে বাটনে চাপ দিলে সিস্টেমের ট্যাপটিক ইঞ্জিন ক্লিক ফিডব্যাক কাজ করবে।'
                    : 'Uses native iOS Taptic Engine click feedback on button taps.'}
                </div>
              )}
            </div>

            {/* Swipe Gestures */}
            <div className="p-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <MoveHorizontal className="w-4 h-4 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'স্লাইড জেসচার' : 'Swipe Gestures'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn' ? 'টেনে রিমাইন্ডার পাঠানো বা ডিলিট করা' : 'Swipe to remind or delete customers'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSwipeGesturesToggle(!swipeGesturesEnabled)}
                className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  swipeGesturesEnabled ? 'bg-slate-950 dark:bg-white' : 'bg-slate-900/15 dark:bg-white/15'
                }`}
              >
                <div className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                  swipeGesturesEnabled
                    ? 'translate-x-6 bg-white dark:bg-slate-950'
                    : 'translate-x-0 bg-white dark:bg-slate-200'
                }`} />
              </button>
            </div>

            {/* Disable All Transitions (Low-end Device Mode) */}
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'সব ট্রানজিশন বন্ধ করুন' : 'Turn Off All Transitions'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'bn'
                    ? 'সাধারণ বা ধীরগতির ডিভাইসে দ্রুত ব্যবহারের জন্য ওয়েবসাইটের সব অ্যানিমেশন ও ট্রানজিশন বন্ধ রাখুন'
                    : 'Disable all animations and visual transitions for faster performance on lower-end devices'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={transitionsOff}
                onClick={() => {
                  triggerHaptic('single');
                  const next = !transitionsOff;
                  setTransitionsOff(next);
                  setTransitionsDisabled(next);
                }}
                className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  transitionsOff ? 'bg-slate-950 dark:bg-white' : 'bg-slate-900/15 dark:bg-white/15'
                }`}
              >
                <div className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                  transitionsOff
                    ? 'translate-x-6 bg-white dark:bg-slate-950'
                    : 'translate-x-0 bg-white dark:bg-slate-200'
                }`} />
              </button>
            </div>

            {/* Custom Keypad & Sound */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Keyboard className="w-4 h-4 stroke-[1.25]" />
                    <span>{lang === 'bn' ? 'কাস্টম কিবোর্ড' : 'Custom Keypad'}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {lang === 'bn'
                      ? 'সংখ্যার ঘরে দ্রুত টাইপ করার জন্য কাস্টম কিবোর্ড ব্যবহার করুন'
                      : 'Use custom numeric keypad for number input fields on mobile'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('single');
                    const nextVal = !customKeypadOn;
                    setCustomKeypadOn(nextVal);
                    setCustomKeypadEnabledState(nextVal);
                    if (!nextVal) {
                      setKeypadSoundOn(false);
                      setKeypadSoundEnabled(false);
                    }
                  }}
                  className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                    customKeypadOn ? 'bg-slate-950 dark:bg-white' : 'bg-slate-900/15 dark:bg-white/15'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                      customKeypadOn
                        ? 'translate-x-6 bg-white dark:bg-slate-950'
                        : 'translate-x-0 bg-white dark:bg-slate-200'
                    }`}
                  />
                </button>
              </div>

              {customKeypadOn && (
                <div className="pt-3.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-4 animate-reveal">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-slate-500 dark:text-slate-400 stroke-[1.25]" />
                      <span>{lang === 'bn' ? 'কিবোর্ড সাউন্ড' : 'Keyboard Sound'}</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {lang === 'bn'
                        ? 'কিবোর্ডে বোতাম টেপার সময় মৃদু ও স্পষ্ট ক্লিক সাউন্ড বাজান'
                        : 'Play subtle acoustic click feedback when tapping keypad keys'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !keypadSoundOn;
                      setKeypadSoundOn(nextVal);
                      setKeypadSoundEnabled(nextVal);
                      if (nextVal) {
                        playKeypadClick('tick');
                      }
                      triggerHaptic('single');
                    }}
                    className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                      keypadSoundOn ? 'bg-slate-950 dark:bg-white' : 'bg-slate-900/15 dark:bg-white/15'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                        keypadSoundOn
                          ? 'translate-x-6 bg-white dark:bg-slate-950'
                          : 'translate-x-0 bg-white dark:bg-slate-200'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Phonetic Bangla Search */}
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Search className="w-4 h-4 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'ফোনেটিক বাংলা সার্চ' : 'Phonetic Bangla Search'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'bn'
                    ? 'ইংরেজি অক্ষরে বাংলা নামের উচ্চারণ লিখে খুঁজুন (যেমন "rahim" লিখলে "রহিম" পাওয়া যাবে)। নিখুঁত ইংরেজি সার্চের জন্য বন্ধ রাখুন।'
                    : 'Find Bengali names when typing in English letters (e.g. typing "rahim" finds "রহিম"). Turn off for exact English matching.'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleSearchBanglaInEnglish}
                className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  searchBanglaInEnglish ? 'bg-slate-950 dark:bg-white' : 'bg-slate-900/15 dark:bg-white/15'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                    searchBanglaInEnglish
                      ? 'translate-x-6 bg-white dark:bg-slate-950'
                      : 'translate-x-0 bg-white dark:bg-slate-200'
                  }`}
                />
              </button>
            </div>

            {/* Biometric Lock */}
            <div className="p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 stroke-[1.25]" />
                    <span>{lang === 'bn' ? 'বায়োমেট্রিক অথেনটিকেশন লক' : 'Biometric Authentication'}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {lang === 'bn'
                      ? 'চালু থাকলে ওয়েবসাইটে প্রবেশের সময় আলাদা বায়োমেট্রিক লগইন স্ক্রিনে ফিঙ্গারপ্রিন্ট বা ফেস আইডি দিয়ে আনলক করতে হবে।'
                      : 'Require Fingerprint or Face ID verification on a dedicated biometric login screen before accessing the ledger.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={biometricBusy}
                  onClick={handleToggleBiometric}
                  className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                    biometricOn ? 'bg-emerald-600' : 'bg-slate-900/15 dark:bg-white/15'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                      biometricOn ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {biometricOn && (
                <div className="pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[1.25]" />
                    <span>
                      {lang === 'bn'
                        ? 'বায়োমেট্রিক লক সক্রিয় রয়েছে'
                        : 'Biometric lock is active for your account'}
                    </span>
                  </div>

                  {onLockBiometricSession && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        onLockBiometricSession();
                      }}
                      className="px-4 py-2 bg-white/60 hover:bg-white/90 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.1] rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors touch-press"
                    >
                      <Lock className="w-3.5 h-3.5 stroke-[1.25]" />
                      <span>{lang === 'bn' ? 'এখনই লক স্ক্রিন দেখুন' : 'Lock Screen Now'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* SECTION 3: LEDGER MAINTENANCE & BACKUP */}
      <div className="space-y-2.5">
        <div className={sectionEyebrow}>
          {lang === 'bn' ? 'আর্কাইভ ও ব্যাকআপ' : 'Maintenance & Backup'}
        </div>

        <div>
          <SpotlightCard className="surface-glass border rounded-[28px] divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] overflow-hidden">
            {/* Auto-Merge & Archive */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Archive className="w-4 h-4 stroke-[1.25]" />
                    <span>
                      {lang === 'bn'
                        ? 'অটো-মার্জ ও স্টেটমেন্ট আর্কাইভ'
                        : 'Auto-Merge Ledger Statements'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {lang === 'bn'
                      ? 'গ্রাহকের খতিয়ানে শুধুমাত্র নির্ধারিত সংখ্যক সাম্প্রতিক লেনদেন (যেমন: ১৫টি) রেখে পুরনো লেনদেনগুলো স্বয়ংক্রিয়ভাবে আর্কাইভে সংরক্ষণ করুন।'
                      : 'Keep only a set number of recent entries (e.g. 15) in each customer ledger statement and automatically archive older entries.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={archivingBusy}
                  onClick={async () => {
                    triggerHaptic('single');
                    if (settings?.autoMergeStatements) {
                      if (resolvedUpdateAutoMerge) {
                        setArchivingBusy(true);
                        await resolvedUpdateAutoMerge(false, snapToMultipleOfFive(keepCountInput, 15));
                        setArchivingBusy(false);
                        toast.success(
                          lang === 'bn'
                            ? 'অটো-মার্জ স্টেটমেন্ট বন্ধ করা হয়েছে'
                            : 'Auto-merge statements turned off'
                        );
                      }
                    } else {
                      setShowAutoMergeWarning(true);
                    }
                  }}
                  className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                    settings?.autoMergeStatements ? 'bg-emerald-600' : 'bg-slate-900/15 dark:bg-white/15'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                      settings?.autoMergeStatements ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {settings?.autoMergeStatements && (
                <div className="pt-3.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-reveal">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                      {lang === 'bn'
                        ? 'প্রতি গ্রাহকের স্টেটমেন্টে সর্বোচ্চ এন্ট্রি সংখ্যা'
                        : 'Statement Entry Limit per Profile'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? 'এর চেয়ে পুরনো এন্ট্রিগুলো আর্কাইভে চলে যাবে (ব্যালেন্স অপরিবর্তিত থাকবে)'
                        : 'Older entries beyond this limit are moved to the profile archive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <div className="inline-flex items-center gap-1.5 select-none">
                      <button
                        type="button"
                        disabled={archivingBusy}
                        onClick={() => {
                          triggerHaptic('tick');
                          const cur = snapToMultipleOfFive(keepCountInput, 15);
                          setKeepCountInput(String(Math.max(5, cur - 5)));
                        }}
                        className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 dark:bg-white/[0.07] dark:hover:bg-white/[0.14] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                        aria-label="Decrease count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[1.25]" />
                      </button>
                      <span className="min-w-[2.25rem] text-center font-mono font-bold text-sm text-slate-950 dark:text-white tabular-nums">
                        {formatNumber(snapToMultipleOfFive(keepCountInput, 15), lang)}
                      </span>
                      <button
                        type="button"
                        disabled={archivingBusy}
                        onClick={() => {
                          triggerHaptic('tick');
                          const cur = snapToMultipleOfFive(keepCountInput, 15);
                          setKeepCountInput(String(Math.min(500, cur + 5)));
                        }}
                        className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 dark:bg-white/[0.07] dark:hover:bg-white/[0.14] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                        aria-label="Increase count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[1.25]" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={archivingBusy}
                      onClick={async () => {
                        if (!resolvedUpdateAutoMerge) return;
                        const parsed = snapToMultipleOfFive(keepCountInput, 15);
                        setKeepCountInput(String(parsed));
                        setShowAutoMergeWarning(true);
                        setArchivingBusy(true);
                        setArchiveProgress({
                          percent: 5,
                          current: 0,
                          total: customers.length,
                          archivedSoFar: 0,
                          message: lang === 'bn' ? 'প্রোফাইল স্ক্যান করা হচ্ছে...' : 'Scanning customer profiles...'
                        });
                        triggerHaptic('single');
                        try {
                          const count = await resolvedUpdateAutoMerge(true, parsed, (p) => setArchiveProgress(p));
                          setShowAutoMergeWarning(false);
                          toast.success(
                            lang === 'bn'
                              ? `সীমা ${formatNumber(parsed, 'bn')}-এ আপডেট হয়েছে (${formatNumber(count, 'bn')}টি আর্কাইভ হয়েছে)`
                              : `Statement limit set to ${parsed} (${count} older entries archived)`
                          );
                        } finally {
                          setArchivingBusy(false);
                          setArchiveProgress(null);
                        }
                      }}
                      className="px-4 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-semibold text-xs rounded-full cursor-pointer transition-colors shadow-xs"
                    >
                      {archivingBusy ? (lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Applying...') : (lang === 'bn' ? 'প্রয়োগ করুন' : 'Apply')}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-3.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{lang === 'bn' ? 'আর্কাইভকৃত পুরনো রেকর্ড' : 'Archived Old Records'}</span>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      · {formatNumber(archivedStatements.length, lang)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'আর্কাইভকৃত লেনদেনগুলো ওয়েবসাইটের লাইভ খাতার সাথে যুক্ত থাকে না বা এডিট করা যায় না, তবে ডাউনলোড করে রাখা যাবে।'
                      : 'Archived records are disconnected from the live ledger and read-only, but can be downloaded anytime.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={exportingArchive || archivedStatements.length === 0}
                    onClick={() => handleDownloadArchivedRecords('csv')}
                    className="px-3.5 py-2 bg-white/55 hover:bg-white/85 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-press"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 stroke-[1.25]" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    disabled={exportingArchive || archivedStatements.length === 0}
                    onClick={() => handleDownloadArchivedRecords('json')}
                    className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-press"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[1.25]" />
                    <span>{lang === 'bn' ? 'আর্কাইভ (.json)' : 'Archive (.json)'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Ledger Insight Statistics */}
            <div className="p-5 space-y-3">
              <h3 className={`text-slate-500 dark:text-slate-400 font-semibold ${lang === 'bn' ? 'text-[11px] tracking-normal' : 'micro-mono-label'}`}>
                {t.ledgerInsights}
              </h3>
              <div className="grid grid-cols-2 divide-x divide-slate-900/[0.06] dark:divide-white/[0.06] surface-subcard rounded-2xl border py-3.5">
                <div className="px-4">
                  <span className={`text-slate-500 dark:text-slate-400 block ${lang === 'bn' ? 'text-[11px] font-bold tracking-normal' : 'micro-mono-label'}`}>{t.totalClients}</span>
                  <span className="font-display text-2xl font-bold text-slate-950 dark:text-white mt-0.5 block tabular-nums">
                    {formatNumber(customers.length, lang)}
                  </span>
                </div>
                <div className="px-4">
                  <span className={`text-slate-500 dark:text-slate-400 block ${lang === 'bn' ? 'text-[11px] font-bold tracking-normal' : 'micro-mono-label'}`}>{t.totalTransactions}</span>
                  <span className="font-display text-2xl font-bold text-slate-950 dark:text-white mt-0.5 block tabular-nums">
                    {formatNumber(settings?.transactionsCount || 0, lang)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cloud Sync & JSON Backup */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Cloud className="w-4 h-4 stroke-[1.25]" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <span>{t.databaseSafety}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[1.5]" />
                  </div>
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{t.connectedCloud}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t.allCalculationsSynced}
                  </p>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-950 dark:text-white">{lang === 'bn' ? 'ব্যাকআপ লিখন ডাউনলোড (.json)' : 'Save Backup (.json)'}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'সরাসরি ব্যাকআপ হিসাব ডাউনলোড করে রাখুন।' : 'Download a full ledger copy for safe keeping.'}</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleBackupExport}
                    className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 font-semibold text-white dark:text-slate-950 rounded-full text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 touch-press"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[1.25]" />
                    {exporting ? (lang === 'bn' ? 'প্রস্তুত হচ্ছে...' : 'Preparing...') : (lang === 'bn' ? 'ব্যাকআপ ফাইল সংরক্ষণ' : 'Download Backup')}
                  </button>

                  <button
                    type="button"
                    onClick={handleImportClick}
                    className="px-4 py-2.5 bg-white/55 hover:bg-white/85 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] font-semibold text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] rounded-full text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors touch-press"
                  >
                    <Upload className="w-3.5 h-3.5 stroke-[1.25]" />
                    {lang === 'bn' ? 'ব্যাকআপ আপলোড' : 'Upload Backup'}
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* SECTION 4: APP & RECOVERY */}
      <div className="space-y-2.5">
        <div className={sectionEyebrow}>
          {lang === 'bn' ? 'অ্যাপ ও রিকভারি' : 'App & Recovery'}
        </div>

        {!isDismissed && !isStandalone && (
          <div>
            <SpotlightCard className="relative surface-glass border p-5 rounded-[28px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('install_card_dismissed', 'true');
                  setIsDismissed(true);
                }}
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full hover:bg-slate-900/10 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors sm:hidden text-slate-500"
                title={lang === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
              >
                <X className="w-4 h-4 stroke-[1.25]" />
              </button>
              <div>
                <div className={`text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'text-[11px] font-bold tracking-normal' : 'micro-mono-label'}`}>
                  {lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
                </div>
                <div className="font-display text-sm font-bold text-slate-950 dark:text-white mt-0.5">
                  {lang === 'bn' ? 'হোম স্ক্রিনে অ্যাপ ইনস্টল করুন' : 'Install Challan Track App'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {deferredPrompt
                    ? (lang === 'bn' ? 'দ্রুত অ্যাক্সেস, অফলাইন সাপোর্ট এবং ফুলস্ক্রিন অ্যাপের জন্য ইনস্টল করুন।' : 'Install as a standalone app with offline support and instant launch.')
                    : (lang === 'bn' ? 'হোম স্ক্রিনে অ্যাপ হিসেবে যোগ করতে ইনস্টল বা ব্রাউজার মেনু ব্যবহার করুন।' : 'Install to your home screen for a native fullscreen app experience.')}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('install_card_dismissed', 'true');
                    setIsDismissed(true);
                  }}
                  className="hidden sm:inline-flex px-4 py-2 bg-white/55 hover:bg-white/85 dark:bg-white/[0.06] text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] font-semibold rounded-full text-xs justify-center items-center cursor-pointer transition-colors"
                >
                  {lang === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
                </button>
                <button
                  type="button"
                  disabled={isInstallingApp}
                  onClick={handleInstallAppClick}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-semibold rounded-full text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0 touch-press disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5 stroke-[1.25]" />
                  {isInstallingApp
                    ? (lang === 'bn' ? 'ইনস্টল হচ্ছে...' : 'Installing...')
                    : (lang === 'bn' ? 'ইনস্টল' : 'Install')}
                </button>
              </div>
            </SpotlightCard>
          </div>
        )}

        {/* Trash Card */}
        <div>
          <SpotlightCard className="surface-glass border p-5 rounded-[28px] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 stroke-[1.25]" />
                  <span>{lang === 'bn' ? 'অস্থায়ী ট্র্যাশ (মুছে ফেলা গ্রাহক)' : 'Trash (Deleted Customers)'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn'
                    ? 'ভুলবশত মুছে ফেলা গ্রাহক এখান থেকে উদ্ধার করা যাবে। ১৪ দিন পর স্থায়ীভাবে ডিলিট হবে।'
                    : 'Recover mistakenly deleted customers. Items are permanently deleted after 14 days.'}
                </p>
              </div>

              {trashCustomers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('double');
                    openConfirmAction({ type: 'empty_trash' });
                  }}
                  className="px-3.5 py-2 border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-semibold rounded-full text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0 touch-press"
                >
                  <Trash2 className="w-3.5 h-3.5 stroke-[1.25]" />
                  {lang === 'bn' ? 'ট্র্যাশ খালি করুন' : 'Empty Trash'}
                </button>
              )}
            </div>

            {trashCustomers.length > 0 ? (
              <div className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] max-h-96 overflow-y-auto pr-1">
                {trashCustomers.map(c => {
                  const deletionTime = c.deletedAt ? new Date(c.deletedAt).getTime() : new Date().getTime();
                  const msPassed = new Date().getTime() - deletionTime;
                  const daysRemaining = Math.max(1, 14 - Math.floor(msPassed / (24 * 60 * 60 * 1000)));

                  return (
                    <div
                      key={c.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-950 dark:text-white truncate">
                          {c.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono">{c.phone || (lang === 'bn' ? '(ফোন নম্বর নেই)' : '(No phone)')}</span>
                          <span>·</span>
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            {lang === 'bn'
                              ? `স্থায়ীভাবে মুছতে ${formatNumber(daysRemaining, 'bn')} দিন বাকি`
                              : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-left sm:text-right">
                          <div className={`text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'text-[10px] font-bold tracking-normal' : 'micro-mono-label'}`}>
                            {lang === 'bn' ? 'ব্যালেন্স' : 'Balance'}
                          </div>
                          <div className={`text-sm font-bold font-mono tabular-nums ${
                            c.outstandingDue > 0
                              ? 'text-ledger-red'
                              : c.outstandingDue < 0
                                ? 'text-ledger-green'
                                : 'text-slate-500'
                          }`}>
                            ৳ {formatNumber(c.outstandingDue || 0, lang)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('single');
                              openConfirmAction({ type: 'restore', customer: c });
                            }}
                            title={lang === 'bn' ? 'পুনরুদ্ধার করুন' : 'Restore'}
                            className="w-9 h-9 bg-white/60 hover:bg-white/90 text-slate-900 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] dark:text-white rounded-full transition-colors cursor-pointer flex items-center justify-center border border-slate-900/[0.08] dark:border-white/[0.08]"
                          >
                            <RotateCcw className="w-3.5 h-3.5 stroke-[1.25]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('double');
                              openConfirmAction({ type: 'delete_perm', customer: c });
                            }}
                            title={lang === 'bn' ? 'স্থায়ীভাবে মুছুন' : 'Delete Permanently'}
                            className="w-9 h-9 bg-rose-500/12 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[1.25]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                {lang === 'bn' ? 'ট্র্যাশ খালি আছে' : 'Trash is empty'}
              </div>
            )}
          </SpotlightCard>
        </div>
      </div>
        </div>
      ) : (
        <div aria-hidden="true" className="min-h-[100dvh]" />
      )}

      {/* Trash Action Confirmation Modal */}
      {confirmAction && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={closeConfirmAction}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl border shadow-2xl p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto hide-scrollbar"
            >
              <div className="flex justify-center -mt-1 pb-3 sm:hidden">
                <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full" />
              </div>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-white/55 dark:bg-white/[0.07] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-full flex items-center justify-center mx-auto mb-3">
                {confirmAction.type === 'restore' ? (
                  <RotateCcw className="w-5 h-5 text-slate-950 dark:text-white stroke-[1.25]" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 stroke-[1.25]" />
                )}
              </div>

              <h3 className="font-display text-base font-bold text-slate-950 dark:text-white mb-1.5">
                {confirmAction.type === 'empty_trash' && (lang === 'bn' ? 'ট্র্যাশ সম্পূর্ণ খালি করুন' : 'Empty Trash')}
                {confirmAction.type === 'restore' && (lang === 'bn' ? 'গ্রাহক অ্যাকাউন্ট পুনরুদ্ধার' : 'Restore Customer Account')}
                {confirmAction.type === 'delete_perm' && (lang === 'bn' ? 'স্থায়ীভাবে মুছে ফেলুন' : 'Delete Account Permanently')}
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {confirmAction.type === 'empty_trash' && (
                  lang === 'bn'
                    ? 'আপনি কি নিশ্চিত সব ট্র্যাশ স্থায়ীভাবে খালি করতে চান? এই হিসাব আর কখনো ফিরে পাওয়া যাবে না!'
                    : 'Are you sure you want to permanently empty the trash? All customer profiles and entries will be deleted forever.'
                )}
                {confirmAction.type === 'restore' && (
                  lang === 'bn'
                    ? 'আপনি কি নিশ্চিত এই গ্রাহকের সম্পূর্ণ অ্যাকাউন্ট এবং আগের লেনদেনের বিবরণ পুনরুদ্ধার করতে চান?'
                    : 'Are you sure you want to restore this customer account and all their historical transactions?'
                )}
                {confirmAction.type === 'delete_perm' && (
                  lang === 'bn'
                    ? 'আপনি কি নিশ্চিত এই গ্রাহকের অ্যাকাউন্টটি স্থায়ীভাবে মুছে ফেলতে চান? এটি আর পুনরুদ্ধার করা সম্ভব হবে না!'
                    : 'Are you sure you want to permanently delete this customer account? All ledger entries will be lost forever.'
                )}
              </p>

              {confirmAction.customer && (
                <div className="surface-subcard border rounded-2xl p-3.5 text-left space-y-1.5 mt-4 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className={`font-semibold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'text-[10px] tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'নাম' : 'Name'}</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{confirmAction.customer.name}</span>
                  </div>
                  {confirmAction.customer.phone && (
                    <div className="flex justify-between items-baseline">
                      <span className={`font-semibold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'text-[10px] tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'মোবাইল' : 'Mobile'}</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300 font-mono">{confirmAction.customer.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className={`font-semibold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'text-[10px] tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Current Balance'}</span>
                    <span className={`font-mono font-bold ${
                      confirmAction.customer.outstandingDue > 0
                        ? 'text-ledger-red'
                        : confirmAction.customer.outstandingDue < 0
                          ? 'text-ledger-green'
                          : 'text-slate-500'
                    }`}>
                      {confirmAction.customer.outstandingDue === 0
                        ? (lang === 'bn' ? 'পরিশোধিত' : 'Settled')
                        : `৳ ${formatNumber(confirmAction.customer.outstandingDue, lang)}`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  const type = confirmAction.type;
                  const customer = confirmAction.customer;
                  closeConfirmAction();

                  if (type === 'empty_trash' || type === 'delete_perm') {
                    triggerHaptic('double');
                  } else {
                    triggerHaptic('single');
                  }

                  if (type === 'empty_trash') {
                    await emptyTrash();
                    toast.success(lang === 'bn' ? 'ট্র্যাশ সফলভাবে খালি করা হয়েছে' : 'Trash emptied successfully');
                  } else if (type === 'restore' && customer) {
                    await restoreCustomer(customer.id);
                    toast.success(lang === 'bn' ? 'গ্রাহক পুনরুদ্ধার করা হয়েছে' : 'Customer restored successfully');
                  } else if (type === 'delete_perm' && customer) {
                    await permanentlyDeleteCustomer(customer.id);
                    toast.success(lang === 'bn' ? 'গ্রাহক স্থায়ীভাবে ডিলিট হয়েছে' : 'Customer permanently deleted');
                  }
                }}
                className={`w-full py-3 font-semibold rounded-full cursor-pointer text-xs transition-all shadow-md active:scale-[0.98] ${
                  confirmAction.type === 'restore'
                    ? 'bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {confirmAction.type === 'restore' && (lang === 'bn' ? 'হ্যাঁ, পুনরুদ্ধার করুন' : 'Yes, Restore')}
                {confirmAction.type === 'empty_trash' && (lang === 'bn' ? 'হ্যাঁ, খালি করুন' : 'Yes, Empty Trash')}
                {confirmAction.type === 'delete_perm' && (lang === 'bn' ? 'হ্যাঁ, স্থায়ীভাবে মুছুন' : 'Yes, Delete Permanently')}
              </button>

              <button
                type="button"
                onClick={closeConfirmAction}
                className="w-full py-2.5 bg-white/55 hover:bg-white/85 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-semibold rounded-full border border-slate-900/[0.08] dark:border-white/[0.08] cursor-pointer text-xs transition-colors"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* JSON Backup Import Modal */}
      {importState.showModal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={() => !importState.loading && setImportState(prev => ({ ...prev, showModal: false }))}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden"
            >
              <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full" />
              </div>

              <div className="flex items-start justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] px-5 sm:px-6 pt-3 sm:pt-5 pb-3.5 gap-3 shrink-0">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
                    {lang === 'bn' ? 'ব্যাকআপ ডাটা ইম্পোর্ট করুন' : 'Import Backup Data'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {importState.loading
                      ? (lang === 'bn'
                          ? 'ডাটাবেসে ব্যাকআপ সিঙ্ক ও ভেরিফাই করা হচ্ছে'
                          : 'Restoring and verifying backup entries with database')
                      : (lang === 'bn'
                          ? 'ফাইল যাচাই করে রিস্টোর পদ্ধতি নির্বাচন করুন'
                          : 'Review backup file and choose import method')}
                  </p>
                </div>
                {!importState.loading && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setImportState(prev => ({ ...prev, showModal: false }));
                    }}
                    className="w-9 h-9 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer transition-colors shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[1.25]" />
                  </button>
                )}
              </div>

              {importState.loading ? (
                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 flex flex-col items-center justify-center space-y-4 text-center">
                <CircularGauge
                  percent={importProgress?.percent || 5}
                  size={74}
                  strokeWidth={5.5}
                  colorClass="text-slate-950 dark:text-white"
                  label={
                    <span className="text-xs font-mono font-bold text-slate-950 dark:text-white tabular-nums">
                      {formatNumber(importProgress?.percent || 5, lang)}%
                    </span>
                  }
                />

                <div className="space-y-1">
                  <h4 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin stroke-[1.25]" />
                    <span>
                      {importProgress?.stage === 'parsing'
                        ? (lang === 'bn' ? 'ব্যাকআপ ফাইল বিশ্লেষণ করা হচ্ছে...' : 'Parsing backup file...')
                        : importProgress?.stage === 'saving'
                        ? (lang === 'bn' ? 'ক্লাউড সার্ভারে ডাটা সংরক্ষণ হচ্ছে...' : 'Saving data to cloud server...')
                        : importProgress?.stage === 'summaries'
                        ? (lang === 'bn' ? 'মাসিক সারাংশ ও এনালিটিক্স তৈরি হচ্ছে...' : 'Rebuilding monthly analytics...')
                        : importProgress?.stage === 'done'
                        ? (lang === 'bn' ? 'ইম্পোর্ট সফলভাবে সম্পন্ন হয়েছে!' : 'Data imported successfully!')
                        : (lang === 'bn' ? 'ডাটা ইম্পোর্ট হচ্ছে...' : 'Importing data...')}
                    </span>
                  </h4>
                  {importProgress && importProgress.totalBatches && importProgress.totalBatches > 1 && (
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? `ব্যাচ: ${formatNumber(importProgress.currentBatch || 1, 'bn')} / ${formatNumber(importProgress.totalBatches, 'bn')}`
                        : `Batch: ${importProgress.currentBatch || 1} / ${importProgress.totalBatches}`}
                    </p>
                  )}
                </div>

                <div className="w-full h-3 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-center overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                  <div
                    className="h-full rounded-full relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      width: `${Math.max(5, importProgress?.percent || 5)}%`,
                      background: 'linear-gradient(90deg, rgba(110, 231, 183, 0.88) 0%, rgba(16, 185, 129, 0.82) 52%, rgba(13, 148, 136, 0.70) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                    }}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                  </div>
                </div>

                <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 font-medium px-1 font-mono tabular-nums">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 stroke-[1.25]" />
                    <span>
                      {lang === 'bn'
                        ? `অতিবাহিত সময়: ${formatNumber(Math.floor(elapsedSeconds / 60), 'bn')}:${elapsedSeconds % 60 < 10 ? `০${formatNumber(elapsedSeconds % 60, 'bn')}` : formatNumber(elapsedSeconds % 60, 'bn')} সে.`
                        : `Elapsed: ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}s`}
                    </span>
                  </span>
                  {importProgress?.totalCount !== undefined && importProgress.totalCount > 0 ? (
                    <span>
                      {formatNumber(importProgress.processedCount ?? 0, lang)} / {formatNumber(importProgress.totalCount, lang)}
                    </span>
                  ) : (
                    <span>{formatNumber(importProgress?.percent || 5, lang)}%</span>
                  )}
                </div>

                <div className="w-full p-3.5 surface-subcard border rounded-2xl text-xs text-slate-600 dark:text-slate-300 text-left">
                  {lang === 'bn'
                    ? 'দয়া করে অপেক্ষা করুন। ব্যাকআপ রিস্টোর চলাকালীন পেজটি রিলোড বা বন্ধ করবেন না।'
                    : 'Please wait. Do not close or refresh this page while restore is in progress.'}
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 sm:p-6 space-y-4">
                  {/* File Meta Info */}
                  <div className="surface-subcard border p-3.5 rounded-2xl space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'ব্যাকআপ সময়:' : 'Backup Date:'}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {importState.backupData.backupTimestamp
                          ? new Date(importState.backupData.backupTimestamp).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')
                          : (lang === 'bn' ? 'প্রযোজ্য নয়' : 'N/A')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'গ্রাহক ও ক্রেডিট কার্ড হিসাব:' : 'Accounts & Credit Cards:'}</span>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono">
                        {formatNumber(importState.backupData.customers?.length || 0, lang)}
                        {Array.isArray(importState.backupData.customers) && importState.backupData.customers.some((c: any) => c.accountType === 'credit_card')
                          ? ` (${formatNumber(importState.backupData.customers.filter((c: any) => c.accountType === 'credit_card').length, lang)} ${lang === 'bn' ? 'কার্ড' : 'cards'})`
                          : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'লেনদেনের সংখ্যা:' : 'Total Transactions:'}</span>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono">
                        {formatNumber(importState.backupData.ledgerTransactions?.length || 0, lang)}
                      </span>
                    </div>
                    {Array.isArray(importState.backupData.goals) && (
                      <div className="flex justify-between">
                        <span>{lang === 'bn' ? 'লক্ষ্য ও উন্মুক্ত সঞ্চয়:' : 'Goals & Flexible Savings:'}</span>
                        <span className="font-semibold text-slate-900 dark:text-white font-mono">
                          {formatNumber(importState.backupData.goals.length, lang)}
                          {importState.backupData.goals.some((g: any) => g.isOpenEnded)
                            ? ` (${formatNumber(importState.backupData.goals.filter((g: any) => g.isOpenEnded).length, lang)} ${lang === 'bn' ? 'উন্মুক্ত' : 'flexible'})`
                            : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Restore Choices */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setImportState(prev => ({ ...prev, choice: 'merge' }))}
                      className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer flex gap-3 ${
                        importState.choice === 'merge'
                          ? 'border-2 border-slate-950 dark:border-white bg-slate-950/[0.06] dark:bg-white/[0.1]'
                          : 'border border-slate-900/[0.08] dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.03] hover:bg-white/70 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        <input
                          type="radio"
                          checked={importState.choice === 'merge'}
                          onChange={() => {}}
                          className="w-4 h-4 accent-slate-950 dark:accent-white cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-950 dark:text-white">
                            {lang === 'bn' ? '১. মার্জ ও আপডেট' : 'Choice 1: Merge & Update'}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            · {lang === 'bn' ? 'প্রস্তাবিত' : 'Recommended'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                          {lang === 'bn'
                            ? 'ফাইলটি লাইভ ডাটাবেসের সাথে তুলনা করে অনুপস্থিত এন্ট্রি যোগ করবে এবং কোনো পরিবর্তন থাকলে আপডেট করবে।'
                            : 'Compares file with live database. Adds missing entries and updates existing ones if changed.'}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportState(prev => ({ ...prev, choice: 'skip' }))}
                      className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer flex gap-3 ${
                        importState.choice === 'skip'
                          ? 'border-2 border-slate-950 dark:border-white bg-slate-950/[0.06] dark:bg-white/[0.1]'
                          : 'border border-slate-900/[0.08] dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.03] hover:bg-white/70 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        <input
                          type="radio"
                          checked={importState.choice === 'skip'}
                          onChange={() => {}}
                          className="w-4 h-4 accent-slate-950 dark:accent-white cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-950 dark:text-white">
                          {lang === 'bn' ? '২. ডুপ্লিকেট এড়িয়ে যান' : 'Choice 2: Skip Duplicates'}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                          {lang === 'bn'
                            ? 'শুধুমাত্র নতুন এন্ট্রিগুলো যুক্ত করবে যা বর্তমান ডাটাবেসে নেই।'
                            : 'Only imports entries that do not exist in the current live database.'}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportState(prev => ({ ...prev, choice: 'clear' }))}
                      className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer flex gap-3 ${
                        importState.choice === 'clear'
                          ? 'border-2 border-rose-600 dark:border-rose-500 bg-rose-500/10'
                          : 'border border-slate-900/[0.08] dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.03] hover:border-rose-500/50'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        <input
                          type="radio"
                          checked={importState.choice === 'clear'}
                          onChange={() => {}}
                          className="w-4 h-4 accent-rose-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                          {lang === 'bn' ? '৩. মুছুন ও প্রতিস্থাপন করুন (সম্পূর্ণ রিস্টোর)' : 'Choice 3: Clear & Replace (Full Restore)'}
                        </span>
                        <p className="text-[11px] text-rose-600/85 dark:text-rose-400/85 mt-1 leading-normal">
                          {lang === 'bn'
                            ? 'সতর্কতা: বর্তমান ডাটাবেসের সমস্ত তথ্য মুছে ফেলবে এবং ব্যাকআপ ফাইল দিয়ে প্রতিস্থাপন করবে।'
                            : 'WARNING: Completely wipes existing live database and replaces with file.'}
                        </p>
                      </div>
                    </button>

                    {importState.choice === 'clear' && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-rose-500/10 border border-rose-500/25 p-3.5 rounded-2xl space-y-2 will-change-transform"
                      >
                        <label className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block leading-tight">
                          {lang === 'bn'
                            ? 'ডাটাবেস সম্পূর্ণ মুছে ফেলার জন্য নিচে "RESTORE" শব্দটি টাইপ করুন:'
                            : 'Type "RESTORE" below to confirm full restore:'}
                        </label>
                        <input
                          type="text"
                          value={importState.confirmText}
                          onChange={(e) => setImportState(prev => ({ ...prev, confirmText: e.target.value }))}
                          placeholder="RESTORE"
                          className="w-full px-3 py-2.5 bg-white/70 dark:bg-white/[0.06] border border-rose-500/40 rounded-full text-xs text-center font-mono font-bold tracking-widest text-rose-600 dark:text-rose-400 outline-none"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="px-5 sm:px-6 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-black/25 backdrop-blur-md shrink-0 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (importState.choice === 'clear' && importState.confirmText !== 'RESTORE') {
                        toast.error(lang === 'bn' ? 'নিশ্চিতকরণের জন্য "RESTORE" শব্দটি টাইপ করুন!' : 'Please type "RESTORE" to confirm!');
                        return;
                      }

                      setImportState(prev => ({ ...prev, loading: true }));
                      setImportProgress({
                        stage: 'parsing',
                        percent: 5,
                        message: lang === 'bn' ? 'ব্যাকআপ ফাইল প্রস্তুত করা হচ্ছে...' : 'Preparing backup data...'
                      });
                      triggerHaptic('single');

                      try {
                        await importLedgerData(importState.backupData, importState.choice, (progress) => {
                          setImportProgress(progress);
                        });
                        toast.success(lang === 'bn' ? 'ডাটা সফলভাবে ইম্পোর্ট করা হয়েছে!' : 'Data imported successfully!');
                        triggerHaptic('double');
                        setImportState(prev => ({ ...prev, showModal: false }));
                      } catch (err) {
                        console.error(err);
                        toast.error(lang === 'bn' ? 'ইম্পোর্ট করতে সমস্যা হয়েছে!' : 'Failed to import data!');
                      } finally {
                        setImportState(prev => ({ ...prev, loading: false }));
                        setImportProgress(null);
                      }
                    }}
                    disabled={importState.choice === 'clear' && importState.confirmText !== 'RESTORE'}
                    className={`w-full py-3 text-white font-semibold rounded-full text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md ${
                      importState.choice === 'clear'
                        ? 'bg-rose-600 hover:bg-rose-700 disabled:opacity-40'
                        : 'bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-950 disabled:opacity-40'
                    }`}
                  >
                    {lang === 'bn' ? 'ইম্পোর্ট শুরু করুন' : 'Confirm Import'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportState(prev => ({ ...prev, showModal: false }))}
                    className="w-full py-2.5 bg-white/55 hover:bg-white/85 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-semibold rounded-full border border-slate-900/[0.08] dark:border-white/[0.08] text-xs cursor-pointer transition-colors"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </ModalPortal>
      )}

      {/* AUTO-MERGE STATEMENTS ACTIVATION MODAL */}
      {showAutoMergeWarning && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={() => !archivingBusy && setShowAutoMergeWarning(false)}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden"
            >
              <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full" />
              </div>

              <div className="flex items-start justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] px-5 sm:px-6 pt-3 sm:pt-5 pb-3.5 gap-3 shrink-0">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
                    {lang === 'bn'
                      ? 'অটো-মার্জ স্টেটমেন্ট চালু করুন'
                      : 'Enable Auto-Merge Statements'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {lang === 'bn'
                      ? 'চালু করার আগে নিচের নিয়মগুলো দেখে নিন'
                      : 'Review how statement archiving works before activating'}
                  </p>
                </div>
                {!archivingBusy && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setShowAutoMergeWarning(false);
                    }}
                    className="w-9 h-9 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer transition-colors shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[1.25]" />
                  </button>
                )}
              </div>

              {archivingBusy ? (
                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 flex flex-col items-center justify-center space-y-4 text-center">
                <CircularGauge
                  percent={archiveProgress?.percent || 8}
                  size={74}
                  strokeWidth={5.5}
                  colorClass="text-slate-950 dark:text-white"
                  label={
                    <span className="text-xs font-mono font-bold text-slate-950 dark:text-white tabular-nums">
                      {archiveProgress?.percent || 8}%
                    </span>
                  }
                />

                <div className="space-y-1">
                  <h4 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin stroke-[1.25]" />
                    <span>
                      {archiveProgress?.message ||
                        (lang === 'bn'
                          ? 'প্রোফাইল স্টেটমেন্ট আর্কাইভ হচ্ছে...'
                          : 'Archiving older statements across profiles...')}
                    </span>
                  </h4>
                  {archiveProgress && archiveProgress.total > 0 && (
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? `সর্বশেষ ${formatNumber(Number(keepCountInput) || 15, 'bn')}টি রেখে আর্কাইভ হয়েছে: ${formatNumber(archiveProgress.archivedSoFar, 'bn')}টি`
                        : `Keeping latest ${Number(keepCountInput) || 15} per profile · Archived: ${archiveProgress.archivedSoFar}`}
                    </p>
                  )}
                </div>

                <div className="w-full h-3 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-center overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                  <div
                    className="h-full rounded-full relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      width: `${Math.max(8, archiveProgress?.percent || 8)}%`,
                      background: 'linear-gradient(90deg, rgba(110, 231, 183, 0.88) 0%, rgba(16, 185, 129, 0.82) 52%, rgba(13, 148, 136, 0.70) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                    }}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                  </div>
                </div>

                <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 font-medium px-1 font-mono tabular-nums">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 stroke-[1.25]" />
                    <span>
                      {lang === 'bn' ? 'অতিবাহিত সময়:' : 'Elapsed:'}{' '}
                      {Math.floor(archiveElapsedSeconds / 60)}:
                      {String(archiveElapsedSeconds % 60).padStart(2, '0')}s
                    </span>
                  </span>
                  {archiveProgress && archiveProgress.total > 0 && (
                    <span>
                      {archiveProgress.current} / {archiveProgress.total}
                    </span>
                  )}
                </div>

                <div className="w-full p-3.5 surface-subcard border rounded-2xl text-xs text-slate-600 dark:text-slate-300 text-left">
                  {lang === 'bn'
                    ? 'দয়া করে অপেক্ষা করুন। প্রতিটি গ্রাহকের প্রোফাইল পরীক্ষা করে পুরনো লেনদেনগুলো আর্কাইভে সংরক্ষণ করা হচ্ছে।'
                    : 'Please wait while we scan each profile, keep the latest entries, and move older statements to their archive.'}
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 sm:p-6 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <div className="p-4 rounded-2xl surface-subcard border space-y-2 text-slate-700 dark:text-slate-200 font-medium">
                    <p>
                      ·{' '}
                      {lang === 'bn'
                        ? `প্রতিটি গ্রাহকের খতিয়ানে শুধুমাত্র সর্বশেষ ${formatNumber(Number(keepCountInput) || 15, 'bn')}টি লেনদেন সক্রিয় থাকবে (প্রাথমিকভাবে ৫টি দৃশ্যমান থাকবে এবং বাকিগুলো 'আরও দেখুন' বাটনে থাকবে)।`
                        : `Only the latest ${Number(keepCountInput) || 15} transactions per customer will remain in the active ledger statement (5 visible initially, others behind 'Show More').`}
                    </p>
                    <p>
                      ·{' '}
                      {lang === 'bn'
                        ? 'পুরনো লেনদেনগুলো ডিলিট না হয়ে প্রতিটি প্রোফাইলের আর্কাইভে জমা থাকবে। আর্কাইভকৃত রেকর্ডগুলো ডাউনলোড করা যাবে কিন্তু এডিট করা যাবে না।'
                        : 'Older transactions are moved to each profile’s Archive. Archived records can be downloaded anytime but cannot be edited.'}
                    </p>
                    <p>
                      ·{' '}
                      {lang === 'bn'
                        ? 'গ্রাহকের বর্তমান বকেয়া বা ব্যালেন্স অপরিবর্তিত থাকবে এবং কোনো "Initial Balance Adjustment" এন্ট্রি তৈরি হবে না।'
                        : 'Customer balances remain unchanged without adding any "Initial Balance Adjustment" entry.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-4 rounded-2xl surface-subcard border">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {lang === 'bn' ? 'সক্রিয় এন্ট্রি সীমা' : 'Active Entries to Keep'}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === 'bn' ? 'প্রতি প্রোফাইলে সর্বশেষ লেনদেন' : 'Latest entries kept per profile'}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-2 shrink-0 select-none">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          const cur = snapToMultipleOfFive(keepCountInput, 15);
                          setKeepCountInput(String(Math.max(5, cur - 5)));
                        }}
                        className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 dark:bg-white/[0.07] dark:hover:bg-white/[0.14] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer"
                        aria-label="Decrease count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[1.25]" />
                      </button>
                      <span className="min-w-[2.25rem] text-center font-mono font-bold text-base text-slate-950 dark:text-white tabular-nums">
                        {formatNumber(snapToMultipleOfFive(keepCountInput, 15), lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          const cur = snapToMultipleOfFive(keepCountInput, 15);
                          setKeepCountInput(String(Math.min(500, cur + 5)));
                        }}
                        className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 dark:bg-white/[0.07] dark:hover:bg-white/[0.14] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer"
                        aria-label="Increase count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[1.25]" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 px-5 sm:px-6 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-black/25 backdrop-blur-md shrink-0">
                  <button
                    type="button"
                    disabled={archivingBusy}
                    onClick={async () => {
                      if (!resolvedUpdateAutoMerge) return;
                      const parsed = snapToMultipleOfFive(keepCountInput, 15);
                      setKeepCountInput(String(parsed));
                      setArchivingBusy(true);
                      setArchiveProgress({
                        percent: 5,
                        current: 0,
                        total: customers.length,
                        archivedSoFar: 0,
                        message: lang === 'bn' ? 'প্রোফাইল স্ক্যান করা হচ্ছে...' : 'Scanning customer profiles...'
                      });
                      triggerHaptic('double');
                      try {
                        const archivedCount = await resolvedUpdateAutoMerge(true, parsed, (p) => {
                          setArchiveProgress(p);
                        });
                        setShowAutoMergeWarning(false);
                        toast.success(
                          lang === 'bn'
                            ? `অটো-মার্জ চালু হয়েছে (${formatNumber(archivedCount, 'bn')}টি পুরনো এন্ট্রি আর্কাইভে স্থানান্তরিত)`
                            : `Auto-Merge enabled (${archivedCount} older entries moved to archive)`
                        );
                      } finally {
                        setArchivingBusy(false);
                        setArchiveProgress(null);
                      }
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full text-xs cursor-pointer transition-colors shadow-md"
                  >
                    {lang === 'bn'
                      ? 'অটো-মার্জ চালু করুন'
                      : 'Enable Auto-Merge'}
                  </button>

                  <button
                    type="button"
                    disabled={archivingBusy}
                    onClick={() => setShowAutoMergeWarning(false)}
                    className="w-full py-2.5 bg-white/55 hover:bg-white/85 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-semibold rounded-full border border-slate-900/[0.08] dark:border-white/[0.08] text-xs cursor-pointer transition-colors"
                  >
                    {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </ModalPortal>
      )}

      {/* Edit Account Name Popup Modal */}
      {showEditNameModal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={() => !savingDisplayName && setShowEditNameModal(false)}
            />
            <div className="relative z-10 w-full sm:max-w-md glass-modal rounded-t-[2rem] sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20" />
              </div>

              <div className="px-6 pt-4 sm:pt-5 pb-3.5 flex items-center justify-between gap-3 border-b border-slate-900/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full surface-subcard border flex items-center justify-center shrink-0"
                    style={{ color: 'var(--accent-color)' }}
                  >
                    <SquarePen className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                      {lang === 'bn' ? 'অ্যাকাউন্টের নাম পরিবর্তন' : 'Edit Account Name'}
                    </h3>
                    {resolvedAccountEmail && (
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {resolvedAccountEmail}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={savingDisplayName}
                  onClick={() => setShowEditNameModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-900/10 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer transition-colors shrink-0"
                  aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                >
                  <X className="w-4 h-4 stroke-[1.5]" />
                </button>
              </div>

              <form onSubmit={handleSaveDisplayName} className="p-6 space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6">
                <div className="space-y-2">
                  <label
                    htmlFor="settings-display-name-input"
                    className={lang === 'bn'
                      ? 'text-xs font-bold text-slate-700 dark:text-slate-200 block'
                      : 'micro-mono-label text-slate-500 dark:text-slate-400 font-semibold block'}
                  >
                    {lang === 'bn' ? 'প্রোফাইল নাম' : 'Display Name'}
                  </label>
                  <input
                    id="settings-display-name-input"
                    type="text"
                    autoFocus
                    maxLength={60}
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    placeholder={lang === 'bn' ? 'আপনার নাম লিখুন...' : 'Enter your name...'}
                    className="w-full px-4 py-3 rounded-2xl surface-subcard border border-slate-900/10 dark:border-white/12 text-sm font-semibold text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] transition-all select-text"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={savingDisplayName}
                    onClick={() => setShowEditNameModal(false)}
                    className="flex-1 py-3 px-4 rounded-full bg-white/55 hover:bg-white/85 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 border border-slate-900/[0.08] dark:border-white/[0.08] font-semibold text-xs cursor-pointer transition-colors touch-press"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={savingDisplayName || !editNameInput.trim()}
                    className="flex-1 py-3 px-4 rounded-full bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-semibold text-xs cursor-pointer transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed touch-press"
                  >
                    {savingDisplayName
                      ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                      : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Name')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      <ManageTagsModal
        isOpen={showManageTagsModal}
        onClose={() => setShowManageTagsModal(false)}
        lang={lang}
        tagConfig={effectiveTagConfig}
        onSaveTagConfig={saveTagConfig || (async () => {})}
      />
    </div>
  );
});

export default SettingsManager;
