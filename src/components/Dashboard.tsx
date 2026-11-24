import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Customer, Transaction, Reminder } from '../types';
import {
  ArrowUpRight, ArrowDownLeft, ArrowRight, Plus, ChevronRight,
  ClipboardList, MessageSquare, Calendar, MapPin, Bell, Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { translations, formatNumber, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import AnalyticsManager from './AnalyticsManager';
import WeatherLocationModal, { WeatherGlyph } from './WeatherLocationModal';
import TagDistributionChart from './TagDistributionChart';
import {
  WeatherData,
  WeatherLocation,
  describeWeatherCode,
  fetchCurrentWeather,
  loadCachedWeather,
  loadSavedWeatherLocation,
  saveWeatherLocation
} from '../lib/weather';
import {
  StaggerReveal,
  SpotlightCard,
  ScrollParallaxStage,
  CircularGauge
} from './MotionPrimitives';

const parseFirestoreDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

/**
 * Zero-React-rerender count-up component.
 * Mutates the DOM text node directly inside requestAnimationFrame so React never re-renders during animation.
 */
function CountUpSpan({
  value,
  lang,
  enabled = true,
  prefix = '',
  suffix = '',
  duration = 560
}: {
  value: number;
  lang: Language;
  enabled?: boolean;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    if (!enabled || value === 0) {
      el.textContent = `${prefix}${formatNumber(value, lang)}${suffix}`;
      return;
    }

    let startTime: number | null = null;
    let rafId: number;
    let lastRendered = -1;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(value * eased);

      if (current !== lastRendered) {
        lastRendered = current;
        el.textContent = `${prefix}${formatNumber(current, lang)}${suffix}`;
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        el.textContent = `${prefix}${formatNumber(value, lang)}${suffix}`;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, lang, enabled, prefix, suffix, duration]);

  return (
    <span ref={spanRef}>
      {`${prefix}${formatNumber(value, lang)}${suffix}`}
    </span>
  );
}

interface DashboardProps {
  customers: Customer[];
  transactions: Transaction[];
  tagTransactions?: Transaction[];
  transactionsCount: number;
  monthlySummaries: any[];
  onOpenQuickEntry: () => void;
  onSelectCustomer: (id: string) => void;
  lang: Language;
  onViewDailyTxs: () => void;
  userName?: string;
  greetingMessage?: string;
  reminders?: Reminder[];
  showDashboardReminders?: boolean;
  showTagChart?: boolean;
  onOpenReminders?: () => void;
}

const Dashboard = React.memo(function Dashboard({
  customers,
  transactions,
  tagTransactions,
  transactionsCount,
  monthlySummaries,
  onOpenQuickEntry,
  onSelectCustomer,
  lang,
  onViewDailyTxs,
  userName = '',
  greetingMessage = '',
  reminders = [],
  showDashboardReminders = true,
  showTagChart = true,
  onOpenReminders
}: DashboardProps) {
  const t = translations[lang];
  const [journalFilter, setJournalFilter] = useState<'all' | 'due' | 'payment'>('all');
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => loadSavedWeatherLocation());
  const [weather, setWeather] = useState<WeatherData | null>(() => loadCachedWeather(loadSavedWeatherLocation()));
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);

  const loadWeatherFor = useCallback((loc: WeatherLocation, forceRefresh = false) => {
    setWeatherLocation(loc);
    saveWeatherLocation(loc);
    if (!forceRefresh) {
      const cached = loadCachedWeather(loc);
      if (cached) {
        setWeather(cached);
        setIsLoadingWeather(false);
        return;
      }
    }
    setIsLoadingWeather(true);
    fetchCurrentWeather(loc, { forceRefresh })
      .then((data) => {
        setWeather(data);
      })
      .catch(() => {
        // Keep last known weather on offline/transient failure
      })
      .finally(() => {
        setIsLoadingWeather(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const cached = loadCachedWeather(weatherLocation);
    if (cached) {
      setWeather(cached);
      return () => controller.abort();
    }
    setIsLoadingWeather(true);
    fetchCurrentWeather(weatherLocation, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setWeather(data);
        }
      })
      .catch(() => {
        // Silent fallback when offline
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingWeather(false);
        }
      });
    return () => controller.abort();
  }, [weatherLocation]);

  const upcomingReminders = useMemo(() => {
    if (!showDashboardReminders || !reminders.length) return [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const getEffectiveDueDate = (r: Reminder): Date | null => {
      if (r.type === 'emi' && r.emiDayOfMonth) {
        const candidate = new Date(now.getFullYear(), now.getMonth(), r.emiDayOfMonth);
        if (candidate.getTime() < todayStart) {
          return new Date(now.getFullYear(), now.getMonth() + 1, r.emiDayOfMonth);
        }
        return candidate;
      }
      if (r.dueDate) return parseFirestoreDate(r.dueDate);
      return null;
    };

    return reminders
      .filter((r) => r.active)
      .map((r) => {
        const dueDate = getEffectiveDueDate(r);
        const dayDiff = dueDate
          ? Math.round((new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime() - todayStart) / 86400000)
          : 9999;
        return { reminder: r, dueDate, dayDiff };
      })
      .sort((a, b) => a.dayDiff - b.dayDiff)
      .slice(0, 3);
  }, [reminders, showDashboardReminders]);

  const weatherMeta = useMemo(() => {
    if (!weather) return null;
    return describeWeatherCode(weather.weatherCode, weather.isDay, lang);
  }, [weather, lang]);
  const filterTrackRef = useRef<HTMLDivElement>(null);
  const [hasUserToggledFilter, setHasUserToggledFilter] = useState(false);
  const [pillRect, setPillRect] = useState<{ x: number; w: number; ready: boolean }>({
    x: 4,
    w: 0,
    ready: false,
  });

  const isDesktop = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 768px)').matches;
  }, []);

  const stats = useMemo(() => {
    const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingDue > 0 ? c.outstandingDue : 0), 0);
    const activeDebtorsCount = customers.filter(c => c.outstandingDue > 0).length;
    const settledCount = customers.filter(c => c.outstandingDue === 0).length;
    const totalOverpaid = customers.reduce((sum, c) => sum + (c.outstandingDue < 0 ? Math.abs(c.outstandingDue) : 0), 0);
    const activeCreditorsCount = customers.filter(c => c.outstandingDue < 0).length;

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const todayTxs = transactions.filter(tx => {
      const txDate = parseFirestoreDate(tx.date);
      return txDate.toDateString() === new Date().toDateString() || txDate >= midnight;
    });

    const duesToday = todayTxs
      .filter(tx => tx.type === 'due')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const paymentsToday = todayTxs
      .filter(tx => tx.type === 'payment')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const duesCountToday = todayTxs.filter(tx => tx.type === 'due').length;
    const paymentsCountToday = todayTxs.filter(tx => tx.type === 'payment').length;

    const topDebtors = [...customers]
      .filter(c => c.outstandingDue > 0)
      .sort((a, b) => b.outstandingDue - a.outstandingDue)
      .slice(0, 3);

    return {
      totalOutstanding,
      activeDebtorsCount,
      settledCount,
      totalOverpaid,
      activeCreditorsCount,
      duesToday,
      paymentsToday,
      duesCountToday,
      paymentsCountToday,
      topDebtors,
      todayTxs
    };
  }, [customers, transactions]);

  const paymentRatio = useMemo(() => {
    const totalActiveActions = stats.duesToday + stats.paymentsToday;
    if (totalActiveActions === 0) return 0;
    return Math.round((stats.paymentsToday / totalActiveActions) * 100);
  }, [stats]);

  const filteredTxs = useMemo(() => {
    if (journalFilter === 'all') return stats.todayTxs;
    return stats.todayTxs.filter(tx => tx.type === journalFilter);
  }, [stats.todayTxs, journalFilter]);

  useLayoutEffect(() => {
    const track = filterTrackRef.current;
    if (!track) return;

    const measure = () => {
      const activeBtn = track.querySelector<HTMLButtonElement>(
        `button[data-qfilter="${journalFilter}"]`
      );
      if (!activeBtn) return;
      const x = activeBtn.offsetLeft;
      const w = activeBtn.offsetWidth;
      if (w > 0) {
        setPillRect((prev) =>
          prev.ready && prev.x === x && prev.w === w ? prev : { x, w, ready: true }
        );
      }
    };

    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(track);
      track.querySelectorAll('button').forEach((btn) => ro.observe(btn));
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, [journalFilter, lang, stats.todayTxs.length, stats.paymentsCountToday, stats.duesCountToday]);

  const getWhatsAppDueLink = (c: Customer) => {
    let phoneNum = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';
    if (phoneNum.startsWith('01')) phoneNum = '88' + phoneNum;
    const msg = lang === 'bn'
      ? `আসসালামু আলাইকুম ${c.name}। আপনার কাছে আমাদের বকেয়া পাওনা ৳${formatNumber(c.outstandingDue, 'bn')}। সম্ভব হলে অনুগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ!`
      : `Hi ${c.name}, friendly reminder that your outstanding due is ৳${formatNumber(c.outstandingDue, 'en')}. Please clear it at your earliest convenience. Thank you!`;
    return `https://wa.me/${phoneNum}?text=${encodeURIComponent(msg)}`;
  };

  const { todayFormattedShort, todayFormattedFull } = useMemo(() => {
    const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
    const now = new Date();
    try {
      return {
        todayFormattedShort: now.toLocaleDateString(locale, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        }),
        todayFormattedFull: now.toLocaleDateString(locale, {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })
      };
    } catch {
      return { todayFormattedShort: '', todayFormattedFull: '' };
    }
  }, [lang]);

  const subheaderTracking = lang === 'bn' ? 'tracking-normal text-xs font-bold' : 'micro-mono-label font-semibold';
  const compactSubheaderTracking = lang === 'bn' ? 'tracking-normal text-[11px] font-bold' : 'micro-mono-label font-semibold';

  const efficiencyStatusLabel = useMemo(() => {
    if (stats.duesToday === 0 && stats.paymentsToday === 0) {
      return lang === 'bn' ? 'স্থিতিশীল' : 'Standby';
    }
    if (paymentRatio >= 70) return lang === 'bn' ? 'চমৎকার আদায়' : 'Strong Flow';
    if (paymentRatio >= 40) return lang === 'bn' ? 'মাঝারি আদায়' : 'Balanced';
    return lang === 'bn' ? 'বাকি বেশি' : 'Credit Heavy';
  }, [stats.duesToday, stats.paymentsToday, paymentRatio, lang]);

  const displayGreeting = greetingMessage || (lang === 'bn' ? 'স্বাগতম' : 'Welcome back');
  const displayFirstName = useMemo(() => {
    const clean = (userName || '').trim();
    if (!clean) return lang === 'bn' ? 'ব্যবহারকারী' : 'Guest';
    return clean;
  }, [userName, lang]);

  return (
    <div data-view="dashboard" className="space-y-8 sm:space-y-10 no-select pb-16 max-w-6xl mx-auto">
      {/* =========================================================================
          0. CARDLESS GREET, WEATHER & UPCOMING REMINDERS STAGE (Scroll-to-Shrink)
          ========================================================================= */}
      <ScrollParallaxStage rangePx={190}>
        <section className="dash-anim-fade relative pt-1 sm:pt-2 pb-[14px] border-b border-slate-900/[0.08] dark:border-white/[0.08] space-y-4">
          <div className="flex items-start sm:items-end justify-between gap-4">
            {/* Left: Greeting + User Name */}
            <div className="min-w-0 space-y-0.5">
              <p className={`text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'text-xs font-semibold' : 'micro-mono-label font-medium'}`}>
                {displayGreeting}
              </p>
              <h1 className="font-display text-2xl sm:text-[32px] font-bold tracking-[-0.03em] text-slate-950 dark:text-white leading-[1.12] truncate">
                {displayFirstName}
              </h1>
            </div>

            {/* Right: Clickable Open Weather Bar */}
            <button
              type="button"
              id="dashboard_weather_btn"
              onClick={() => {
                triggerHaptic('single');
                setIsWeatherModalOpen(true);
              }}
              className="group shrink-0 flex items-center gap-2.5 sm:gap-3 py-1.5 px-2.5 -mr-2.5 rounded-2xl hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-right touch-press"
              title={lang === 'bn' ? 'আবহাওয়া ও অবস্থান পরিবর্তন করুন' : 'Change weather location'}
            >
              <div className="min-w-0">
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="font-display text-lg sm:text-xl font-bold tabular-nums text-slate-950 dark:text-white leading-none">
                    {weather ? `${formatNumber(weather.temperature, lang)}°` : '--°'}
                  </span>
                  {weatherMeta && (
                    <span className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[110px] sm:max-w-[150px]">
                      {weatherMeta.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3 h-3 stroke-[1.5] shrink-0 opacity-70 group-hover:text-[var(--accent-color)] transition-colors" />
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">{weatherLocation.name}</span>
                </div>
              </div>

              <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
                <WeatherGlyph
                  kind={weatherMeta?.icon || 'partly-cloudy'}
                  className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]"
                  style={{ color: '#F59E0B' }}
                />
              </div>
            </button>
          </div>

          {/* Below: Toggleable Upcoming Reminders Strip (Cardless Hairline List) */}
          {showDashboardReminders && (
            <div className="pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
              {upcomingReminders.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Bell className="w-3.5 h-3.5 stroke-[1.5]" />
                      <span className={lang === 'bn' ? 'text-[11px] font-bold' : 'micro-mono-label font-semibold'}>
                        {lang === 'bn' ? 'আসন্ন রিমাইন্ডার' : 'Upcoming Reminders'}
                      </span>
                    </div>
                    {onOpenReminders && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('single');
                          onOpenReminders();
                        }}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white inline-flex items-center gap-0.5 cursor-pointer transition-colors"
                      >
                        <span>{lang === 'bn' ? 'সব দেখুন' : 'View all'}</span>
                        <ChevronRight className="w-3 h-3 stroke-[1.75]" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {upcomingReminders.map(({ reminder, dueDate, dayDiff }) => {
                      const isOverdue = dayDiff < 0;
                      const isToday = dayDiff === 0;
                      const dueText = !dueDate
                        ? (lang === 'bn' ? 'নির্ধারিত তারিখ নেই' : 'Scheduled')
                        : isOverdue
                          ? (lang === 'bn' ? `${formatNumber(Math.abs(dayDiff), 'bn')} দিন অতিবাহিত` : `${Math.abs(dayDiff)}d overdue`)
                          : isToday
                            ? (lang === 'bn' ? 'আজ বাকি' : 'Due today')
                            : dayDiff === 1
                              ? (lang === 'bn' ? 'আগামীকাল' : 'Tomorrow')
                              : dueDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' });

                      return (
                        <button
                          key={reminder.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('single');
                            onOpenReminders?.();
                          }}
                          className="w-full text-left py-2 px-3 rounded-xl bg-slate-900/[0.03] hover:bg-slate-900/[0.06] dark:bg-white/[0.035] dark:hover:bg-white/[0.07] border border-slate-900/[0.05] dark:border-white/[0.06] transition-colors flex items-center justify-between gap-2.5 cursor-pointer touch-press"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {reminder.customerName || reminder.notes || (lang === 'bn' ? 'রিমাইন্ডার' : 'Reminder')}
                            </p>
                            <div className={`flex items-center gap-1 mt-0.5 text-[11px] font-medium ${
                              isOverdue
                                ? 'text-rose-600 dark:text-rose-400'
                                : isToday
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              <Clock className="w-3 h-3 stroke-[1.5] shrink-0" />
                              <span className="truncate">{dueText}</span>
                            </div>
                          </div>
                          {typeof reminder.installmentAmount === 'number' && reminder.installmentAmount > 0 && (
                            <span className="font-mono text-xs font-bold tabular-nums text-slate-800 dark:text-slate-200 shrink-0">
                              ৳{formatNumber(reminder.installmentAmount, lang)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bell className="w-3.5 h-3.5 stroke-[1.5] opacity-70 shrink-0" />
                    <span className="truncate">
                      {lang === 'bn' ? 'কোনো আসন্ন রিমাইন্ডার নেই' : 'No upcoming reminders scheduled'}
                    </span>
                  </div>
                  {onOpenReminders && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        onOpenReminders();
                      }}
                      className="text-[11px] font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white inline-flex items-center gap-0.5 shrink-0 cursor-pointer transition-colors"
                    >
                      <span>{lang === 'bn' ? 'রিমাইন্ডার' : 'Reminders'}</span>
                      <ChevronRight className="w-3 h-3 stroke-[1.75]" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </ScrollParallaxStage>

      {/* =========================================================================
          1. CARDLESS ATMOSPHERIC HERO STAGE (Scroll Parallax + Monumental Scale)
          ========================================================================= */}
      <ScrollParallaxStage rangePx={260}>
        <section className="dash-anim-fade relative pb-2 space-y-6">
          {/* Monumental Typographic Balance Directly Over Living Aurora */}
          <div className="space-y-2">
            {/* Full-width Header Row so PC Date aligns cleanly to the right margin */}
            <div className="flex items-center justify-between gap-3 w-full">
              <span className={`block text-slate-700 dark:text-slate-200 ${subheaderTracking}`}>
                {t.totalOutstanding}
              </span>

              <div className={`flex items-center gap-1.5 ${lang === 'bn' ? 'text-xs font-bold' : 'micro-mono-label font-medium'} text-slate-600 dark:text-slate-300 shrink-0 whitespace-nowrap`}>
                <Calendar className="w-3.5 h-3.5 stroke-[1.25] opacity-70 shrink-0" />
                <span className="sm:hidden">{todayFormattedShort}</span>
                <span className="hidden sm:inline">{todayFormattedFull}</span>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="hero-balance-display font-extrabold text-slate-950 dark:text-white tracking-[-0.045em] flex items-baseline gap-2.5 flex-wrap">
                  <span className="font-light opacity-40 text-[0.72em] leading-none">৳</span>
                  <span>
                    <CountUpSpan value={stats.totalOutstanding} lang={lang} enabled={true} />
                  </span>
                </div>
              </div>

            {/* Ergonomic Thumb-Zone Action Capsules */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <button
                onClick={() => {
                  triggerHaptic('single');
                  onOpenQuickEntry();
                }}
                className="touch-press flex-1 sm:flex-none px-5 py-3.5 rounded-full text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  boxShadow: '0 14px 30px -10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)'
                }}
                id="dash_quick_entry_btn"
              >
                <Plus className="w-4 h-4 stroke-[1.5] shrink-0" />
                <span className="truncate">{lang === 'bn' ? 'হিসাব লিখুন' : 'Quick Entry'}</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('single');
                  onViewDailyTxs();
                }}
                className="touch-press flex-1 sm:flex-none px-5 py-3.5 rounded-full surface-glass-interactive border text-slate-900 dark:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                id="dash_daily_journal_btn"
              >
                <span className="truncate">{lang === 'bn' ? 'দৈনিক খাতা' : 'Daily Journal'}</span>
                <ArrowRight className="w-4 h-4 stroke-[1.25] shrink-0 opacity-75" />
              </button>
            </div>
            </div>
          </div>

          {/* Open Hairline Telemetry Bar */}
          <div className="pt-5 border-t border-slate-900/[0.08] dark:border-white/[0.08] grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className={`text-slate-500 dark:text-slate-400 truncate ${compactSubheaderTracking}`}>
                {lang === 'bn' ? (
                  'দেনাদার'
                ) : (
                  <>
                    <span className="sm:hidden">Debtors</span>
                    <span className="hidden sm:inline">Active Debtors</span>
                  </>
                )}
              </div>
              <div className="text-lg sm:text-2xl font-display font-bold text-slate-950 dark:text-white tabular-nums leading-none">
                <CountUpSpan value={stats.activeDebtorsCount} lang={lang} enabled={true} />
                <span className="text-[11px] font-sans font-medium text-slate-400 dark:text-slate-500 ml-1">
                  {lang === 'bn' ? 'জন' : 'clients'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className={`text-slate-500 dark:text-slate-400 truncate ${compactSubheaderTracking}`}>
                {lang === 'bn' ? 'মোট লেনদেন' : 'Entries'}
              </div>
              <div className="text-lg sm:text-2xl font-display font-bold text-slate-950 dark:text-white tabular-nums leading-none">
                <CountUpSpan value={transactionsCount} lang={lang} enabled={true} />
                <span className="text-[11px] font-sans font-medium text-slate-400 dark:text-slate-500 ml-1">
                  {lang === 'bn' ? 'টি' : 'logs'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {stats.totalOverpaid > 0 ? (
                <>
                  <div className={`text-slate-500 dark:text-slate-400 truncate ${compactSubheaderTracking}`}>
                    {lang === 'bn' ? (
                      'অগ্রিম জমা'
                    ) : (
                      <>
                        <span className="sm:hidden">Advance</span>
                        <span className="hidden sm:inline">Advance Credit</span>
                      </>
                    )}
                  </div>
                  <div
                    className="text-lg sm:text-2xl font-display font-bold tabular-nums leading-none truncate text-ledger-green"
                  >
                    <CountUpSpan value={stats.totalOverpaid} lang={lang} prefix="৳ " enabled={true} />
                  </div>
                </>
              ) : (
                <>
                  <div className={`text-slate-500 dark:text-slate-400 truncate ${compactSubheaderTracking}`}>
                    {lang === 'bn' ? 'পরিশোধিত' : 'Settled'}
                  </div>
                  <div className="text-lg sm:text-2xl font-display font-bold text-slate-950 dark:text-white tabular-nums leading-none">
                    <CountUpSpan value={stats.settledCount} lang={lang} enabled={true} />
                    <span className="text-[11px] font-sans font-medium text-slate-400 dark:text-slate-500 ml-1">
                      {lang === 'bn' ? 'জন' : 'clear'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </ScrollParallaxStage>

      {/* Modern Animated Pie Chart Based on Tag Segments */}
      {showTagChart && (
        <TagDistributionChart
          transactions={tagTransactions ?? transactions}
          lang={lang}
        />
      )}

      {/* =========================================================================
          2. TODAY'S PULSE CAROUSEL (Horizontal-Only Snap Strip on Mobile, 3-Col Grid on Desktop)
          ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-slate-600 dark:text-slate-300 ${subheaderTracking}`}>
            {lang === 'bn' ? 'আজকের লেনদেন প্রবাহ' : "Today's Pulse"}
          </span>
        </div>

        <div className="horizontal-snap-strip flex md:grid md:grid-cols-3 gap-3.5 snap-x snap-mandatory hide-scrollbar">
          {/* Card 1: Collected Today */}
          <StaggerReveal index={0} staggerMs={45} className="min-w-[80%] sm:min-w-[48%] md:min-w-0 snap-start shrink-0">
            <SpotlightCard className="h-full surface-glass rounded-[26px] p-5 flex flex-col justify-between space-y-5 relative overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-45"
                style={{ backgroundColor: 'var(--ledger-green-bg)' }}
              />
              <div className="relative z-10 flex items-center justify-between">
                <span className={`text-ledger-green ${subheaderTracking}`}>
                  {lang === 'bn' ? 'আজকের আদায়' : t.paymentsToday}
                </span>
                <ArrowDownLeft className="w-4 h-4 stroke-[1.25] text-ledger-green shrink-0" />
              </div>

              <div className="relative z-10 space-y-1.5">
                <div className="text-3xl sm:text-4xl font-display font-extrabold text-ledger-green tabular-nums tracking-tight">
                  <CountUpSpan value={stats.paymentsToday} lang={lang} prefix="৳ " enabled={true} />
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    <CountUpSpan value={stats.paymentsCountToday} lang={lang} enabled={true} />
                  </span>
                  <span>{lang === 'bn' ? 'টি জমা রসিদ' : 'receipts logged'}</span>
                </div>
              </div>
            </SpotlightCard>
          </StaggerReveal>

          {/* Card 2: Dues Issued Today */}
          <StaggerReveal index={1} staggerMs={45} className="min-w-[80%] sm:min-w-[48%] md:min-w-0 snap-start shrink-0">
            <SpotlightCard className="h-full surface-glass rounded-[26px] p-5 flex flex-col justify-between space-y-5 relative overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-45"
                style={{ backgroundColor: 'var(--ledger-red-bg)' }}
              />
              <div className="relative z-10 flex items-center justify-between">
                <span className={`text-ledger-red ${subheaderTracking}`}>
                  {lang === 'bn' ? 'আজকের বাকি' : t.duesToday}
                </span>
                <ArrowUpRight className="w-4 h-4 stroke-[1.25] text-ledger-red shrink-0" />
              </div>

              <div className="relative z-10 space-y-1.5">
                <div className="text-3xl sm:text-4xl font-display font-extrabold text-ledger-red tabular-nums tracking-tight">
                  <CountUpSpan value={stats.duesToday} lang={lang} prefix="+৳ " enabled={true} />
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    <CountUpSpan value={stats.duesCountToday} lang={lang} enabled={true} />
                  </span>
                  <span>{lang === 'bn' ? 'টি বাকি চালান' : 'dues issued'}</span>
                </div>
              </div>
            </SpotlightCard>
          </StaggerReveal>

          {/* Card 3: Collection Efficiency Radial Arc Gauge */}
          <StaggerReveal index={2} staggerMs={45} className="min-w-[82%] sm:min-w-[48%] md:min-w-0 snap-start shrink-0">
            <SpotlightCard className="h-full surface-glass rounded-[26px] p-5 flex items-center justify-between gap-4">
              <div className="space-y-3 min-w-0">
                <div>
                  <span className={`text-slate-600 dark:text-slate-300 block ${subheaderTracking}`}>
                    {lang === 'bn' ? 'আদায়ের হার' : t.efficiency}
                  </span>
                  <span className="text-sm font-bold text-slate-950 dark:text-white block mt-1">
                    {efficiencyStatusLabel}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium space-y-0.5">
                  {stats.duesToday === 0 && stats.paymentsToday === 0 ? (
                    <span>{lang === 'bn' ? 'আজ কোনো লেনদেন নেই' : 'No volume recorded today'}</span>
                  ) : (
                    <span>
                      {lang === 'bn' ? 'মোট প্রবাহ' : 'Volume'}:{' '}
                      <strong className="font-mono text-slate-900 dark:text-white">
                        <CountUpSpan value={stats.paymentsToday + stats.duesToday} lang={lang} prefix="৳" enabled={true} />
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <CircularGauge
                percent={paymentRatio}
                size={68}
                strokeWidth={5}
                label={
                  <span className="text-sm font-display font-extrabold text-slate-950 dark:text-white tabular-nums">
                    <CountUpSpan value={paymentRatio} lang={lang} suffix="%" enabled={true} />
                  </span>
                }
              />
            </SpotlightCard>
          </StaggerReveal>
        </div>
      </div>

      {/* =========================================================================
          3. PRIORITY DEBTORS HORIZONTAL RIBBON (Cardless Section, No Box Wrapper)
          ========================================================================= */}
      {stats.topDebtors.length > 0 && (
        <section className="space-y-3">
          <span className={`text-slate-600 dark:text-slate-300 block ${subheaderTracking}`}>
            {lang === 'bn' ? 'শীর্ষ বকেয়া অ্যাকাউন্ট' : 'Priority Receivables'}
          </span>

          <div className="horizontal-snap-strip flex sm:grid sm:grid-cols-3 gap-3 snap-x snap-mandatory hide-scrollbar">
            {stats.topDebtors.map((debtor, i) => {
              const initial = debtor.name.trim().charAt(0).toUpperCase() || 'C';
              return (
                <StaggerReveal key={debtor.id} index={i} staggerMs={45} className="min-w-[76%] sm:min-w-0 snap-start shrink-0">
                  <SpotlightCard className="surface-glass-interactive rounded-[22px] p-4 flex items-center justify-between gap-3">
                    <div
                      onClick={() => onSelectCustomer(debtor.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-ledger-red-subtle border border-ledger-red-subtle flex items-center justify-center font-display font-bold text-sm text-ledger-red shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-950 dark:text-white truncate group-hover:underline">
                          {debtor.name}
                        </div>
                        <div className="text-sm font-bold font-mono text-ledger-red tabular-nums mt-0.5">
                          <CountUpSpan value={debtor.outstandingDue} lang={lang} prefix="৳ " enabled={true} />
                        </div>
                      </div>
                    </div>

                    {debtor.phone && (
                      <a
                        href={getWhatsAppDueLink(debtor)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => triggerHaptic('single')}
                        className="touch-press w-9 h-9 rounded-full surface-subcard border flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-colors shrink-0"
                        title={lang === 'bn' ? 'হোয়াটসঅ্যাপে তাগাদা পাঠান' : 'Send WhatsApp Reminder'}
                      >
                        <MessageSquare className="w-4 h-4 stroke-[1.25]" />
                      </a>
                    )}
                  </SpotlightCard>
                </StaggerReveal>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================================
          4. TODAY'S QUICK BOOK JOURNAL (Floating Filter Bar + Hairline Feed)
          ========================================================================= */}
      <section className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-lg sm:text-xl font-display font-extrabold text-slate-950 dark:text-white tracking-tight">
              {lang === 'bn' ? 'আজকের খাতা' : t.quickBook}
            </h2>
            <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500">
              {formatNumber(filteredTxs.length, lang)} {lang === 'bn' ? 'টি' : 'entries'}
            </span>
          </div>

          <div
            ref={filterTrackRef}
            className="surface-glass inline-flex items-center p-1 rounded-full self-start sm:self-auto select-none relative"
          >
            {pillRect.ready && (
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0, x: pillRect.x, width: pillRect.w }}
                animate={{ opacity: 1, x: pillRect.x, width: pillRect.w }}
                transition={{
                  opacity: { duration: 0.22, ease: 'easeOut' },
                  x: hasUserToggledFilter
                    ? { type: 'spring', stiffness: 520, damping: 38 }
                    : { duration: 0 },
                  width: hasUserToggledFilter
                    ? { type: 'spring', stiffness: 520, damping: 38 }
                    : { duration: 0 },
                }}
                className={`pointer-events-none absolute top-1 bottom-1 left-0 bg-white/95 dark:bg-white/[0.14] rounded-full shadow-xs border-2 transition-colors duration-200 z-0 ${
                  journalFilter === 'payment'
                    ? 'border-emerald-500/75'
                    : journalFilter === 'due'
                    ? 'border-rose-500/75'
                    : 'border-slate-950/35 dark:border-white/40'
                }`}
              />
            )}

            <button
              type="button"
              data-qfilter="all"
              onClick={() => {
                triggerHaptic('tick');
                setHasUserToggledFilter(true);
                setJournalFilter('all');
              }}
              className={`relative z-10 px-4 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer flex items-center gap-1.5 ${
                journalFilter === 'all'
                  ? 'text-slate-950 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{lang === 'bn' ? 'সব' : 'All'}</span>
              <span className="text-[10px] font-mono opacity-60">{formatNumber(stats.todayTxs.length, lang)}</span>
            </button>

            <button
              type="button"
              data-qfilter="payment"
              onClick={() => {
                triggerHaptic('tick');
                setHasUserToggledFilter(true);
                setJournalFilter('payment');
              }}
              className={`relative z-10 px-4 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer flex items-center gap-1.5 ${
                journalFilter === 'payment'
                  ? 'text-ledger-green'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{lang === 'bn' ? 'আদায়' : 'Got'}</span>
              <span className="text-[10px] font-mono opacity-60">{formatNumber(stats.paymentsCountToday, lang)}</span>
            </button>

            <button
              type="button"
              data-qfilter="due"
              onClick={() => {
                triggerHaptic('tick');
                setHasUserToggledFilter(true);
                setJournalFilter('due');
              }}
              className={`relative z-10 px-4 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer flex items-center gap-1.5 ${
                journalFilter === 'due'
                  ? 'text-ledger-red'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{lang === 'bn' ? 'বাকি' : 'Given'}</span>
              <span className="text-[10px] font-mono opacity-60">{formatNumber(stats.duesCountToday, lang)}</span>
            </button>
          </div>
        </div>

        <div className="surface-glass rounded-[26px] overflow-hidden">
          {filteredTxs.length === 0 ? (
            <div className="p-10 sm:p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
              <ClipboardList className="w-7 h-7 stroke-[1.25] opacity-40" />
              <div>
                <p className="font-bold text-sm text-slate-950 dark:text-white">{t.noActivity}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.recentPayments}</p>
              </div>
              <button
                type="button"
                onClick={onViewDailyTxs}
                className="touch-press mt-1 px-4 py-2 text-xs font-semibold text-slate-900 dark:text-white surface-subcard rounded-full transition-colors cursor-pointer border"
              >
                {lang === 'bn' ? 'পুরানো খাতা দেখুন' : 'Browse past daily records'}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
              {filteredTxs.slice(0, 6).map((tx, idx) => (
                <StaggerReveal key={tx.id} index={idx} staggerMs={45}>
                  <div
                    onClick={() => onSelectCustomer(tx.customerId)}
                    className="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 pr-3">
                      <div
                        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${
                          tx.type === 'due'
                            ? 'bg-ledger-red-subtle text-ledger-red'
                            : 'bg-ledger-green-subtle text-ledger-green'
                        }`}
                      >
                        {tx.type === 'due' ? (
                          <ArrowUpRight className="w-4 h-4 stroke-[1.25]" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4 stroke-[1.25]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-950 dark:text-white truncate group-hover:opacity-80 transition-opacity">
                          {tx.customerName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-normal">
                          {tx.description || (tx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-base font-bold tabular-nums font-mono ${
                          tx.type === 'due' ? 'text-ledger-red' : 'text-ledger-green'
                        }`}
                      >
                        {tx.type === 'due' ? '+' : '-'} ৳{formatNumber(tx.amount, lang)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 tabular-nums flex items-center justify-end gap-1.5">
                        {tx.isEdited && (
                          <span className="font-sans font-medium">
                            {lang === 'bn' ? 'সম্পাদিত ·' : 'Edited ·'}
                          </span>
                        )}
                        <span>
                          {new Date(parseFirestoreDate(tx.date)).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </StaggerReveal>
              ))}

              {filteredTxs.length > 0 && (
                <div className="p-3 bg-slate-900/[0.015] dark:bg-white/[0.02] flex justify-center">
                  <button
                    onClick={onViewDailyTxs}
                    className="touch-press py-1 px-3 text-xs font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{lang === 'bn' ? 'আজকের সব লেনদেন দেখুন' : 'View All Daily Transactions'}</span>
                    <ChevronRight className="w-3.5 h-3.5 stroke-[1.25]" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          5. INTEGRATED MONTHLY ANALYTICS & INSIGHTS
          ========================================================================= */}
      <div className="pt-2">
        <AnalyticsManager
          customers={customers}
          monthlySummaries={monthlySummaries}
          lang={lang}
          animateOnDesktop={isDesktop || true}
          onSelectCustomer={onSelectCustomer}
        />
      </div>
      {/* Weather & Location Selector Popup */}
      <WeatherLocationModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        weather={weather}
        currentLocation={weatherLocation}
        isLoadingWeather={isLoadingWeather}
        onSelectLocation={loadWeatherFor}
        lang={lang}
      />
    </div>
  );
});

export default Dashboard;
