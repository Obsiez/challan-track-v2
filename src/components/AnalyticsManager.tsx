import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer } from '../types';
import { BarChart3, Calendar, TrendingUp, Users, Award } from 'lucide-react';
import { translations, formatNumber, Language } from '../lib/translations';
import { StaggerReveal, SpotlightCard, CircularGauge } from './MotionPrimitives';
import { triggerHaptic } from '../lib/haptics';
import { NativeOptionPicker } from './NativePickers';

function CountUpSpan({
  value,
  lang,
  prefix = '',
  suffix = '',
  enabled = true,
  duration = 550
}: {
  value: number;
  lang: Language;
  prefix?: string;
  suffix?: string;
  enabled?: boolean;
  duration?: number;
}) {
  const spanRef = useRef<HTMLSpanElement | null>(null);

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
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(value * eased);

      if (current !== lastRendered) {
        lastRendered = current;
        if (spanRef.current) {
          spanRef.current.textContent = `${prefix}${formatNumber(current, lang)}${suffix}`;
        }
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${formatNumber(value, lang)}${suffix}`;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, lang, prefix, suffix, enabled, duration]);

  return (
    <span ref={spanRef}>
      {prefix}{formatNumber(value, lang)}{suffix}
    </span>
  );
}

function compactChart(val: number, lang: Language): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBn = (s: string) => (lang === 'bn' ? s.replace(/[0-9]/g, d => bengaliDigits[+d]) : s);
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) {
    const n = abs / 1_000_000_000;
    return toBn((n % 1 === 0 ? n.toFixed(0) : parseFloat(n.toFixed(2)).toString()) + 'B');
  }
  if (abs >= 1_000_000) {
    const n = abs / 1_000_000;
    return toBn((n % 1 === 0 ? n.toFixed(0) : parseFloat(n.toFixed(2)).toString()) + 'M');
  }
  if (abs >= 1_000) {
    const n = abs / 1_000;
    return toBn((n % 1 === 0 ? n.toFixed(0) : parseFloat(n.toFixed(1)).toString()) + 'K');
  }
  return toBn(abs.toString());
}

interface AnalyticsManagerProps {
  customers: Customer[];
  monthlySummaries: any[];
  lang: Language;
  animateOnDesktop?: boolean;
  onSelectCustomer?: (id: string) => void;
}

interface Point {
  x: number;
  y: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// Fritsch-Carlson Monotone Cubic Spline: Silky, elegant, strictly non-oscillating and bounded
function buildSmoothSplinePath(points: Point[], minY: number, maxY: number): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x.toFixed(1)} ${clamp(points[0].y, minY, maxY).toFixed(1)}`;

  const pts = points.map(p => ({
    x: p.x,
    y: clamp(p.y, minY, maxY)
  }));

  const dxs: number[] = [];
  const deltas: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    dxs.push(dx);
    deltas.push(dx > 0 ? (pts[i + 1].y - pts[i].y) / dx : 0);
  }

  // Calculate tangents
  const m: number[] = new Array(n);
  m[0] = deltas[0];
  m[n - 1] = deltas[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      // Zero slope at peaks/valleys completely stops overshoot and loops
      m[i] = 0;
    } else {
      m[i] = (2 * deltas[i - 1] * deltas[i]) / (deltas[i - 1] + deltas[i]);
    }
  }

  // Fritsch-Carlson monotonicity condition
  for (let i = 0; i < n - 1; i++) {
    if (deltas[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / deltas[i];
      const beta = m[i + 1] / deltas[i];
      const dist = alpha * alpha + beta * beta;
      if (dist > 9) {
        const tau = 3 / Math.sqrt(dist);
        m[i] = tau * alpha * deltas[i];
        m[i + 1] = tau * beta * deltas[i];
      }
    }
  }

  // Construct Bézier segments, strictly clamping control points inside bounds
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = dxs[i];
    const cp1x = pts[i].x + dx / 3;
    const cp1y = clamp(pts[i].y + m[i] * (dx / 3), minY, maxY);
    const cp2x = pts[i + 1].x - dx / 3;
    const cp2y = clamp(pts[i + 1].y - m[i + 1] * (dx / 3), minY, maxY);

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

export default function AnalyticsManager({
  customers,
  monthlySummaries,
  lang,
  animateOnDesktop = true,
  onSelectCustomer
}: AnalyticsManagerProps) {
  const t = translations[lang];

  // Bars data: Monthly bars data will get loaded once and will never be forgotten. Only get replaced by newer data.
  const [persistedSummaries, setPersistedSummaries] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('easy_due_monthly_bars_permanent');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });

  useEffect(() => {
    if (!monthlySummaries || monthlySummaries.length === 0) return;
    setPersistedSummaries(prev => {
      const map = new Map<string, any>();
      // Retain previously loaded months forever
      (prev || []).forEach(item => {
        if (item?.id) map.set(item.id, item);
      });
      // Replace with newer incoming data
      monthlySummaries.forEach(item => {
        if (item?.id) map.set(item.id, item);
      });
      const updated = Array.from(map.values()).sort((a, b) => b.id.localeCompare(a.id));
      try {
        localStorage.setItem('easy_due_monthly_bars_permanent', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [monthlySummaries]);

  const activeSummaries = persistedSummaries.length > 0 ? persistedSummaries : monthlySummaries;

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthKey);

    activeSummaries.forEach(s => {
      if (s.id) monthsSet.add(s.id);
    });

    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [activeSummaries]);

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || '');
  const [activeBarKey, setActiveBarKey] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'trend' | 'bars'>('trend');

  useEffect(() => {
    if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0] || '');
    }
  }, [availableMonths, selectedMonth]);

  const toBnNum = (n: string | number) => n.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);

  const getMonthName = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, monthStr] = monthKey.split('-');
    const monthIndex = parseInt(monthStr, 10) - 1;
    const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const bnMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const mName = lang === 'bn' ? bnMonths[monthIndex] : enMonths[monthIndex];
    const yName = lang === 'bn' ? toBnNum(year) : year;
    return `${mName} ${yName}`;
  };

  const monthlyMetrics = useMemo(() => {
    if (!selectedMonth) return { dues: 0, payments: 0, count: 0, efficiency: 0 };
    const summary = activeSummaries.find(s => s.id === selectedMonth);

    const duesTotal = summary?.dues || 0;
    const paymentsTotal = summary?.payments || 0;
    const txCount = summary?.count || 0;

    const efficiency =
      duesTotal > 0 ? Math.round((paymentsTotal / duesTotal) * 100) : paymentsTotal > 0 ? 100 : 0;

    return { dues: duesTotal, payments: paymentsTotal, count: txCount, efficiency: Math.min(100, efficiency) };
  }, [activeSummaries, selectedMonth]);

  const chartData = useMemo(() => {
    const EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const BN_SHORT = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
    const now = new Date();
    const list: { key: string; label: string; dues: number; payments: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const key = `${yr}-${String(mo + 1).padStart(2, '0')}`;

      const summary = activeSummaries.find(s => s.id === key);
      list.push({
        key,
        label: lang === 'bn' ? BN_SHORT[mo] : EN_SHORT[mo],
        dues: summary?.dues || 0,
        payments: summary?.payments || 0
      });
    }

    return list;
  }, [activeSummaries, lang]);

  const maxChartValue = useMemo(() => {
    let max = 0;
    chartData.forEach(d => {
      if (d.dues > max) max = d.dues;
      if (d.payments > max) max = d.payments;
    });
    return max > 0 ? max * 1.25 : 1000;
  }, [chartData]);

  const hasAnyData = chartData.some(d => d.dues > 0 || d.payments > 0);
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Smooth SVG spline coordinates with strictly bounded layout (never overflows fixed height)
  const svgChart = useMemo(() => {
    const width = 600;
    const height = 180;
    const padX = 28;
    const padTop = 20;
    const padBottom = 16;
    const baselineY = height - padBottom;
    const plotW = width - padX * 2;
    const plotH = baselineY - padTop;
    const n = Math.max(1, chartData.length - 1);

    const duePts: Point[] = chartData.map((d, i) => ({
      x: padX + (i / n) * plotW,
      y: padTop + plotH - (Math.min(d.dues, maxChartValue) / maxChartValue) * plotH
    }));
    const payPts: Point[] = chartData.map((d, i) => ({
      x: padX + (i / n) * plotW,
      y: padTop + plotH - (Math.min(d.payments, maxChartValue) / maxChartValue) * plotH
    }));

    const dueLine = buildSmoothSplinePath(duePts, padTop, baselineY);
    const payLine = buildSmoothSplinePath(payPts, padTop, baselineY);
    const dueArea = duePts.length
      ? `${dueLine} L ${duePts[duePts.length - 1].x.toFixed(1)} ${baselineY} L ${duePts[0].x.toFixed(1)} ${baselineY} Z`
      : '';
    const payArea = payPts.length
      ? `${payLine} L ${payPts[payPts.length - 1].x.toFixed(1)} ${baselineY} L ${payPts[0].x.toFixed(1)} ${baselineY} Z`
      : '';

    return { width, height, baselineY, padTop, plotH, duePts, payPts, dueLine, payLine, dueArea, payArea };
  }, [chartData, maxChartValue]);

  const activePointIdx = useMemo(() => {
    if (!activeBarKey) return chartData.length - 1;
    const found = chartData.findIndex(d => d.key === activeBarKey);
    return found >= 0 ? found : chartData.length - 1;
  }, [activeBarKey, chartData]);

  const activePointData = chartData[activePointIdx] || chartData[chartData.length - 1];

  const topDebtors = useMemo(
    () =>
      [...customers]
        .filter(c => c.outstandingDue > 0)
        .sort((a, b) => b.outstandingDue - a.outstandingDue)
        .slice(0, 5),
    [customers]
  );

  const maxTopDue = useMemo(
    () => Math.max(1, ...topDebtors.map(c => c.outstandingDue)),
    [topDebtors]
  );

  const topPayers = useMemo(() => {
    if (!selectedMonth) return [];
    const summary = activeSummaries.find(s => s.id === selectedMonth);
    if (!summary || !summary.customerPayments) return [];

    return Object.entries(summary.customerPayments)
      .map(([customerId, val]: [string, any]) => ({
        id: customerId,
        name: val.name,
        total: val.total
      }))
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5);
  }, [activeSummaries, selectedMonth]);

  const maxTopPaid = useMemo(
    () => Math.max(1, ...topPayers.map(p => p.total)),
    [topPayers]
  );

  const monthTotalVolume = monthlyMetrics.dues + monthlyMetrics.payments;
  const duesSharePct = monthTotalVolume > 0 ? Math.round((monthlyMetrics.dues / monthTotalVolume) * 100) : 50;
  const cashSharePct = monthTotalVolume > 0 ? 100 - duesSharePct : 50;
  const netMonthBalance = monthlyMetrics.payments - monthlyMetrics.dues;

  const labelClass = lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block';

  return (
    <div className="flex flex-col gap-6 pt-4 border-t border-slate-900/[0.08] dark:border-white/[0.08]">
      {/* EDITORIAL HEADER & MONTH FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className={labelClass}>{lang === 'bn' ? 'মাসিক বিশ্লেষণ' : 'Monthly Intelligence'}</span>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-950 dark:text-white tracking-tight mt-0.5">
            {t.analytics}
          </h2>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[1.25]" />
          <NativeOptionPicker
            value={selectedMonth}
            onChange={setSelectedMonth}
            lang={lang}
            title={lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Month'}
            options={availableMonths.map(m => ({
              value: m,
              label: getMonthName(m)
            }))}
            triggerClassName="surface-glass rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer flex items-center gap-2 touch-press"
          />
        </div>
      </div>

      {/* MONTHLY KPI SNAP CAROUSEL (Horizontal-only mobile swipe, aligned with margin) */}
      <div className="horizontal-snap-strip flex md:grid md:grid-cols-3 gap-3.5 snap-x snap-mandatory hide-scrollbar">
        <StaggerReveal index={0} staggerMs={45} className="min-w-[80%] sm:min-w-[48%] md:min-w-0 snap-start shrink-0">
          <SpotlightCard className="surface-glass p-5 rounded-[26px] flex flex-col justify-between space-y-4 h-full">
            <span className={labelClass}>{lang === 'bn' ? 'বাকি দেওয়া হয়েছে' : 'Credit Sales'}</span>
            <div>
              <div className="text-2xl sm:text-3xl font-display font-extrabold text-ledger-red tabular-nums">
                <CountUpSpan value={monthlyMetrics.dues} lang={lang} prefix="৳ " enabled={animateOnDesktop} />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                {lang === 'bn' ? 'মোট বাকি বিক্রি' : 'Dues logged this month'}
              </span>
            </div>
          </SpotlightCard>
        </StaggerReveal>

        <StaggerReveal index={1} staggerMs={45} className="min-w-[80%] sm:min-w-[48%] md:min-w-0 snap-start shrink-0">
          <SpotlightCard className="surface-glass p-5 rounded-[26px] flex flex-col justify-between space-y-4 h-full">
            <span className={labelClass}>{lang === 'bn' ? 'নগদ আদায় হয়েছে' : 'Cash Collected'}</span>
            <div>
              <div className="text-2xl sm:text-3xl font-display font-extrabold text-ledger-green tabular-nums">
                <CountUpSpan value={monthlyMetrics.payments} lang={lang} prefix="৳ " enabled={animateOnDesktop} />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                {lang === 'bn' ? 'মোট নগদ আদায়' : 'Payments received'}
              </span>
            </div>
          </SpotlightCard>
        </StaggerReveal>

        <StaggerReveal index={2} staggerMs={45} className="min-w-[82%] sm:min-w-[48%] md:min-w-0 snap-start shrink-0">
          <SpotlightCard className="surface-glass p-5 rounded-[26px] flex items-center justify-between gap-4 h-full">
            <div className="space-y-1.5 min-w-0">
              <span className={labelClass}>{t.efficiency}</span>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'বাকি আদায়ের সাফল্য' : 'Recovery rate'}
              </div>
            </div>
            <CircularGauge
              percent={monthlyMetrics.efficiency}
              size={62}
              strokeWidth={4.5}
              label={
                <span className="text-sm font-display font-extrabold text-slate-950 dark:text-white tabular-nums">
                  <CountUpSpan value={monthlyMetrics.efficiency} lang={lang} suffix="%" enabled={animateOnDesktop} />
                </span>
              }
            />
          </SpotlightCard>
        </StaggerReveal>
      </div>

      {/* CHART + LEADERBOARDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0 w-full">
        {/* 6-MONTH FLUID TREND / HISTOGRAM */}
        <StaggerReveal index={3} staggerMs={45} className="lg:col-span-2 min-w-0 w-full">
          <SpotlightCard className="surface-glass p-4 sm:p-6 rounded-[28px] space-y-5 overflow-hidden min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-display font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 stroke-[1.25] opacity-70" />
                  {t.salesVsCollections}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn' ? 'গত ৬ মাসের বাকি ও আদায়ের তুলনা' : 'Last 6 months — credit given vs. cash collected'}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-ledger-red-solid shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">{lang === 'bn' ? 'বাকি' : 'Credit'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-ledger-green-solid shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">{lang === 'bn' ? 'আদায়' : 'Cash'}</span>
                  </div>
                </div>

                {/* Trend vs Bars Mode Switch */}
                <div className="surface-subcard p-0.5 rounded-full inline-flex items-center gap-0.5 select-none">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick');
                      setChartMode('trend');
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                      chartMode === 'trend'
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 border-2 border-slate-950 dark:border-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-2 border-transparent'
                    }`}
                  >
                    {lang === 'bn' ? 'ট্রেন্ড' : 'Trend'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick');
                      setChartMode('bars');
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                      chartMode === 'bars'
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 border-2 border-slate-950 dark:border-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-2 border-transparent'
                    }`}
                  >
                    {lang === 'bn' ? 'বার' : 'Bars'}
                  </button>
                </div>
              </div>
            </div>

            {!hasAnyData ? (
              <div className="h-52 flex flex-col items-center justify-center gap-2.5 text-slate-400 dark:text-slate-500">
                <BarChart3 className="w-8 h-8 stroke-[1.25] opacity-50" />
                <p className="text-xs font-medium text-center">
                  {lang === 'bn' ? 'গত ৬ মাসে কোনো লেনদেন পাওয়া যায়নি' : 'No transactions found in the last 6 months'}
                </p>
              </div>
            ) : chartMode === 'trend' ? (
              <div className="space-y-3">
                {/* Active Selected Month Compact Floating Summary Bar */}
                {activePointData && (
                  <div className="surface-subcard rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {activePointData.label}
                    </span>
                    <div className="flex items-center gap-3 sm:gap-4 font-mono tabular-nums">
                      <span className="text-ledger-red font-bold">
                        {lang === 'bn' ? 'বাকি' : 'Due'}: ৳{compactChart(activePointData.dues, lang)}
                      </span>
                      <span className="text-ledger-green font-bold">
                        {lang === 'bn' ? 'আদায়' : 'Cash'}: ৳{compactChart(activePointData.payments, lang)}
                      </span>
                      <span className={`font-bold ${activePointData.payments - activePointData.dues >= 0 ? 'text-ledger-green' : 'text-ledger-red'}`}>
                        {activePointData.payments - activePointData.dues >= 0 ? '+' : '-'}৳{compactChart(Math.abs(activePointData.payments - activePointData.dues), lang)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Smooth Dual-Series SVG Area/Spline Chart */}
                <div className="relative flex items-stretch gap-1.5 sm:gap-2 min-w-0 w-full overflow-hidden">
                  {/* Y-axis ticks */}
                  <div className="flex flex-col justify-between py-2 text-[10px] font-mono text-slate-400 dark:text-slate-500 text-right w-8 sm:w-9 shrink-0 select-none">
                    <span className="truncate">{compactChart(Math.round(maxChartValue), lang)}</span>
                    <span className="truncate">{compactChart(Math.round(maxChartValue * 0.5), lang)}</span>
                    <span>{lang === 'bn' ? '০' : '0'}</span>
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden">
                    <svg
                      viewBox={`0 0 ${svgChart.width} ${svgChart.height}`}
                      className="w-full h-[164px] sm:h-[180px] block select-none overflow-hidden"
                      role="img"
                      aria-label={t.salesVsCollections}
                    >
                      <defs>
                        <linearGradient id="creditAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--ledger-red)" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="var(--ledger-red)" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="cashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--ledger-green)" stopOpacity="0.26" />
                          <stop offset="100%" stopColor="var(--ledger-green)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal subtle grid lines */}
                      {[0, 0.5, 1].map((frac, idx) => {
                        const y = svgChart.padTop + (1 - frac) * svgChart.plotH;
                        return (
                          <line
                            key={idx}
                            x1={16}
                            y1={y}
                            x2={svgChart.width - 16}
                            y2={y}
                            stroke="currentColor"
                            strokeOpacity={0.07}
                            strokeDasharray="4 4"
                          />
                        );
                      })}

                      {/* Vertical crosshair highlight at active point */}
                      {svgChart.duePts[activePointIdx] && (
                        <line
                          x1={svgChart.duePts[activePointIdx].x}
                          y1={svgChart.padTop - 2}
                          x2={svgChart.duePts[activePointIdx].x}
                          y2={svgChart.baselineY}
                          stroke="currentColor"
                          strokeOpacity={0.25}
                          strokeWidth={1.25}
                          strokeDasharray="3 3"
                        />
                      )}

                      {/* Area Fills */}
                      <path d={svgChart.dueArea} fill="url(#creditAreaGrad)" />
                      <path d={svgChart.payArea} fill="url(#cashAreaGrad)" />

                      {/* Crisp Smooth Curves (Bounded Strictly Inside Viewport) */}
                      <path
                        d={svgChart.dueLine}
                        fill="none"
                        stroke="var(--ledger-red)"
                        strokeWidth={2.25}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={svgChart.payLine}
                        fill="none"
                        stroke="var(--ledger-green)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Interactive Hit Zones & Nodes */}
                      {chartData.map((d, i) => {
                        const duePt = svgChart.duePts[i];
                        const payPt = svgChart.payPts[i];
                        const isSelected = i === activePointIdx;
                        const colW = svgChart.width / chartData.length;
                        return (
                          <g
                            key={d.key}
                            onClick={() => {
                              triggerHaptic('tick');
                              setActiveBarKey(d.key);
                            }}
                            onMouseEnter={() => setActiveBarKey(d.key)}
                            className="cursor-pointer"
                          >
                            <rect
                              x={duePt.x - colW / 2}
                              y={0}
                              width={colW}
                              height={svgChart.height}
                              fill="transparent"
                            />
                            <circle
                              cx={duePt.x}
                              cy={duePt.y}
                              r={isSelected ? 4.5 : 2.5}
                              fill="var(--ledger-red)"
                              stroke="#ffffff"
                              strokeWidth={isSelected ? 1.75 : 1}
                            />
                            <circle
                              cx={payPt.x}
                              cy={payPt.y}
                              r={isSelected ? 5 : 3}
                              fill="var(--ledger-green)"
                              stroke="#ffffff"
                              strokeWidth={isSelected ? 2 : 1}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {/* X-axis month labels */}
                    <div className="grid grid-cols-6 gap-1 pt-1 min-w-0 w-full">
                      {chartData.map((d, i) => {
                        const isSelected = i === activePointIdx;
                        const isCurrent = d.key === currentMonthKey;
                        return (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => {
                              triggerHaptic('tick');
                              setActiveBarKey(d.key);
                            }}
                            className={`min-w-0 truncate text-[9px] sm:text-[10px] font-mono font-bold px-1 py-0.5 rounded-full text-center transition-colors cursor-pointer ${
                              isSelected
                                ? 'text-slate-950 dark:text-white bg-slate-900/[0.06] dark:bg-white/[0.12]'
                                : isCurrent
                                  ? 'text-slate-800 dark:text-slate-200'
                                  : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active Selected Month Compact Floating Summary Bar (Shared with Trend Mode, Never Clipped) */}
                {activePointData && (
                  <div className="surface-subcard rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {activePointData.label}
                    </span>
                    <div className="flex items-center gap-3 sm:gap-4 font-mono tabular-nums">
                      <span className="text-ledger-red font-bold">
                        {lang === 'bn' ? 'বাকি' : 'Due'}: ৳{compactChart(activePointData.dues, lang)}
                      </span>
                      <span className="text-ledger-green font-bold">
                        {lang === 'bn' ? 'আদায়' : 'Cash'}: ৳{compactChart(activePointData.payments, lang)}
                      </span>
                      <span className={`font-bold ${activePointData.payments - activePointData.dues >= 0 ? 'text-ledger-green' : 'text-ledger-red'}`}>
                        {activePointData.payments - activePointData.dues >= 0 ? '+' : '-'}৳{compactChart(Math.abs(activePointData.payments - activePointData.dues), lang)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="relative pt-3 pb-1 min-w-0 w-full overflow-hidden">
                  {/* Subtle Y-axis reference ticks & ultra-faint guide lines */}
                  <div className="absolute inset-x-0 top-3 h-[176px] sm:h-[184px] pointer-events-none">
                    {[1, 0.5, 0].map((frac, i) => {
                      const val = Math.round(maxChartValue * frac);
                      return (
                        <div
                          key={i}
                          className="absolute left-0 right-0 flex items-center -translate-y-1/2"
                          style={{ top: `${(1 - frac) * 100}%` }}
                        >
                          <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 dark:text-slate-500 w-8 sm:w-9 text-right shrink-0 leading-none truncate">
                            {compactChart(val, lang)}
                          </span>
                          <div className="flex-1 ml-1.5 sm:ml-2.5 border-t border-dashed border-slate-900/[0.06] dark:border-white/[0.06]" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Recessed Capsule Tracks + Distinct Sculpted Glass Pillars */}
                  <div className="ml-9 sm:ml-11 h-[176px] sm:h-[184px] grid grid-cols-6 gap-1 sm:gap-2.5 relative z-10 min-w-0">
                    {chartData.map((data, idx) => {
                      const dueH = data.dues > 0 ? Math.max(9, (data.dues / maxChartValue) * 100) : 0;
                      const payH = data.payments > 0 ? Math.max(9, (data.payments / maxChartValue) * 100) : 0;
                      const isSelected = idx === activePointIdx;

                      return (
                        <div
                          key={data.key}
                          onClick={() => {
                            triggerHaptic('tick');
                            setActiveBarKey(data.key);
                          }}
                          onMouseEnter={() => setActiveBarKey(data.key)}
                          className={`relative min-w-0 w-full flex items-end justify-center h-full group cursor-pointer rounded-xl sm:rounded-2xl px-1 sm:px-1.5 py-2 transition-all duration-300 ${
                            isSelected
                              ? 'bg-slate-900/[0.045] dark:bg-white/[0.06] ring-1 ring-slate-900/[0.08] dark:ring-white/[0.12]'
                              : 'opacity-80 hover:opacity-100 hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-end justify-center gap-1 sm:gap-2 h-full w-full min-w-0 mx-auto">
                            {/* Credit / Due Pillar: Warm Coral-to-Ruby Faceted Gradient + Diagonal Etched Texture */}
                            <div className="h-full flex-1 max-w-[14px] sm:max-w-[17px] min-w-[9px] rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-end justify-center relative overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                              {data.dues > 0 ? (
                                <div
                                  className="w-full rounded-full relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dash-anim-bar-y"
                                  style={{
                                    height: `${dueH}%`,
                                    minHeight: '14px',
                                    background: isSelected
                                      ? 'linear-gradient(155deg, rgba(253, 164, 175, 0.96) 0%, rgba(244, 63, 94, 0.88) 42%, rgba(190, 18, 60, 0.72) 100%)'
                                      : 'linear-gradient(155deg, rgba(253, 164, 175, 0.82) 0%, rgba(244, 63, 94, 0.70) 42%, rgba(190, 18, 60, 0.52) 100%)',
                                    boxShadow: isSelected
                                      ? '0 0 14px rgba(244, 63, 94, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                                      : 'inset 0 1px 0 rgba(255, 255, 255, 0.55)'
                                  }}
                                >
                                  {/* Diagonal Micro-Hatched Glass Etching */}
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 opacity-75"
                                    style={{
                                      backgroundImage:
                                        'repeating-linear-gradient(-45deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 6px)'
                                    }}
                                  />
                                  {/* Uniform Circular Tip (inactive bars only) */}
                                  {!isSelected && (
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none absolute top-[2.5px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] sm:w-[6px] sm:h-[6px] aspect-square rounded-full shrink-0 bg-rose-50/90"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-1.5 rounded-full bg-rose-500/25 dark:bg-rose-400/25" />
                              )}
                            </div>

                            {/* Cash / Paid Pillar: Cool Mint-to-Teal Liquid Gradient + Matching Diagonal Etched Texture */}
                            <div className="h-full flex-1 max-w-[14px] sm:max-w-[17px] min-w-[9px] rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-end justify-center relative overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                              {data.payments > 0 ? (
                                <div
                                  className="w-full rounded-full relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dash-anim-bar-y"
                                  style={{
                                    height: `${payH}%`,
                                    minHeight: '14px',
                                    background: isSelected
                                      ? 'linear-gradient(180deg, rgba(110, 231, 183, 0.96) 0%, rgba(16, 185, 129, 0.86) 46%, rgba(13, 148, 136, 0.72) 100%)'
                                      : 'linear-gradient(180deg, rgba(110, 231, 183, 0.80) 0%, rgba(16, 185, 129, 0.68) 46%, rgba(13, 148, 136, 0.50) 100%)',
                                    boxShadow: isSelected
                                      ? '0 0 14px rgba(16, 185, 129, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.82)'
                                      : 'inset 0 1px 0 rgba(255, 255, 255, 0.58)'
                                  }}
                                >
                                  {/* Matching Diagonal Micro-Hatched Glass Etching */}
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 opacity-75"
                                    style={{
                                      backgroundImage:
                                        'repeating-linear-gradient(-45deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 6px)'
                                    }}
                                  />
                                  {/* Uniform Circular Tip (inactive bars only) */}
                                  {!isSelected && (
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none absolute top-[2.5px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] sm:w-[6px] sm:h-[6px] aspect-square rounded-full shrink-0 bg-emerald-50/90"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-1.5 rounded-full bg-emerald-500/25 dark:bg-emerald-400/25" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X-axis month buttons */}
                  <div className="ml-9 sm:ml-11 grid grid-cols-6 gap-1 sm:gap-2.5 pt-2.5 min-w-0">
                    {chartData.map((data, idx) => {
                      const isSelected = idx === activePointIdx;
                      const isCurrent = data.key === currentMonthKey;
                      return (
                        <button
                          key={data.key}
                          type="button"
                          onClick={() => {
                            triggerHaptic('tick');
                            setActiveBarKey(data.key);
                          }}
                          className={`min-w-0 truncate text-[9px] sm:text-[10px] font-mono font-bold py-1 px-0.5 rounded-full text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'text-slate-950 dark:text-white bg-slate-900/[0.07] dark:bg-white/[0.14] shadow-2xs'
                              : isCurrent
                                ? 'text-slate-800 dark:text-slate-200'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {data.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Proportional Cash vs Credit Collection Split Bar */}
            <div className="pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.07] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-ledger-red font-mono tabular-nums">
                  {lang === 'bn' ? 'বাকি' : 'Credit'} {formatNumber(duesSharePct, lang)}%
                </span>
                <span className={`font-mono tabular-nums ${netMonthBalance >= 0 ? 'text-ledger-green' : 'text-ledger-red'}`}>
                  {lang === 'bn' ? 'নিট প্রবাহ:' : 'Net:'} {netMonthBalance >= 0 ? '+' : '-'}৳{compactChart(Math.abs(netMonthBalance), lang)}
                </span>
                <span className="text-ledger-green font-mono tabular-nums">
                  {lang === 'bn' ? 'আদায়' : 'Cash'} {formatNumber(cashSharePct, lang)}%
                </span>
              </div>
              <div className="h-3.5 w-full rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-center gap-[1.5px] overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                {duesSharePct > 0 && (
                  <div
                    className="h-full rounded-full relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dash-anim-bar-x"
                    style={{
                      width: `${duesSharePct}%`,
                      background: 'linear-gradient(90deg, rgba(253, 164, 175, 0.90) 0%, rgba(244, 63, 94, 0.84) 48%, rgba(190, 18, 60, 0.72) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                    }}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                  </div>
                )}
                {cashSharePct > 0 && (
                  <div
                    className="h-full rounded-full relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dash-anim-bar-x"
                    style={{
                      width: `${cashSharePct}%`,
                      background: 'linear-gradient(90deg, rgba(110, 231, 183, 0.88) 0%, rgba(16, 185, 129, 0.82) 52%, rgba(13, 148, 136, 0.70) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                    }}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                  </div>
                )}
              </div>
            </div>
          </SpotlightCard>
        </StaggerReveal>

        {/* HAIRLINE LEADERBOARDS WITH PROPORTIONAL BARS */}
        <div className="space-y-4">
          <StaggerReveal index={4} staggerMs={45}>
            <SpotlightCard className="surface-glass p-5 rounded-[26px] space-y-3">
              <h3 className="text-sm font-display font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 stroke-[1.25] opacity-70" />
                {t.topDebtors}
              </h3>
              {topDebtors.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                  {lang === 'bn' ? 'কোনো বকেয়া বাকি অ্যাকাউন্ট নেই!' : 'No unpaid customer accounts.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {topDebtors.map((c, i) => {
                    const pct = Math.max(6, Math.round((c.outstandingDue / maxTopDue) * 100));
                    return (
                      <div
                        key={c.id}
                        onClick={() => onSelectCustomer?.(c.id)}
                        className={`space-y-1.5 ${onSelectCustomer ? 'cursor-pointer group' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 w-5 shrink-0">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:underline">
                              {c.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-ledger-red tabular-nums font-mono shrink-0 ml-2">
                            <CountUpSpan value={c.outstandingDue} lang={lang} prefix="৳ " enabled={animateOnDesktop} />
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-center overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                          <div
                            className="h-full rounded-full relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dash-anim-bar-x"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, rgba(253, 164, 175, 0.90) 0%, rgba(244, 63, 94, 0.84) 48%, rgba(190, 18, 60, 0.72) 100%)',
                              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.62)'
                            }}
                          >
                            <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SpotlightCard>
          </StaggerReveal>

          <StaggerReveal index={5} staggerMs={45}>
            <SpotlightCard className="surface-glass p-5 rounded-[26px] space-y-3">
              <h3 className="text-sm font-display font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 stroke-[1.25] opacity-70" />
                {t.topEarners}
              </h3>
              {topPayers.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                  {lang === 'bn' ? 'এই মাসে কোনো আদায় নেই!' : 'No payments received this month.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {topPayers.map((p, i) => {
                    const pct = Math.max(6, Math.round((p.total / maxTopPaid) * 100));
                    return (
                      <div
                        key={p.id ? `${p.id}-${i}` : `${p.name}-${i}`}
                        onClick={() => p.id && onSelectCustomer?.(p.id)}
                        className={`space-y-1.5 ${p.id && onSelectCustomer ? 'cursor-pointer group' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 w-5 shrink-0">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:underline">
                              {p.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-ledger-green tabular-nums font-mono shrink-0 ml-2">
                            <CountUpSpan value={p.total} lang={lang} prefix="৳ " enabled={animateOnDesktop} />
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-center overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                          <div
                            className="h-full rounded-full relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dash-anim-bar-x"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, rgba(110, 231, 183, 0.88) 0%, rgba(16, 185, 129, 0.82) 52%, rgba(13, 148, 136, 0.70) 100%)',
                              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.62)'
                            }}
                          >
                            <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SpotlightCard>
          </StaggerReveal>
        </div>
      </div>
    </div>
  );
}
