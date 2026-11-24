import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Clock, ChevronLeft, ChevronRight, ChevronDown, Check, X, Search, User, CreditCard, Delete
} from 'lucide-react';
import { Customer } from '../types';
import { Language, formatNumber } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { playWheelTick, unlockWheelAudio } from '../lib/sounds';
import { cleanBangladeshiPhone } from '../lib/phoneUtils';
import { matchesPhonetic, isPhoneticSearchEnabled } from '../lib/phonetics';
import ModalPortal, { useModalScrollLock } from './ModalPortal';

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
const MONTH_NAMES_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

const MODAL_SHEET_SPRING = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 36,
  mass: 0.85
};

export function formatTimeDisplay(time24: string, lang: Language): string {
  if (!time24 || !time24.includes(':')) return lang === 'bn' ? 'সময় বেছে নিন' : 'Select time';
  const [hStr, mStr] = time24.split(':');
  const h24 = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h24) || isNaN(m)) return time24;
  const isPm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const hh = String(h12).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const period = lang === 'bn' ? (isPm ? 'PM' : 'AM') : (isPm ? 'PM' : 'AM');
  if (lang === 'bn') {
    return `${formatNumber(Number(hh), 'bn').padStart(2, '০')}:${m < 10 ? `০${formatNumber(m, 'bn')}` : formatNumber(m, 'bn')} ${period}`;
  }
  return `${hh}:${mm} ${period}`;
}

export function formatDateDisplay(dateStr: string, lang: Language): string {
  if (!dateStr) return lang === 'bn' ? 'তারিখ বেছে নিন' : 'Select date';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  try {
    return dt.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/* ============================================================================
 * 1. NATIVE DATE PICKER
 * ============================================================================ */
interface NativeDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  lang: Language;
  placeholder?: string;
  title?: string;
  triggerClassName?: string;
  iconOnly?: boolean;
  id?: string;
}

export function NativeDatePicker({
  value,
  onChange,
  lang,
  placeholder,
  title,
  triggerClassName,
  iconOnly = false,
  id
}: NativeDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const initialDate = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [pickerMode, setPickerMode] = useState<'days' | 'months' | 'years'>('days');
  const [yearPageStart, setYearPageStart] = useState(() => Math.floor(initialDate.getFullYear() / 12) * 12);

  useEffect(() => {
    if (isOpen) {
      const y = initialDate.getFullYear();
      setViewYear(y);
      setViewMonth(initialDate.getMonth());
      setYearPageStart(Math.floor(y / 12) * 12);
      setPickerMode('days');
    }
  }, [isOpen, initialDate]);

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOffset = new Date(viewYear, viewMonth, 1).getDay();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handleHeaderPrev = () => {
    triggerHaptic('tick');
    if (pickerMode === 'years') {
      setYearPageStart(s => s - 12);
      return;
    }
    if (pickerMode === 'months') {
      setViewYear(y => y - 1);
      return;
    }
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleHeaderNext = () => {
    triggerHaptic('tick');
    if (pickerMode === 'years') {
      setYearPageStart(s => s + 12);
      return;
    }
    if (pickerMode === 'months') {
      setViewYear(y => y + 1);
      return;
    }
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const selectDay = (day: number) => {
    triggerHaptic('single');
    const formatted = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const monthLabel = lang === 'bn' ? MONTH_NAMES_BN[viewMonth] : MONTH_NAMES_EN[viewMonth];
  const monthNamesGrid = lang === 'bn' ? MONTH_NAMES_BN : MONTH_SHORT_EN;
  const weekdays = lang === 'bn' ? WEEKDAYS_BN : WEEKDAYS_EN;
  const formattedViewYear = formatNumber(viewYear, lang).replace(/,/g, '');

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          id={id}
          onClick={() => {
            triggerHaptic('single');
            setIsOpen(true);
          }}
          className={triggerClassName || 'touch-press w-10 h-10 surface-glass-interactive border rounded-full flex items-center justify-center text-slate-900 dark:text-white cursor-pointer'}
          title={title || (lang === 'bn' ? 'তারিখ নির্বাচন করুন' : 'Select Date')}
        >
          <Calendar className="w-4 h-4 stroke-[1.25]" />
        </button>
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => {
            triggerHaptic('single');
            setIsOpen(true);
          }}
          className={triggerClassName || 'w-full px-3.5 py-2.5 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-2xl text-slate-950 dark:text-white text-xs font-medium outline-none hover:border-slate-900/20 dark:hover:border-white/20 transition-colors flex items-center justify-between gap-2 cursor-pointer text-left touch-press'}
        >
          <span className={`truncate font-mono ${value ? 'text-slate-950 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
            {value ? formatDateDisplay(value, lang) : (placeholder || (lang === 'bn' ? 'তারিখ বেছে নিন' : 'Select date'))}
          </span>
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[1.25]" />
        </button>
      )}

      <ModalPortal lockScroll={false}>
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 [backdrop-filter:blur(16px)] [-webkit-backdrop-filter:blur(16px)]"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{ willChange: 'transform, opacity' }}
                onClick={(e) => e.stopPropagation()}
                className="glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col relative z-10 max-h-[90dvh]"
              >
                <div className="flex items-center justify-center pt-3 pb-1 sm:hidden w-full mx-auto">
                  <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto" />
                </div>

                {/* Header */}
                <div className="px-5 pt-3 sm:pt-5 pb-3.5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                      {title || (lang === 'bn' ? 'তারিখ নির্বাচন' : 'Select Date')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick');
                        if (pickerMode === 'days') {
                          setYearPageStart(Math.floor(viewYear / 12) * 12);
                          setPickerMode('months');
                        } else {
                          setPickerMode('days');
                        }
                      }}
                      className="font-display text-base font-bold text-slate-950 dark:text-white mt-0.5 text-left cursor-pointer hover:opacity-75 transition-opacity inline-flex items-center gap-1"
                      title={lang === 'bn' ? 'মাস ও বছর পরিবর্তন করুন' : 'Pick month & year'}
                    >
                      <span>{monthLabel} {formattedViewYear}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 stroke-[1.75] transition-transform duration-200 ${
                          pickerMode !== 'days' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleHeaderPrev}
                      className="w-8 h-8 rounded-full surface-subcard border flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] cursor-pointer touch-press transition-colors"
                      aria-label={pickerMode === 'years' ? 'Previous years' : pickerMode === 'months' ? 'Previous year' : 'Previous month'}
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={handleHeaderNext}
                      className="w-8 h-8 rounded-full surface-subcard border flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] cursor-pointer touch-press transition-colors"
                      aria-label={pickerMode === 'years' ? 'Next years' : pickerMode === 'months' ? 'Next year' : 'Next month'}
                    >
                      <ChevronRight className="w-4 h-4 stroke-[1.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="w-8 h-8 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-white flex items-center justify-center cursor-pointer ml-1 transition-colors"
                    >
                      <X className="w-4 h-4 stroke-[1.25]" />
                    </button>
                  </div>
                </div>

                {/* Calendar / Month / Year Stage */}
                <div className="p-4 sm:p-5 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    {pickerMode === 'days' && (
                      <motion.div
                        key={`days-${viewYear}-${viewMonth}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-2.5"
                      >
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {weekdays.map((wd) => (
                            <div key={wd} className="text-[11px] font-bold text-slate-400 dark:text-slate-500 py-1">
                              {wd}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: firstDayOffset }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-10" />
                          ))}
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                            const cellStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isSelected = value === cellStr;
                            const isToday = todayStr === cellStr;

                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => selectDay(day)}
                                className={`h-10 rounded-full font-mono text-xs font-bold flex items-center justify-center transition-colors duration-150 cursor-pointer touch-press relative ${
                                  isSelected
                                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                                    : isToday
                                    ? 'surface-subcard border-2 text-slate-950 dark:text-white'
                                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]'
                                }`}
                                style={isToday && !isSelected ? { borderColor: 'var(--accent-color)' } : undefined}
                              >
                                {formatNumber(day, lang)}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {pickerMode === 'months' && (
                      <motion.div
                        key="months-grid"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                            {lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Choose Month'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('tick');
                              setYearPageStart(Math.floor(viewYear / 12) * 12);
                              setPickerMode('years');
                            }}
                            className="px-3 py-1.5 rounded-full surface-subcard border text-xs font-mono font-bold text-slate-950 dark:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] flex items-center gap-1 cursor-pointer touch-press transition-colors"
                          >
                            <span>{formattedViewYear}</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-65 stroke-[1.5]" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {monthNamesGrid.map((mName, mIdx) => {
                            const isSelectedMonth = mIdx === viewMonth;
                            const isCurrentMonth = mIdx === today.getMonth() && viewYear === today.getFullYear();
                            return (
                              <button
                                key={mIdx}
                                type="button"
                                onClick={() => {
                                  triggerHaptic('single');
                                  setViewMonth(mIdx);
                                  setPickerMode('days');
                                }}
                                className={`py-3 px-2 rounded-2xl text-xs font-bold transition-colors duration-150 cursor-pointer touch-press ${
                                  isSelectedMonth
                                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                                    : isCurrentMonth
                                    ? 'surface-subcard border-2 text-slate-950 dark:text-white'
                                    : 'surface-subcard border text-slate-800 dark:text-slate-200 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]'
                                }`}
                                style={isCurrentMonth && !isSelectedMonth ? { borderColor: 'var(--accent-color)' } : undefined}
                              >
                                {mName}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {pickerMode === 'years' && (
                      <motion.div
                        key={`years-grid-${yearPageStart}`}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                            {lang === 'bn' ? 'বছর নির্বাচন করুন' : 'Choose Year'}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                            {formatNumber(yearPageStart, lang).replace(/,/g, '')} – {formatNumber(yearPageStart + 11, lang).replace(/,/g, '')}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {Array.from({ length: 12 }, (_, idx) => yearPageStart + idx).map((yr) => {
                            const isSelectedYear = yr === viewYear;
                            const isCurrentYear = yr === today.getFullYear();
                            return (
                              <button
                                key={yr}
                                type="button"
                                onClick={() => {
                                  triggerHaptic('single');
                                  setViewYear(yr);
                                  setPickerMode('months');
                                }}
                                className={`py-3 px-2 rounded-2xl font-mono text-xs font-bold transition-colors duration-150 cursor-pointer touch-press tabular-nums ${
                                  isSelectedYear
                                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                                    : isCurrentYear
                                    ? 'surface-subcard border-2 text-slate-950 dark:text-white'
                                    : 'surface-subcard border text-slate-800 dark:text-slate-200 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]'
                                }`}
                                style={isCurrentYear && !isSelectedYear ? { borderColor: 'var(--accent-color)' } : undefined}
                              >
                                {formatNumber(yr, lang).replace(/,/g, '')}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2.5 bg-white/40 dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      onChange(todayStr);
                      setIsOpen(false);
                    }}
                    className="px-4 py-2 rounded-full surface-subcard border text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] cursor-pointer touch-press transition-colors"
                  >
                    {lang === 'bn' ? 'আজকের তারিখ' : 'Today'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pickerMode !== 'days') {
                        triggerHaptic('tick');
                        setPickerMode('days');
                      } else {
                        setIsOpen(false);
                      }
                    }}
                    className="px-4 py-2 rounded-full bg-slate-900/[0.06] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
                  >
                    {pickerMode !== 'days'
                      ? (lang === 'bn' ? 'ক্যালেন্ডারে ফিরুন' : 'Back to Days')
                      : (lang === 'bn' ? 'বন্ধ করুন' : 'Close')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>
    </>
  );
}

/* ============================================================================
 * 2. NATIVE TIME PICKER
 * ============================================================================ */
interface NativeTimePickerProps {
  value: string; // HH:mm
  onChange: (timeStr: string) => void;
  lang: Language;
  title?: string;
  triggerClassName?: string;
  id?: string;
}

interface AppleWheelColumnProps<T> {
  items: T[];
  selectedItem: T;
  onSelect: (item: T) => void;
  renderItem: (item: T, distance: number) => React.ReactNode;
  loop?: boolean;
  itemHeight?: number;
  wheelHeight?: number;
  ariaLabel?: string;
  className?: string;
}

const WHEEL_STEP_DEG = 22;
const WHEEL_STEP_RAD = (WHEEL_STEP_DEG * Math.PI) / 180;
const WHEEL_CYLINDER_RADIUS = 96;

function positiveMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function rubberBandOffset(value: number, min: number, max: number): number {
  if (value < min) {
    const over = min - value;
    return min - (over * 0.34) / (1 + over * 0.25);
  }
  if (value > max) {
    const over = value - max;
    return max + (over * 0.34) / (1 + over * 0.25);
  }
  return value;
}

function AppleWheelColumn<T extends string | number>({
  items,
  selectedItem,
  onSelect,
  renderItem,
  loop = true,
  itemHeight = 36,
  wheelHeight = 216,
  ariaLabel,
  className = ''
}: AppleWheelColumnProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const count = items.length;
  const initialIndex = Math.max(0, items.indexOf(selectedItem));

  const offsetRef = useRef<number>(initialIndex);
  const [renderOffset, setRenderOffset] = useState<number>(initialIndex);
  const lastTickSlotRef = useRef<number>(initialIndex);
  const lastEmittedIdxRef = useRef<number>(initialIndex);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startY: number;
    startOffset: number;
    totalTravel: number;
    samples: Array<{ y: number; t: number }>;
  }>({
    active: false,
    pointerId: null,
    startY: 0,
    startOffset: initialIndex,
    totalTravel: 0,
    samples: []
  });

  const animRef = useRef<{
    rafId: number | null;
    mode: 'idle' | 'coast' | 'snap';
    velocity: number; // slots / sec
    targetOffset: number;
    lastTime: number;
  }>({
    rafId: null,
    mode: 'idle',
    velocity: 0,
    targetOffset: initialIndex,
    lastTime: 0
  });

  const wheelTimerRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const stopAnimation = () => {
    if (animRef.current.rafId !== null) {
      cancelAnimationFrame(animRef.current.rafId);
      animRef.current.rafId = null;
    }
    animRef.current.mode = 'idle';
    animRef.current.velocity = 0;
  };

  const commitIfSlotCrossed = (rawOffset: number) => {
    const rounded = loop
      ? Math.round(rawOffset)
      : Math.max(0, Math.min(count - 1, Math.round(rawOffset)));

    if (rounded !== lastTickSlotRef.current) {
      lastTickSlotRef.current = rounded;
      playWheelTick();
      triggerHaptic('tick');

      const normIdx = positiveMod(rounded, count);
      if (normIdx !== lastEmittedIdxRef.current) {
        lastEmittedIdxRef.current = normIdx;
        const nextVal = itemsRef.current[normIdx];
        if (nextVal !== undefined) {
          onSelectRef.current(nextVal);
        }
      }
    }
  };

  const setWheelOffset = (nextOffset: number) => {
    offsetRef.current = nextOffset;
    commitIfSlotCrossed(nextOffset);
    setRenderOffset(nextOffset);
  };

  const startSnapTo = (targetSlot: number, initialVelocity = 0) => {
    stopAnimation();
    const clampedTarget = loop
      ? Math.round(targetSlot)
      : Math.max(0, Math.min(count - 1, Math.round(targetSlot)));

    animRef.current.mode = 'snap';
    animRef.current.targetOffset = clampedTarget;
    animRef.current.velocity = initialVelocity;
    animRef.current.lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - animRef.current.lastTime) / 1000));
      animRef.current.lastTime = now;

      const diff = animRef.current.targetOffset - offsetRef.current;
      // Critically damped spring settle
      const stiffness = 260;
      const damping = 32;
      const accel = stiffness * diff - damping * animRef.current.velocity;
      animRef.current.velocity += accel * dt;
      const next = offsetRef.current + animRef.current.velocity * dt;

      if (Math.abs(animRef.current.targetOffset - next) < 0.002 && Math.abs(animRef.current.velocity) < 0.02) {
        setWheelOffset(animRef.current.targetOffset);
        stopAnimation();
        // Keep virtual offset compact when idle in loop mode
        if (loop && Math.abs(offsetRef.current) > count * 20) {
          const modVal = positiveMod(Math.round(offsetRef.current), count);
          offsetRef.current = modVal;
          lastTickSlotRef.current = modVal;
          setRenderOffset(modVal);
        }
        return;
      }

      setWheelOffset(next);
      animRef.current.rafId = requestAnimationFrame(step);
    };

    animRef.current.rafId = requestAnimationFrame(step);
  };

  const startCoast = (velocitySlotsPerSec: number) => {
    stopAnimation();
    animRef.current.mode = 'coast';
    animRef.current.velocity = Math.max(-42, Math.min(42, velocitySlotsPerSec));
    animRef.current.lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - animRef.current.lastTime) / 1000));
      animRef.current.lastTime = now;

      // Fluid exponential iOS scroll deceleration
      const decay = Math.exp(-3.9 * dt);
      animRef.current.velocity *= decay;
      let next = offsetRef.current + animRef.current.velocity * dt;

      if (!loop) {
        if (next < 0) {
          next = rubberBandOffset(next, 0, count - 1);
          animRef.current.velocity *= 0.45;
          if (Math.abs(animRef.current.velocity) < 1.2) {
            setWheelOffset(next);
            startSnapTo(0, animRef.current.velocity);
            return;
          }
        } else if (next > count - 1) {
          next = rubberBandOffset(next, 0, count - 1);
          animRef.current.velocity *= 0.45;
          if (Math.abs(animRef.current.velocity) < 1.2) {
            setWheelOffset(next);
            startSnapTo(count - 1, animRef.current.velocity);
            return;
          }
        }
      }

      setWheelOffset(next);

      if (Math.abs(animRef.current.velocity) < 0.75) {
        startSnapTo(Math.round(next), animRef.current.velocity);
        return;
      }

      animRef.current.rafId = requestAnimationFrame(step);
    };

    animRef.current.rafId = requestAnimationFrame(step);
  };

  // Sync if selectedItem changes externally while idle
  useEffect(() => {
    if (dragRef.current.active || animRef.current.mode !== 'idle') return;
    const targetIdx = items.indexOf(selectedItem);
    if (targetIdx < 0) return;

    const currentNorm = positiveMod(Math.round(offsetRef.current), count);
    if (targetIdx !== currentNorm) {
      let delta = targetIdx - currentNorm;
      if (loop) {
        if (delta > count / 2) delta -= count;
        if (delta < -count / 2) delta += count;
      }
      const nextSlot = Math.round(offsetRef.current) + delta;
      offsetRef.current = nextSlot;
      lastTickSlotRef.current = nextSlot;
      lastEmittedIdxRef.current = targetIdx;
      setRenderOffset(nextSlot);
    }
  }, [selectedItem, items, count, loop]);

  // Non-passive wheel listener for smooth trackpad/mouse wheel spinning
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      unlockWheelAudio();
      stopAnimation();

      const deltaSlots = (e.deltaY / itemHeight) * 0.55;
      let next = offsetRef.current + deltaSlots;
      if (!loop) {
        next = rubberBandOffset(next, 0, count - 1);
      }
      setWheelOffset(next);

      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
      }
      wheelTimerRef.current = window.setTimeout(() => {
        wheelTimerRef.current = null;
        startSnapTo(Math.round(offsetRef.current));
      }, 95);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
      }
    };
  }, [count, itemHeight, loop]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      stopAnimation();
      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    unlockWheelAudio();
    stopAnimation();
    if (wheelTimerRef.current !== null) {
      window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = null;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      startOffset: offsetRef.current,
      totalTravel: 0,
      samples: [{ y: e.clientY, t: now }]
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== e.pointerId) return;
    const now = performance.now();
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.totalTravel = Math.max(dragRef.current.totalTravel, Math.abs(dy));
    dragRef.current.samples.push({ y: e.clientY, t: now });
    if (dragRef.current.samples.length > 8) {
      dragRef.current.samples.shift();
    }

    let next = dragRef.current.startOffset - dy / itemHeight;
    if (!loop) {
      next = rubberBandOffset(next, 0, count - 1);
    }
    setWheelOffset(next);
  };

  const finishPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current.active = false;
    dragRef.current.pointerId = null;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }

    // Tap to jump cleanly to tapped slot
    if (dragRef.current.totalTravel < 4 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const relY = e.clientY - rect.top - wheelHeight / 2;
      const ratio = Math.max(-0.94, Math.min(0.94, relY / WHEEL_CYLINDER_RADIUS));
      const approxSlotDelta = Math.round(Math.asin(ratio) / WHEEL_STEP_RAD);
      if (approxSlotDelta !== 0) {
        const targetSlot = Math.round(offsetRef.current) + approxSlotDelta;
        startSnapTo(targetSlot);
      } else {
        startSnapTo(Math.round(offsetRef.current));
      }
      return;
    }

    const now = performance.now();
    const recent = dragRef.current.samples.filter((s) => now - s.t <= 105);
    let velocitySlots = 0;

    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dtSec = (last.t - first.t) / 1000;
      if (dtSec > 0.004) {
        const dy = last.y - first.y;
        velocitySlots = -(dy / itemHeight) / dtSec;
      }
    }

    if (Math.abs(velocitySlots) > 1.35) {
      startCoast(velocitySlots);
    } else {
      startSnapTo(Math.round(offsetRef.current), velocitySlots * 0.35);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      unlockWheelAudio();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const target = Math.round(offsetRef.current) + delta;
      startSnapTo(target);
    }
  };

  // Render only visible window around current offset
  const centerVirtual = Math.round(renderOffset);
  const visibleSlots: number[] = [];
  for (let v = centerVirtual - 4; v <= centerVirtual + 4; v++) {
    if (loop || (v >= 0 && v < count)) {
      visibleSlots.push(v);
    }
  }

  return (
    <div
      ref={containerRef}
      role="spinbutton"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuenow={positiveMod(centerVirtual, count)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
      className={`relative select-none touch-none outline-none cursor-grab active:cursor-grabbing overflow-hidden ${className}`}
      style={{ height: `${wheelHeight}px`, perspective: '900px' }}
    >
      {visibleSlots.map((virtualIdx) => {
        const d = virtualIdx - renderOffset;
        if (Math.abs(d) > 3.65) return null;

        const itemIdx = positiveMod(virtualIdx, count);
        const item = items[itemIdx];
        const angleRad = d * WHEEL_STEP_RAD;
        const translateY = Math.sin(angleRad) * WHEEL_CYLINDER_RADIUS;
        const rotateX = -d * WHEEL_STEP_DEG;
        const absD = Math.abs(d);
        const scale = 1 - Math.min(1, absD / 3.8) * 0.14;
        const opacity = Math.max(0, 1 - Math.pow(absD / 3.55, 1.35));
        const isCenter = absD < 0.48;

        return (
          <div
            key={virtualIdx}
            className="absolute inset-x-0 top-1/2 flex items-center justify-center pointer-events-none will-change-transform"
            style={{
              height: `${itemHeight}px`,
              marginTop: `${-itemHeight / 2}px`,
              opacity,
              transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) rotateX(${rotateX.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
            }}
          >
            <span
              className={`leading-none transition-colors duration-75 ${
                isCenter
                  ? 'text-[21px] font-semibold text-slate-950 dark:text-white'
                  : 'text-[19px] font-normal text-slate-600 dark:text-slate-300'
              }`}
            >
              {renderItem(item, d)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function NativeTimePicker({
  value,
  onChange,
  lang,
  triggerClassName,
  id
}: NativeTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const parsed = useMemo(() => {
    const [hStr, mStr] = (value || '09:00').split(':');
    const h24 = Math.min(23, Math.max(0, parseInt(hStr || '9', 10) || 0));
    const min = Math.min(59, Math.max(0, parseInt(mStr || '0', 10) || 0));
    const isPm = h24 >= 12;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { h12, min, isPm };
  }, [value]);

  const [hour12, setHour12] = useState(parsed.h12);
  const [minute, setMinute] = useState(parsed.min);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.isPm ? 'PM' : 'AM');

  useEffect(() => {
    if (isOpen) {
      setHour12(parsed.h12);
      setMinute(parsed.min);
      setPeriod(parsed.isPm ? 'PM' : 'AM');
    }
  }, [isOpen, parsed]);

  useModalScrollLock(isOpen);

  const formatTo24 = (h12Val: number, minVal: number, pmVal: boolean) => {
    let h24 = h12Val % 12;
    if (pmVal) h24 += 12;
    return `${String(h24).padStart(2, '0')}:${String(minVal).padStart(2, '0')}`;
  };

  const handleConfirm = () => {
    triggerHaptic('single');
    onChange(formatTo24(hour12, minute, period === 'PM'));
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerHaptic('single');
        onChange(formatTo24(hour12, minute, period === 'PM'));
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, hour12, minute, period, onChange]);

  const padBn = (n: number) =>
    n < 10 ? `০${formatNumber(n, 'bn')}` : formatNumber(n, 'bn');

  const hourList = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], []);
  const minuteList = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const periodList = useMemo<Array<'AM' | 'PM'>>(() => ['AM', 'PM'], []);

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => {
          unlockWheelAudio();
          triggerHaptic('single');
          setIsOpen(true);
        }}
        className={triggerClassName || 'w-full px-3.5 py-2.5 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-2xl text-slate-950 dark:text-white text-xs font-mono font-bold outline-none hover:border-slate-900/20 dark:hover:border-white/20 transition-colors flex items-center justify-between gap-2 cursor-pointer touch-press'}
      >
        <span className="truncate">{formatTimeDisplay(value || '09:00', lang)}</span>
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[1.25]" />
      </button>

      <ModalPortal lockScroll={false}>
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-slate-950/55 dark:bg-black/75 [backdrop-filter:blur(16px)] [-webkit-backdrop-filter:blur(16px)]"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 22, scale: 0.985 }}
                transition={MODAL_SHEET_SPRING}
                style={{ willChange: 'transform, opacity' }}
                onClick={(e) => e.stopPropagation()}
                className="glass-modal w-full sm:max-w-[340px] rounded-t-[2rem] sm:rounded-[28px] border shadow-2xl overflow-hidden flex flex-col relative z-10"
              >
                {/* Minimal Apple Top Grab Handle (Mobile Only) */}
                <div className="flex items-center justify-center pt-2.5 pb-0.5 sm:hidden shrink-0 w-full">
                  <div className="w-9 h-1 bg-slate-400/35 dark:bg-white/20 rounded-full" />
                </div>

                {/* Minimal Apple Navigation Bar: Cancel | Title | Done */}
                <div className="px-4 pt-2.5 sm:pt-3.5 pb-2.5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick');
                      setIsOpen(false);
                    }}
                    className="min-h-[40px] px-2 flex items-center text-[15px] font-normal text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-colors"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>

                  <span className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-white truncate px-2">
                    {lang === 'bn' ? 'নির্ধারিত সময়' : 'Target Time'}
                  </span>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="min-h-[40px] px-2 flex items-center text-[15px] font-semibold text-[var(--accent-color,#059669)] hover:opacity-80 cursor-pointer transition-opacity"
                  >
                    {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
                  </button>
                </div>

                {/* Pure Apple Cylindrical Wheel Drum */}
                <div className="relative px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
                  <div className="relative max-w-[236px] mx-auto">
                    {/* Apple Center Selection Highlight Bar */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[38px] rounded-[10px] bg-slate-900/[0.065] dark:bg-white/[0.11]"
                    />

                    <div
                      className="grid grid-cols-3 items-center relative z-0"
                      style={{
                        maskImage: 'linear-gradient(to bottom, transparent 0%, black 24%, black 76%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 24%, black 76%, transparent 100%)',
                      }}
                    >
                      {/* Hours Wheel (Infinite Loop) */}
                      <AppleWheelColumn
                        items={hourList}
                        selectedItem={hour12}
                        onSelect={setHour12}
                        loop={true}
                        ariaLabel={lang === 'bn' ? 'ঘণ্টা' : 'Hour'}
                        renderItem={(h) => (
                          <span className="tabular-nums tracking-tight">
                            {lang === 'bn' ? formatNumber(h, 'bn') : String(h)}
                          </span>
                        )}
                      />

                      {/* Minutes Wheel (Infinite Loop) */}
                      <AppleWheelColumn
                        items={minuteList}
                        selectedItem={minute}
                        onSelect={setMinute}
                        loop={true}
                        ariaLabel={lang === 'bn' ? 'মিনিট' : 'Minute'}
                        renderItem={(m) => (
                          <span className="tabular-nums tracking-tight">
                            {lang === 'bn' ? padBn(m) : String(m).padStart(2, '0')}
                          </span>
                        )}
                      />

                      {/* AM / PM Wheel (Apple 2-Stop Bounded Wheel) */}
                      <AppleWheelColumn
                        items={periodList}
                        selectedItem={period}
                        onSelect={setPeriod}
                        loop={false}
                        ariaLabel={lang === 'bn' ? 'সকাল/বিকাল' : 'Period'}
                        renderItem={(p) => (
                          <span className="tracking-normal text-[18px]">
                            {p}
                          </span>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>
    </>
  );
}

/* ============================================================================
 * 3. NATIVE OPTION PICKER (Replaces <select> for Months, Frequencies, Days, Goals)
 * ============================================================================ */
export interface NativeOptionItem<T extends string | number> {
  value: T;
  label: string;
  compactLabel?: string;
  sublabel?: string;
  disabled?: boolean;
}

interface NativeOptionPickerProps<T extends string | number> {
  value: T;
  options: NativeOptionItem<T>[];
  onChange: (val: T) => void;
  lang: Language;
  title: string;
  placeholder?: string;
  triggerClassName?: string;
  gridColumns?: 1 | 2 | 5 | 7;
  id?: string;
}

export function NativeOptionPicker<T extends string | number>({
  value,
  options,
  onChange,
  lang,
  title,
  placeholder,
  triggerClassName,
  gridColumns = 1,
  id
}: NativeOptionPickerProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);

  const gridCls =
    gridColumns === 7
      ? 'grid grid-cols-7 gap-1.5'
      : gridColumns === 5
      ? 'grid grid-cols-5 gap-2'
      : gridColumns === 2
      ? 'grid grid-cols-2 gap-2'
      : 'space-y-2';

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => {
          triggerHaptic('single');
          setIsOpen(true);
        }}
        className={triggerClassName || 'w-full px-3.5 py-2.5 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-2xl text-slate-950 dark:text-white text-xs font-semibold outline-none hover:border-slate-900/20 dark:hover:border-white/20 transition-colors flex items-center justify-between gap-2 cursor-pointer text-left touch-press'}
      >
        <span className={`truncate ${selectedOption ? '' : 'text-slate-400 dark:text-slate-500'}`}>
          {selectedOption ? selectedOption.label : (placeholder || (lang === 'bn' ? 'নির্বাচন করুন' : 'Select option'))}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[1.5]" />
      </button>

      <ModalPortal lockScroll={false}>
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 [backdrop-filter:blur(16px)] [-webkit-backdrop-filter:blur(16px)]"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{ willChange: 'transform, opacity' }}
                onClick={(e) => e.stopPropagation()}
                className="glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col relative z-10 max-h-[82dvh]"
              >
                <div className="flex items-center justify-center pt-3 pb-1 sm:hidden w-full mx-auto">
                  <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto" />
                </div>

                <div className="px-5 pt-3 sm:pt-5 pb-3.5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
                  <h3 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                    {title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-white flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[1.25]" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
                  <div className={gridCls}>
                    {options.map((opt) => {
                      const isSelected = opt.value === value;
                      if (gridColumns > 1) {
                        return (
                          <button
                            key={String(opt.value)}
                            type="button"
                            disabled={opt.disabled}
                            onClick={() => {
                              if (opt.disabled) return;
                              triggerHaptic('single');
                              onChange(opt.value);
                              setIsOpen(false);
                            }}
                            className={`py-2.5 px-2 rounded-2xl text-xs font-bold transition-colors duration-150 cursor-pointer touch-press flex items-center justify-center text-center ${
                              opt.disabled
                                ? 'opacity-40 cursor-not-allowed surface-subcard border'
                                : isSelected
                                ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm'
                                : 'surface-subcard border text-slate-900 dark:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]'
                            }`}
                          >
                            <span className="truncate">{opt.compactLabel || opt.label}</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => {
                            if (opt.disabled) return;
                            triggerHaptic('single');
                            onChange(opt.value);
                            setIsOpen(false);
                          }}
                          className={`w-full p-3.5 rounded-2xl transition-colors duration-150 cursor-pointer flex items-center justify-between gap-3 text-left touch-press ${
                            opt.disabled
                              ? 'opacity-45 cursor-not-allowed surface-subcard border'
                              : isSelected
                              ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm'
                              : 'surface-subcard border text-slate-900 dark:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{opt.label}</div>
                            {opt.sublabel && (
                              <div className={`text-[11px] mt-0.5 truncate ${isSelected ? 'text-white/75 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
                                {opt.sublabel}
                              </div>
                            )}
                          </div>
                          {isSelected && <Check className="w-4 h-4 stroke-[1.75] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>
    </>
  );
}

/* ============================================================================
 * 4. NATIVE CUSTOMER PICKER (Searchable Glass Customer Picker)
 * ============================================================================ */
interface NativeCustomerPickerProps {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  lang: Language;
  title?: string;
  placeholder: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabledCustomerIds?: Set<string>;
  disabledBadgeText?: string;
  triggerClassName?: string;
  id?: string;
}

export function NativeCustomerPicker({
  customers,
  value,
  onChange,
  lang,
  title,
  placeholder,
  allowNone = false,
  noneLabel,
  disabledCustomerIds,
  disabledBadgeText,
  triggerClassName,
  id
}: NativeCustomerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === value) || null,
    [customers, value]
  );

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    const phoneticOn = isPhoneticSearchEnabled();
    return customers.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.phone && cleanBangladeshiPhone(c.phone).includes(q)) return true;
      if (phoneticOn && matchesPhonetic(c.name, q)) return true;
      return false;
    });
  }, [customers, query]);

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => {
          triggerHaptic('single');
          setIsOpen(true);
        }}
        className={triggerClassName || 'w-full px-3.5 py-2.5 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-2xl text-slate-950 dark:text-white text-xs font-medium outline-none hover:border-slate-900/20 dark:hover:border-white/20 transition-colors flex items-center justify-between gap-2 cursor-pointer text-left touch-press'}
      >
        <span className={`truncate flex items-center gap-1.5 min-w-0 ${selectedCustomer ? 'font-bold text-slate-950 dark:text-white' : (allowNone && value === '' ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500')}`}>
          {selectedCustomer ? (
            <>
              {selectedCustomer.accountType === 'credit_card' ? (
                <CreditCard className="w-3.5 h-3.5 shrink-0 opacity-70 stroke-[1.25]" />
              ) : (
                <User className="w-3.5 h-3.5 shrink-0 opacity-70 stroke-[1.25]" />
              )}
              <span className="truncate">{selectedCustomer.name}</span>
              <span className="font-mono text-[11px] opacity-65 shrink-0">
                (৳{formatNumber(selectedCustomer.outstandingDue || 0, lang)})
              </span>
            </>
          ) : allowNone && value === '' && noneLabel ? (
            noneLabel
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[1.5]" />
      </button>

      <ModalPortal lockScroll={false}>
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 [backdrop-filter:blur(16px)] [-webkit-backdrop-filter:blur(16px)]"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{ willChange: 'transform, opacity' }}
                onClick={(e) => e.stopPropagation()}
                className="glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col relative z-10 max-h-[85dvh]"
              >
                <div className="flex items-center justify-center pt-3 pb-1 sm:hidden shrink-0 w-full mx-auto">
                  <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto" />
                </div>

                {/* Header */}
                <div className="px-5 pt-3 sm:pt-5 pb-3.5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
                  <div>
                    <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                      {lang === 'bn' ? 'গ্রাহক তালিকা' : 'Customer Directory'}
                    </span>
                    <h3 className="font-display text-base font-bold text-slate-950 dark:text-white mt-0.5">
                      {title || (lang === 'bn' ? 'গ্রাহক নির্বাচন করুন' : 'Select Customer')}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-white flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[1.25]" />
                  </button>
                </div>

                {/* Search Field */}
                <div className="px-4 sm:px-5 pt-3.5 pb-2 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 stroke-[1.25] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={lang === 'bn' ? 'নাম বা নম্বর দিয়ে খুঁজুন...' : 'Search by name or phone...'}
                      className="w-full pl-10 pr-10 py-2.5 rounded-full border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white text-xs font-semibold outline-none focus:border-slate-900/30 dark:focus:border-white/30"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          setQuery('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                      >
                        <Delete className="w-3.5 h-3.5 stroke-[1.25]" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer List */}
                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 sm:px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 space-y-2">
                  {allowNone && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        onChange('');
                        setIsOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-2xl transition-colors duration-150 cursor-pointer flex items-center justify-between gap-3 text-left touch-press ${
                        value === ''
                          ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm'
                          : 'surface-subcard border text-slate-900 dark:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <span className="text-xs font-bold truncate">
                        {noneLabel || (lang === 'bn' ? 'কোনো গ্রাহক নয়' : 'None')}
                      </span>
                      {value === '' && <Check className="w-4 h-4 stroke-[1.75] shrink-0" />}
                    </button>
                  )}

                  {filteredCustomers.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'কোনো গ্রাহক পাওয়া যায়নি' : 'No matching customers found'}
                    </div>
                  ) : (
                    filteredCustomers.map((c) => {
                      const isSelected = value === c.id;
                      const isDisabled = Boolean(disabledCustomerIds?.has(c.id));
                      const initial = c.name.trim().charAt(0).toUpperCase() || 'C';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            triggerHaptic('single');
                            onChange(c.id);
                            setIsOpen(false);
                          }}
                          className={`w-full p-3.5 rounded-2xl transition-colors duration-150 flex items-center justify-between gap-3 text-left ${
                            isDisabled
                              ? 'opacity-45 cursor-not-allowed surface-subcard border'
                              : isSelected
                              ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm cursor-pointer touch-press'
                              : 'surface-subcard border text-slate-900 dark:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] cursor-pointer touch-press'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 ${
                              isSelected
                                ? 'bg-white text-slate-950 dark:bg-slate-950 dark:text-white'
                                : 'bg-slate-900/[0.06] dark:bg-white/[0.08] text-slate-700 dark:text-slate-200'
                            }`}>
                              {c.accountType === 'credit_card' ? <CreditCard className="w-4 h-4 stroke-[1.25]" /> : initial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                <span className="truncate">{c.name}</span>
                                {isDisabled && disabledBadgeText && (
                                  <span className="text-[10px] font-semibold opacity-80 shrink-0">
                                    · {disabledBadgeText}
                                  </span>
                                )}
                              </div>
                              <div className={`text-[11px] font-mono truncate mt-0.5 ${isSelected ? 'text-white/75 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
                                {c.phone ? cleanBangladeshiPhone(c.phone) : (lang === 'bn' ? 'নম্বর নেই' : 'No phone')}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-mono text-xs font-bold tabular-nums ${
                              isSelected
                                ? 'text-white dark:text-slate-950'
                                : (c.outstandingDue || 0) > 0
                                ? 'text-ledger-red'
                                : (c.outstandingDue || 0) < 0
                                ? 'text-ledger-green'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              ৳{formatNumber(c.outstandingDue || 0, lang)}
                            </span>
                            {isSelected && <Check className="w-4 h-4 stroke-[1.75]" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>
    </>
  );
}
