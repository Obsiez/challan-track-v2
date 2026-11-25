import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tags as DefaultTagIcon } from 'lucide-react';
import { Transaction } from '../types';
import { Language, formatNumber } from '../lib/translations';
import { getTagMeta, TagMeta, useTagConfig } from '../lib/tagSystem';
import { triggerHaptic } from '../lib/haptics';
import { StaggerReveal } from './MotionPrimitives';

interface TagDistributionChartProps {
  transactions: Transaction[];
  lang: Language;
}

interface TagSegment {
  id: string;
  name: string;
  amount: number;
  count: number;
  color: string;
  percentage: number;
  meta: TagMeta | null;
}

export const TagDistributionChart: React.FC<TagDistributionChartProps> = ({
  transactions,
  lang
}) => {
  const [viewType, setViewType] = useState<'due' | 'payment'>('due');
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [hasSwitched, setHasSwitched] = useState(false);
  const tagConfig = useTagConfig();

  const switchTrackRef = useRef<HTMLDivElement>(null);
  const [pillRect, setPillRect] = useState<{ x: number; w: number; ready: boolean }>({
    x: 4,
    w: 0,
    ready: false
  });

  useLayoutEffect(() => {
    const track = switchTrackRef.current;
    if (!track) return;

    const measure = () => {
      const btn = track.querySelector<HTMLButtonElement>(`button[data-tagview="${viewType}"]`);
      if (!btn) return;
      const x = btn.offsetLeft;
      const w = btn.offsetWidth;
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
      track.querySelectorAll('button').forEach((b) => ro.observe(b));
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, [viewType, lang]);

  const { segments, totalAmount, totalCount } = useMemo(() => {
    const filtered = transactions.filter((t) => t.type === viewType);
    const amountMap: Record<string, { amount: number; count: number }> = {};
    let total = 0;
    let count = 0;

    filtered.forEach((tx) => {
      const tagId = tx.tag ? tx.tag.toLowerCase().trim() : 'other';
      if (!amountMap[tagId]) {
        amountMap[tagId] = { amount: 0, count: 0 };
      }
      amountMap[tagId].amount += tx.amount;
      amountMap[tagId].count += 1;
      total += tx.amount;
      count += 1;
    });

    const segList: TagSegment[] = Object.keys(amountMap)
      .map((tagId) => {
        const meta = getTagMeta(tagId, viewType);
        const name = meta ? (lang === 'bn' ? meta.bn : meta.en) : (lang === 'bn' ? 'অন্যান্য' : 'Other');
        const color = meta ? meta.color : '#64748B';
        const amt = amountMap[tagId].amount;
        const c = amountMap[tagId].count;
        const pct = total > 0 ? (amt / total) * 100 : 0;

        return {
          id: tagId,
          name,
          amount: amt,
          count: c,
          color,
          percentage: pct,
          meta
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { segments: segList, totalAmount: total, totalCount: count };
  }, [transactions, viewType, lang, tagConfig]);

  const activeSegment = useMemo(() => {
    if (activeTagId) {
      const found = segments.find((s) => s.id === activeTagId);
      if (found) return found;
    }
    return segments[0] || null;
  }, [activeTagId, segments]);

  const subheaderTracking = lang === 'bn' ? 'tracking-normal text-xs font-bold' : 'micro-mono-label font-semibold';
  const compactLabelTracking = lang === 'bn' ? 'text-[11px] font-bold' : 'micro-mono-label font-semibold';

  // Precision architectural ring geometry
  const size = 132;
  const strokeWidth = 9.5;
  const radius = (size - strokeWidth - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const visibleRows = segments.slice(0, 5);

  const ringArcs = useMemo(() => {
    let accumulatedOffset = 0;
    const gap = segments.length > 1 ? 3.5 : 0;
    return segments.map((seg) => {
      const rawLen = (seg.percentage / 100) * circumference;
      const arcLen = segments.length > 1 ? Math.max(2, rawLen - gap) : rawLen;
      const offset = -accumulatedOffset;
      accumulatedOffset += rawLen;
      return {
        seg,
        arcLen,
        offset
      };
    });
  }, [segments, circumference]);

  const handleSwitchType = (nextType: 'due' | 'payment') => {
    if (nextType === viewType) return;
    triggerHaptic('tick');
    setHasSwitched(true);
    setViewType(nextType);
    setActiveTagId(null);
  };

  return (
    <section className="space-y-3 no-select">
      {/* Editorial Section Header + Gliding Spring Switcher */}
      <div className="flex items-center justify-between gap-3">
        <span className={`text-slate-600 dark:text-slate-300 ${subheaderTracking}`}>
          {lang === 'bn' ? 'ট্যাগভিত্তিক বিশ্লেষণ' : 'Tag Intelligence'}
        </span>

        <div
          ref={switchTrackRef}
          className="surface-glass inline-flex items-center p-1 rounded-full select-none relative"
        >
          {pillRect.ready && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0, x: pillRect.x, width: pillRect.w }}
              animate={{ opacity: 1, x: pillRect.x, width: pillRect.w }}
              transition={{
                opacity: { duration: 0.2, ease: 'easeOut' },
                x: hasSwitched
                  ? { type: 'spring', stiffness: 520, damping: 38 }
                  : { duration: 0 },
                width: hasSwitched
                  ? { type: 'spring', stiffness: 520, damping: 38 }
                  : { duration: 0 }
              }}
              className={`pointer-events-none absolute top-1 bottom-1 left-0 bg-white/95 dark:bg-white/[0.14] rounded-full shadow-xs border-2 transition-colors duration-200 z-0 ${
                viewType === 'payment' ? 'border-emerald-500/75' : 'border-rose-500/75'
              }`}
            />
          )}

          <button
            type="button"
            data-tagview="due"
            onClick={() => handleSwitchType('due')}
            className={`relative z-10 px-3.5 py-1 text-xs font-bold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
              viewType === 'due'
                ? 'text-ledger-red'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {lang === 'bn' ? 'বাকি' : 'Due'}
          </button>

          <button
            type="button"
            data-tagview="payment"
            onClick={() => handleSwitchType('payment')}
            className={`relative z-10 px-3.5 py-1 text-xs font-bold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
              viewType === 'payment'
                ? 'text-ledger-green'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {lang === 'bn' ? 'আদায়' : 'Cash'}
          </button>
        </div>
      </div>

      {/* Cardless Editorial Stage on Plain Canvas */}
      <StaggerReveal index={0} staggerMs={45}>
        <div className="py-5 border-y border-slate-900/[0.08] dark:border-white/[0.08] relative">
          <AnimatePresence mode="wait" initial={false}>
            {segments.length === 0 ? (
              <motion.div
                key={`empty-${viewType}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 py-6 text-center space-y-1"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {viewType === 'due'
                    ? (lang === 'bn' ? 'এখনও কোনো বাকি ট্যাগ নেই' : 'No tagged dues recorded yet')
                    : (lang === 'bn' ? 'এখনও কোনো আদায় ট্যাগ নেই' : 'No tagged payments recorded yet')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'হিসাবে ট্যাগ যুক্ত করলে এখানে তা দেখাবে'
                    : 'Assign tags when logging entries to reveal category flow'}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`chart-${viewType}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8"
              >
                {/* Left: Architectural Precision Ring */}
                <div className="relative w-[132px] h-[132px] shrink-0 mx-auto sm:mx-0">
                  <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="-rotate-90 overflow-visible"
                    role="img"
                    aria-label={lang === 'bn' ? 'ট্যাগ বণ্টন চার্ট' : 'Tag distribution chart'}
                  >
                    {/* Recessed Glass Track */}
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      className="text-slate-900/[0.06] dark:text-white/[0.07]"
                    />

                    {ringArcs.map(({ seg, arcLen, offset }, idx) => {
                      const isSelected = activeSegment?.id === seg.id;
                      const isDimmed = activeSegment !== null && !isSelected;

                      return (
                        <motion.circle
                          key={seg.id}
                          cx={size / 2}
                          cy={size / 2}
                          r={radius}
                          fill="none"
                          stroke={seg.color}
                          strokeLinecap={segments.length > 1 ? 'round' : 'butt'}
                          strokeDashoffset={offset}
                          initial={{
                            strokeDasharray: `0 ${circumference}`,
                            opacity: 0
                          }}
                          animate={{
                            strokeDasharray: `${arcLen} ${circumference}`,
                            strokeWidth: isSelected ? strokeWidth + 2.5 : strokeWidth,
                            opacity: isDimmed ? 0.28 : 1
                          }}
                          transition={{
                            strokeDasharray: {
                              duration: 0.62,
                              delay: Math.min(idx * 0.04, 0.2),
                              ease: [0.16, 1, 0.3, 1]
                            },
                            strokeWidth: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                            opacity: { duration: 0.2, ease: 'easeOut' }
                          }}
                          className="cursor-pointer"
                          onClick={() => {
                            triggerHaptic('tick');
                            setActiveTagId(activeTagId === seg.id ? null : seg.id);
                          }}
                          onMouseEnter={() => setActiveTagId(seg.id)}
                        />
                      );
                    })}
                  </svg>

                  {/* Center Readout Core */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
                    <span className="text-2xl font-display font-extrabold text-slate-950 dark:text-white leading-none tabular-nums tracking-tight">
                      {formatNumber(Math.round(activeSegment?.percentage || 0), lang)}%
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1 truncate max-w-[84px]">
                      {activeSegment?.name || ''}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums truncate max-w-[86px]">
                      ৳{formatNumber(activeSegment?.amount || 0, lang)}
                    </span>
                  </div>
                </div>

                {/* Right: Editorial Summary + Liquid Etched Spectrum + Hairline Rows */}
                <div className="flex-1 min-w-0 space-y-4">
                  {/* Top Summary Strip */}
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <span className={`text-slate-500 dark:text-slate-400 ${compactLabelTracking}`}>
                        {viewType === 'due'
                          ? (lang === 'bn' ? 'মোট বাকি' : 'Total Credit')
                          : (lang === 'bn' ? 'মোট আদায়' : 'Total Cash')}
                      </span>
                      <span
                        className={`text-lg sm:text-xl font-display font-extrabold tabular-nums tracking-tight ${
                          viewType === 'due' ? 'text-ledger-red' : 'text-ledger-green'
                        }`}
                      >
                        ৳{formatNumber(totalAmount, lang)}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                      <span>
                        {formatNumber(segments.length, lang)}{' '}
                        {lang === 'bn' ? 'টি খাত' : segments.length === 1 ? 'tag' : 'tags'}
                      </span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>
                        {formatNumber(totalCount, lang)}{' '}
                        {lang === 'bn' ? 'টি লেনদেন' : totalCount === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                  </div>

                  {/* Unified Liquid Glass Etched Spectrum Bar */}
                  <div className="h-2.5 w-full rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-center gap-[2px] overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                    {segments.map((seg) => {
                      const isSelected = activeSegment?.id === seg.id;
                      const isDimmed = activeSegment !== null && !isSelected;

                      return (
                        <div
                          key={seg.id}
                          onClick={() => {
                            triggerHaptic('tick');
                            setActiveTagId(activeTagId === seg.id ? null : seg.id);
                          }}
                          onMouseEnter={() => setActiveTagId(seg.id)}
                          className="h-full rounded-full relative overflow-hidden cursor-pointer transition-opacity duration-200 dash-anim-bar-x"
                          style={{
                            width: `${Math.max(2, seg.percentage)}%`,
                            backgroundColor: seg.color,
                            opacity: isDimmed ? 0.3 : 0.92,
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.55)'
                          }}
                          title={`${seg.name}: ${Math.round(seg.percentage)}%`}
                        >
                          <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70 glass-bar-etch" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Clean Hairline Ledger Rows (Zero Dots, Zero Extra Pills) */}
                  <div className="divide-y divide-slate-900/[0.055] dark:divide-white/[0.055]">
                    {visibleRows.map((seg, idx) => {
                      const isSelected = activeSegment?.id === seg.id;
                      const isDimmed = activeSegment !== null && !isSelected;
                      const IconComp = seg.meta?.icon || DefaultTagIcon;

                      return (
                        <div
                          key={seg.id}
                          onClick={() => {
                            triggerHaptic('tick');
                            setActiveTagId(activeTagId === seg.id ? null : seg.id);
                          }}
                          onMouseEnter={() => setActiveTagId(seg.id)}
                          className={`py-2 first:pt-0.5 last:pb-0 cursor-pointer transition-opacity duration-200 ${
                            isDimmed ? 'opacity-45 hover:opacity-85' : 'opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 w-4 shrink-0 tabular-nums">
                                {formatNumber(idx + 1, lang).padStart(2, lang === 'bn' ? '০' : '0')}
                              </span>
                              {seg.meta?.logoDataUrl ? (
                                <img
                                  src={seg.meta.logoDataUrl}
                                  alt={seg.name}
                                  className="w-3.5 h-3.5 shrink-0 rounded-xs object-contain"
                                  draggable={false}
                                />
                              ) : (
                                <IconComp
                                  className="w-3.5 h-3.5 shrink-0 stroke-[1.5]"
                                  style={{ color: seg.color }}
                                />
                              )}
                              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {seg.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 font-mono tabular-nums shrink-0 text-xs">
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                {formatNumber(Math.round(seg.percentage), lang)}%
                              </span>
                              <span className="font-bold text-slate-950 dark:text-white">
                                ৳{formatNumber(seg.amount, lang)}
                              </span>
                            </div>
                          </div>

                          {/* Precision Hairline Proportional Rule */}
                          <div className="ml-[26px] mt-1.5 h-[2px] w-[calc(100%-26px)] rounded-full bg-slate-900/[0.045] dark:bg-white/[0.05] overflow-hidden">
                            <div
                              className="h-full rounded-full dash-anim-bar-x"
                              style={{
                                width: `${Math.max(3, seg.percentage)}%`,
                                backgroundColor: seg.color,
                                opacity: isSelected ? 0.95 : 0.65
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </StaggerReveal>
    </section>
  );
};

export default TagDistributionChart;
