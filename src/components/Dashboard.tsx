import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Customer, Transaction } from '../types';
import { 
  ArrowUpRight, ArrowDownLeft, ArrowRight, Zap, ChevronRight, 
  ClipboardList, MessageSquare, ShieldCheck, Calendar
} from 'lucide-react';
import { motion } from 'motion/react';
import { translations, formatNumber, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import AnalyticsManager from './AnalyticsManager';

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
  duration = 550
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
      // Cubic ease-out for crisp, smooth deceleration
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
  transactionsCount: number;
  monthlySummaries: any[];
  onOpenQuickEntry: () => void;
  onSelectCustomer: (id: string) => void;
  lang: Language;
  onViewDailyTxs: () => void;
}

export default function Dashboard({
  customers,
  transactions,
  transactionsCount,
  monthlySummaries,
  onOpenQuickEntry,
  onSelectCustomer,
  lang,
  onViewDailyTxs
}: DashboardProps) {
  const t = translations[lang];
  const [journalFilter, setJournalFilter] = useState<'all' | 'due' | 'payment'>('all');

  // Detect PC / desktop viewport once on mount so mobile animations stop after Collection Efficiency
  const isDesktop = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 768px)').matches;
  }, []);

  // Calculate statistics cleanly
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

    // Top 3 Priority Debtors
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

  // Payment capture percentage
  const paymentRatio = useMemo(() => {
    const totalActiveActions = stats.duesToday + stats.paymentsToday;
    if (totalActiveActions === 0) return 0;
    return Math.round((stats.paymentsToday / totalActiveActions) * 100);
  }, [stats]);

  // Filtered transactions for journal
  const filteredTxs = useMemo(() => {
    if (journalFilter === 'all') return stats.todayTxs;
    return stats.todayTxs.filter(tx => tx.type === journalFilter);
  }, [stats.todayTxs, journalFilter]);

  const getWhatsAppDueLink = (c: Customer) => {
    let phoneNum = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';
    if (phoneNum.startsWith('01')) phoneNum = '88' + phoneNum;
    const msg = lang === 'bn'
      ? `আসসালামু আলাইকুম ${c.name}। আপনার কাছে আমাদের বকেয়া পাওনা ৳${formatNumber(c.outstandingDue, 'bn')}। সম্ভব হলে অনুগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ!`
      : `Hi ${c.name}, friendly reminder that your outstanding due is ৳${formatNumber(c.outstandingDue, 'en')}. Please clear it at your earliest convenience. Thank you!`;
    return `https://wa.me/${phoneNum}?text=${encodeURIComponent(msg)}`;
  };

  // Formatted Today's Date for balanced Hero Header
  const todayFormatted = useMemo(() => {
    try {
      return new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return '';
    }
  }, [lang]);

  // Safe tracking class that preserves natural Bangla word & ligature rendering
  const subheaderTracking = lang === 'bn' ? 'tracking-normal text-xs' : 'tracking-wider uppercase text-[11px]';
  const compactSubheaderTracking = lang === 'bn' ? 'tracking-normal text-[11px] sm:text-xs' : 'tracking-wider uppercase text-[10px] sm:text-[11px]';

  // Efficiency status label
  const efficiencyStatusLabel = useMemo(() => {
    if (stats.duesToday === 0 && stats.paymentsToday === 0) {
      return lang === 'bn' ? 'স্থিতিশীল' : 'Standby';
    }
    if (paymentRatio >= 70) return lang === 'bn' ? 'চমৎকার আদায়' : 'Strong Flow';
    if (paymentRatio >= 40) return lang === 'bn' ? 'মাঝারি আদায়' : 'Balanced';
    return lang === 'bn' ? 'বাকি বেশি' : 'Credit Heavy';
  }, [stats.duesToday, stats.paymentsToday, paymentRatio, lang]);

  return (
    <div className="space-y-4 sm:space-y-5 no-select pb-12 max-w-6xl mx-auto">
      
      {/* =========================================================================
          1. HERO BANNER: TOTAL OUTSTANDING BALANCE & ARCHITECTURAL SUMMARY
          (Animates on both Mobile and PC)
          ========================================================================= */}
      <div className="dash-anim-fade bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Top Kicker Row: Left Label & Right Live Date */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/70">
          <div className="flex items-center gap-2">
            <ShieldCheck 
              className="w-4 h-4 shrink-0" 
              style={{ color: 'var(--accent-color)' }}
            />
            <span className={`font-bold text-slate-600 dark:text-slate-300 ${subheaderTracking}`}>
              {t.totalOutstanding}
            </span>
          </div>

          <div className={`flex items-center gap-1.5 text-xs ${lang === 'bn' ? 'font-bold' : 'font-medium'} text-slate-500 dark:text-slate-400`}>
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            <span>{todayFormatted}</span>
          </div>
        </div>

        {/* Center Main Stage: Commanding Balance & Symmetrical Action Controls */}
        <div className="py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="text-center sm:text-left space-y-1">
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 dark:text-white tabular-nums font-mono tracking-tight leading-none">
              <CountUpSpan value={stats.totalOutstanding} lang={lang} prefix="৳ " enabled={true} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pt-1">
              {lang === 'bn'
                ? 'সকল সক্রিয় গ্রাহকের সম্মিলিত নিট বকেয়া পাওনা'
                : 'Net receivables across active client ledgers'}
            </p>
          </div>

          {/* Action Buttons: Full-width 2-col grid on mobile, crisp pair on desktop */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                triggerHaptic('single');
                onOpenQuickEntry();
              }}
              className="px-4 py-3 sm:py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-xs"
              id="dash_quick_entry_btn"
            >
              <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="truncate">{lang === 'bn' ? '+ হিসাব লিখুন' : '+ Quick Entry'}</span>
            </button>
            
            <button
              onClick={() => {
                triggerHaptic('single');
                onViewDailyTxs();
              }}
              className="px-4 py-3 sm:py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/70 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200/90 dark:border-slate-800 transition-all active:scale-[0.98]"
              id="dash_daily_journal_btn"
            >
              <span className="truncate">{lang === 'bn' ? 'দৈনিক খাতা' : 'Daily Journal'}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Bottom Architectural 3-Column Ledger Distribution Strip (All 3 Center-Aligned) */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2 divide-x divide-slate-100 dark:divide-slate-800/80">
          {/* Column 1: Center-aligned */}
          <div className="px-1.5 text-center">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {lang === 'bn' ? 'দেনাদার খাতা' : 'Active Debtors'}
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-slate-950 dark:text-white tabular-nums mt-0.5">
              <CountUpSpan value={stats.activeDebtorsCount} lang={lang} enabled={true} />{' '}
              <span className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'জন' : 'clients'}
              </span>
            </div>
          </div>

          {/* Column 2: Center-aligned */}
          <div className="px-1.5 text-center">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {lang === 'bn' ? 'মোট লেনদেন' : 'Total Entries'}
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-slate-950 dark:text-white tabular-nums mt-0.5">
              <CountUpSpan value={transactionsCount} lang={lang} enabled={true} />{' '}
              <span className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'টি' : 'logs'}
              </span>
            </div>
          </div>

          {/* Column 3: Center-aligned */}
          <div className="px-1.5 text-center">
            {stats.totalOverpaid > 0 ? (
              <>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {lang === 'bn' ? 'অগ্রিম জমা' : 'Advance Credit'}
                </div>
                <div 
                  className="text-sm sm:text-base font-black font-mono tabular-nums mt-0.5 truncate"
                  style={{ color: 'var(--accent-color)' }}
                >
                  <CountUpSpan value={stats.totalOverpaid} lang={lang} prefix="৳ " enabled={true} />
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {lang === 'bn' ? 'পরিশোধিত খাতা' : 'Settled Clients'}
                </div>
                <div className="text-sm sm:text-base font-black font-mono text-slate-950 dark:text-white tabular-nums mt-0.5">
                  <CountUpSpan value={stats.settledCount} lang={lang} enabled={true} />{' '}
                  <span className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400">
                    {lang === 'bn' ? 'জন' : 'clear'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. PERFORMANCE STRIP (TODAY'S MOVEMENT)
          - Mobile (< sm): Single unified compact card combining Payments Got Today & Dues Added Today, followed by Collection Efficiency
          - Tablet & Desktop (sm+): Symmetrical 3-column grid (unchanged)
          - Animates on both Mobile and PC (up to Collection Efficiency card)
          ========================================================================= */}
      <div
        className="dash-anim-fade grid grid-cols-1 sm:grid-cols-3 gap-4"
        style={{ animationDelay: '40ms' }}
      >
        {/* MOBILE ONLY (< sm): UNIFIED SYMMETRICAL TODAY'S SUMMARY CARD */}
        <div className="sm:hidden bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl px-4 py-4 shadow-xs">
          <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800/80">
            {/* Left Column: Payments Got Today */}
            <div className="pr-3 text-center space-y-1 min-w-0">
              <div className={`font-bold text-slate-600 dark:text-slate-300 truncate ${compactSubheaderTracking}`}>
                {lang === 'bn' ? 'আজকের আদায়' : t.paymentsToday}
              </div>

              <div className="text-xl font-black text-slate-950 dark:text-white tabular-nums font-mono tracking-tight truncate">
                <CountUpSpan value={stats.paymentsToday} lang={lang} prefix="৳ " enabled={!isDesktop} />
              </div>

              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate pt-0.5">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  <CountUpSpan value={stats.paymentsCountToday} lang={lang} enabled={!isDesktop} />
                </span>{' '}
                <span>{lang === 'bn' ? 'টি জমা রসিদ' : 'receipts logged'}</span>
              </div>
            </div>

            {/* Right Column: Dues Added Today */}
            <div className="pl-3 text-center space-y-1 min-w-0">
              <div className={`font-bold text-slate-600 dark:text-slate-300 truncate ${compactSubheaderTracking}`}>
                {lang === 'bn' ? 'আজকের বাকি' : t.duesToday}
              </div>

              <div className="text-xl font-black text-slate-950 dark:text-white tabular-nums font-mono tracking-tight truncate">
                <CountUpSpan value={stats.duesToday} lang={lang} prefix="৳ " enabled={!isDesktop} />
              </div>

              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate pt-0.5">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  <CountUpSpan value={stats.duesCountToday} lang={lang} enabled={!isDesktop} />
                </span>{' '}
                <span>{lang === 'bn' ? 'টি বাকি চালান' : 'dues issued'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TABLET & DESKTOP ONLY (sm+): CARD 1 — TODAY'S COLLECTIONS */}
        <div className="hidden sm:flex bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex-col justify-between space-y-3.5">
          <div className="flex items-center justify-between">
            <span 
              className={`font-bold ${subheaderTracking}`}
              style={{ color: 'var(--accent-color)' }}
            >
              {lang === 'bn' ? 'আজকের আদায়' : t.paymentsToday}
            </span>
            <div 
              className="p-1.5 rounded-lg"
              style={{ 
                color: 'var(--accent-color)', 
                backgroundColor: 'var(--accent-subtle)'
              }}
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          <div>
            <div 
              className="text-2xl lg:text-3xl font-black tabular-nums font-mono tracking-tight"
              style={{ color: 'var(--accent-color)' }}
            >
              <CountUpSpan value={stats.paymentsToday} lang={lang} prefix="৳ " enabled={isDesktop} />
            </div>
            <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/70 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{lang === 'bn' ? 'জমা রসিদ সংখ্যা' : 'Receipts logged'}</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                <CountUpSpan value={stats.paymentsCountToday} lang={lang} enabled={isDesktop} />
              </span>
            </div>
          </div>
        </div>

        {/* TABLET & DESKTOP ONLY (sm+): CARD 2 — TODAY'S DUES GIVEN */}
        <div className="hidden sm:flex bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex-col justify-between space-y-3.5">
          <div className="flex items-center justify-between">
            <span className={`font-bold text-rose-600 dark:text-rose-400 ${subheaderTracking}`}>
              {lang === 'bn' ? 'আজকের বাকি' : t.duesToday}
            </span>
            <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          <div>
            <div className="text-2xl lg:text-3xl font-black text-rose-600 dark:text-rose-400 tabular-nums font-mono tracking-tight">
              <CountUpSpan value={stats.duesToday} lang={lang} prefix="+৳ " enabled={isDesktop} />
            </div>
            <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/70 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{lang === 'bn' ? 'বাকি চালান সংখ্যা' : 'Dues issued today'}</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                <CountUpSpan value={stats.duesCountToday} lang={lang} enabled={isDesktop} />
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: MODERN COLLECTION EFFICIENCY GAUGE */}
        <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3 sm:space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className={`font-bold text-slate-600 dark:text-slate-300 block ${subheaderTracking}`}>
                {lang === 'bn' ? 'আদায়ের হার' : t.efficiency}
              </span>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {efficiencyStatusLabel}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
              <CountUpSpan value={paymentRatio} lang={lang} suffix="%" enabled={true} />
            </div>
          </div>

          <div className="space-y-2">
            {/* Precision Calibrated Progress Track with Quarter Markers */}
            <div className="relative w-full bg-slate-100 dark:bg-slate-800/90 rounded-lg h-3 p-0.5 overflow-hidden border border-slate-200/70 dark:border-slate-800">
              {/* Subtle 25% / 50% / 75% calibration ticks */}
              <div className="absolute inset-0 grid grid-cols-4 pointer-events-none z-10">
                <div className="border-r border-slate-300/50 dark:border-slate-700/50" />
                <div className="border-r border-slate-300/50 dark:border-slate-700/50" />
                <div className="border-r border-slate-300/50 dark:border-slate-700/50" />
                <div />
              </div>

              {/* GPU-composited scaleX Fill Bar */}
              <div 
                className="dash-anim-bar-x h-full rounded-[5px] relative flex items-center justify-end overflow-hidden"
                style={{ 
                  width: `${stats.duesToday > 0 || stats.paymentsToday > 0 ? Math.max(4, paymentRatio) : 0}%`,
                  backgroundColor: 'var(--accent-color)'
                }}
              >
                <span className="w-1 h-full bg-white/60 rounded-full mr-0.5 shrink-0" />
              </div>
            </div>

            {/* Bottom Two-Sided Scale / Context Row */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
              {stats.duesToday === 0 && stats.paymentsToday === 0 ? (
                <>
                  <span>{lang === 'bn' ? 'আজ কোনো লেনদেন নেই' : 'No activity today'}</span>
                  <span className="font-mono text-[10px]">0% — 100%</span>
                </>
              ) : (
                <>
                  <span>
                    {lang === 'bn' ? 'আদায়' : 'In'}:{' '}
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      <CountUpSpan value={stats.paymentsToday} lang={lang} prefix="৳" enabled={true} />
                    </strong>
                  </span>
                  <span>
                    {lang === 'bn' ? 'মোট প্রবাহ' : 'Volume'}:{' '}
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      <CountUpSpan value={stats.paymentsToday + stats.duesToday} lang={lang} prefix="৳" enabled={true} />
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          3. TODAY'S QUICK BOOK JOURNAL & THEME-AUTHENTIC SEGMENTED FILTER
          (Animates ONLY on PC)
          ========================================================================= */}
      <div
        className={`${isDesktop ? 'dash-anim-fade' : ''} space-y-3 pt-1`}
        style={isDesktop ? { animationDelay: '80ms' } : undefined}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <span className={`font-bold text-slate-900 dark:text-slate-100 ${subheaderTracking}`}>
              {lang === 'bn' ? 'আজকের খসড়া খাতা' : t.quickBook}
            </span>
            <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
              · {formatNumber(filteredTxs.length, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
            </span>
          </div>

          {/* Theme-Surface-Consistent Segmented Control (Scroll-Safe Tap Activation) */}
          <div
            className="grid grid-cols-3 sm:inline-flex items-center bg-slate-100 dark:bg-[#0D121D] p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 select-none relative"
          >
            {/* Option 1: ALL */}
            <button
              type="button"
              data-qfilter="all"
              onClick={() => {
                triggerHaptic('tick');
                setJournalFilter('all');
              }}
              className={`relative z-10 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                journalFilter === 'all'
                  ? 'text-slate-950 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {journalFilter === 'all' && (
                <motion.div
                  layoutId="quickBookFilterIndicator"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-2xs border border-slate-200/80 dark:border-slate-700 -z-10"
                />
              )}
              <span>{lang === 'bn' ? 'সব' : 'All'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                journalFilter === 'all'
                  ? 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {formatNumber(stats.todayTxs.length, lang)}
              </span>
            </button>

            {/* Option 2: GOT (PAYMENTS) */}
            <button
              type="button"
              data-qfilter="payment"
              onClick={() => {
                triggerHaptic('tick');
                setJournalFilter('payment');
              }}
              className={`relative z-10 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                journalFilter === 'payment'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {journalFilter === 'payment' && (
                <motion.div
                  layoutId="quickBookFilterIndicator"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-2xs border border-emerald-200/80 dark:border-emerald-800/60 -z-10"
                />
              )}
              <ArrowDownLeft className="w-3 h-3 stroke-[2.5] text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{lang === 'bn' ? 'আদায়' : 'Got'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                journalFilter === 'payment'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {formatNumber(stats.paymentsCountToday, lang)}
              </span>
            </button>

            {/* Option 3: GIVEN (DUES) */}
            <button
              type="button"
              data-qfilter="due"
              onClick={() => {
                triggerHaptic('tick');
                setJournalFilter('due');
              }}
              className={`relative z-10 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                journalFilter === 'due'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {journalFilter === 'due' && (
                <motion.div
                  layoutId="quickBookFilterIndicator"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-2xs border border-rose-200/80 dark:border-rose-800/60 -z-10"
                />
              )}
              <ArrowUpRight className="w-3 h-3 stroke-[2.5] text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{lang === 'bn' ? 'বাকি' : 'Given'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                journalFilter === 'due'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {formatNumber(stats.duesCountToday, lang)}
              </span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
          {filteredTxs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700">
                <ClipboardList className="w-5 h-5 stroke-[1.8]" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-950 dark:text-white">{t.noActivity}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.recentPayments}</p>
              </div>
              <button
                type="button"
                onClick={onViewDailyTxs}
                className="mt-2 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
              >
                {lang === 'bn' ? 'পুরানো খাতা দেখতে চান?' : 'Browse past daily records'}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredTxs.slice(0, 6).map((tx) => (
                <div 
                  key={tx.id}
                  onClick={() => onSelectCustomer(tx.customerId)}
                  className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      tx.type === 'due' 
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/50' 
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900/50'
                    }`}>
                      {tx.type === 'due' ? <ArrowUpRight className="w-4 h-4 stroke-[2.5]" /> : <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-950 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {tx.customerName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-normal">
                        {tx.description || (tx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-base font-bold tabular-nums font-mono ${
                      tx.type === 'due' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {tx.type === 'due' ? '+' : '-'} ৳ {formatNumber(tx.amount, lang)}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 tabular-nums flex items-center justify-end gap-1.5">
                      {tx.isEdited && (
                        <span className="text-[10px] font-sans font-medium text-slate-400 dark:text-slate-500">
                          {lang === 'bn' ? 'সম্পাদিত ·' : 'Edited ·'}
                        </span>
                      )}
                      <span>{new Date(parseFirestoreDate(tx.date)).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredTxs.length > 0 && (
                <div className="p-3 bg-slate-50/40 dark:bg-slate-900/30 flex justify-center border-t border-slate-100 dark:border-slate-800/60">
                  <button 
                    onClick={onViewDailyTxs}
                    className="text-xs font-semibold text-slate-800 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{lang === 'bn' ? 'আজকের সব লেনদেন দেখুন' : 'View All Daily Transactions'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          4. PRIORITY DUES: TOP 3 OUTSTANDING ACCOUNTS (Simple Theme-Consistent Cards)
          (Animates ONLY on PC)
          ========================================================================= */}
      {stats.topDebtors.length > 0 && (
        <div
          className={`${isDesktop ? 'dash-anim-fade' : ''} bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-3`}
          style={isDesktop ? { animationDelay: '120ms' } : undefined}
        >
          <span className={`font-bold text-slate-600 dark:text-slate-300 block ${subheaderTracking}`}>
            {lang === 'bn' ? 'শীর্ষ বকেয়া অ্যাকাউন্ট (তাগাদা পাঠান)' : 'Top 3 Outstanding Accounts'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stats.topDebtors.map((debtor) => (
              <div 
                key={debtor.id}
                className="p-3.5 rounded-xl border border-slate-200/80 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50 flex items-center justify-between gap-2.5 transition-all shadow-2xs"
              >
                <div 
                  onClick={() => onSelectCustomer(debtor.id)}
                  className="min-w-0 flex-1 cursor-pointer group"
                >
                  <div className="text-xs font-bold text-slate-950 dark:text-white truncate group-hover:underline">
                    {debtor.name}
                  </div>
                  <div className="text-sm font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
                    <CountUpSpan value={debtor.outstandingDue} lang={lang} prefix="৳ " enabled={isDesktop} />
                  </div>
                </div>

                {debtor.phone && (
                  <a
                    href={getWhatsAppDueLink(debtor)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => triggerHaptic('single')}
                    className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 transition-colors shrink-0 shadow-2xs"
                    title={lang === 'bn' ? 'হোয়াটসঅ্যাপে তাগাদা পাঠান' : 'Send WhatsApp Reminder'}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          5. INTEGRATED MONTHLY ANALYTICS & INSIGHTS
          (Animates ONLY on PC)
          ========================================================================= */}
      <div
        className={`${isDesktop ? 'dash-anim-fade' : ''} pt-4 border-t border-slate-200/80 dark:border-slate-800/80`}
        style={isDesktop ? { animationDelay: '160ms' } : undefined}
      >
        <AnalyticsManager 
          customers={customers}
          monthlySummaries={monthlySummaries}
          lang={lang}
          animateOnDesktop={isDesktop}
        />
      </div>

    </div>
  );
}


