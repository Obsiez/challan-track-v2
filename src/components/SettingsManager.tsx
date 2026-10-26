import React, { useState, useEffect } from 'react';
import { Customer, UserSettings, ImportProgress, Transaction } from '../types';
import { 
  Moon, Sun, Cloud, Download, Upload, LogOut, CheckCircle2, Languages, AlertTriangle, X, RotateCcw, Trash2, Contrast, Clock, RefreshCw, Palette, Check, Pipette, Fingerprint, Archive, Lock, FileSpreadsheet, Sliders, Minus, Plus, Keyboard, Vibrate, MoveHorizontal, Volume2, Search
} from 'lucide-react';
import { isPhoneticSearchEnabled, setPhoneticSearchEnabled } from '../lib/phonetics';
import { PRESET_ACCENTS, getSavedAccentColor, applyAccentColor, THEME_PALETTES, getSavedThemePalette, getSavedThemeIntensity, applyThemePalette } from '../lib/accentTheme';
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

interface SettingsManagerProps {
  theme: 'light' | 'dark';
  trashCustomers: Customer[];
  restoreCustomer: (customerId: string) => Promise<void>;
  permanentlyDeleteCustomer: (customerId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  swipeGesturesEnabled: boolean;
  onSwipeGesturesToggle: (val: boolean) => void;
  settings: UserSettings | null;
  updateTheme: (theme: 'light' | 'dark') => Promise<void>;
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
  archivedStatements?: Transaction[];
  updateStatementAutoMerge?: (enabled: boolean, keepCount: number, onProgress?: (p: any) => void) => Promise<number>;
  onUpdateStatementAutoMerge?: (enabled: boolean, keepCount: number, onProgress?: (p: any) => void) => Promise<number>;
  exportArchivedStatements?: () => Promise<any[]>;
  onExportArchivedStatements?: () => Promise<any[]>;
  onLockBiometricSession?: () => void;
}

export default function SettingsManager({
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
  archivedStatements = [],
  updateStatementAutoMerge,
  onUpdateStatementAutoMerge,
  exportArchivedStatements,
  onExportArchivedStatements,
  onLockBiometricSession
}: SettingsManagerProps) {
  const resolvedUpdateAutoMerge = updateStatementAutoMerge || onUpdateStatementAutoMerge;
  const resolvedExportArchived = exportArchivedStatements || onExportArchivedStatements;
  const t = translations[lang];
  const [exporting, setExporting] = useState(false);

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
  const [showAutoMergeWarning, setShowAutoMergeWarning] = useState(false);
  const [keepCountInput, setKeepCountInput] = useState<string>(() => String(settings?.statementKeepCount || 15));
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
    setBiometricOn(isBiometricEnabled(settings?.uid));
    if (settings?.statementKeepCount) {
      setKeepCountInput(String(settings.statementKeepCount));
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
      if (confirmAction) {
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

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.hex) setCustomAccent(e.detail.hex);
    };
    const themeHandler = (e: any) => {
      if (e.detail?.paletteId) setCurrentThemePalette(e.detail.paletteId);
      if (e.detail?.intensity !== undefined) setSurfaceIntensity(e.detail.intensity);
    };
    window.addEventListener('accent-color-changed', handler);
    window.addEventListener('theme-palette-changed', themeHandler);
    return () => {
      window.removeEventListener('accent-color-changed', handler);
      window.removeEventListener('theme-palette-changed', themeHandler);
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
  useEffect(() => {
    if (confirmAction || importState.showModal || showAutoMergeWarning) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [confirmAction, importState.showModal, showAutoMergeWarning]);

  const handleToggleBiometric = async () => {
    if (biometricBusy) return;
    triggerHaptic('single');
    const uid = settings?.uid || auth.currentUser?.uid || 'local-guest-session';
    const uName = auth.currentUser?.displayName || settings?.email || 'ChallanTrack Owner';

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
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

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

  return (
    <div className="space-y-5 no-select">
      
      {/* 1. LANGUAGE SELECTOR CARD */}
      <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl space-y-4">
        <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <Languages className="w-4 h-4 stroke-[2]" />
          {t.displayLang}
        </h2>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              onLangChange('en');
            }}
            className={`py-3.5 px-3 rounded-xl border-2 text-center transition-colors cursor-pointer ${
              lang === 'en'
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 border-slate-950 dark:border-white font-bold shadow-xs'
                : 'bg-white hover:bg-slate-50 dark:bg-[#0D121D] dark:hover:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-semibold'
            }`}
          >
            <span className="text-sm font-black block">{t.english}</span>
            <span className="text-[11px] opacity-70 block mt-0.5">English System</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              onLangChange('bn');
            }}
            className={`py-3.5 px-3 rounded-xl border-2 text-center transition-colors cursor-pointer ${
              lang === 'bn'
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 border-slate-950 dark:border-white font-bold shadow-xs'
                : 'bg-white hover:bg-slate-50 dark:bg-[#0D121D] dark:hover:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-semibold'
            }`}
          >
            <span className="text-sm font-black block">{t.bangla}</span>
            <span className="text-[11px] opacity-70 block mt-0.5">বাংলা সংস্করণ</span>
          </button>
        </div>
      </div>

      {/* 2. THEME AND LIGHTING TOGGLE CARD */}
      <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <Contrast className="w-4 h-4 stroke-[2]" />
          {t.themeMode}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {lang === 'bn' 
            ? 'চালান ট্র্যাককে আপনার সুবিধাজনক আলোতে রূপ দিন। কাজের ক্ষেত্র উজ্জ্বল রোদে বা রাতে চোখের সুরক্ষায় আরামদায়ক থিম ব্যবহার করুন।' 
            : 'Tailor Challan Track to the most comforting view. Perfect for outdoor sunny fields or dark indoor offices.'}
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              updateTheme('light');
            }}
            className={`py-3 px-3 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeTheme === 'light'
                ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white font-bold shadow-xs'
                : 'bg-white hover:bg-slate-50 dark:bg-[#0D121D] dark:hover:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-semibold'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span className="text-xs font-bold">{t.lightMode}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              updateTheme('dark');
            }}
            className={`py-3 px-3 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeTheme === 'dark'
                ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white font-bold shadow-xs'
                : 'bg-white hover:bg-slate-50 dark:bg-[#0D121D] dark:hover:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-semibold'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span className="text-xs font-bold">{t.darkMode}</span>
          </button>
        </div>

        {/* Theme Surface Palette Selector */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              {lang === 'bn' ? 'থিম কালার প্যালেট নির্বাচন করুন' : 'Choose Theme Surface Palette'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                  className={`p-2.5 rounded-xl border-2 flex flex-col gap-1 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-slate-950 dark:border-white bg-slate-50 dark:bg-slate-900 shadow-2xs font-bold'
                      : 'border-slate-300 dark:border-slate-700 hover:border-slate-950 dark:hover:border-white bg-white dark:bg-[#0D121D]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center -space-x-1">
                      {palette.previewSwatches.map((hex, idx) => (
                        <span
                          key={idx}
                          className="w-4 h-4 rounded-full border border-white/40 dark:border-black/40"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 dark:text-white stroke-[3]" />}
                  </div>
                  <span className="text-xs font-bold truncate text-slate-900 dark:text-white mt-0.5">
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
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span className="uppercase tracking-wider font-bold">
                {lang === 'bn' ? 'শেড' : 'Shade'}
              </span>
              <span>{formatNumber(surfaceIntensity, lang)}%</span>
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

      {/* 2.5 CUSTOM ACCENT COLOR CARD */}
      <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Palette className="w-4 h-4 stroke-[2]" />
            <span>{lang === 'bn' ? 'কাস্টম অ্যাকসেন্ট কালার' : 'Custom Accent Color'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'অ্যাপের প্রধান হাইলাইট ও গ্রাফের রঙ পছন্দমতো বেছে নিন' : 'Personalize highlights, focus rings, and metric colors'}
          </p>
        </div>

        {/* Preset Palettes (Clickable Panels with Bold Borders) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
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
                className={`p-2.5 rounded-xl border-2 flex items-center gap-2 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-slate-950 dark:border-white bg-slate-50 dark:bg-slate-900 shadow-2xs font-bold'
                    : 'border-slate-300 dark:border-slate-700 hover:border-slate-950 dark:hover:border-white bg-white dark:bg-[#0D121D]'
                }`}
              >
                <span 
                  className="w-4 h-4 rounded-full border border-slate-900/40 dark:border-white/40 shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: preset.previewHex }}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                </span>
                <span className="text-xs truncate text-slate-900 dark:text-white">
                  {lang === 'bn' ? preset.nameBn : preset.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Spectrum Picker */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="font-mono text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'বর্তমান হেক্স:' : 'Active Hex:'} <strong className="text-slate-900 dark:text-white">{customAccent}</strong>
          </span>
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-xl cursor-pointer text-slate-900 dark:text-white font-bold transition-colors">
            <input 
              type="color"
              value={customAccent}
              onChange={(e) => {
                const hex = e.target.value;
                setCustomAccent(hex);
                applyAccentColor(hex);
              }}
              className="opacity-0 absolute w-0 h-0"
            />
            <Pipette className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'রঙের চাকা বা হেক্স' : 'Color Spectrum'}</span>
          </label>
        </div>
      </div>

      {/* HAPTICS TOGGLE CARD */}
      <div className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
              <Vibrate className="w-4 h-4 stroke-[2]" />
              <span>{lang === 'bn' ? 'ভাইব্রেশন' : 'Haptic Feedback'}</span>
            </h2>
            <p className="text-xs text-[#757575] mt-0.5">
              {lang === 'bn' ? 'বাটনে চাপ দিলে হালকা ভাইব্রেশন হবে' : 'Vibrate on button press'}
            </p>
          </div>
          <button
            onClick={toggleHaptics}
            className={`w-12 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
              hapticsOn ? 'bg-black dark:bg-white' : 'bg-[#E2E2E2] dark:bg-[#333333]'
            }`}
          >
            <div className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
              hapticsOn 
                ? 'translate-x-6 bg-white dark:bg-black' 
                : 'translate-x-0 bg-white dark:bg-black'
            }`} />
          </button>
        </div>

        {hapticsOn && !isIOSDevice() && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2.5">
            <div className="flex justify-between items-center text-xs font-bold text-black dark:text-white">
              <span>{t.hapticIntensity}</span>
              <span className="text-[#757575]">
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
            <div className="flex justify-between text-[10px] font-mono font-bold text-[#757575] px-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>
        )}
        {hapticsOn && isIOSDevice() && (
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {lang === 'bn'
              ? 'আইওএস ডিভাইসে বাটনে চাপ দিলে সিস্টেমের ট্যাপটিক ইঞ্জিন ক্লিক ফিডব্যাক কাজ করবে।'
              : 'Uses native iOS Taptic Engine click feedback on button taps.'}
          </div>
        )}
      </div>

      {/* SWIPE GESTURES TOGGLE CARD */}
      <div className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
              <MoveHorizontal className="w-4 h-4 stroke-[2]" />
              <span>{lang === 'bn' ? 'স্লাইড জেসচার' : 'Swipe Gestures'}</span>
            </h2>
            <p className="text-xs text-[#757575] mt-0.5">
              {lang === 'bn' ? 'টেনে রিমাইন্ডার পাঠানো বা ডিলিট করা' : 'Swipe to remind or delete customers'}
            </p>
          </div>
          <button
            onClick={() => onSwipeGesturesToggle(!swipeGesturesEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
              swipeGesturesEnabled ? 'bg-black dark:bg-white' : 'bg-[#E2E2E2] dark:bg-[#333333]'
            }`}
          >
            <div className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
              swipeGesturesEnabled 
                ? 'translate-x-6 bg-white dark:bg-black' 
                : 'translate-x-0 bg-white dark:bg-black'
            }`} />
          </button>
        </div>
      </div>

      {/* CUSTOM KEYPAD & SOUND TOGGLE CARD */}
      <div className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4 stroke-[2]" />
              <span>{lang === 'bn' ? 'কাস্টম কিবোর্ড' : 'Custom Keypad'}</span>
            </h2>
            <p className="text-xs text-[#757575] leading-relaxed">
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
                // If custom keypad gets disabled, so will keyboard sound
                setKeypadSoundOn(false);
                setKeypadSoundEnabled(false);
              }
            }}
            className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
              customKeypadOn ? 'bg-black dark:bg-white' : 'bg-[#E2E2E2] dark:bg-[#333333]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                customKeypadOn
                  ? 'translate-x-6 bg-white dark:bg-black'
                  : 'translate-x-0 bg-white dark:bg-black'
              }`}
            />
          </button>
        </div>

        {/* Keyboard Sound Toggle - only visible when Custom Keypad is enabled */}
        {customKeypadOn && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 animate-reveal">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-slate-500 dark:text-slate-400 stroke-[2]" />
                <span>{lang === 'bn' ? 'কিবোর্ড সাউন্ড' : 'Keyboard Sound'}</span>
              </h3>
              <p className="text-xs text-[#757575] leading-relaxed">
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
                keypadSoundOn ? 'bg-black dark:bg-white' : 'bg-[#E2E2E2] dark:bg-[#333333]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                  keypadSoundOn
                    ? 'translate-x-6 bg-white dark:bg-black'
                    : 'translate-x-0 bg-white dark:bg-black'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* SEARCH BANGLA IN ENGLISH TOGGLE CARD */}
      <div className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
              <Search className="w-4 h-4 stroke-[2]" />
              <span>
                {lang === 'bn' ? 'ফোনেটিক বাংলা সার্চ' : 'Phonetic Bangla Search'}
              </span>
            </h2>
            <p className="text-xs text-[#757575] leading-relaxed">
              {lang === 'bn'
                ? 'ইংরেজি অক্ষরে বাংলা নামের উচ্চারণ লিখে খুঁজুন (যেমন "rahim" লিখলে "রহিম" পাওয়া যাবে)। নিখুঁত ইংরেজি সার্চের জন্য বন্ধ রাখুন।'
                : 'Find Bengali names when typing in English letters (e.g. typing "rahim" finds "রহিম"). Turn off for exact English matching.'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSearchBanglaInEnglish}
            className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
              searchBanglaInEnglish ? 'bg-black dark:bg-white' : 'bg-[#E2E2E2] dark:bg-[#333333]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full shadow-xs transform transition-transform ${
                searchBanglaInEnglish
                  ? 'translate-x-6 bg-white dark:bg-black'
                  : 'translate-x-0 bg-white dark:bg-black'
              }`}
            />
          </button>
        </div>
      </div>

      {/* BIOMETRIC AUTHENTICATION SECURITY CARD */}
      <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Fingerprint className="w-4 h-4 stroke-[2]" />
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
              biometricOn ? 'bg-emerald-600' : 'bg-[#E2E2E2] dark:bg-[#333333]'
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
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
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
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-700 hover:border-slate-950 dark:hover:border-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'এখনই লক স্ক্রিন দেখুন' : 'Lock Screen Now'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* AUTO MERGE / ARCHIVE LEDGER STATEMENTS CARD */}
      <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Archive className="w-4 h-4 stroke-[2]" />
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
                  await resolvedUpdateAutoMerge(false, Number(keepCountInput) || 15);
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
              settings?.autoMergeStatements ? 'bg-emerald-600' : 'bg-[#E2E2E2] dark:bg-[#333333]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                settings?.autoMergeStatements ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Configuration when enabled */}
        {settings?.autoMergeStatements && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-reveal">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
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
                {/* Borderless + / - Stepper Control (No input field or squared border) */}
                <div className="inline-flex items-center gap-1.5 select-none">
                  <button
                    type="button"
                    disabled={archivingBusy}
                    onClick={() => {
                      triggerHaptic('tick');
                      const cur = parseInt(keepCountInput, 10) || 15;
                      setKeepCountInput(String(Math.max(5, cur - 5)));
                    }}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                    aria-label="Decrease count"
                  >
                    <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                  <span className="min-w-[2.25rem] text-center font-mono font-black text-sm text-slate-950 dark:text-white tabular-nums">
                    {formatNumber(parseInt(keepCountInput, 10) || 15, lang)}
                  </span>
                  <button
                    type="button"
                    disabled={archivingBusy}
                    onClick={() => {
                      triggerHaptic('tick');
                      const cur = parseInt(keepCountInput, 10) || 15;
                      setKeepCountInput(String(Math.min(500, cur + 5)));
                    }}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                    aria-label="Increase count"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={archivingBusy}
                  onClick={async () => {
                    if (!resolvedUpdateAutoMerge) return;
                    const parsed = Math.max(5, Math.min(500, parseInt(keepCountInput, 10) || 15));
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
                  className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold text-xs rounded-xl border-2 border-slate-950 dark:border-white cursor-pointer transition-colors"
                >
                  {archivingBusy ? (lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Applying...') : (lang === 'bn' ? 'প্রয়োগ করুন' : 'Apply')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Archived Records Download Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{lang === 'bn' ? 'আর্কাইভকৃত পুরনো রেকর্ড:' : 'Archived Old Records:'}</span>
              <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                {formatNumber(archivedStatements.length, lang)}
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
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-700 hover:border-slate-950 dark:hover:border-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              disabled={exportingArchive || archivedStatements.length === 0}
              onClick={() => handleDownloadArchivedRecords('json')}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 border-2 border-slate-950 dark:border-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'আর্কাইভ ডাউনলোড (.json)' : 'Download Archive (.json)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. BUSINESS LEDGER INSIGHT STATISTICS */}
      <div className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-3">
        <h3 className="text-xs font-bold text-[#757575] uppercase tracking-wider">
          {t.ledgerInsights}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] font-bold text-[#757575] block uppercase tracking-wider">{t.totalClients}</span>
            <span className="text-xl font-black text-black dark:text-white mt-1 block tabular-nums font-mono">
              {formatNumber(customers.length, lang)}
            </span>
          </div>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] font-bold text-[#757575] block uppercase tracking-wider">{t.totalTransactions}</span>
            <span className="text-xl font-black text-black dark:text-white mt-1 block tabular-nums font-mono">
              {formatNumber(settings?.transactionsCount || 0, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. AUTOMATIC CLOUD AND OFFLINE BACKUP */}
      <div className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-4">
        <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
          <Cloud className="w-4 h-4 stroke-[2]" />
          {t.databaseSafety}
        </h3>
        
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-lg space-y-2">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-black dark:text-white">{t.connectedCloud}</div>
              <p className="text-[11px] text-[#757575] mt-0.5 leading-snug">
                {t.allCalculationsSynced}
              </p>
            </div>
          </div>
        </div>

        {/* Offline Backup Export action */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-black dark:text-white">{lang === 'bn' ? 'ব্যাকআপ লিখন ডাউনলোড (.json)' : 'Save Backup (.json)'}</div>
            <p className="text-[11px] text-[#757575]">{lang === 'bn' ? 'সরাসরি ব্যাকআপ হিসাব ডাউনলোড করে রাখুন।' : 'Download a full ledger copy for safe keeping.'}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              disabled={exporting}
              onClick={handleBackupExport}
              className="px-4 py-2.5 bg-black hover:bg-[#262626] dark:bg-white dark:hover:bg-[#E2E2E2] font-bold text-white dark:text-black rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-75"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? (lang === 'bn' ? 'প্রস্তুত হচ্ছে...' : 'Preparing...') : (lang === 'bn' ? 'ব্যাকআপ ফাইল সংরক্ষণ' : 'Download Backup')}
            </button>

            <button
              type="button"
              onClick={handleImportClick}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800 font-bold text-black dark:text-white border border-slate-200 dark:border-slate-800/80 rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
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

      {/* 5. OWNER PROFILE ACCOUNT DETAIL */}
      <div className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">{lang === 'bn' ? 'মালিকানা অ্যাকাউন্ট' : 'Owner Account'}</div>
          <div className="text-sm font-bold text-black dark:text-white mt-0.5">
            {auth.currentUser?.displayName || (lang === 'bn' ? 'সম্মানিত লেজার মালিক' : 'Business Owner')}
          </div>
          <p className="text-xs text-[#757575] mt-0.5">{settings?.email || 'N/A'}</p>
        </div>

        <button
          onClick={() => {
            triggerHaptic('double');
            onSignOut();
          }}
          className="px-4 py-2.5 bg-[#FFECEB] hover:bg-[#FFD9D7] text-[#DC2626] dark:bg-[#DC2626]/20 dark:hover:bg-[#DC2626]/30 dark:text-[#FF6B5B] font-bold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t.signOutBtn}
        </button>
      </div>

      {/* 6. NATIVE PWA INSTALL APP */}
      {!isDismissed && !isStandalone && deferredPrompt && (
        <div className="relative bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button 
            onClick={() => {
              localStorage.setItem('install_card_dismissed', 'true');
              setIsDismissed(true);
            }}
            className="absolute top-3 right-3 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer transition-colors sm:hidden text-[#757575]"
            title={lang === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <div className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">
              {lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
            </div>
            <div className="text-sm font-bold text-black dark:text-white mt-0.5">
              {lang === 'bn' ? 'হোম স্ক্রিনে যুক্ত করুন' : 'Add to Home Screen'}
            </div>
            <p className="text-xs text-[#757575] mt-0.5">
              {lang === 'bn' ? 'দ্রুত অ্যাক্সেস এবং ফুলস্ক্রিন অভিজ্ঞতার জন্য অ্যাপটি ইনস্টল করুন।' : 'Install the app for quick access and a fullscreen experience.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => {
                localStorage.setItem('install_card_dismissed', 'true');
                setIsDismissed(true);
              }}
              className="hidden sm:inline-flex px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 text-black dark:text-white font-bold rounded-lg text-xs justify-center items-center cursor-pointer transition-colors"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
            </button>
            <button
              onClick={async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                  onInstallComplete();
                }
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-black hover:bg-[#262626] dark:bg-white dark:hover:bg-[#E2E2E2] text-white dark:text-black font-bold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'ইনস্টল' : 'Install'}
            </button>
          </div>
        </div>
      )}

      {/* TRASH / DELETED CUSTOMER ACCOUNTS CARD */}
      <div className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 stroke-[2]" />
              {lang === 'bn' ? 'অস্থায়ী ট্র্যাশ (মুছে ফেলা গ্রাহক)' : 'Trash (Deleted Customers)'}
            </h2>
            <p className="text-xs text-[#757575] mt-0.5">
              {lang === 'bn' 
                ? 'ভুলবশত মুছে ফেলা গ্রাহক এখান থেকে উদ্ধার করা যাবে। ১৪ দিন পর স্থায়ীভাবে ডিলিট হবে।' 
                : 'Recover mistakenly deleted customers. Items are permanently deleted after 14 days.'}
            </p>
          </div>

          {trashCustomers.length > 0 && (
            <button
              onClick={() => {
                triggerHaptic('double');
                openConfirmAction({ type: 'empty_trash' });
              }}
              className="px-3.5 py-1.5 border border-[#DC2626] text-[#DC2626] hover:bg-[#FFECEB] dark:hover:bg-[#DC2626]/20 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'ট্র্যাশ খালি করুন' : 'Empty Trash'}
            </button>
          )}
        </div>

        {trashCustomers.length > 0 ? (
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] max-h-96 overflow-y-auto pr-1">
            {trashCustomers.map(c => {
              const deletionTime = c.deletedAt ? new Date(c.deletedAt).getTime() : new Date().getTime();
              const msPassed = new Date().getTime() - deletionTime;
              const daysRemaining = Math.max(1, 14 - Math.floor(msPassed / (24 * 60 * 60 * 1000)));

              return (
                <div 
                  key={c.id} 
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-black dark:text-white truncate">
                      {c.name}
                    </div>
                    <div className="text-xs text-[#757575] mt-0.5">
                      {c.phone || (lang === 'bn' ? '(ফোন নম্বর নেই)' : '(No phone)')}
                    </div>
                    <div className="text-[11px] font-semibold text-[#DC2626] mt-0.5">
                      {lang === 'bn' 
                        ? `স্থায়ীভাবে মুছতে ${formatNumber(daysRemaining, 'bn')} দিন বাকি` 
                        : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">
                        {lang === 'bn' ? 'ব্যালেন্স' : 'Balance'}
                      </div>
                      <div className={`text-sm font-black font-mono tabular-nums ${
                        c.outstandingDue > 0 
                          ? 'text-[#DC2626]' 
                          : c.outstandingDue < 0 
                            ? 'text-[#059669]' 
                            : 'text-[#757575]'
                      }`}>
                        ৳ {formatNumber(c.outstandingDue || 0, lang)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          triggerHaptic('single');
                          openConfirmAction({ type: 'restore', customer: c });
                        }}
                        title={lang === 'bn' ? 'পুনরুদ্ধার করুন' : 'Restore'}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-black dark:bg-slate-900/60 dark:hover:bg-slate-800 dark:text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center border border-slate-200 dark:border-slate-800/80"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('double');
                          openConfirmAction({ type: 'delete_perm', customer: c });
                        }}
                        title={lang === 'bn' ? 'স্থায়ীভাবে মুছুন' : 'Delete Permanently'}
                        className="p-2 bg-[#FFECEB] hover:bg-[#FFD9D7] text-[#DC2626] dark:bg-[#DC2626]/20 dark:hover:bg-[#DC2626]/30 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-[#757575] text-xs font-semibold">
            {lang === 'bn' ? 'ট্র্যাশ খালি আছে' : 'Trash is empty'}
          </div>
        )}
      </div>

      {/* Trash Action Confirmation Modal */}
      {confirmAction && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={closeConfirmAction}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#0D121D] w-full max-w-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-6"
          >
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                {confirmAction.type === 'restore' ? (
                  <RotateCcw className="w-6 h-6 text-slate-950 dark:text-white" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                )}
              </div>
              
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white mb-1.5">
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
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-left space-y-1.5 mt-4 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">{lang === 'bn' ? 'নাম' : 'Name'}</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{confirmAction.customer.name}</span>
                  </div>
                  {confirmAction.customer.phone && (
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">{lang === 'bn' ? 'মোবাইল' : 'Mobile'}</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300 font-mono">{confirmAction.customer.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">{lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Current Balance'}</span>
                    <span className={`font-mono font-bold ${
                      confirmAction.customer.outstandingDue > 0 
                        ? 'text-rose-600 dark:text-rose-400' 
                        : confirmAction.customer.outstandingDue < 0 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-slate-500'
                    }`}>
                      {confirmAction.customer.outstandingDue === 0 ? (lang === 'bn' ? 'পরিশোধিত' : 'Settled') : "৳ " + formatNumber(confirmAction.customer.outstandingDue, lang)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <button
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
                className={`w-full py-2.5 font-bold rounded-xl border-2 cursor-pointer text-xs transition-colors ${
                  confirmAction.type === 'restore' 
                    ? 'bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 border-slate-950 dark:border-white' 
                    : 'bg-rose-600 hover:bg-rose-700 text-white border-transparent hover:border-slate-950 dark:hover:border-white'
                }`}
              >
                {confirmAction.type === 'restore' && (lang === 'bn' ? 'হ্যাঁ, পুনরুদ্ধার করুন' : 'Yes, Restore')}
                {confirmAction.type === 'empty_trash' && (lang === 'bn' ? 'হ্যাঁ, খালি করুন' : 'Yes, Empty Trash')}
                {confirmAction.type === 'delete_perm' && (lang === 'bn' ? 'হ্যাঁ, স্থায়ীভাবে মুছুন' : 'Yes, Delete Permanently')}
              </button>
              
              <button
                onClick={() => {
                  triggerHaptic('single');
                  closeConfirmAction();
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer text-xs transition-colors"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* JSON Backup Import Modal */}
      {importState.showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 no-select backdrop-blur-xs"
          onClick={() => !importState.loading && setImportState(prev => ({ ...prev, showModal: false }))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-reveal bg-white dark:bg-[#0D121D] w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-6 space-y-5 max-h-[88vh] overflow-y-auto hide-scrollbar"
          >
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
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
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {importState.loading ? (
              <div className="py-6 px-1 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      className="text-slate-200 dark:text-slate-800"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="50"
                      cy="50"
                    />
                    <circle
                      className="text-slate-950 dark:text-white transition-all duration-300"
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * (importProgress?.percent || 5)) / 100}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="50"
                      cy="50"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xs font-mono font-bold text-slate-950 dark:text-white">
                      {formatNumber(importProgress?.percent || 5, lang)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-950 dark:text-white flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
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

                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-slate-950 dark:bg-white h-full transition-all duration-300"
                    style={{ width: `${Math.max(5, importProgress?.percent || 5)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 font-medium px-1 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
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

                <div className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 text-left">
                  {lang === 'bn'
                    ? 'দয়া করে অপেক্ষা করুন। ব্যাকআপ রিস্টোর চলাকালীন পেজটি রিলোড বা বন্ধ করবেন না।'
                    : 'Please wait. Do not close or refresh this page while restore is in progress.'}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {/* File Meta Info */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'ব্যাকআপ সময়:' : 'Backup Date:'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {importState.backupData.backupTimestamp 
                          ? new Date(importState.backupData.backupTimestamp).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US') 
                          : (lang === 'bn' ? 'প্রযোজ্য নয়' : 'N/A')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'গ্রাহক ও ক্রেডিট কার্ড হিসাব:' : 'Accounts & Credit Cards:'}</span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {formatNumber(importState.backupData.customers?.length || 0, lang)}
                        {Array.isArray(importState.backupData.customers) && importState.backupData.customers.some((c: any) => c.accountType === 'credit_card')
                          ? ` (${formatNumber(importState.backupData.customers.filter((c: any) => c.accountType === 'credit_card').length, lang)} ${lang === 'bn' ? 'কার্ড' : 'cards'})`
                          : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'লেনদেনের সংখ্যা:' : 'Total Transactions:'}</span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {formatNumber(importState.backupData.ledgerTransactions?.length || 0, lang)}
                      </span>
                    </div>
                    {Array.isArray(importState.backupData.goals) && (
                      <div className="flex justify-between">
                        <span>{lang === 'bn' ? 'লক্ষ্য ও উন্মুক্ত সঞ্চয়:' : 'Goals & Flexible Savings:'}</span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {formatNumber(importState.backupData.goals.length, lang)}
                          {importState.backupData.goals.some((g: any) => g.isOpenEnded)
                            ? ` (${formatNumber(importState.backupData.goals.filter((g: any) => g.isOpenEnded).length, lang)} ${lang === 'bn' ? 'উন্মুক্ত' : 'flexible'})`
                            : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Restore Choices */}
                  <div className="space-y-2.5">
                    {/* Choice 1 */}
                    <button
                      type="button"
                      onClick={() => setImportState(prev => ({ ...prev, choice: 'merge' }))}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer flex gap-3 ${
                        importState.choice === 'merge'
                          ? 'border-slate-950 dark:border-white bg-slate-50 dark:bg-slate-900'
                          : 'border-slate-300 dark:border-slate-700 bg-transparent hover:border-slate-900 dark:hover:border-white'
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
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-950 text-white dark:bg-white dark:text-slate-950 rounded">
                            {lang === 'bn' ? 'প্রস্তাবিত' : 'Recommended'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                          {lang === 'bn' 
                            ? 'ফাইলটি লাইভ ডাটাবেসের সাথে তুলনা করে অনুপস্থিত এন্ট্রি যোগ করবে এবং কোনো পরিবর্তন থাকলে আপডেট করবে।' 
                            : 'Compares file with live database. Adds missing entries and updates existing ones if changed.'}
                        </p>
                      </div>
                    </button>

                    {/* Choice 2 */}
                    <button
                      type="button"
                      onClick={() => setImportState(prev => ({ ...prev, choice: 'skip' }))}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer flex gap-3 ${
                        importState.choice === 'skip'
                          ? 'border-slate-950 dark:border-white bg-slate-50 dark:bg-slate-900'
                          : 'border-slate-300 dark:border-slate-700 bg-transparent hover:border-slate-900 dark:hover:border-white'
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

                    {/* Choice 3 */}
                    <button
                      type="button"
                      onClick={() => setImportState(prev => ({ ...prev, choice: 'clear' }))}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer flex gap-3 ${
                        importState.choice === 'clear'
                          ? 'border-rose-600 dark:border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                          : 'border-slate-300 dark:border-slate-700 bg-transparent hover:border-rose-600 dark:hover:border-rose-500'
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
                        <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90 mt-1 leading-normal">
                          {lang === 'bn' 
                            ? 'সতর্কতা: বর্তমান ডাটাবেসের সমস্ত তথ্য মুছে ফেলবে এবং ব্যাকআপ ফাইল দিয়ে প্রতিস্থাপন করবে।' 
                            : 'WARNING: Completely wipes existing live database and replaces with file.'}
                        </p>
                      </div>
                    </button>

                    {importState.choice === 'clear' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-3.5 rounded-xl space-y-2"
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
                          className="w-full px-3 py-2 bg-white dark:bg-[#0D121D] border-2 border-rose-300 dark:border-rose-800 rounded-xl text-xs text-center font-bold tracking-widest text-rose-600 dark:text-rose-400 outline-none"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-2">
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
                    className={`w-full py-2.5 text-white font-bold rounded-xl border-2 text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      importState.choice === 'clear'
                        ? 'bg-rose-600 hover:bg-rose-700 border-transparent hover:border-slate-950 dark:hover:border-white disabled:opacity-40'
                        : 'bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-950 border-slate-950 dark:border-white disabled:opacity-40'
                    }`}
                  >
                    {lang === 'bn' ? 'ইম্পোর্ট শুরু করুন' : 'Confirm Import'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportState(prev => ({ ...prev, showModal: false }))}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-xs cursor-pointer transition-colors"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* AUTO-MERGE STATEMENTS ACTIVATION MODAL (Center-staged popup, clean header, keyboard-aware & scroll-locked) */}
      {showAutoMergeWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 no-select"
          onClick={() => !archivingBusy && setShowAutoMergeWarning(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-reveal bg-white dark:bg-[#0D121D] w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-6 space-y-5 max-h-[88vh] overflow-y-auto hide-scrollbar"
          >
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
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
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {archivingBusy ? (
              <div className="py-6 px-1 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      className="text-slate-200 dark:text-slate-800"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="50"
                      cy="50"
                    />
                    <circle
                      className="text-slate-950 dark:text-white transition-all duration-300"
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * (archiveProgress?.percent || 8)) / 100}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="50"
                      cy="50"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xs font-mono font-bold text-slate-950 dark:text-white">
                      {archiveProgress?.percent || 8}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-950 dark:text-white flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
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
                        : `Keeping latest ${Number(keepCountInput) || 15} per profile • Archived: ${archiveProgress.archivedSoFar}`}
                    </p>
                  )}
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-slate-950 dark:bg-white h-full transition-all duration-300"
                    style={{ width: `${Math.max(8, archiveProgress?.percent || 8)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 font-medium px-1 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
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

                <div className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 text-left">
                  {lang === 'bn'
                    ? 'দয়া করে অপেক্ষা করুন। প্রতিটি গ্রাহকের প্রোফাইল পরীক্ষা করে পুরনো লেনদেনগুলো আর্কাইভে সংরক্ষণ করা হচ্ছে।'
                    : 'Please wait while we scan each profile, keep the latest entries, and move older statements to their archive.'}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-slate-700 dark:text-slate-200 font-medium">
                    <p>
                      •{' '}
                      {lang === 'bn'
                        ? `প্রতিটি গ্রাহকের খতিয়ানে শুধুমাত্র সর্বশেষ ${formatNumber(Number(keepCountInput) || 15, 'bn')}টি লেনদেন সক্রিয় থাকবে (প্রাথমিকভাবে ৫টি দৃশ্যমান থাকবে এবং বাকিগুলো 'আরও দেখুন' বাটনে থাকবে)।`
                        : `Only the latest ${Number(keepCountInput) || 15} transactions per customer will remain in the active ledger statement (5 visible initially, others behind 'Show More').`}
                    </p>
                    <p>
                      •{' '}
                      {lang === 'bn'
                        ? 'পুরনো লেনদেনগুলো ডিলিট না হয়ে প্রতিটি প্রোফাইলের আর্কাইভে জমা থাকবে। আর্কাইভকৃত রেকর্ডগুলো ডাউনলোড করা যাবে কিন্তু এডিট করা যাবে না।'
                        : 'Older transactions are moved to each profile’s Archive. Archived records can be downloaded anytime but cannot be edited.'}
                    </p>
                    <p>
                      •{' '}
                      {lang === 'bn'
                        ? 'গ্রাহকের বর্তমান বকেয়া বা ব্যালেন্স অপরিবর্তিত থাকবে এবং কোনো "Initial Balance Adjustment" এন্ট্রি তৈরি হবে না।'
                        : 'Customer balances remain unchanged without adding any "Initial Balance Adjustment" entry.'}
                    </p>
                  </div>

                  {/* Minimal Borderless + / - Stepper Row (No input field or squared border) */}
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
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
                          const cur = parseInt(keepCountInput, 10) || 15;
                          setKeepCountInput(String(Math.max(5, cur - 5)));
                        }}
                        className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer"
                        aria-label="Decrease count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <span className="min-w-[2.25rem] text-center font-mono font-black text-base text-slate-950 dark:text-white tabular-nums">
                        {formatNumber(parseInt(keepCountInput, 10) || 15, lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          const cur = parseInt(keepCountInput, 10) || 15;
                          setKeepCountInput(String(Math.min(500, cur + 5)));
                        }}
                        className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer"
                        aria-label="Increase count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={archivingBusy}
                    onClick={async () => {
                      if (!resolvedUpdateAutoMerge) return;
                      const parsed = Math.max(5, Math.min(500, parseInt(keepCountInput, 10) || 15));
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
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-2 border-transparent hover:border-slate-950 dark:hover:border-white text-xs cursor-pointer transition-colors"
                  >
                    {lang === 'bn'
                      ? 'অটো-মার্জ চালু করুন'
                      : 'Enable Auto-Merge'}
                  </button>

                  <button
                    type="button"
                    disabled={archivingBusy}
                    onClick={() => setShowAutoMergeWarning(false)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-xs cursor-pointer transition-colors"
                  >
                    {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
