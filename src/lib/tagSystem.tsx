import React from 'react';
import {
  Utensils,
  Car,
  Home,
  HeartPulse,
  User,
  ShoppingBag,
  GraduationCap,
  Receipt,
  Landmark,
  Gift,
  Plane,
  Users,
  PawPrint,
  Tag,
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  LucideIcon
} from 'lucide-react';
import { Language } from './translations';
import { Transaction } from '../types';

export interface TagMeta {
  id: string;
  en: string;
  bn: string;
  shortDescEn: string;
  shortDescBn: string;
  icon: LucideIcon;
  color: string;
}

export const EXPENSE_TAGS: TagMeta[] = [
  { id: 'food', en: 'Food', bn: 'খাবার', shortDescEn: 'Food', shortDescBn: 'খাবার', icon: Utensils, color: '#F97316' },
  { id: 'transport', en: 'Transport', bn: 'যাতায়াত', shortDescEn: 'Transport', shortDescBn: 'যাতায়াত', icon: Car, color: '#3B82F6' },
  { id: 'housing', en: 'Housing', bn: 'বাসা-ভাড়া', shortDescEn: 'Housing', shortDescBn: 'বাসা-ভাড়া', icon: Home, color: '#8B5CF6' },
  { id: 'health', en: 'Health', bn: 'চিকিৎসা', shortDescEn: 'Health', shortDescBn: 'চিকিৎসা', icon: HeartPulse, color: '#EF4444' },
  { id: 'personal', en: 'Personal', bn: 'ব্যক্তিগত', shortDescEn: 'Personal', shortDescBn: 'ব্যক্তিগত', icon: User, color: '#EC4899' },
  { id: 'shopping', en: 'Shopping', bn: 'কেনাকাটা', shortDescEn: 'Shopping', shortDescBn: 'কেনাকাটা', icon: ShoppingBag, color: '#06B6D4' },
  { id: 'education', en: 'Education', bn: 'শিক্ষা', shortDescEn: 'Education', shortDescBn: 'শিক্ষা', icon: GraduationCap, color: '#10B981' },
  { id: 'bills', en: 'Bills', bn: 'বিল', shortDescEn: 'Bills', shortDescBn: 'বিল', icon: Receipt, color: '#F59E0B' },
  { id: 'finance', en: 'Finance', bn: 'ফাইন্যান্স', shortDescEn: 'Finance', shortDescBn: 'ফাইন্যান্স', icon: Landmark, color: '#6366F1' },
  { id: 'gifts', en: 'Gifts', bn: 'উপহার', shortDescEn: 'Gift', shortDescBn: 'উপহার', icon: Gift, color: '#F43F5E' },
  { id: 'travel', en: 'Travel', bn: 'ভ্রমণ', shortDescEn: 'Travel', shortDescBn: 'ভ্রমণ', icon: Plane, color: '#0EA5E9' },
  { id: 'family', en: 'Family', bn: 'পরিবার', shortDescEn: 'Family', shortDescBn: 'পরিবার', icon: Users, color: '#14B8A6' },
  { id: 'pets', en: 'Pets', bn: 'পোষা প্রাণী', shortDescEn: 'Pets', shortDescBn: 'পোষা প্রাণী', icon: PawPrint, color: '#D97706' },
  { id: 'other', en: 'Other', bn: 'অন্যান্য', shortDescEn: 'Other', shortDescBn: 'অন্যান্য', icon: Tag, color: '#64748B' },
];

export const PAYMENT_TAGS: TagMeta[] = [
  { id: 'cash', en: 'Cash', bn: 'নগদ', shortDescEn: 'Cash', shortDescBn: 'নগদ', icon: Banknote, color: '#10B981' },
  { id: 'card', en: 'Card', bn: 'কার্ড', shortDescEn: 'Card', shortDescBn: 'কার্ড', icon: CreditCard, color: '#3B82F6' },
  { id: 'mobile', en: 'Mobile', bn: 'মোবাইল', shortDescEn: 'Mobile', shortDescBn: 'মোবাইল', icon: Smartphone, color: '#EC4899' },
  { id: 'bank', en: 'Bank', bn: 'ব্যাংক', shortDescEn: 'Bank', shortDescBn: 'ব্যাংক', icon: Building2, color: '#8B5CF6' },
  { id: 'online', en: 'Online', bn: 'অনলাইন', shortDescEn: 'Online', shortDescBn: 'অনলাইন', icon: Globe, color: '#06B6D4' },
  { id: 'other', en: 'Other', bn: 'অন্যান্য', shortDescEn: 'Other', shortDescBn: 'অন্যান্য', icon: Tag, color: '#64748B' },
];

export const ALL_TAGS: TagMeta[] = [...EXPENSE_TAGS, ...PAYMENT_TAGS.filter(p => !EXPENSE_TAGS.some(e => e.id === p.id))];

const TAG_MAP: Record<string, TagMeta> = {};
EXPENSE_TAGS.forEach(t => { TAG_MAP[t.id] = t; });
PAYMENT_TAGS.forEach(t => { if (!TAG_MAP[t.id]) TAG_MAP[t.id] = t; });

export function getTagMeta(tagId?: string | null): TagMeta | null {
  if (!tagId) return null;
  const normalized = tagId.toLowerCase().trim();
  return TAG_MAP[normalized] || null;
}

export function getTagDefaultDescription(tagId: string, lang: Language): string {
  const meta = getTagMeta(tagId);
  if (!meta) return '';
  return lang === 'bn' ? meta.shortDescBn : meta.shortDescEn;
}

export function recordTagUsage(tagId: string): void {
  if (typeof window === 'undefined' || !tagId) return;
  try {
    const raw = localStorage.getItem('easy_due_tag_usage_counts');
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const norm = tagId.toLowerCase().trim();
    map[norm] = (map[norm] || 0) + 1;
    localStorage.setItem('easy_due_tag_usage_counts', JSON.stringify(map));
  } catch {}
}

export function getTagUsageCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('easy_due_tag_usage_counts');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getSortedTags(type: 'due' | 'payment', transactions: Transaction[] = []): TagMeta[] {
  const baseList = type === 'due' ? [...EXPENSE_TAGS] : [...PAYMENT_TAGS];
  const countMap: Record<string, number> = { ...getTagUsageCounts() };

  transactions.forEach((tx) => {
    if (tx.type === type && tx.tag) {
      const normalized = tx.tag.toLowerCase().trim();
      countMap[normalized] = (countMap[normalized] || 0) + 1;
    }
  });

  return baseList.sort((a, b) => {
    const countA = countMap[a.id] || 0;
    const countB = countMap[b.id] || 0;
    if (countB !== countA) return countB - countA;
    return 0;
  });
}

export interface TagIconProps {
  tag?: string | null;
  type?: 'due' | 'payment';
  className?: string;
  style?: React.CSSProperties;
}

export const TagIcon: React.FC<TagIconProps> = ({
  tag,
  type = 'due',
  className = 'w-4 h-4 stroke-[1.5]',
  style
}) => {
  const meta = getTagMeta(tag);
  if (meta) {
    const IconComponent = meta.icon;
    return <IconComponent className={className} style={style} />;
  }
  if (type === 'due') {
    return <ArrowUpRight className={className} style={style} />;
  }
  return <ArrowDownLeft className={className} style={style} />;
};

export function useHorizontalDragWheelScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  depKey?: unknown
) {
  const [scrollEdges, setScrollEdges] = React.useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStateRef = React.useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startScrollLeft: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const suppressClickRef = React.useRef(false);

  const updateEdges = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > 4;
    const right = maxScroll > 4 && el.scrollLeft < maxScroll - 4;
    setScrollEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right }
    );
  }, [containerRef]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateEdges();

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const absY = Math.abs(e.deltaY);
      const absX = Math.abs(e.deltaX);
      if (absY === 0 && absX === 0) return;
      const lineStep = e.deltaMode === 1 ? 28 : e.deltaMode === 2 ? el.clientWidth * 0.85 : 1;
      const delta = absY > absX ? e.deltaY * lineStep : e.deltaX * lineStep;
      if (delta !== 0) {
        e.preventDefault();
        e.stopPropagation();
        el.scrollLeft += delta;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', updateEdges, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateEdges);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', updateEdges);
      ro?.disconnect();
    };
  }, [containerRef, updateEdges, depKey]);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const el = containerRef.current;
      if (!el || el.scrollWidth <= el.clientWidth + 1) return;
      dragStateRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
      };
      suppressClickRef.current = false;
    },
    [containerRef]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state.active) return;
      const el = containerRef.current;
      if (!el) return;
      const dx = e.clientX - state.startX;
      if (!state.moved && Math.abs(dx) > 5) {
        state.moved = true;
        suppressClickRef.current = true;
        setIsDragging(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
      if (state.moved) {
        el.scrollLeft = state.startScrollLeft - dx;
      }
    },
    [containerRef]
  );

  const finishDrag = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state.active) return;
      const wasMoved = state.moved;
      state.active = false;
      state.moved = false;
      setIsDragging(false);
      const el = containerRef.current;
      if (el) {
        try {
          if (el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
          }
        } catch {}
      }
      if (wasMoved) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    },
    [containerRef]
  );

  const onClickCapture = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }, []);

  const scrollByStep = React.useCallback(
    (dir: -1 | 1) => {
      const el = containerRef.current;
      if (!el) return;
      const step = Math.max(140, Math.round(el.clientWidth * 0.65));
      el.scrollBy({ left: dir * step, behavior: 'smooth' });
    },
    [containerRef]
  );

  return {
    scrollEdges,
    isDragging,
    scrollByStep,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onClickCapture,
    },
  };
}

interface TagPickerBarProps {
  type: 'due' | 'payment';
  selectedTag: string | null;
  onSelectTag: (tagId: string | null) => void;
  transactions?: Transaction[];
  lang: Language;
  className?: string;
}

export const TagPickerBar: React.FC<TagPickerBarProps> = ({
  type,
  selectedTag,
  onSelectTag,
  transactions = [],
  lang,
  className = ''
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Strictly sort by most-used counts; never jump selected tag to front or shuffle mid-interaction
  const sortedTags = React.useMemo(
    () => getSortedTags(type, transactions),
    [type, transactions]
  );

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  }, [type]);

  const { scrollEdges, isDragging, scrollByStep, handlers } = useHorizontalDragWheelScroll(
    containerRef,
    sortedTags.length
  );

  const activeMeta = selectedTag ? getTagMeta(selectedTag) : null;
  const ActiveIcon = activeMeta?.icon;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between px-0.5">
        <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
          {lang === 'bn' ? 'ট্যাগ নির্বাচন করুন' : 'Assign Tag'}
        </span>
        {activeMeta && ActiveIcon && (
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
            <ActiveIcon className="w-3 h-3 stroke-[1.75]" style={{ color: activeMeta.color }} />
            <span>{lang === 'bn' ? activeMeta.bn : activeMeta.en}</span>
          </span>
        )}
      </div>

      {/* Horizontally scrollable tag strip with PC wheel, mouse-drag & desktop scroll nudges */}
      <div className="relative group/tagstrip">
        {scrollEdges.left && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Scroll tags left"
            onClick={() => scrollByStep(-1)}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full surface-glass-interactive border items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer transition-opacity"
          >
            <ChevronLeft className="w-3.5 h-3.5 stroke-[1.75]" />
          </button>
        )}

        <div
          ref={containerRef}
          {...handlers}
          className={`flex items-center gap-2 overflow-x-auto hide-scrollbar py-1.5 px-1 select-none whitespace-nowrap ${
            isDragging ? 'cursor-grabbing' : 'sm:cursor-grab'
          }`}
        >
          {sortedTags.map((tagItem) => {
            const isSelected = selectedTag === tagItem.id;
            const IconComp = tagItem.icon;
            return (
              <button
                key={tagItem.id}
                type="button"
                onClick={() => {
                  if (!isSelected) recordTagUsage(tagItem.id);
                  onSelectTag(isSelected ? null : tagItem.id);
                }}
                className={`touch-press shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xs ring-1 ring-slate-950 dark:ring-white font-bold'
                    : 'surface-subcard border text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <IconComp
                  className="w-3.5 h-3.5 stroke-[1.5] shrink-0"
                  style={{ color: isSelected ? undefined : tagItem.color }}
                />
                <span className="whitespace-nowrap">{lang === 'bn' ? tagItem.bn : tagItem.en}</span>
              </button>
            );
          })}
        </div>

        {scrollEdges.right && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Scroll tags right"
            onClick={() => scrollByStep(1)}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full surface-glass-interactive border items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer transition-opacity"
          >
            <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
          </button>
        )}
      </div>
    </div>
  );
};
