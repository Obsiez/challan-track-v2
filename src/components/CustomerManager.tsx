import React, { useState, useMemo, useRef } from 'react';
import { Customer, Transaction } from '../types';
import { 
	Search, UserPlus, Phone, ArrowUpRight, ArrowDownLeft, ReceiptText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pin, 
	MessageSquare, MessageCircleMore, CircleEllipsis, Trash2, Pencil, RefreshCw, X, UserMinus, Plus, Minus, ShieldCheck, 
	AlertTriangle, ArrowLeftRight, Check, Trash, Users, Send, ArrowLeft, ArrowUpDown, Delete,
	BookUser, Download, Share2, Copy, MoreHorizontal, Archive, RotateCcw,
	History, FileText, Info, CreditCard, Calendar, Camera, UserRound
} from 'lucide-react';
import { 
  generateReceiptPng, 
  downloadReceiptImage, 
  copyReceiptImage, 
  shareReceiptImage, 
  ReceiptImageResult,
  generateCreditCardStatementPdf,
  downloadReceiptPdf,
  copyPlainTextReceipt,
  shareReceiptPdf,
  CreditCardStatementPdfResult
} from '../lib/receiptGenerator';
import { toast } from 'sonner';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { getPhoneticKey, matchesPhonetic, isPhoneticSearchEnabled } from '../lib/phonetics';
import { translations, formatNumber, formatIndianNumberString, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { showNotification } from '../lib/notifications';
import ContactNumberPickerModal from './ContactNumberPickerModal';
import { cleanBangladeshiPhone } from '../lib/phoneUtils';
import { StaggerReveal, SpotlightCard, ScrollParallaxStage, ClientCardStage } from './MotionPrimitives';
import ModalPortal, { useModalScrollLock } from './ModalPortal';
import LoadingSpinner from './LoadingSpinner';
import { TagIcon, TagPickerBar, getTagDefaultDescription, getTagMeta, isTagDisabled, useTagConfig, EXPENSE_TAGS, PAYMENT_TAGS, useHorizontalDragWheelScroll } from '../lib/tagSystem';
import { OptimizedPhotoResult } from '../lib/imageOptimizer';
import ContactPhotoCropModal from './ContactPhotoCropModal';

const WhatsAppIcon = () => (
	<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="shrink-0">
		<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
	</svg>
);

const ListClockIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.25"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
	>
		<path d="M21 5H3" />
		<path d="M10 12H3" />
		<path d="M10 19H3" />
		<circle cx="17" cy="15" r="5" />
		<path d="M17 13v2l1.5 1" />
	</svg>
);

const AppleContactPhotoPicker = ({
	photoUrl,
	displayName,
	lang,
	inputRef,
	onFileChange,
	onRemove,
}: {
	photoUrl: string | null;
	displayName: string;
	lang: Language;
	inputRef: React.RefObject<HTMLInputElement | null>;
	onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onRemove: () => void;
}) => {
	const trimmedName = displayName.trim();
	return (
		<div className="flex items-center gap-3.5 p-3.5 rounded-2xl surface-subcard border border-slate-900/[0.08] dark:border-white/[0.09]">
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				aria-label={photoUrl ? (lang === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Change contact photo') : (lang === 'bn' ? 'ছবি যোগ করুন' : 'Add contact photo')}
				className="relative shrink-0 p-[2px] rounded-full contact-avatar-ring cursor-pointer touch-press group transition-transform"
			>
				<span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-white/[0.06]">
					{photoUrl ? (
						<img
							src={photoUrl}
							alt={displayName || 'Contact photo'}
							className="w-full h-full object-cover"
							draggable={false}
						/>
					) : (
						<UserRound className="w-7 h-7 text-slate-500 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white transition-colors stroke-[1.4]" />
					)}
				</span>
				<span
					aria-hidden="true"
					className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border border-slate-900/15 dark:border-white/20 shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform"
				>
					<Camera className="w-3.5 h-3.5 text-slate-800 dark:text-white stroke-[1.75]" />
				</span>
			</button>

			<div className="flex-1 min-w-0 text-left">
				<div className="text-sm font-bold text-slate-950 dark:text-white truncate">
					{trimmedName || (lang === 'bn' ? 'কন্টাক্ট ছবি' : 'Contact Photo')}
				</div>
				<p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
					{photoUrl
						? (lang === 'bn' ? 'পরিবর্তন করতে ছবিতে ট্যাপ করুন' : 'Tap photo to replace or reframe')
						: (lang === 'bn' ? 'ছবি যোগ করতে আইকনে ট্যাপ করুন' : 'Tap icon to add a contact photo')}
				</p>
			</div>

			{photoUrl ? (
				<button
					type="button"
					onClick={onRemove}
					className="shrink-0 px-4 py-2 rounded-full bg-slate-100/90 hover:bg-rose-500/15 text-slate-700 hover:text-rose-600 dark:bg-white/[0.08] dark:hover:bg-rose-500/20 dark:text-slate-200 dark:hover:text-rose-400 font-bold text-xs border border-slate-200/80 dark:border-white/[0.1] transition-colors cursor-pointer touch-press"
				>
					{lang === 'bn' ? 'মুছুন' : 'Remove'}
				</button>
			) : (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					className="shrink-0 px-4 py-2 rounded-full surface-glass-interactive border text-slate-900 dark:text-white font-bold text-xs transition-colors cursor-pointer touch-press"
				>
					{lang === 'bn' ? 'বাছাই' : 'Choose'}
				</button>
			)}

			<input
				ref={inputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
				onChange={onFileChange}
				className="hidden"
			/>
		</div>
	);
};


interface SwipeableCustomerItemProps {
	customer: Customer;
	lang: Language;
	onClick: () => void;
	isSelected: boolean;
	onWhatsApp: () => void;
	onDelete: () => void;
	onLongPress?: () => void;
	swipeGesturesEnabled: boolean;
	isDeleting: boolean;
	children: React.ReactNode;
}

const SwipeableCustomerItem = React.memo(({
	customer,
	lang,
	onClick,
	onWhatsApp,
	onDelete,
	onLongPress,
	swipeGesturesEnabled,
	isDeleting,
	children,
}: SwipeableCustomerItemProps) => {
	const cardRef = React.useRef<HTMLDivElement>(null);
	const innerRef = React.useRef<HTMLDivElement>(null);
	const rightBgRef = React.useRef<HTMLDivElement>(null);
	const leftBgRef = React.useRef<HTMLDivElement>(null);
	const swipeDirRef = React.useRef<'left' | 'right' | null>(null);
	const snapTimerRef = React.useRef<number | null>(null);

	const setSwipeBgDir = React.useCallback((dir: 'left' | 'right' | null) => {
		if (swipeDirRef.current === dir) return;
		swipeDirRef.current = dir;
		if (rightBgRef.current) {
			rightBgRef.current.style.opacity = dir === 'right' ? '1' : '0';
		}
		if (leftBgRef.current) {
			leftBgRef.current.style.opacity = dir === 'left' ? '1' : '0';
		}
	}, []);

	const setTranslateX = React.useCallback((x: number, transitionCss?: string) => {
		const el = innerRef.current;
		if (!el) return;
		el.style.willChange = x === 0 && !transitionCss ? '' : 'transform';
		el.style.transition = transitionCss || 'none';
		el.style.transform = x === 0 ? '' : `translate3d(${x}px, 0, 0)`;
	}, []);

	const longPressTimerRef = React.useRef<number | null>(null);
	const longPressFiredRef = React.useRef(false);

	const clearLongPressTimer = React.useCallback(() => {
		if (longPressTimerRef.current !== null) {
			window.clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
	}, []);

	React.useEffect(() => {
		return () => {
			if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
			clearLongPressTimer();
			if ((window as any).activeSwipingId === customer.id) {
				(window as any).activeSwipingId = null;
			}
		};
	}, [customer.id, clearLongPressTimer]);

	const startXRef = React.useRef(0);
	const startYRef = React.useRef(0);
	const isSwipingRef = React.useRef(false);
	const hasVibratedRef = React.useRef(false);
	const isSnappingRef = React.useRef(false);
	const prevIsDeletingRef = React.useRef(isDeleting);

	React.useEffect(() => {
		if (isDeleting) {
			prevIsDeletingRef.current = true;
			const cardWidth = cardRef.current?.offsetWidth || 350;
			setSwipeBgDir('left');
			setTranslateX(-cardWidth * 0.4, 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)');
		} else if (prevIsDeletingRef.current) {
			prevIsDeletingRef.current = false;
			setTranslateX(0, 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)');
			if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
			snapTimerRef.current = window.setTimeout(() => {
				setSwipeBgDir(null);
				if (innerRef.current) innerRef.current.style.willChange = '';
				isSwipingRef.current = false;
				(window as any).activeSwipingId = null;
			}, 240);
		}
	}, [isDeleting, setSwipeBgDir, setTranslateX]);

	const handleSnap = (targetX: number) => {
		if (isSnappingRef.current) return;
		isSnappingRef.current = true;

		setTranslateX(targetX, 'transform 220ms cubic-bezier(0.34, 1.45, 0.64, 1)');
		if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
		snapTimerRef.current = window.setTimeout(() => {
			if (targetX > 0) {
				onWhatsApp();
				setTranslateX(0, 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)');
				snapTimerRef.current = window.setTimeout(() => {
					setSwipeBgDir(null);
					if (innerRef.current) innerRef.current.style.willChange = '';
					isSwipingRef.current = false;
					isSnappingRef.current = false;
					(window as any).activeSwipingId = null;
				}, 240);
			} else {
				onDelete();
				isSnappingRef.current = false;
				(window as any).activeSwipingId = null;
			}
		}, 210);
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		longPressFiredRef.current = false;
		clearLongPressTimer();
		if (isSnappingRef.current || isDeleting) return;
		if (e.touches.length !== 1) return;

		startXRef.current = e.touches[0].clientX;
		startYRef.current = e.touches[0].clientY;
		isSwipingRef.current = false;
		hasVibratedRef.current = false;

		const targetEl = e.target as HTMLElement | null;
		const isActionControl = Boolean(targetEl?.closest('a, button'));
		if (onLongPress && !isActionControl) {
			longPressTimerRef.current = window.setTimeout(() => {
				longPressTimerRef.current = null;
				if (isSwipingRef.current || isSnappingRef.current || isDeleting) return;
				longPressFiredRef.current = true;
				triggerHaptic('punchy');
				onLongPress();
			}, 480);
		}
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (isSnappingRef.current || isDeleting) return;
		const diffX = e.touches[0].clientX - startXRef.current;
		const diffY = e.touches[0].clientY - startYRef.current;

		if (Math.hypot(diffX, diffY) > 8) {
			clearLongPressTimer();
		}

		if (!swipeGesturesEnabled) return;

		if (!isSwipingRef.current) {
			if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 15) {
				isSwipingRef.current = true;
				(window as any).activeSwipingId = customer.id;
			}
		}

		if (isSwipingRef.current) {
			const cardWidth = cardRef.current?.offsetWidth || 350;
			const thresholdX = cardWidth * 0.4;
			const resistanceX = Math.sign(diffX) * Math.pow(Math.abs(diffX), 0.7) * 0.85;

			const dir = resistanceX > 0 ? 'right' : (resistanceX < 0 ? 'left' : null);
			setSwipeBgDir(dir);

			setTranslateX(resistanceX, 'none');

			if (Math.abs(diffX) >= thresholdX && !hasVibratedRef.current) {
				triggerHaptic('punchy');
				hasVibratedRef.current = true;
			} else if (Math.abs(diffX) < thresholdX && hasVibratedRef.current) {
				hasVibratedRef.current = false;
			}

			if (Math.abs(diffX) >= thresholdX) {
				handleSnap(diffX > 0 ? thresholdX : -thresholdX);
				return;
			}

			if (e.cancelable) {
				e.preventDefault();
			}
		}
	};

	const handleTouchEnd = () => {
		clearLongPressTimer();
		if (!swipeGesturesEnabled || isSnappingRef.current || isDeleting) return;
		if (isSwipingRef.current) {
			setTranslateX(0, 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)');
			if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
			snapTimerRef.current = window.setTimeout(() => {
				setSwipeBgDir(null);
				if (innerRef.current) innerRef.current.style.willChange = '';
				isSwipingRef.current = false;
				hasVibratedRef.current = false;
				(window as any).activeSwipingId = null;
			}, 220);
		}
	};

	const handleClickCapture = (e: React.MouseEvent) => {
		if (longPressFiredRef.current) {
			longPressFiredRef.current = false;
			e.preventDefault();
			e.stopPropagation();
		}
	};

	return (
		<div ref={cardRef} className="relative overflow-hidden rounded-[24px] w-full">
			<div
				ref={rightBgRef}
				aria-hidden="true"
				style={{ opacity: 0 }}
				className="pointer-events-none absolute inset-0 z-0 bg-[#048848] flex items-center justify-start pl-6 text-white rounded-[24px] font-bold text-xs gap-2"
			>
				<WhatsAppIcon />
				<span className="font-bold text-xs">{lang === 'bn' ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}</span>
			</div>
			<div
				ref={leftBgRef}
				aria-hidden="true"
				style={{ opacity: 0 }}
				className="pointer-events-none absolute inset-0 z-0 bg-[#E11900] flex items-center justify-end pr-6 text-white rounded-[24px] font-bold text-xs gap-2"
			>
				<span className="font-bold text-xs">{lang === 'bn' ? 'মুছুন' : 'Delete'}</span>
				<Trash2 className="w-6 h-6 text-white stroke-[1.25]" />
			</div>
			<div
				ref={innerRef}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onTouchCancel={handleTouchEnd}
				onClickCapture={handleClickCapture}
				onClick={onClick}
				className="w-full relative z-10 rounded-[24px] touch-pan-y"
			>
				{children}
			</div>
		</div>
	);
});


const parseFirestoreDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const LEDGER_DATE_FMT_EN = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const LEDGER_DATE_FMT_BN = new Intl.DateTimeFormat('bn-BD', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const LEDGER_TIME_FMT_EN = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
const LEDGER_TIME_FMT_BN = new Intl.DateTimeFormat('bn-BD', { hour: '2-digit', minute: '2-digit' });
const LEDGER_SHORT_DATE_FMT_EN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const LEDGER_SHORT_DATE_FMT_BN = new Intl.DateTimeFormat('bn-BD', { month: 'short', day: 'numeric', year: 'numeric' });
const LEDGER_AUDIT_FMT_EN = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const LEDGER_AUDIT_FMT_BN = new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });

interface CustomerCardGridItemProps {
  customer: Customer;
  index: number;
  lang: Language;
  isSelected: boolean;
  isPinned: boolean;
  swipeGesturesEnabled: boolean;
  isDeleting: boolean;
  onSelectCustomer: (c: Customer) => void;
  onOpenPinModal: (c: Customer) => void;
  onWhatsAppCustomer: (c: Customer) => void;
  onDeleteCustomer: (c: Customer) => void;
}

const CustomerCardGridItem = React.memo(({
  customer: c,
  index,
  lang,
  isSelected,
  isPinned,
  swipeGesturesEnabled,
  isDeleting,
  onSelectCustomer,
  onOpenPinModal,
  onWhatsAppCustomer,
  onDeleteCustomer,
}: CustomerCardGridItemProps) => {
  const initials = c.name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'C';

  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [c.photoUrl]);

  const isDue = c.outstandingDue > 0;
  const isOverpaid = c.outstandingDue < 0;
  const cleanedPhone = c.phone ? cleanBangladeshiPhone(c.phone) : '';
  const waNumber = c.phone ? (c.phone.startsWith('01') ? '88' : '') + c.phone.replace(/[^0-9]/g, '') : '';

  return (
    <ClientCardStage index={index} className="customer-card-cv">
      <SwipeableCustomerItem
        customer={c}
        lang={lang}
        isSelected={isSelected}
        swipeGesturesEnabled={swipeGesturesEnabled}
        isDeleting={isDeleting}
        onLongPress={() => onOpenPinModal(c)}
        onWhatsApp={() => onWhatsAppCustomer(c)}
        onDelete={() => onDeleteCustomer(c)}
        onClick={() => {}}
      >
        <SpotlightCard
          onTouchStart={() => {
            (window as any).__lastCustomerCardTouchAt = Date.now();
          }}
          onClick={() => onSelectCustomer(c)}
          className={`surface-card-glass border p-4 sm:p-5 pb-3.5 rounded-[24px] cursor-pointer flex flex-col justify-between gap-3 group ${
            isSelected
              ? 'ring-2 ring-slate-950/30 dark:ring-white/30'
              : ''
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              {c.photoUrl && !imgError ? (
                <div className="p-[1.5px] rounded-full contact-avatar-ring shrink-0">
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImgError(true)}
                    className="w-10 h-10 rounded-full object-cover block"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 ${
                  isDue
                    ? 'bg-ledger-red-subtle text-ledger-red'
                    : isOverpaid
                    ? 'bg-ledger-green-subtle text-ledger-green'
                    : 'bg-slate-900/[0.06] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300'
                }`}>
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <div
                  onClick={(e) => {
                    const lastTouchAt = (window as any).__lastCustomerCardTouchAt || 0;
                    const isMobileTouch =
                      Date.now() - lastTouchAt < 800 ||
                      (e.nativeEvent as any)?.pointerType === 'touch' ||
                      (typeof window !== 'undefined' &&
                        window.matchMedia('(pointer: coarse)').matches &&
                        !window.matchMedia('(hover: hover) and (pointer: fine)').matches);
                    if (isMobileTouch) {
                      return;
                    }
                    e.stopPropagation();
                    triggerHaptic('single');
                    onOpenPinModal(c);
                  }}
                  className="text-sm sm:text-base font-bold text-slate-950 dark:text-white truncate flex items-center gap-1.5 cursor-pointer group-hover:opacity-80 transition-opacity"
                >
                  <span className="truncate">{c.name}</span>
                  {isPinned && (
                    <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 rotate-45 shrink-0 stroke-[1.25]" />
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate font-mono">
                  {c.accountType === 'credit_card' ? (
                    <>
                      <Calendar className="w-3 h-3 shrink-0 opacity-70 stroke-[1.25]" />
                      <span className="truncate">
                        {lang === 'bn'
                          ? `বিলিং: প্রতি মাসের ${formatNumber(c.billingDay || 15, 'bn')} তারিখ`
                          : `Billing Day: ${c.billingDay || 15}`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-3 h-3 shrink-0 opacity-70 stroke-[1.25]" />
                      <span className="truncate">{c.phone ? cleanedPhone : (lang === 'bn' ? '(ফোন নম্বর নেই)' : '(No phone)')}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className={`font-display text-base sm:text-lg font-bold font-mono tabular-nums truncate ${
                isDue
                  ? 'text-ledger-red'
                  : isOverpaid
                  ? 'text-ledger-green'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {c.outstandingDue === 0
                  ? `৳ ${lang === 'bn' ? '০' : '0'}`
                  : `${c.outstandingDue < 0 ? '-' : ''}৳ ${formatNumber(Math.abs(c.outstandingDue), lang)}`}
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs min-h-[30px]">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] font-semibold">
              <span className={`truncate ${
                isDue
                  ? 'text-ledger-red'
                  : isOverpaid
                  ? 'text-ledger-green'
                  : 'text-slate-500 dark:text-slate-400'
              }`}>
                {c.accountType === 'credit_card' ? (
                  isDue ? (
                    lang === 'bn' ? 'কার্ড বিল বকেয়া' : 'Card Bill Due'
                  ) : isOverpaid ? (
                    lang === 'bn' ? 'অতিরিক্ত জমা' : 'Extra Credit'
                  ) : (
                    lang === 'bn' ? 'বিল পরিশোধিত' : 'Bill Settled'
                  )
                ) : isDue ? (
                  lang === 'bn' ? 'বকেয়া ব্যালেন্স' : 'Due Balance'
                ) : isOverpaid ? (
                  lang === 'bn' ? 'অগ্রিম ক্রেডিট' : 'Advance Credit'
                ) : (
                  lang === 'bn' ? 'পরিশোধিত' : 'Settled'
                )}
              </span>

              {c.accountType === 'credit_card' && (
                <span className="text-slate-400 dark:text-slate-500 inline-flex items-center gap-1 shrink-0 font-mono text-[10px]">
                  · <CreditCard className="w-3 h-3 stroke-[1.25]" /> {lang === 'bn' ? 'কার্ড' : 'Card'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {c.phone && (
                <>
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('single');
                    }}
                    className="w-7 h-7 rounded-full bg-emerald-500/12 hover:bg-emerald-500/22 text-emerald-600 dark:text-emerald-400 transition-colors active:scale-95 flex items-center justify-center"
                    title="WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5 stroke-[1.25]" />
                  </a>
                  <a
                    href={`tel:${c.phone}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('single');
                    }}
                    className="w-7 h-7 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 transition-colors active:scale-95 flex items-center justify-center"
                    title={lang === 'bn' ? 'কল করুন' : 'Call'}
                  >
                    <Phone className="w-3.5 h-3.5 stroke-[1.25]" />
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('single');
                  onSelectCustomer(c);
                }}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                title={lang === 'bn' ? 'খাতা খুলুন' : 'Open Ledger'}
                aria-label={lang === 'bn' ? 'খাতা খুলুন' : 'Open Ledger'}
              >
                <ChevronRight className="w-4 h-4 stroke-[1.25] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </SpotlightCard>
      </SwipeableCustomerItem>
    </ClientCardStage>
  );
});

interface CustomerManagerProps {
 customers: Customer[];
 transactions: Transaction[];
 allTransactions?: Transaction[];
 createCustomer: (
   name: string,
   phone: string,
   options?: { accountType?: 'standard' | 'credit_card'; billingDay?: number; photoUrl?: string | null }
 ) => Promise<string | null | undefined>;
 addTransaction: (
 customerId: string, 
 type: 'due' | 'payment', 
 amount: number, 
 description: string,
 date?: Date,
 fallbackCustomerInfo?: { name: string; phone: string; accountType?: 'standard' | 'credit_card'; billingDay?: number },
 tag?: string
 ) => Promise<void>;
 updateCustomerDetails: (
   customerId: string,
   name: string,
   phone: string,
   options?: { accountType?: 'standard' | 'credit_card'; billingDay?: number; photoUrl?: string | null }
 ) => Promise<void>;
 editTransaction?: (transactionId: string, newType: 'due' | 'payment', newAmount: number, newDescription: string, newTag?: string | null) => Promise<void>;
 deleteTransaction?: (transactionId: string) => Promise<void>;
 deleteCustomer: (id: string) => Promise<void>;
 selectedCustomerId: string | null;
 setSelectedCustomerId: (id: string | null) => void;
 lang: Language;
 triggerConfirm?: (title: string, message: string, onConfirm: () => void) => void;
  swipeGesturesEnabled?: boolean;
  highlightedTxId?: string | null;
  setHighlightedTxId?: (id: string | null) => void;
  hasMoreTxs: boolean;
  loadMoreTransactions: () => void;
  customerTxLimit?: number;
  resetCustomerTxLimit?: () => void;
  activeCustomerTxCount?: number;
  archivedStatements?: any[];
  archiveCustomerExcessStatements?: (customerId: string, keepCount: number) => Promise<number>;
  exportArchivedStatements?: (customerId?: string) => Promise<any[]> | any;
}

const CustomerManager = React.memo(function CustomerManager({
 customers,
 transactions,
 allTransactions,
 createCustomer,
 addTransaction,
 updateCustomerDetails,
 editTransaction,
 deleteTransaction,
 deleteCustomer,
 selectedCustomerId,
 setSelectedCustomerId,
 lang,
 triggerConfirm,
  swipeGesturesEnabled = true,
  highlightedTxId = null,
  setHighlightedTxId = () => {},
  hasMoreTxs,
  loadMoreTransactions,
  customerTxLimit = 5,
  resetCustomerTxLimit = () => {},
  activeCustomerTxCount = 0,
  archivedStatements = [],
  archiveCustomerExcessStatements,
  exportArchivedStatements
}: CustomerManagerProps) {
 const t = translations[lang];
 const liveTagConfig = useTagConfig();

 const [showExtraBalanceCards, setShowExtraBalanceCards] = useState(false);
 const [showMonthlyCycle, setShowMonthlyCycle] = useState(false);
 const [isManageStatementsOpen, setIsManageStatementsOpen] = useState(false);
 const [manualKeepCountInput, setManualKeepCountInput] = useState('15');
 const [isManualArchiving, setIsManualArchiving] = useState(false);
 const [listBatchExpanded, setListBatchExpanded] = useState(false);

 React.useEffect(() => {
   if (listBatchExpanded || selectedCustomerId) return;
   let cancelled = false;
   const rafId = window.requestAnimationFrame(() => {
     if (cancelled) return;
     React.startTransition(() => {
       setListBatchExpanded(true);
     });
   });
   return () => {
     cancelled = true;
     window.cancelAnimationFrame(rafId);
   };
 }, [listBatchExpanded, selectedCustomerId]);

 React.useEffect(() => {
   setShowExtraBalanceCards(false);
   setShowMonthlyCycle(false);
   setIsManageStatementsOpen(false);
   setCardCycleTab('unbilled');
   setActionTargetCycle('unbilled');
   setLedgerTagFilter(null);
   setDetailAvatarError(false);
 }, [selectedCustomerId]);

 const [pendingPhotoCrop, setPendingPhotoCrop] = useState<{ file: File; target: 'new' | 'edit' } | null>(null);

 const handleCustomerPhotoSelect = (
   e: React.ChangeEvent<HTMLInputElement>,
   target: 'new' | 'edit'
 ) => {
   const file = e.target.files?.[0];
   e.target.value = '';
   if (!file) return;

   if (!file.type || !file.type.startsWith('image/')) {
     triggerHaptic('double');
     toast.error(lang === 'bn' ? 'দয়া করে একটি ছবি নির্বাচন করুন' : 'Please choose an image file');
     return;
   }
   if (file.size > 12 * 1024 * 1024) {
     triggerHaptic('double');
     toast.error(lang === 'bn' ? 'ছবির সাইজ ১২ এমবি-র কম হতে হবে' : 'Please choose a photo smaller than 12 MB');
     return;
   }

   triggerHaptic('single');
   setPendingPhotoCrop({ file, target });
 };

 const handleCropComplete = (result: OptimizedPhotoResult) => {
   if (!pendingPhotoCrop) return;
   if (pendingPhotoCrop.target === 'new') {
     setNewPhotoUrl(result.dataUrl);
   } else {
     setEditPhotoUrl(result.dataUrl);
     setDetailAvatarError(false);
   }
   setPendingPhotoCrop(null);
 };

 const handleCropError = () => {
   setPendingPhotoCrop(null);
   toast.error(lang === 'bn' ? 'এই ছবিটি ব্যবহার করা যাচ্ছে না, অন্য ছবি দিন' : 'Couldn’t use that photo. Please try another one.');
 };

 const [searchQuery, setSearchQuery] = useState('');
  const [searchBanglaInEnglish, setSearchBanglaInEnglish] = useState(() => isPhoneticSearchEnabled());

  React.useEffect(() => {
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
 const [showAddForm, setShowAddForm] = useState(false);
 const [newName, setNewName] = useState('');
 const [newPhone, setNewPhone] = useState('');
 const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
 const newPhotoInputRef = useRef<HTMLInputElement>(null);
 const [newAccountType, setNewAccountType] = useState<'standard' | 'credit_card'>('standard');
 const [newBillingDay, setNewBillingDay] = useState<string>('');
 const [pendingContactChoice, setPendingContactChoice] = useState<{
   contactName: string;
   numbers: string[];
   isNewAccount?: boolean;
   onSelect: (number: string, finalName?: string) => void;
 } | null>(null);
 const [formError, setFormError] = useState('');
 const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

 // Individual Customer transaction adding form state
 const [openActionType, setOpenActionType] = useState<'due' | 'payment' | null>(null);
 const [actionAmount, setActionAmount] = useState('');
 const [actionDesc, setActionDesc] = useState('');
 const [actionTag, setActionTag] = useState<string | null>(null);
 const [ledgerTagFilter, setLedgerTagFilter] = useState<string | null>(null);
 const [actionTargetCycle, setActionTargetCycle] = useState<'unbilled' | 'billed'>('unbilled');
 const [paymentQuickFillIntent, setPaymentQuickFillIntent] = useState<'billed' | 'total' | null>(null);
 const [txSubmitting, setTxSubmitting] = useState(false);

 // Credit Card Billing Cycle View Tab ('unbilled' = This Month, 'billed' = Last Month)
 const [cardCycleTab, setCardCycleTab] = useState<'unbilled' | 'billed'>('unbilled');

 const [filterStatus, setFilterStatus] = useState<'all' | 'due' | 'settled' | 'overpaid'>('all');
 const filterPillsContainerRef = useRef<HTMLDivElement | null>(null);
 const isSlidingFilterRef = useRef(false);

 const selectFilterPillAtClientX = (clientX: number, isInitialPress = false) => {
   const container = filterPillsContainerRef.current;
   if (!container) return;
   const pills = Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-filter-pill]'));
   if (pills.length === 0) return;

   let matchedId: 'all' | 'due' | 'settled' | 'overpaid' | null = null;
   let minDist = Infinity;

   for (const pill of pills) {
     const rect = pill.getBoundingClientRect();
     const id = pill.getAttribute('data-filter-pill') as 'all' | 'due' | 'settled' | 'overpaid' | null;
     if (!id) continue;

     if (clientX >= rect.left && clientX <= rect.right) {
       matchedId = id;
       break;
     }

     const center = (rect.left + rect.right) / 2;
     const dist = Math.abs(clientX - center);
     if (dist < minDist) {
       minDist = dist;
       matchedId = id;
     }
   }

   if (matchedId) {
     setFilterStatus((prev) => {
       if (prev !== matchedId) {
         triggerHaptic('level3');
         return matchedId!;
       }
       if (isInitialPress) {
         triggerHaptic('level3');
       }
       return prev;
     });
   }
 };

 // Editing state for customer details
 const [isEditingCustomer, setIsEditingCustomer] = useState(false);
 const [editName, setEditName] = useState('');
 const [editPhone, setEditPhone] = useState('');
 const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
 const editPhotoInputRef = useRef<HTMLInputElement>(null);
 const [detailAvatarError, setDetailAvatarError] = useState(false);
 const [editAccountType, setEditAccountType] = useState<'standard' | 'credit_card'>('standard');
 const [editBillingDay, setEditBillingDay] = useState<string>('');
 const [editError, setEditError] = useState('');
 const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Selected message template for reminder alerts
  const [selectedTemplate, setSelectedTemplate] = useState<1 | 2 | 3>(() => {
    try {
      const stored = localStorage.getItem('selected_reminder_template');
      if (stored) {
        const val = Number(stored);
        if (val === 1 || val === 2 || val === 3) return val as 1 | 2 | 3;
      }
      return 1;
    } catch (e) {
      return 1;
    }
  });

  React.useEffect(() => {
    localStorage.setItem('selected_reminder_template', String(selectedTemplate));
  }, [selectedTemplate]);

 // Transaction Edit/Delete Modal states
 
  const [phoneWarningCustomer, setPhoneWarningCustomer] = useState<Customer | null>(null);
  const [pinActionCustomer, setPinActionCustomer] = useState<Customer | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptImageResult | CreditCardStatementPdfResult | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [isCopiedReceipt, setIsCopiedReceipt] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'high_balance' | 'low_balance' | 'custom'>('recent');
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('customers_custom_order');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const saveCustomOrder = (newOrder: string[]) => {
    setCustomOrder(newOrder);
    localStorage.setItem('customers_custom_order', JSON.stringify(newOrder));
  };

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [pinnedCustomerNames, setPinnedCustomerNames] = useState<string[]>(() => {
    try {
      const storedNames = localStorage.getItem('pinned_customers_names');
      if (storedNames) return JSON.parse(storedNames);
      return [];
    } catch (e) {
      return [];
    }
  });

  const togglePinCustomer = (id: string) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;
    triggerHaptic('single');
    setPinnedCustomerNames(prev => {
      const updated = prev.includes(customer.name) ? prev.filter(name => name !== customer.name) : [...prev, customer.name];
      localStorage.setItem('pinned_customers_names', JSON.stringify(updated));
      return updated;
    });
  };
const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDesc, setEditTxDesc] = useState('');
  const [editTxTag, setEditTxTag] = useState<string | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [ledgerLimit, setLedgerLimit] = useState(5);

  const [auditLogTx, setAuditLogTx] = useState<Transaction | null>(null);

  // Sync pinned customer names on storage events (e.g., from backup import)
  React.useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = localStorage.getItem('pinned_customers_names');
        if (stored) setPinnedCustomerNames(JSON.parse(stored));
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const [duplicateTxWarning, setDuplicateTxWarning] = useState<Transaction | null>(null);
  const [hasShownDuplicateWarning, setHasShownDuplicateWarning] = useState(false);

  React.useEffect(() => {
    setLedgerLimit(5);
    setDuplicateTxWarning(null);
    setHasShownDuplicateWarning(false);
  }, [selectedCustomerId]);

  React.useEffect(() => {
    setDuplicateTxWarning(null);
    setHasShownDuplicateWarning(false);
  }, [openActionType]);

  React.useEffect(() => {
    try {
      const oldIdsStr = localStorage.getItem('pinned_customers');
      if (oldIdsStr && customers.length > 0) {
        const oldIds = JSON.parse(oldIdsStr) as string[];
        if (oldIds.length > 0) {
          const namesToPin: string[] = [];
          oldIds.forEach(id => {
            const c = customers.find(cust => cust.id === id);
            if (c) namesToPin.push(c.name);
          });
          if (namesToPin.length > 0) {
            setPinnedCustomerNames(prev => {
              const updated = Array.from(new Set([...prev, ...namesToPin]));
              localStorage.setItem('pinned_customers_names', JSON.stringify(updated));
              return updated;
            });
          }
          localStorage.removeItem('pinned_customers');
        }
      }
    } catch (e) {
      // ignore
    }
  }, [customers]);

  // Background scroll disabled while modals are opened
  useModalScrollLock(
    Boolean(
      deletingCustomer ||
      editingTx ||
      deletingTx ||
      auditLogTx ||
      duplicateTxWarning ||
      phoneWarningCustomer ||
      pinActionCustomer ||
      receiptResult ||
      isManageStatementsOpen ||
      pendingContactChoice
    )
  );

  // Escape key dismissal prioritizing topmost open popup
  React.useEffect(() => {
    const anyModalOpen =
      pendingContactChoice ||
      duplicateTxWarning ||
      deletingTx ||
      editingTx ||
      auditLogTx ||
      receiptResult ||
      pinActionCustomer ||
      phoneWarningCustomer ||
      deletingCustomer ||
      isManageStatementsOpen;
    if (!anyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingContactChoice) {
        setPendingContactChoice(null);
      } else if (duplicateTxWarning) {
        setDuplicateTxWarning(null);
      } else if (deletingTx || editingTx) {
        closeTxModals();
      } else if (auditLogTx) {
        closeAuditLogModal();
      } else if (receiptResult) {
        closeReceiptModal();
      } else if (pinActionCustomer) {
        closePinActionModal();
      } else if (phoneWarningCustomer) {
        closePhoneWarningModal();
      } else if (deletingCustomer) {
        closeDeleteCustomerModal();
      } else if (isManageStatementsOpen && !isManualArchiving) {
        closeManageStatementsModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    pendingContactChoice,
    duplicateTxWarning,
    deletingTx,
    editingTx,
    auditLogTx,
    receiptResult,
    pinActionCustomer,
    phoneWarningCustomer,
    deletingCustomer,
    isManageStatementsOpen,
    isManualArchiving
  ]);

   // Handle history for modals (mobile back gesture)
  React.useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Ignore popstate events restoring into another modal, quickEntry, or active photo cropper
      if (e.state?.modal === 'accentPalette' || e.state?.quickEntry || e.state?.dialogOpen || e.state?.photoCropper) {
        return;
      }
      // Close edit mode first (one back press = exit edit)
      if (isEditingCustomer && e.state?.modal !== 'editingCustomer') {
        // Capture scroll position before React re-render to prevent unwanted scroll
        const savedScrollY = window.scrollY;
        setIsEditingCustomer(false);
        // Restore scroll position after the DOM settles from the state change
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: savedScrollY, behavior: 'instant' });
          });
        });
        return;
      }
      if (isManageStatementsOpen && e.state?.modal !== 'manageStatements') {
        setIsManageStatementsOpen(false);
        return;
      }
      if (auditLogTx && e.state?.modal !== 'auditLog') {
        setAuditLogTx(null);
        return;
      }
      if (receiptResult && e.state?.modal !== 'receiptPreview') {
        setReceiptResult((prev) => {
          if (prev?.kind === 'pdf') {
            prev.previewPages.forEach((u) => {
              if (u.startsWith('blob:')) {
                try { URL.revokeObjectURL(u); } catch {}
              }
            });
          } else if (prev?.dataUrl?.startsWith('blob:')) {
            try { URL.revokeObjectURL(prev.dataUrl); } catch {}
          }
          return null;
        });
        return;
      }
      if (editingTx && e.state?.modal !== 'editTx') {
        setEditingTx(null);
      }
      if (deletingTx && e.state?.modal !== 'deleteTx') {
        setDeletingTx(null);
      }
      if (deletingCustomer && e.state?.modal !== 'deleteCustomer') {
        setDeletingCustomer(null);
      }
      if (duplicateTxWarning) {
        setDuplicateTxWarning(null);
      }
      if (pinActionCustomer && e.state?.modal !== 'pinActionCustomer') {
        setPinActionCustomer(null);
      }
      if (phoneWarningCustomer && e.state?.modal !== 'phoneWarningCustomer') {
        setPhoneWarningCustomer(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isEditingCustomer, isManageStatementsOpen, auditLogTx, editingTx, deletingTx, deletingCustomer, duplicateTxWarning, pinActionCustomer, phoneWarningCustomer, receiptResult]);

  const [recentlyEditedTxId, setRecentlyEditedTxId] = useState<string | null>(null);

  // Smooth scroll and highlight effect for target transaction
  React.useEffect(() => {
    if (highlightedTxId) {
      // Delay scroll slightly so DOM settles after navigation (especially needed in PWA standalone mode)
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById(`tx-row-${highlightedTxId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);
      const highlightTimer = setTimeout(() => {
        if (setHighlightedTxId) {
          setHighlightedTxId(null);
        }
      }, 3120);
      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(highlightTimer);
      };
    }
  }, [highlightedTxId, selectedCustomerId]);

  const parseTxDate = (d: any): Date => {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (typeof d.toDate === 'function') return d.toDate();
    if (d.seconds !== undefined) return new Date(d.seconds * 1000);
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const fallbackCustomerTxs = useMemo(() => {
    if (!selectedCustomerId) return [];
    const sourceTxs = allTransactions ?? transactions;
    const inMem = sourceTxs.filter(t => t.customerId === selectedCustomerId);
    if (inMem.length > 0 || typeof localStorage === 'undefined') return inMem;
    try {
      const userId = customers.find(c => c.id === selectedCustomerId)?.userId;
      if (userId) {
        const cached = localStorage.getItem(`easy_due_txs_${userId}_${selectedCustomerId}`);
        if (cached) return JSON.parse(cached) as Transaction[];
      }
    } catch {}
    return [];
  }, [selectedCustomerId, allTransactions, transactions, customers]);

  const getDuplicate = React.useCallback((actionType: 'due' | 'payment', amountStr: string) => {
    if (!selectedCustomerId || !amountStr || fallbackCustomerTxs.length === 0) return null;
    const cleaned = amountStr.replace(/,/g, '');
    const amountVal = parseFloat(cleaned);
    if (isNaN(amountVal) || amountVal <= 0) return null;

    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    return fallbackCustomerTxs.find(t => {
      if (t.type !== actionType || Math.abs(t.amount - amountVal) >= 0.01) return false;
      const tDate = parseTxDate(t.createdAt || t.date);
      return (now - tDate.getTime()) < twentyFourHoursMs;
    }) || null;
  }, [selectedCustomerId, fallbackCustomerTxs]);

  const activeRealtimeDuplicate = useMemo(() => {
    if (!openActionType || txSubmitting || !actionAmount) return null;
    return getDuplicate(openActionType, actionAmount);
  }, [openActionType, txSubmitting, actionAmount, getDuplicate]);

 const openEditTxModal = (tx: Transaction) => {
   setEditingTx(tx);
   setEditTxAmount(tx.amount.toString());
   setEditTxDesc(tx.description || '');
   setEditTxTag(tx.tag || null);
   window.history.pushState({ ...window.history.state, modal: 'editTx' }, '');
 };

 const openDeleteTxModal = (tx: Transaction) => {
   setDeletingTx(tx);
   window.history.pushState({ ...window.history.state, modal: 'deleteTx' }, '');
 };

 const closeTxModals = () => {
    setEditingTx(null);
    setDeletingTx(null);
    setEditTxTag(null);
    if (window.history.state?.modal === 'editTx' || window.history.state?.modal === 'deleteTx') {
      window.history.back(); // This triggers popstate, which sets states to null
    }
  };

  const closePinActionModal = () => {
    setPinActionCustomer(null);
    if (window.history.state?.modal === 'pinActionCustomer') {
      window.history.back();
    }
  };

  const closeDeleteCustomerModal = () => {
    setDeletingCustomer(null);
    if (window.history.state?.modal === 'deleteCustomer') {
      window.history.back();
    }
  };

  const closePhoneWarningModal = () => {
    setPhoneWarningCustomer(null);
    if (window.history.state?.modal === 'phoneWarningCustomer') {
      window.history.back();
    }
  };

  const closeReceiptModal = () => {
    setReceiptResult((prev) => {
      if (prev?.kind === 'pdf') {
        prev.previewPages.forEach((u) => {
          if (u.startsWith('blob:')) {
            try { URL.revokeObjectURL(u); } catch {}
          }
        });
      } else if (prev?.dataUrl?.startsWith('blob:')) {
        try { URL.revokeObjectURL(prev.dataUrl); } catch {}
      }
      return null;
    });
    if (window.history.state?.modal === 'receiptPreview') {
      window.history.back();
    }
  };

  const snapKeepCountToFive = (raw: number | string | undefined, fallback = 15) => {
    const num = typeof raw === 'number' ? raw : parseInt(String(raw || ''), 10);
    const base = !isNaN(num) && num > 0 ? num : fallback;
    return Math.max(5, Math.min(500, Math.round(base / 5) * 5));
  };

  const openManageStatementsModal = () => {
    setManualKeepCountInput((prev) => String(snapKeepCountToFive(prev, 15)));
    setIsManageStatementsOpen(true);
    window.history.pushState({ ...window.history.state, modal: 'manageStatements' }, '');
  };

  const closeManageStatementsModal = () => {
    setIsManageStatementsOpen(false);
    if (window.history.state?.modal === 'manageStatements') {
      window.history.back();
    }
  };

  const openAuditLogModal = (tx: Transaction) => {
    setAuditLogTx(tx);
    window.history.pushState({ ...window.history.state, modal: 'auditLog' }, '');
  };

  const closeAuditLogModal = () => {
    setAuditLogTx(null);
    if (window.history.state?.modal === 'auditLog') {
      window.history.back();
    }
  };


  const pinnedCustomerNameSet = useMemo(() => new Set(pinnedCustomerNames), [pinnedCustomerNames]);

  // Filter & sort customers list (with O(1) Set/Map lookups and hoisted query normalization)
  const filteredCustomers = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    const lowerQuery = trimmedQuery.toLowerCase();

    // 1. Filter customers
    const filtered = customers.filter(c => {
      if (trimmedQuery) {
        const queryMatch =
          c.name.toLowerCase().includes(lowerQuery) ||
          c.phone.includes(trimmedQuery) ||
          (searchBanglaInEnglish && matchesPhonetic(c.name, trimmedQuery));
        if (!queryMatch) return false;
      }

      if (filterStatus === 'due') return c.outstandingDue > 0;
      if (filterStatus === 'settled') return c.outstandingDue === 0;
      if (filterStatus === 'overpaid') return c.outstandingDue < 0;
      return true;
    });

    const customOrderMap =
      sortBy === 'custom'
        ? new Map<string, number>(customOrder.map((id, idx) => [id, idx]))
        : null;

    const recencyMap =
      sortBy === 'recent'
        ? new Map<string, number>(
            filtered.map((c) => {
              const d = c.updatedAt ?? c.createdAt;
              return [c.id, d ? parseFirestoreDate(d).getTime() : 0];
            })
          )
        : null;

    // 2. Sort customers
    filtered.sort((a, b) => {
      const aPinned = pinnedCustomerNameSet.has(a.name);
      const bPinned = pinnedCustomerNameSet.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      if (sortBy === 'custom' && customOrderMap) {
        const idxA = customOrderMap.get(a.id) ?? 999999;
        const idxB = customOrderMap.get(b.id) ?? 999999;
        if (idxA !== idxB) return idxA - idxB;
      }
      if (sortBy === 'high_balance') {
        return b.outstandingDue - a.outstandingDue;
      }
      if (sortBy === 'low_balance') {
        return a.outstandingDue - b.outstandingDue;
      }

      // Default: 'recent' — last activity (payment, due, profile edit)
      if (recencyMap) {
        return (recencyMap.get(b.id) ?? 0) - (recencyMap.get(a.id) ?? 0);
      }
      return 0;
    });

    return filtered;
  }, [customers, searchQuery, filterStatus, sortBy, pinnedCustomerNameSet, customOrder, searchBanglaInEnglish]);

 // Selected customer object & transactions
 const selectedCustomer = useMemo(() => {
 if (!selectedCustomerId) return null;
 return customers.find(c => c.id === selectedCustomerId) || null;
 }, [customers, selectedCustomerId]);

 const selectedCustomerTransactions = useMemo(() => {
    if (!selectedCustomerId) return [];
    return transactions.filter(t => t.customerId === selectedCustomerId);
  }, [transactions, selectedCustomerId]);

 const selectedCustomerAllTransactions = useMemo(() => {
    if (!selectedCustomerId) return [];
    const source = allTransactions ?? transactions;
    return source.filter(t => t.customerId === selectedCustomerId);
  }, [allTransactions, transactions, selectedCustomerId]);

  const selectedCustomerMetrics = useMemo(() => {
    if (!selectedCustomer) return { totalBilled: 0, totalPaid: 0, lifetimeVolume: 0, txCount: 0 };
    const txs = selectedCustomerAllTransactions;
    const totalBilled = txs.filter(t => t.type === 'due').reduce((s, t) => s + t.amount, 0);
    const totalPaid = txs.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
    return {
      totalBilled,
      totalPaid,
      lifetimeVolume: totalBilled + totalPaid,
      txCount: txs.length
    };
  }, [selectedCustomer, selectedCustomerAllTransactions]);

  const handleAutoCreateAndOpenCustomer = async (customerName: string, phone: string) => {
    const trimmedName = customerName.trim() || phone;
    const rawBillingDay = parseInt(newBillingDay, 10);
    if (newAccountType === 'credit_card' && (!rawBillingDay || rawBillingDay < 1 || rawBillingDay > 31)) {
      setFormError(
        lang === 'bn'
          ? 'অনুগ্রহ করে কার্ডের বিলিং তারিখ দিন (১-৩১)'
          : 'Please enter a statement billing day (1–31)'
      );
      return;
    }
    const parsedBillingDay = rawBillingDay ? Math.min(31, Math.max(1, rawBillingDay)) : undefined;
    setIsCreatingCustomer(true);
    setFormError('');
    try {
      const [newId] = await Promise.all([
        createCustomer(trimmedName, phone, {
          accountType: newAccountType,
          billingDay: newAccountType === 'credit_card' ? parsedBillingDay : undefined,
          photoUrl: newPhotoUrl
        }),
        new Promise(resolve => setTimeout(resolve, 300))
      ]);
      if (newId) {
        setNewName('');
        setNewPhone('');
        setNewPhotoUrl(null);
        setNewAccountType('standard');
        setNewBillingDay('');
        setShowAddForm(false);
        setSelectedCustomerId(newId as string);
        triggerHaptic('single');
        toast.success(
          lang === 'bn'
            ? `"${trimmedName}"-এর হিসাব তৈরি ও খোলা হয়েছে`
            : `Account for "${trimmedName}" created & opened`
        );
      }
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_NAME') {
        toast.error(
          lang === 'bn'
            ? 'এই নামের গ্রাহক ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।'
            : 'A customer with this name already exists.'
        );
      } else {
        toast.error(
          lang === 'bn'
            ? 'অ্যাকাউন্ট সংরক্ষণ করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।'
            : 'Failed to create customer account. Please try again.'
        );
      }
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handlePickContact = async (
    onPickPhone: (phone: string) => void, 
    onPickName?: (name: string) => void,
    isNewAccount: boolean = false
  ) => {
    triggerHaptic('soft');
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && (navigator as any).contacts?.select) {
      try {
        const props = ['name', 'tel'];
        const options = { multiple: false };
        const contacts = await (navigator as any).contacts.select(props, options);
        if (contacts && contacts.length > 0) {
          // Strictly limit to single contact
          const contact = contacts[0];
          const rawName = (contact.name && contact.name[0]) ? contact.name[0] : '';
          const rawTels: string[] = contact.tel || [];

          // Clean all numbers (stripping +88 / +880) and deduplicate
          const cleanedNumbers = Array.from(new Set(
            rawTels
              .map(t => cleanBangladeshiPhone(t))
              .filter(t => t.length > 0)
          ));

          if (cleanedNumbers.length === 0) {
            toast.error(lang === 'bn' ? 'কোনো ফোন নম্বর পাওয়া যায়নি।' : 'No phone number found in this contact.');
            return;
          }

          // If coming from "New account details", always open the custom confirmation/number picker modal
          if (isNewAccount) {
            triggerHaptic('single');
            const initialName = (newName.trim() || rawName || '').trim();
            setPendingContactChoice({
              contactName: initialName,
              numbers: cleanedNumbers,
              isNewAccount: true,
              onSelect: async (chosenNumber: string, finalName?: string) => {
                const targetName = (finalName || initialName || chosenNumber).trim();
                await handleAutoCreateAndOpenCustomer(targetName, chosenNumber);
              }
            });
            return;
          }

          // If contact has multiple numbers (for existing customer edit/view)
          if (cleanedNumbers.length > 1) {
            triggerHaptic('single');
            setPendingContactChoice({
              contactName: rawName,
              numbers: cleanedNumbers,
              isNewAccount: false,
              onSelect: (chosen: string, finalName?: string) => {
                onPickPhone(chosen);
                if (onPickName && (finalName || rawName)) onPickName(finalName || rawName);
                toast.success(lang === 'bn' ? 'নম্বর সফলভাবে নেওয়া হয়েছে' : 'Contact number selected');
              }
            });
            return;
          }

          // Exactly one number: set directly
          const singleNumber = cleanedNumbers[0];
          onPickPhone(singleNumber);
          if (onPickName && rawName) {
            onPickName(rawName);
          }
          triggerHaptic('single');
          toast.success(lang === 'bn' ? 'নম্বর সফলভাবে নেওয়া হয়েছে' : 'Contact number selected');
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn("Contact picker failed:", err);
        }
      }
    } else {
      triggerHaptic('double');
      toast.info(lang === 'bn' 
        ? 'কন্টাক্ট পিকারটি শুধুমাত্র মোবাইল ডিভাইসের সমর্থিত ব্রাউজারে উপলব্ধ।' 
        : 'Contact picker is supported on mobile browsers (like Chrome on Android).');
    }
  };

  const handleGenerateReceiptImage = async () => {
    if (!selectedCustomer) return;
    setIsGeneratingReceipt(true);
    triggerHaptic('single');

    try {
      if (selectedCustomer.accountType === 'credit_card') {
        const result = await generateCreditCardStatementPdf(
          selectedCustomer,
          creditCardCycleData?.billedTxs || [],
          creditCardCycleData,
          lang
        );
        setReceiptResult(result);
      } else {
        const currentTheme = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
          ? 'dark'
          : 'light';
        const result = await generateReceiptPng(
          selectedCustomer,
          selectedCustomerAllTransactions,
          lang,
          currentTheme
        );
        setReceiptResult(result);
      }
      try {
        window.history.pushState({ ...window.history.state, modal: 'receiptPreview' }, '');
      } catch {
        // history navigation fallback
      }
    } catch (err: any) {
      console.error('Receipt generation error:', err);
      const errMsg = err?.message || String(err);
      toast.error(lang === 'bn' ? `রসিদ তৈরিতে ত্রুটি: ${errMsg}` : `Failed to generate receipt: ${errMsg}`);
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  // Credit Card Billing Cycle Metrics: Unbilled (Current Cycle) vs Billed (Bills close only on Billing Day)
  const creditCardCycleData = useMemo(() => {
    if (!selectedCustomer || selectedCustomer.accountType !== 'credit_card') return null;

    const billingDay = Math.min(31, Math.max(1, selectedCustomer.billingDay || 15));
    const getCycleBoundary = (year: number, monthIndex: number, day: number) => {
      const firstOfTarget = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const maxDays = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
      return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(day, maxDays), 0, 0, 0, 0);
    };

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const thisMonthCutoff = getCycleBoundary(now.getFullYear(), now.getMonth(), billingDay);

    let lastStatementDate: Date;
    let prevStatementDate: Date;
    let nextStatementDate: Date;
    const isBillingDayToday = todayMidnight.getTime() === thisMonthCutoff.getTime();

    if (todayMidnight.getTime() >= thisMonthCutoff.getTime()) {
      lastStatementDate = thisMonthCutoff;
      prevStatementDate = getCycleBoundary(now.getFullYear(), now.getMonth() - 1, billingDay);
      nextStatementDate = getCycleBoundary(now.getFullYear(), now.getMonth() + 1, billingDay);
    } else {
      lastStatementDate = getCycleBoundary(now.getFullYear(), now.getMonth() - 1, billingDay);
      prevStatementDate = getCycleBoundary(now.getFullYear(), now.getMonth() - 2, billingDay);
      nextStatementDate = thisMonthCutoff;
    }

    const lastCutoffMs = lastStatementDate.getTime();
    const prevCutoffMs = prevStatementDate.getTime();

    const unbilledWithMeta: Array<{ tx: Transaction; txMs: number; createdMs: number; idx: number }> = [];
    const billedWithMeta: Array<{ tx: Transaction; txMs: number; createdMs: number; idx: number }> = [];
    const lastCycleOnlyTxs: Transaction[] = [];

    selectedCustomerAllTransactions.forEach((tx, idx) => {
      const txMs = parseFirestoreDate(tx.date).getTime();
      const createdMs = parseFirestoreDate(tx.createdAt || tx.date).getTime();
      if (txMs >= lastCutoffMs) {
        unbilledWithMeta.push({ tx, txMs, createdMs, idx });
      } else {
        billedWithMeta.push({ tx, txMs, createdMs, idx });
        if (txMs >= prevCutoffMs) {
          lastCycleOnlyTxs.push(tx);
        }
      }
    });

    const sortNewestEntries = (
      a: { txMs: number; createdMs: number; idx: number },
      b: { txMs: number; createdMs: number; idx: number }
    ) => {
      if (b.txMs !== a.txMs) return b.txMs - a.txMs;
      if (b.createdMs !== a.createdMs) return b.createdMs - a.createdMs;
      return a.idx - b.idx;
    };

    const unbilledTxs = unbilledWithMeta.sort(sortNewestEntries).map((item) => item.tx);
    const billedTxs = billedWithMeta.sort(sortNewestEntries).map((item) => item.tx);

    const thisMonthSpend = unbilledTxs
      .filter((t) => t.type === 'due')
      .reduce((s, t) => s + t.amount, 0);
    const paymentsSinceCutoff = unbilledTxs
      .filter((t) => t.type === 'payment')
      .reduce((s, t) => s + t.amount, 0);

    const lastMonthCycleSpend = lastCycleOnlyTxs
      .filter((t) => t.type === 'due')
      .reduce((s, t) => s + t.amount, 0);
    const lastMonthCyclePayments = lastCycleOnlyTxs
      .filter((t) => t.type === 'payment')
      .reduce((s, t) => s + t.amount, 0);

    // Exact statement balance at the moment the last statement closed on billingDay (includes any older unpaid balance carried into it)
    const rawStatementAtCutoff = selectedCustomer.outstandingDue - thisMonthSpend + paymentsSinceCutoff;
    const billedStatementAmount = Math.max(0, rawStatementAtCutoff);

    // Payments made since cutoff pay down the Billed statement first; any excess reduces Unbilled (Current Cycle)
    const paidTowardBilled = Math.min(billedStatementAmount, paymentsSinceCutoff);
    const unpaidCarryOver = Math.max(0, billedStatementAmount - paymentsSinceCutoff);
    const excessPaymentOnUnbilled = Math.max(0, paymentsSinceCutoff - billedStatementAmount);

    const netUnbilledThisMonth = Math.max(0, thisMonthSpend - excessPaymentOnUnbilled);
    const totalPayableWithCarryOver = Math.max(0, selectedCustomer.outstandingDue);

    // Prior unpaid balance from before prevStatementDate that carried into Last Month's statement
    const priorCarryIntoLastMonth = Math.max(
      0,
      billedStatementAmount - lastMonthCycleSpend + lastMonthCyclePayments
    );

    const daysUntilNextStatement = isBillingDayToday
      ? 0
      : Math.max(
          1,
          Math.round((nextStatementDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))
        );

    const lastMonthEndDisplay = new Date(lastStatementDate.getTime() - 24 * 60 * 60 * 1000);
    const thisMonthEndDisplay = new Date(nextStatementDate.getTime() - 24 * 60 * 60 * 1000);

    return {
      billingDay,
      isBillingDayToday,
      lastStatementDate,
      prevStatementDate,
      nextStatementDate,
      lastMonthEndDisplay,
      thisMonthEndDisplay,
      daysUntilNextStatement,
      unbilledTxs,
      billedTxs,
      thisMonthSpend,
      paymentsSinceCutoff,
      lastMonthCycleSpend,
      lastMonthCyclePayments,
      billedStatementAmount,
      paidTowardBilled,
      unpaidCarryOver,
      netUnbilledThisMonth,
      totalPayableWithCarryOver,
      priorCarryIntoLastMonth
    };
  }, [selectedCustomer, selectedCustomerAllTransactions]);

  const [tagFilterLimit, setTagFilterLimit] = useState(5);

  React.useEffect(() => {
    setTagFilterLimit(5);
  }, [selectedCustomerId, ledgerTagFilter, cardCycleTab]);

  // Full unfiltered transactions for this customer/cycle so tag sorting scans even the 1000th entry
  const fullCycleTransactions = useMemo(() => {
    if (selectedCustomer?.accountType === 'credit_card' && creditCardCycleData) {
      return cardCycleTab === 'unbilled'
        ? creditCardCycleData.unbilledTxs
        : creditCardCycleData.billedTxs;
    }
    return selectedCustomerAllTransactions;
  }, [selectedCustomer?.accountType, creditCardCycleData, cardCycleTab, selectedCustomerAllTransactions]);

  const availableLedgerTags = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (let i = 0; i < fullCycleTransactions.length; i++) {
      const tx = fullCycleTransactions[i];
      const tag = tx.tag;
      if (!tag || seen.has(tag)) continue;
      const meta = getTagMeta(tag, tx.type);
      if (!meta || meta.enabled === false || isTagDisabled(tag, tx.type)) continue;
      seen.add(tag);
      list.push(tag);
    }
    return list;
  }, [fullCycleTransactions, liveTagConfig]);

  // Clear active sort tag cleanly if the user disabled or deleted it
  React.useEffect(() => {
    if (ledgerTagFilter && !availableLedgerTags.includes(ledgerTagFilter)) {
      setLedgerTagFilter(null);
    }
  }, [ledgerTagFilter, availableLedgerTags]);

  const ledgerTagScrollRef = useRef<HTMLDivElement>(null);
  const {
    scrollEdges: ledgerTagEdges,
    isDragging: isDraggingLedgerTags,
    scrollByStep: scrollLedgerTagsByStep,
    handlers: ledgerTagScrollHandlers,
  } = useHorizontalDragWheelScroll(ledgerTagScrollRef, availableLedgerTags.length);

  const { groupedTransactions, filteredTotalCount, displayedCount } = useMemo(() => {
    const matchedTxs = ledgerTagFilter
      ? fullCycleTransactions.filter((tx) => tx.tag === ledgerTagFilter)
      : fullCycleTransactions;

    const totalMatched = matchedTxs.length;
    const activeLimit = ledgerTagFilter ? tagFilterLimit : customerTxLimit;
    const sourceTxs =
      selectedCustomer?.accountType === 'credit_card'
        ? matchedTxs
        : matchedTxs.slice(0, activeLimit);

    const groups: Record<string, { dayMs: number; items: Array<{ tx: Transaction; txMs: number; createdMs: number; idx: number }> }> = {};
    for (let i = 0; i < sourceTxs.length; i++) {
      const tx = sourceTxs[i];
      const d = parseFirestoreDate(tx.date);
      const txMs = d.getTime();
      const createdMs = parseFirestoreDate(tx.createdAt || tx.date).getTime();
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!groups[dayKey]) {
        groups[dayKey] = {
          dayMs: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
          items: [],
        };
      }
      groups[dayKey].items.push({ tx, txMs, createdMs, idx: i });
    }

    const grouped = Object.entries(groups)
      .sort((a, b) => b[1].dayMs - a[1].dayMs)
      .map(([dayKey, group]) => ({
        dateStr: dayKey,
        isTagGroup: false,
        tagKey: '',
        label: '',
        dateObj: new Date(group.dayMs),
        items: group.items
          .sort((a, b) => {
            if (b.txMs !== a.txMs) return b.txMs - a.txMs;
            if (b.createdMs !== a.createdMs) return b.createdMs - a.createdMs;
            return a.idx - b.idx;
          })
          .map(item => item.tx),
      }));

    return {
      groupedTransactions: grouped,
      filteredTotalCount: totalMatched,
      displayedCount: sourceTxs.length,
    };
  }, [fullCycleTransactions, ledgerTagFilter, tagFilterLimit, customerTxLimit, selectedCustomer?.accountType]);

  const activeCustomerArchives = useMemo(() => {
    if (!selectedCustomerId || archivedStatements.length === 0) return [];
    return archivedStatements.filter((a: any) => a && a.customerId === selectedCustomerId);
  }, [archivedStatements, selectedCustomerId]);

  const handleCardSelect = React.useCallback((c: Customer) => {
    setSelectedCustomerId(selectedCustomerId === c.id ? null : c.id);
  }, [selectedCustomerId, setSelectedCustomerId]);

  const handleCardOpenPin = React.useCallback((c: Customer) => {
    window.history.pushState({ ...window.history.state, modal: 'pinActionCustomer' }, '');
    setPinActionCustomer(c);
  }, []);

  const handleCardDelete = React.useCallback((c: Customer) => {
    triggerHaptic('double');
    window.history.pushState({ ...window.history.state, modal: 'deleteCustomer' }, '');
    setDeletingCustomer(c);
  }, []);

 const handleCreateCustomer = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormError('');

 if (!newName.trim()) {
 setFormError(
   newAccountType === 'credit_card'
     ? (lang === 'bn' ? 'অনুগ্রহ করে কার্ড বা হিসাবের নাম লিখুন' : 'Please enter a credit card or account name')
     : (lang === 'bn' ? 'অনুগ্রহ করে গ্রাহকের নাম লিখুন' : 'Please enter a customer name')
 );
 return;
 }

 const rawBillingDay = parseInt(newBillingDay, 10);
 if (newAccountType === 'credit_card' && (!rawBillingDay || rawBillingDay < 1 || rawBillingDay > 31)) {
   setFormError(
     lang === 'bn'
       ? 'অনুগ্রহ করে কার্ডের বিলিং তারিখ লিখুন (১ থেকে ৩১ এর মধ্যে)'
       : 'Please enter a statement billing day between 1 and 31'
   );
   return;
 }
 const parsedBillingDay = rawBillingDay ? Math.min(31, Math.max(1, rawBillingDay)) : undefined;

 setIsCreatingCustomer(true);
 try {
 const newId = await createCustomer(newName, newPhone, {
   accountType: newAccountType,
   billingDay: newAccountType === 'credit_card' ? parsedBillingDay : undefined,
   photoUrl: newPhotoUrl
 });
 if (newId) {
 setNewName('');
 setNewPhone('');
 setNewPhotoUrl(null);
 setNewAccountType('standard');
 setNewBillingDay('');
 setShowAddForm(false);
 setSelectedCustomerId(newId as string); // open their profile immediately!
 toast.success(
   newAccountType === 'credit_card'
     ? (lang === 'bn' ? 'ক্রেডিট কার্ড হিসাব তৈরি সম্পন্ন হয়েছে' : 'Credit card ledger created successfully')
     : (lang === 'bn' ? 'গ্রাহক তৈরি সম্পন্ন হয়েছে' : 'Customer created successfully')
 );
 }
 } catch (err: any) {
 if (err.message === 'DUPLICATE_NAME') {
 setFormError(lang === 'bn' ? 'এই নামের হিসাব ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।' : 'An account with this name already exists.');
 } else {
 setFormError(lang === 'bn' ? 'অ্যাকাউন্ট সংরক্ষণ করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।' : 'Failed to save account. Try again.');
 }
 } finally {
 setIsCreatingCustomer(false);
 }
 };

   const handleAddInlineTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeInlineTransaction(false);
  };

  const executeInlineTransaction = async (bypassDuplicateCheck = false) => {
    if (!selectedCustomerId || !openActionType) return;
    const cleaned = actionAmount.replace(/,/g, '');
    const amountVal = parseFloat(cleaned);
    if (!amountVal || amountVal <= 0) return;

    if (!bypassDuplicateCheck && !hasShownDuplicateWarning) {
      const duplicate = getDuplicate(openActionType, actionAmount);
      if (duplicate) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setDuplicateTxWarning(duplicate);
        return;
      }
    }

    // If adding a bill into Last Month's Billed cycle on a Credit Card ledger, timestamp it strictly newer than existing billed entries inside that closed cycle so it always lands on top
    let txDate = new Date();
    if (
      selectedCustomer?.accountType === 'credit_card' &&
      openActionType === 'due' &&
      actionTargetCycle === 'billed' &&
      creditCardCycleData
    ) {
      const cutoffMs = creditCardCycleData.lastStatementDate.getTime();
      let maxBilledMs = cutoffMs - 12 * 60 * 60 * 1000;
      creditCardCycleData.billedTxs.forEach((bTx) => {
        const bMs = parseFirestoreDate(bTx.date).getTime();
        if (bMs < cutoffMs && bMs > maxBilledMs) {
          maxBilledMs = bMs;
        }
      });
      txDate = new Date(Math.min(cutoffMs - 1000, maxBilledMs + 1000));
    }

    const finalDesc = actionDesc.trim() || (actionTag ? getTagDefaultDescription(actionTag, lang) : '');
    setTxSubmitting(true);
    try {
      await addTransaction(selectedCustomerId, openActionType, amountVal, finalDesc, txDate, undefined, actionTag || undefined);
      setActionAmount('');
      setActionDesc('');
      setActionTag(null);
      setPaymentQuickFillIntent(null);
      setActionTargetCycle('unbilled');
      setOpenActionType(null);
      setDuplicateTxWarning(null);
      setHasShownDuplicateWarning(false);
      toast.success(lang === 'bn' ? 'হিসাব সফলভাবে যোগ হয়েছে' : 'Transaction added successfully');
    } catch (err) {
      console.error(err);
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleDelete = (c: Customer) => {
    window.history.pushState({ ...window.history.state, modal: 'deleteCustomer' }, '');
    setDeletingCustomer(c);
  };

 // Generate message text based on selected template index
  const getMessageText = (c: Customer, templateIdx: number) => {
    if (lang === 'bn') {
      if (templateIdx === 1) {
        return `আসসালামু আলাইকুম ${c.name}। আপনার কাছে আমাদের বকেয়া পাওনা ৳${formatNumber(c.outstandingDue, 'bn')}। সম্ভব হলে অনুগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ!`;
      } else if (templateIdx === 2) {
        return `আসসালামু আলাইকুম ${c.name}। আশা করি ভালো আছেন। আপনার বকেয়া হিসাব ৳${formatNumber(c.outstandingDue, 'bn')} পরিশোধ বা সমন্বয় করার অনুরোধ রইল। ধন্যবাদ!`;
      } else {
        return `প্রিয় ${c.name}। আপনার মোট বকেয়া পাওনা ৳${formatNumber(c.outstandingDue, 'bn')}। অনুগ্রহ করে দ্রুত পরিশোধ করার জন্য অনুরোধ করা হলো। ধন্যবাদ!`;
      }
    } else {
      if (templateIdx === 1) {
        return `Hi ${c.name}, a friendly reminder that your outstanding balance is ৳${formatNumber(c.outstandingDue, 'en')}. Please clear it at your earliest convenience. Thanks!`;
      } else if (templateIdx === 2) {
        return `Hi ${c.name}, hope you are doing well. According to our ledger, your outstanding due is ৳${formatNumber(c.outstandingDue, 'en')}. Kindly settle this balance. Thanks!`;
      } else {
        return `Dear ${c.name}, your total outstanding due is ৳${formatNumber(c.outstandingDue, 'en')}. We request you to clear it as soon as possible. Thank you!`;
      }
    }
  };

  // Generate customized shareable WhatsApp link
  const getShareLink = React.useCallback((c: Customer, format: 'whatsapp' | 'sms') => {
  const text = getMessageText(c, selectedTemplate);
  const encodedText = encodeURIComponent(text);
  if (format === 'whatsapp') {
  let phoneNum = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';
  if (phoneNum.startsWith('01')) phoneNum = '88' + phoneNum;
  return `https://wa.me/${phoneNum}?text=${encodedText}`;
  }
  return `sms:${c.phone}?body=${encodedText}`;
  }, [lang, selectedTemplate]);

  const handleCardWhatsApp = React.useCallback((c: Customer) => {
    if (!c.phone || !c.phone.trim()) {
      triggerHaptic('double');
      window.history.pushState({ ...window.history.state, modal: 'phoneWarningCustomer' }, '');
      setPhoneWarningCustomer(c);
    } else {
      triggerHaptic('single');
      window.open(getShareLink(c, 'whatsapp'), '_blank');
    }
  }, [getShareLink]);



 return (
 <div className="space-y-6 no-select">
 
 {/* 1. LIST VIEW OF ALL CUSTOMERS */}
      {!selectedCustomer ? (
        <div className="space-y-5">
          {/* Open Editorial Header with Scroll Parallax Shrink */}
          <ScrollParallaxStage rangePx={160}>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1 px-1">
              <div>
                <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1' : 'micro-mono-label text-slate-500 dark:text-slate-400 block mb-1'}>
                  {lang === 'bn' ? `${formatNumber(customers.length, lang)}টি প্রোফাইল খতিয়ানে` : `${formatNumber(customers.length, lang)} Profiles on Ledger`}
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tracking-tight leading-tight">
                  {t.customerAccounts}
                </h2>
              </div>

              <button
                onClick={() => {
                  triggerHaptic('single');
                  setShowAddForm(!showAddForm);
                }}
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-semibold rounded-full flex items-center justify-center gap-2 transition-all cursor-pointer text-xs shrink-0 touch-press shadow-md"
                id="add_customer_btn"
              >
                <UserPlus className="w-4 h-4 stroke-[1.25]" />
                <span>{t.createAccount}</span>
              </button>
            </div>
          </ScrollParallaxStage>

          {/* Form to add new customer */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleCreateCustomer}
                className="surface-glass border p-5 sm:p-6 rounded-[28px] space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-3">
                  <div className={lang === 'bn' ? 'text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label text-slate-600 dark:text-slate-300 font-semibold'}>
                    {t.newAccountDetails}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      triggerHaptic('medium');
                      setShowAddForm(false);
                    }}
                    className="w-8 h-8 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4 stroke-[1.25]" />
                  </button>
                </div>

                {/* Account Type Selector */}
                <div className="space-y-1.5">
                  <label className={`block ${lang === 'bn' ? 'text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-normal' : 'micro-mono-label text-slate-600 dark:text-slate-300 font-semibold'}`}>
                    {lang === 'bn' ? 'হিসাবের ধরন' : 'Account Type'}
                  </label>
                  <div className="relative grid grid-cols-2 p-1 rounded-full bg-slate-900/[0.045] dark:bg-white/[0.05] border border-slate-900/[0.08] dark:border-white/[0.09]">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-slate-950 dark:bg-white shadow-sm will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        transform: `translate3d(${newAccountType === 'credit_card' ? '100%' : '0%'}, 0, 0)`
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setNewAccountType('standard');
                      }}
                      className={`relative z-10 py-2.5 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors duration-200 touch-press ${
                        newAccountType === 'standard'
                          ? 'text-white dark:text-slate-950'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 shrink-0 stroke-[1.25]" />
                      <span className="truncate">{lang === 'bn' ? 'গ্রাহক খতিয়ান' : 'Customer Ledger'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setNewAccountType('credit_card');
                      }}
                      className={`relative z-10 py-2.5 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors duration-200 touch-press ${
                        newAccountType === 'credit_card'
                          ? 'text-white dark:text-slate-950'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5 shrink-0 stroke-[1.25]" />
                      <span className="truncate">{lang === 'bn' ? 'ক্রেডিট কার্ড' : 'Credit Card'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={lang === 'bn' ? 'text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-normal block overflow-hidden' : 'micro-mono-label text-slate-600 dark:text-slate-300 font-semibold block overflow-hidden'}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={newAccountType}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                          className="inline-block"
                        >
                          {newAccountType === 'credit_card'
                            ? (lang === 'bn' ? 'কার্ড / হিসাবের নাম' : 'Card / Account Name')
                            : t.customerName}
                        </motion.span>
                      </AnimatePresence>
                    </label>
                    <input
                      type="text"
                      placeholder={newAccountType === 'credit_card' ? (lang === 'bn' ? 'যেমন: সিটি ব্যাংক অ্যামেক্স' : 'e.g. City Bank Amex') : 'e.g. Wahid Zaman'}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/60 dark:bg-white/[0.05] border border-slate-900/[0.1] dark:border-white/[0.1] rounded-2xl text-slate-950 dark:text-white text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white font-medium transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={lang === 'bn' ? 'text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-normal' : 'micro-mono-label text-slate-600 dark:text-slate-300 font-semibold'}>{t.phoneNumber}</label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder={t.phoneSmsNotice}
                        value={newPhone}
                        onChange={(e) => setNewPhone(cleanBangladeshiPhone(e.target.value))}
                        className="flex-1 px-4 py-2.5 bg-white/60 dark:bg-white/[0.05] border border-slate-900/[0.1] dark:border-white/[0.1] rounded-2xl text-slate-950 dark:text-white text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white font-mono transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handlePickContact(setNewPhone, (name) => { if (!newName.trim()) setNewName(name); }, true)}
                        className="px-3.5 bg-white/60 hover:bg-white/90 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-900 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 font-semibold text-xs"
                        title={lang === 'bn' ? 'কন্টাক্ট নির্বাচন করুন' : 'Pick Contact'}
                      >
                        <BookUser className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 stroke-[1.25]" />
                        <span className="hidden sm:inline">{lang === 'bn' ? 'কন্টাক্ট' : 'Contacts'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Apple-style Contact Photo Picker */}
                <AppleContactPhotoPicker
                  photoUrl={newPhotoUrl}
                  displayName={newName}
                  lang={lang}
                  inputRef={newPhotoInputRef}
                  onFileChange={(e) => handleCustomerPhotoSelect(e, 'new')}
                  onRemove={() => setNewPhotoUrl(null)}
                />

                <AnimatePresence>
                  {newAccountType === 'credit_card' && (
                    <motion.div
                      key="create-billing-day"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="p-3.5 rounded-2xl surface-subcard border"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <label className={`flex items-center gap-1.5 ${lang === 'bn' ? 'text-[11px] text-slate-700 dark:text-slate-200 font-bold tracking-normal' : 'micro-mono-label text-slate-700 dark:text-slate-200 font-semibold'}`}>
                            <Calendar className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 stroke-[1.25]" />
                            <span>{lang === 'bn' ? 'স্টেটমেন্ট বিলিং তারিখ (১-৩১)' : 'Statement Billing Day (1–31)'}</span>
                          </label>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {lang === 'bn'
                              ? 'মাসের কোন তারিখে কার্ডের বিল তৈরি হয় তা লিখুন (যেমন: ১৫)'
                              : 'Enter the day of the month your statement generates (1–31)'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="text"
                            inputMode="numeric"
                            data-numpad="true"
                            placeholder={lang === 'bn' ? '১-৩১' : '1–31'}
                            value={newBillingDay}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9]/g, '');
                              if (!clean) {
                                setNewBillingDay('');
                                return;
                              }
                              const num = Math.min(31, Math.max(1, parseInt(clean, 10)));
                              setNewBillingDay(String(num));
                            }}
                            className="w-20 px-3 py-2 text-center bg-white/65 dark:bg-white/[0.06] border border-slate-900/[0.1] dark:border-white/[0.1] rounded-full text-slate-950 dark:text-white font-mono font-bold text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white placeholder:text-slate-400 placeholder:font-normal"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {formError && (
                  <div className="text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-1.5 bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
                    <AlertTriangle className="w-4 h-4 shrink-0 stroke-[1.25]" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-white/55 hover:bg-white/85 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-slate-900/[0.08] dark:border-white/[0.08] font-semibold rounded-full text-xs cursor-pointer transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCustomer}
                    className="px-5 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-semibold rounded-full text-xs disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-sm"
                  >
                    {isCreatingCustomer ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner size="xs" />
                        {t.saving || (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')}
                      </span>
                    ) : (
                      t.saveAndOpen
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Frosted Pill Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none stroke-[1.25]" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="surface-glass w-full pl-11 pr-12 py-3 border rounded-full text-slate-950 dark:text-white text-sm focus:outline-none font-medium placeholder:text-slate-400 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('level3');
                  setSearchQuery('');
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
                title={lang === 'bn' ? 'খালি করুন' : 'Clear search'}
                aria-label={lang === 'bn' ? 'খালি করুন' : 'Clear search'}
              >
                <Delete className="w-4.5 h-4.5 stroke-[1.25]" />
              </button>
            )}
          </div>

          {/* Client Status Filter Pills & Sort Dropdown */}
          <div className="flex items-center justify-between gap-2 relative select-none px-0.5">
            <div
              ref={filterPillsContainerRef}
              onPointerDown={(e) => {
                isSlidingFilterRef.current = true;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                selectFilterPillAtClientX(e.clientX, true);
              }}
              onPointerMove={(e) => {
                if (!isSlidingFilterRef.current) return;
                selectFilterPillAtClientX(e.clientX, false);
              }}
              onPointerUp={(e) => {
                isSlidingFilterRef.current = false;
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
              }}
              onPointerCancel={() => {
                isSlidingFilterRef.current = false;
              }}
              onLostPointerCapture={() => {
                isSlidingFilterRef.current = false;
              }}
              className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-1 touch-none select-none"
            >
              {([
                { id: 'all', title: lang === 'bn' ? 'সব গ্রাহক' : 'All Customers' },
                { id: 'due', title: lang === 'bn' ? 'বাকি' : 'Due Customers' },
                { id: 'settled', title: lang === 'bn' ? 'পরিশোধিত' : 'Settled Customers' },
                { id: 'overpaid', title: lang === 'bn' ? 'অগ্রিম জমা' : 'Advance / Overpaid' },
              ] as const).map((tab) => {
                const isActive = filterStatus === tab.id;
                const activeBorderClass =
                  tab.id === 'due'
                    ? 'bg-white/95 dark:bg-white/[0.16] border-2 border-rose-500/80 dark:border-rose-400/80 shadow-xs'
                    : tab.id === 'settled'
                    ? 'bg-white/95 dark:bg-white/[0.16] border-2 border-emerald-500/80 dark:border-emerald-400/80 shadow-xs'
                    : tab.id === 'overpaid'
                    ? 'bg-white/95 dark:bg-white/[0.16] border-2 border-[var(--accent-color)] shadow-xs'
                    : 'bg-white/95 dark:bg-white/[0.16] border-2 border-slate-950/45 dark:border-white/55 shadow-xs';
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-filter-pill={tab.id}
                    title={tab.title}
                    aria-label={tab.title}
                    onClick={() => {
                      if (filterStatus !== tab.id) {
                        triggerHaptic('level3');
                        setFilterStatus(tab.id);
                      }
                    }}
                    className={`w-7 h-3 rounded-full transition-all cursor-pointer shrink-0 active:scale-95 ${
                      isActive
                        ? activeBorderClass
                        : 'border-2 bg-white/45 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.1] border-slate-900/[0.14] dark:border-white/[0.14] hover:border-slate-900/25 dark:hover:border-white/25'
                    }`}
                  />
                );
              })}
            </div>

            {/* Sort Button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('single');
                  setIsSortOpen(!isSortOpen);
                }}
                className={`surface-glass-interactive px-3.5 py-1.5 rounded-full font-semibold text-xs border-2 text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  isSortOpen
                    ? 'border-slate-950/40 dark:border-white/45 bg-white/90 dark:bg-white/[0.14]'
                    : 'border-slate-900/[0.14] dark:border-white/[0.14] hover:border-slate-900/25 dark:hover:border-white/25'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 stroke-[1.25]" />
                <span>{lang === 'bn' ? 'সাজান' : 'Sort'}</span>
              </button>

              {isSortOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-[60]" 
                    onClick={() => setIsSortOpen(false)} 
                  />
                  <div className="absolute right-0 mt-1.5 w-48 glass-dropdown border rounded-2xl z-[70] p-1.5 space-y-0.5 animate-reveal">
                    {(['recent', 'high_balance', 'low_balance'] as const).map((option) => {
                       const label = option === 'recent'
                          ? (lang === 'bn' ? 'সাম্প্রতিক' : 'Recent')
                          : option === 'high_balance'
                            ? (lang === 'bn' ? 'সর্বোচ্চ ব্যালেন্স' : 'High Balance')
                            : (lang === 'bn' ? 'সর্বনিম্ন ব্যালেন্স' : 'Low Balance');
                       return (
                         <button
                           key={option}
                           type="button"
                           onClick={() => {
                             triggerHaptic('single');
                             setSortBy(option);
                             setIsSortOpen(false);
                           }}
                           className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                             sortBy === option 
                               ? 'bg-slate-950/[0.07] dark:bg-white/[0.12] text-slate-950 dark:text-white' 
                               : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
                           }`}
                         >
                           <span>{label}</span>
                           {sortBy === option && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[1.5]" />}
                         </button>
                       );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Customer Profile Grid (First viewport cards render immediately, rest yield cleanly after paint) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(listBatchExpanded || searchQuery.trim().length > 0 ? filteredCustomers : filteredCustomers.slice(0, 16)).map((c, idx) => (
              <CustomerCardGridItem
                key={c.id}
                customer={c}
                index={idx}
                lang={lang}
                isSelected={selectedCustomerId === c.id}
                isPinned={pinnedCustomerNameSet.has(c.name)}
                swipeGesturesEnabled={swipeGesturesEnabled}
                isDeleting={deletingCustomer?.id === c.id}
                onSelectCustomer={handleCardSelect}
                onOpenPinModal={handleCardOpenPin}
                onWhatsAppCustomer={handleCardWhatsApp}
                onDeleteCustomer={handleCardDelete}
              />
            ))}

            {filteredCustomers.length === 0 && (
              <div className="col-span-1 sm:col-span-2 p-10 text-center surface-glass rounded-[28px] border border-dashed text-slate-500">
                <Users className="w-8 h-8 mx-auto stroke-[1.25] mb-2 text-slate-400" />
                <p className="font-bold text-sm text-slate-900 dark:text-white">{t.noCustomersFound}</p>
                <p className={`text-xs mt-1 text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'font-editorial-bn' : ''}`}>{t.createOneAbove}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
 
 /* 2. CHOSEN CUSTOMER DETAIL SHEET VIEW */
 <div className="space-y-5 motion-view-enter">
 {/* Back button */}
 <button
 onClick={() => {
 setSelectedCustomerId(null);
 setOpenActionType(null);
 setIsEditingCustomer(false);
  setLedgerLimit(5);
  }}
  className="surface-glass-interactive inline-flex items-center gap-2 px-4 py-2 font-bold text-slate-900 dark:text-slate-100 rounded-full text-xs cursor-pointer border border-slate-200/80 dark:border-white/[0.1] touch-press shadow-2xs"
 id="back_to_list_btn"
 >
 <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
 <span>{t.backToList}</span>
 </button>

 {/* Customer Profile card */}
 <SpotlightCard className="surface-hero-glass border rounded-[28px] p-5 sm:p-6 space-y-5 relative overflow-hidden">
  {/* Subtle atmospheric accent glow behind profile card */}
  <div
    aria-hidden="true"
    className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-[0.12] dark:opacity-[0.16]"
    style={{ backgroundColor: 'var(--accent-color)' }}
  />
 
 {/* Edit and Pin Buttons on the Top Right Side of the Card */}
  {!isEditingCustomer && (
    <div className="absolute right-4 top-4 sm:right-5 sm:top-5 flex items-center gap-1.5 z-25">
      <button
        type="button"
        onClick={() => {
          triggerHaptic('single');
          togglePinCustomer(selectedCustomer.id);
        }}
        className="w-9 h-9 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-white/[0.08] rounded-full transition-colors cursor-pointer flex items-center justify-center touch-press"
        title={pinnedCustomerNameSet.has(selectedCustomer.name) ? (lang === 'bn' ? 'আনপিন করুন' : 'Unpin Customer') : (lang === 'bn' ? 'পিন করুন' : 'Pin Customer')}
      >
        <Pin className={`w-4 h-4 stroke-[1.25] ${pinnedCustomerNameSet.has(selectedCustomer.name) ? 'text-amber-500 fill-amber-500 rotate-45' : 'text-slate-500 dark:text-slate-400'}`} />
      </button>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('single');
          handleGenerateReceiptImage();
        }}
        disabled={isGeneratingReceipt}
        className="w-9 h-9 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-white/[0.08] rounded-full transition-colors cursor-pointer flex items-center justify-center touch-press"
        title={selectedCustomer.accountType === 'credit_card'
          ? (lang === 'bn' ? 'বিল্ড স্টেটমেন্ট PDF ডাউনলোড করুন' : 'Generate Billed Statement PDF')
          : (lang === 'bn' ? 'রসিদ ইমেজ তৈরি ও ডাউনলোড করুন' : 'Generate & Download Receipt Image')}
      >
        {isGeneratingReceipt ? (
          <RefreshCw className="w-4 h-4 text-slate-500 animate-spin stroke-[1.25]" />
        ) : (
          <ReceiptText className="w-4 h-4 text-slate-500 dark:text-slate-400 stroke-[1.25]" />
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('single');
          setEditName(selectedCustomer.name);
          setEditPhone(cleanBangladeshiPhone(selectedCustomer.phone || ''));
          setEditPhotoUrl(selectedCustomer.photoUrl || null);
          setEditAccountType(selectedCustomer.accountType || 'standard');
          setEditBillingDay(selectedCustomer.billingDay ? String(selectedCustomer.billingDay) : '');
          setEditError('');
          window.history.replaceState({ tab: 'customers', customerId: selectedCustomer.id, modal: 'editingCustomer', quickEntry: false }, '', `?tab=customers&c=${selectedCustomer.id}`);
          setIsEditingCustomer(true);
        }}
        className="w-9 h-9 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-white/[0.08] rounded-full transition-colors cursor-pointer flex items-center justify-center touch-press"
        title={lang === 'bn' ? 'তথ্য পরিবর্তন করুন' : 'Edit Customer Info'}
      >
        <Pencil className="w-4 h-4 stroke-[1.25]" />
      </button>
    </div>
  )}

 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 pt-1">
 {isEditingCustomer ? (
 <motion.form
   key="edit-customer-form"
   initial={{ opacity: 0, y: -8, scale: 0.985 }}
   animate={{ opacity: 1, y: 0, scale: 1 }}
   transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
   onSubmit={async (e) => {
     e.preventDefault();
     triggerHaptic('single');
     if (!editName.trim()) {
       setEditError(lang === 'bn' ? 'নাম অবশ্যই দিতে হবে' : 'Name is required');
       return;
     }
     const rawBilling = parseInt(editBillingDay, 10);
     if (editAccountType === 'credit_card' && (!rawBilling || rawBilling < 1 || rawBilling > 31)) {
       setEditError(lang === 'bn' ? 'বিলিং তারিখ ১ থেকে ৩১ এর মধ্যে দিন' : 'Please enter a billing day between 1 and 31');
       return;
     }
     setIsSavingEdit(true);
     try {
       const parsedBilling = rawBilling ? Math.min(31, Math.max(1, rawBilling)) : undefined;
       await updateCustomerDetails(selectedCustomer.id, editName, editPhone, {
         accountType: editAccountType,
         billingDay: editAccountType === 'credit_card' ? parsedBilling : undefined,
         photoUrl: editPhotoUrl
       });
       setIsEditingCustomer(false);
       toast.success(lang === 'bn' ? 'তথ্য আপডেট করা হয়েছে' : 'Profile updated');
     } catch (err) {
       if (err && (err as any).message === 'DUPLICATE_NAME') {
         setEditError(lang === 'bn' ? 'এই নামের গ্রাহক ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।' : 'A customer with this name already exists.');
       } else {
         setEditError(lang === 'bn' ? 'সংরক্ষণ করতে ব্যর্থ হয়েছে' : 'Failed to save changes');
       }
     } finally {
       setIsSavingEdit(false);
     }
   }}
   className="flex-1 space-y-3.5 max-w-md md:max-w-none"
 >
   {/* Desktop 2-Column Top Grid (Mobile stays exact single column) */}
   <div className="space-y-3.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 md:items-center">
     {/* Apple-style Contact Photo Picker in Edit Mode */}
     <AppleContactPhotoPicker
       photoUrl={editPhotoUrl}
       displayName={editName || selectedCustomer.name}
       lang={lang}
       inputRef={editPhotoInputRef}
       onFileChange={(e) => handleCustomerPhotoSelect(e, 'edit')}
       onRemove={() => setEditPhotoUrl(null)}
     />

     {/* Account Type Selector in Edit Mode */}
     <div>
       <label className={`block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>
         {lang === 'bn' ? 'হিসাবের ধরন' : 'Account Type'}
       </label>
       <div className="relative grid grid-cols-2 p-1 rounded-full bg-slate-900/[0.045] dark:bg-white/[0.05] border border-slate-900/[0.08] dark:border-white/[0.09]">
         <div
           aria-hidden="true"
           className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-slate-950 dark:bg-white shadow-xs transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
           style={{
             transform: `translate3d(${editAccountType === 'credit_card' ? '100%' : '0%'}, 0, 0)`
           }}
         />
         <button
           type="button"
           onClick={() => {
             triggerHaptic('tick');
             setEditAccountType('standard');
           }}
           className={`relative z-10 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200 ${
             editAccountType === 'standard'
               ? 'text-white dark:text-slate-950'
               : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
           }`}
         >
           <Users className="w-3.5 h-3.5 stroke-[1.25]" />
           <span>{lang === 'bn' ? 'গ্রাহক খতিয়ান' : 'Customer Ledger'}</span>
         </button>
         <button
           type="button"
           onClick={() => {
             triggerHaptic('tick');
             setEditAccountType('credit_card');
           }}
           className={`relative z-10 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200 ${
             editAccountType === 'credit_card'
               ? 'text-white dark:text-slate-950'
               : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
           }`}
         >
           <CreditCard className="w-3.5 h-3.5 stroke-[1.25]" />
           <span>{lang === 'bn' ? 'ক্রেডিট কার্ড' : 'Credit Card'}</span>
         </button>
       </div>
     </div>
   </div>

   {/* Desktop 2-Column Fields Grid (Mobile stays exact single column) */}
   <div className="space-y-3.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
     <div>
       <label className={`block mb-1.5 overflow-hidden ${lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label text-slate-500 dark:text-slate-400 font-bold'}`}>
         {editAccountType === 'credit_card' ? (lang === 'bn' ? 'কার্ড / হিসাবের নাম' : 'Card / Account Name') : (lang === 'bn' ? 'গ্রাহকের নাম' : 'Customer Name')}
       </label>
       <input
         type="text"
         value={editName}
         onChange={(e) => setEditName(e.target.value)}
         className="w-full px-4 py-2.5 border border-slate-200/80 dark:border-white/[0.1] rounded-2xl bg-slate-50/80 dark:bg-white/[0.04] text-slate-950 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white text-sm font-bold transition-colors"
         placeholder={editAccountType === 'credit_card' ? (lang === 'bn' ? 'যেমন: সিটি ব্যাংক অ্যামেক্স' : 'e.g. City Bank Amex') : (lang === 'bn' ? 'নাম লিখুন' : 'Enter name')}
         required
       />
     </div>

     <div>
       <label className={`block mb-1.5 ${lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label text-slate-500 dark:text-slate-400 font-bold'}`}>
         {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
       </label>
       <div className="flex gap-2">
         <input
           type="tel"
           id="edit_customer_phone"
           value={editPhone}
           onChange={(e) => setEditPhone(cleanBangladeshiPhone(e.target.value))}
           className="flex-1 px-4 py-2.5 border border-slate-200/80 dark:border-white/[0.1] rounded-2xl bg-slate-50/80 dark:bg-white/[0.04] text-slate-950 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white text-sm font-bold font-mono transition-colors"
           placeholder={lang === 'bn' ? 'যেমন: ০১৭...' : 'e.g. 017...'}
         />
         <button
           type="button"
           onClick={() => handlePickContact(async (pickedPhone) => {
             setEditPhone(pickedPhone);
             if (selectedCustomer) {
               setIsSavingEdit(true);
               try {
                 const rawBilling = parseInt(editBillingDay, 10);
                 const parsedBilling = rawBilling ? Math.min(31, Math.max(1, rawBilling)) : (selectedCustomer.billingDay || 15);
                 await updateCustomerDetails(selectedCustomer.id, editName.trim() || selectedCustomer.name, pickedPhone, {
                   accountType: editAccountType,
                   billingDay: editAccountType === 'credit_card' ? parsedBilling : undefined,
                   photoUrl: editPhotoUrl
                 });
                 setIsEditingCustomer(false);
                 triggerHaptic('single');
                 toast.success(lang === 'bn' ? 'মোবাইল নম্বর ও প্রোফাইল স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়েছে' : 'Profile saved automatically');
               } catch (err: any) {
                 if (err && (err as any).message === 'DUPLICATE_NAME') {
                   setEditError(lang === 'bn' ? 'এই নামের গ্রাহক ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।' : 'A customer with this name already exists.');
                 } else {
                   setEditError(lang === 'bn' ? 'সংরক্ষণ করতে ব্যর্থ হয়েছে' : 'Failed to save changes');
                 }
               } finally {
                 setIsSavingEdit(false);
               }
             }
           })}
           className="w-11 h-11 md:w-auto md:h-auto md:px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 rounded-2xl flex items-center justify-center md:gap-1.5 cursor-pointer transition-all shrink-0 touch-press"
           title={lang === 'bn' ? 'কন্টাক্ট নির্বাচন করুন' : 'Pick Contact'}
         >
           <BookUser className="w-5 h-5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400 stroke-[1.25]" />
           <span className="hidden md:inline text-xs font-bold">{lang === 'bn' ? 'কন্টাক্ট' : 'Contacts'}</span>
         </button>
       </div>
     </div>
   </div>

   {editAccountType === 'credit_card' && (
     <div className="p-3.5 rounded-2xl surface-subcard border border-slate-200/70 dark:border-white/[0.08]">
       <div className="flex items-center justify-between gap-2">
         <label className={`flex items-center gap-1.5 ${lang === 'bn' ? 'text-[11px] font-bold text-slate-600 dark:text-slate-300 tracking-normal' : 'micro-mono-label text-slate-600 dark:text-slate-300 font-bold'}`}>
           <Calendar className="w-3.5 h-3.5 stroke-[1.25]" />
           <span>{lang === 'bn' ? 'স্টেটমেন্ট বিলিং তারিখ (১-৩১)' : 'Statement Billing Day (1–31)'}</span>
         </label>
         <input
           type="text"
           inputMode="numeric"
           data-numpad="true"
           placeholder={lang === 'bn' ? '১-৩১' : '1–31'}
           value={editBillingDay}
           onChange={(e) => {
             const clean = e.target.value.replace(/[^0-9]/g, '');
             if (!clean) {
               setEditBillingDay('');
               return;
             }
             setEditBillingDay(String(Math.min(31, Math.max(1, parseInt(clean, 10)))));
           }}
           className="w-20 px-2.5 py-1.5 text-center border border-slate-200/80 dark:border-white/[0.1] rounded-xl bg-white/80 dark:bg-white/[0.06] text-slate-950 dark:text-white font-mono font-black text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white placeholder:text-slate-400 placeholder:font-normal"
         />
       </div>
     </div>
   )}

   {editError && (
     <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{editError}</p>
   )}
   <div className="flex items-center gap-2 pt-1 md:justify-end">
     <button
       type="submit"
       disabled={isSavingEdit}
       className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold text-xs rounded-full transition-colors cursor-pointer touch-press"
     >
       {isSavingEdit ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save')}
     </button>
     <button
       type="button"
       disabled={isSavingEdit}
       onClick={() => {
         triggerHaptic('single');
         setIsEditingCustomer(false);
       }}
       className="px-5 py-2.5 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold text-xs rounded-full border border-slate-200/80 dark:border-white/[0.08] transition-colors cursor-pointer touch-press"
     >
       {lang === 'bn' ? 'বাতিল' : 'Cancel'}
     </button>
   </div>
 </motion.form>
 ) : (
 <motion.div
   key="view-customer-info"
   initial={{ opacity: 0, y: 6 }}
   animate={{ opacity: 1, y: 0 }}
   transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
   className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-3.5"
 >
   {/* Desktop Left Avatar (shown on sm+ side-by-side layout; on mobile only inline beside name if photo exists) */}
   {selectedCustomer.photoUrl && !detailAvatarError ? (
     <div className="hidden sm:block p-[2px] rounded-full contact-avatar-ring shrink-0 mt-0.5">
       <img
         src={selectedCustomer.photoUrl}
         alt={selectedCustomer.name}
         decoding="async"
         onError={() => setDetailAvatarError(true)}
         className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover block"
         draggable={false}
       />
     </div>
   ) : (
     <div className={`hidden sm:flex w-12 h-12 sm:w-14 sm:h-14 rounded-full items-center justify-center font-display font-bold text-base sm:text-lg shrink-0 mt-0.5 ${
       selectedCustomer.outstandingDue > 0
         ? 'bg-ledger-red-subtle text-ledger-red'
         : selectedCustomer.outstandingDue < 0
         ? 'bg-ledger-green-subtle text-ledger-green'
         : 'bg-slate-900/[0.06] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300'
     }`}>
       {selectedCustomer.name
         .split(' ')
         .map(n => n[0])
         .filter(Boolean)
         .slice(0, 2)
         .join('')
         .toUpperCase() || 'C'}
     </div>
   )}
   <div className="min-w-0 flex-1">
     <div className="flex items-center gap-2.5 pr-28">
       {selectedCustomer.photoUrl && !detailAvatarError && (
         <div className="sm:hidden p-[1.5px] rounded-full contact-avatar-ring shrink-0">
           <img
             src={selectedCustomer.photoUrl}
             alt={selectedCustomer.name}
             decoding="async"
             onError={() => setDetailAvatarError(true)}
             className="w-8 h-8 rounded-full object-cover block"
             draggable={false}
           />
         </div>
       )}
       <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white truncate">{selectedCustomer.name}</h2>
     </div>
 {selectedCustomer.phone ? (
 <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-2 font-mono whitespace-nowrap">
 <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0 stroke-[1.5]" />
 <span>{cleanBangladeshiPhone(selectedCustomer.phone)}</span>
 <a 
 href={`tel:${cleanBangladeshiPhone(selectedCustomer.phone)}`}
 onClick={() => triggerHaptic('single')}
 className="ml-1.5 text-[11px] font-sans font-bold bg-slate-100/90 hover:bg-slate-200/80 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] px-3 py-0.5 rounded-full border border-slate-200/70 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 inline-flex items-center whitespace-nowrap shrink-0 cursor-pointer transition-colors touch-press"
 >
 {lang === 'bn' ? 'কল করুন' : 'Call Now'}
 </a>
 </p>
 ) : (
 <button
 type="button"
 onClick={() => handlePickContact(async (pickedPhone) => {
   try {
     await updateCustomerDetails(selectedCustomer.id, selectedCustomer.name, pickedPhone, {
       accountType: selectedCustomer.accountType,
       billingDay: selectedCustomer.billingDay
     });
     triggerHaptic('single');
     toast.success(lang === 'bn' ? 'মোবাইল নম্বর স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়েছে' : 'Phone number saved automatically');
   } catch (e) {
     toast.error(lang === 'bn' ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save phone number');
   }
 })}
 className="mt-2 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer"
 >
 <Phone className="w-3.5 h-3.5 stroke-[1.25]" />
 <span>{lang === 'bn' ? '+ মোবাইল নম্বর যুক্ত করুন' : '+ Add phone number'}</span>
 </button>
 )}

 {/* Single-line Billing Date underneath the Phone Number matching Phone Number styling */}
 {selectedCustomer.accountType === 'credit_card' && creditCardCycleData && (
   <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1.5 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
     <Calendar className="w-3.5 h-3.5 text-ledger-green shrink-0 stroke-[1.5]" />
     <span className="truncate text-[12px]">
       {creditCardCycleData.isBillingDayToday
         ? (lang === 'bn'
             ? `আজ বিলিং দিন (${creditCardCycleData.lastStatementDate.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })})`
             : `Billing Day Today (${creditCardCycleData.lastStatementDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`)
         : (lang === 'bn'
             ? `বিলিং তারিখ: ${creditCardCycleData.nextStatementDate.toLocaleDateString('bn-BD', { month: 'long', day: 'numeric' })} (${formatNumber(creditCardCycleData.daysUntilNextStatement, 'bn')} দিন পর)`
             : `Billing Date: ${creditCardCycleData.nextStatementDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (in ${creditCardCycleData.daysUntilNextStatement}d)`)}
     </span>
   </p>
 )}
 </div>
 </motion.div>
 )}
 </div>
 {/* CURRENT BALANCE CARD + SUBTLE LEFT ELLIPSIS TOGGLE FOR TOTAL BILLED & TOTAL PAID */}
 <div className="pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-3 relative z-10">
   {/* Neutral Total Outstanding Box */}
   <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-white/[0.08] surface-subcard flex flex-col gap-1.5">
     <div className="flex items-center justify-between gap-3">
       {/* Subtle Circle-Ellipsis Button on the left */}
       <button
         type="button"
         onClick={() => {
           triggerHaptic('single');
           setShowExtraBalanceCards(prev => !prev);
         }}
         className={`w-9 h-9 rounded-full transition-colors cursor-pointer shrink-0 flex items-center justify-center touch-press ${
           showExtraBalanceCards
             ? 'text-slate-950 dark:text-white bg-slate-200/80 dark:bg-white/[0.12]'
             : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/[0.08]'
         }`}
         title={showExtraBalanceCards ? (lang === 'bn' ? 'মোট বিবরণ লুকান' : 'Hide totals') : (lang === 'bn' ? 'মোট বকেয়া ও আদায় দেখুন' : 'Show Total Billed & Total Paid')}
         aria-expanded={showExtraBalanceCards}
         aria-label={showExtraBalanceCards ? (lang === 'bn' ? 'মোট বিবরণ লুকান' : 'Hide totals') : (lang === 'bn' ? 'মোট বকেয়া ও আদায় দেখুন' : 'Show Total Billed & Total Paid')}
       >
         <CircleEllipsis className="w-4.5 h-4.5 stroke-[1.25]" />
       </button>

       <div className="space-y-1.5 min-w-0 flex-1 text-right">
         <span className={`block ${lang === 'bn' ? 'text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label text-slate-500 dark:text-slate-400 font-bold'}`}>
           {selectedCustomer.accountType === 'credit_card'
             ? (lang === 'bn' ? 'মোট বকেয়া কার্ড ব্যালেন্স' : 'Total Outstanding Card Balance')
             : lang === 'bn'
               ? (selectedCustomer.outstandingDue > 0
                   ? 'বর্তমান ব্যালেন্স (বকেয়া)'
                   : selectedCustomer.outstandingDue < 0
                   ? 'বর্তমান ব্যালেন্স (অগ্রিম)'
                   : t.currentBalance)
               : t.currentBalance}
         </span>
         <div className={`font-display text-3xl sm:text-4xl leading-none font-black tabular-nums tracking-tight ${
           selectedCustomer.outstandingDue > 0
             ? 'text-ledger-red'
             : selectedCustomer.outstandingDue < 0
             ? 'text-ledger-green'
             : 'text-slate-500 dark:text-slate-400'
         }`}>
           {selectedCustomer.outstandingDue === 0
             ? `৳ ${lang === 'bn' ? '০ (পরিশোধিত)' : '0 (Settled)'}`
             : `${selectedCustomer.outstandingDue < 0 ? '-' : ''}৳ ${formatNumber(Math.abs(selectedCustomer.outstandingDue), lang)}`}
         </div>
       </div>
     </div>

     <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium leading-snug text-right whitespace-nowrap truncate">
       {selectedCustomer.accountType === 'credit_card' ? (
         selectedCustomer.outstandingDue > 0
           ? (creditCardCycleData && creditCardCycleData.unpaidCarryOver > 0
               ? (lang === 'bn'
                   ? `${creditCardCycleData.lastStatementDate.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })}-এ বিল্ড হওয়া ৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'bn')} অন্তর্ভুক্ত`
                   : `Includes ৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'en')} moved to Billed on ${creditCardCycleData.lastStatementDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
               : (lang === 'bn'
                   ? `${creditCardCycleData ? creditCardCycleData.nextStatementDate.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' }) : ''}-এর আগে আনবিল্ড (বিলিং দিনে বিল্ড হবে)`
                   : `Unbilled before ${creditCardCycleData ? creditCardCycleData.nextStatementDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'billing date'} (bills on billing day)`))
           : selectedCustomer.outstandingDue < 0
           ? (lang === 'bn' ? 'কার্ডে অতিরিক্ত ক্রেডিট ব্যালেন্স আছে' : 'Extra credit balance on card')
           : (lang === 'bn' ? 'সব কার্ড বিল পরিশোধিত' : 'All card bills settled')
       ) : (
         selectedCustomer.outstandingDue > 0 
           ? t.customerOwes 
           : selectedCustomer.outstandingDue < 0 
           ? t.youOweCustomer 
           : t.allClear
       )}
     </p>
   </div>

   {/* Expanded Telemetry Panel: Lifetime Total Billed & Total Paid */}
   <AnimatePresence>
     {showExtraBalanceCards && (() => {
       const billedAmt = selectedCustomerMetrics.totalBilled || 0;
       const paidAmt = selectedCustomerMetrics.totalPaid || 0;
       const totalVolume = billedAmt + paidAmt;
       const billedPct = totalVolume > 0 ? Math.round((billedAmt / totalVolume) * 100) : 50;
       const paidPct = totalVolume > 0 ? 100 - billedPct : 50;
       const recoveryPct = billedAmt > 0 ? Math.min(100, Math.round((paidAmt / billedAmt) * 100)) : (paidAmt > 0 ? 100 : 0);

       return (
         <motion.div
           initial={{ opacity: 0, y: -6, scale: 0.985 }}
           animate={{ opacity: 1, y: 0, scale: 1 }}
           exit={{ opacity: 0, y: -6, scale: 0.985 }}
           transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
           className="surface-glass rounded-[22px] p-3.5 sm:p-4 border border-slate-900/[0.08] dark:border-white/[0.1] space-y-3.5 overflow-hidden"
         >
           <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
             {/* Total Billed Sub-Card */}
             <div className="relative overflow-hidden surface-subcard rounded-[18px] p-3.5 sm:p-4 border border-slate-900/[0.06] dark:border-white/[0.08] flex flex-col justify-between gap-2.5 min-w-0">
               <div
                 aria-hidden="true"
                 className="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-50"
                 style={{ backgroundColor: 'var(--ledger-red-bg)' }}
               />
               <div className="relative z-10 flex items-center justify-between gap-1.5">
                 <span className={`truncate ${
                   lang === 'bn' ? 'text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label !text-[10px] text-slate-500 dark:text-slate-400 font-semibold'
                 }`}>
                   {selectedCustomer.accountType === 'credit_card'
                     ? (lang === 'bn' ? 'মোট কার্ড খরচ' : 'Card Spend')
                     : (lang === 'bn' ? 'মোট বিলকৃত' : 'Total Billed')}
                 </span>
                 <ArrowUpRight className="w-3.5 h-3.5 stroke-[1.25] text-ledger-red shrink-0" />
               </div>

               <div className="relative z-10 space-y-1 min-w-0">
                 <div className="font-display text-lg sm:text-2xl font-extrabold text-ledger-red tabular-nums tracking-tight truncate">
                   ৳{formatNumber(billedAmt, lang)}
                 </div>
                 <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                   {formatNumber(selectedCustomerMetrics.txCount, lang)} {lang === 'bn' ? 'টি খতিয়ান এন্ট্রি' : 'ledger entries'}
                 </p>
               </div>
             </div>

             {/* Total Paid Sub-Card */}
             <div className="relative overflow-hidden surface-subcard rounded-[18px] p-3.5 sm:p-4 border border-slate-900/[0.06] dark:border-white/[0.08] flex flex-col justify-between gap-2.5 min-w-0">
               <div
                 aria-hidden="true"
                 className="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-55"
                 style={{ backgroundColor: 'var(--ledger-green-bg)' }}
               />
               <div className="relative z-10 flex items-center justify-between gap-1.5">
                 <span className={`truncate ${
                   lang === 'bn' ? 'text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label !text-[10px] text-slate-500 dark:text-slate-400 font-semibold'
                 }`}>
                   {selectedCustomer.accountType === 'credit_card'
                     ? (lang === 'bn' ? 'বিল পরিশোধ' : 'Bill Paid')
                     : (lang === 'bn' ? 'মোট আদায়' : 'Total Paid')}
                 </span>
                 <ArrowDownLeft className="w-3.5 h-3.5 stroke-[1.25] text-ledger-green shrink-0" />
               </div>

               <div className="relative z-10 space-y-1 min-w-0">
                 <div className="font-display text-lg sm:text-2xl font-extrabold text-ledger-green tabular-nums tracking-tight truncate">
                   ৳{formatNumber(paidAmt, lang)}
                 </div>
                 <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                   {selectedCustomer.accountType === 'credit_card'
                     ? (lang === 'bn' ? 'রেকর্ডকৃত বিল নিষ্পত্তি' : 'Recorded settlements')
                     : (lang === 'bn' ? 'যাচাইকৃত আদায়' : 'Verified inflow')}
                 </p>
               </div>
             </div>
           </div>

           {/* Proportional Billed vs Paid Recovery Telemetry Bar */}
           <div className="pt-2.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-2">
             <div className="flex items-center justify-between text-[10.5px] font-mono font-semibold tabular-nums">
               <span className="text-ledger-red">
                 {lang === 'bn' ? 'বাকি' : 'Billed'} {formatNumber(billedPct, lang)}%
               </span>
               <span className="text-slate-500 dark:text-slate-400">
                 {formatNumber(recoveryPct, lang)}% {lang === 'bn' ? 'আদায় হার' : 'settled'}
               </span>
               <span className="text-ledger-green">
                 {lang === 'bn' ? 'আদায়' : 'Paid'} {formatNumber(paidPct, lang)}%
               </span>
             </div>
             <div className="h-3.5 w-full rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-center gap-[1.5px] overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
               {billedPct > 0 && (
                 <div
                   className="h-full rounded-full relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dash-anim-bar-x"
                   style={{
                     width: `${billedPct}%`,
                     background: 'linear-gradient(90deg, rgba(253, 164, 175, 0.90) 0%, rgba(244, 63, 94, 0.84) 48%, rgba(190, 18, 60, 0.72) 100%)',
                     boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                   }}
                 >
                   <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                 </div>
               )}
               {paidPct > 0 && (
                 <div
                   className="h-full rounded-full relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dash-anim-bar-x"
                   style={{
                     width: `${paidPct}%`,
                     background: 'linear-gradient(90deg, rgba(110, 231, 183, 0.88) 0%, rgba(16, 185, 129, 0.82) 52%, rgba(13, 148, 136, 0.70) 100%)',
                     boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                   }}
                 >
                   <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                 </div>
               )}
             </div>
           </div>
         </motion.div>
       );
     })()}
   </AnimatePresence>
 </div>

 {/* Quick message template picker card */}
 {selectedCustomer.phone && selectedCustomer.outstandingDue > 0 && (
  <details className="surface-subcard px-4 py-3 open:pb-4 rounded-2xl border border-slate-200/70 dark:border-white/[0.08] transition-colors relative z-10 group [&_summary::-webkit-details-marker]:hidden">
    <summary
      onClick={() => triggerHaptic('single')}
      className={`flex items-center justify-between cursor-pointer list-none select-none leading-none ${lang === 'bn' ? 'text-xs font-bold text-slate-700 dark:text-slate-200 tracking-normal' : 'micro-mono-label text-slate-600 dark:text-slate-300 font-bold'}`}
    >
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[1.5]" />
        <span>{t.predefinedMessages}</span>
      </div>
      <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform group-open:-rotate-180 shrink-0 stroke-[1.5]" />
    </summary>
    <div className="mt-3 pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('single');
            setSelectedTemplate(1);
          }}
          className={`p-2.5 text-left rounded-2xl text-xs font-bold transition-all cursor-pointer touch-press ${
            selectedTemplate === 1
              ? 'bg-emerald-600 border-2 border-emerald-500 text-white shadow-xs'
              : 'border bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.08]'
          }`}
        >
          {t.templatePolite}
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('single');
            setSelectedTemplate(2);
          }}
          className={`p-2.5 text-left rounded-2xl text-xs font-bold transition-all cursor-pointer touch-press ${
            selectedTemplate === 2
              ? 'bg-emerald-600 border-2 border-emerald-500 text-white shadow-xs'
              : 'border bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.08]'
          }`}
        >
          {t.templateRespect}
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('single');
            setSelectedTemplate(3);
          }}
          className={`p-2.5 text-left rounded-2xl text-xs font-bold transition-all cursor-pointer touch-press ${
            selectedTemplate === 3
              ? 'bg-emerald-600 border-2 border-emerald-500 text-white shadow-xs'
              : 'border bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.08]'
          }`}
        >
          {t.templateFormal}
        </button>
      </div>
      
      {/* Live Message Preview */}
      <div className="bg-white/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] p-3.5 rounded-2xl text-xs italic text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
        "{getMessageText(selectedCustomer, selectedTemplate)}"
      </div>
    </div>
  </details>
 )}

 {/* SEND REMINDERS / ACTIONS */}
 <div className="!mt-3 pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex flex-wrap gap-2.5 relative z-10">
 {selectedCustomer.phone && selectedCustomer.outstandingDue > 0 && (
 <>
 <a
 href={getShareLink(selectedCustomer, 'whatsapp')}
 target="_blank"
 rel="noreferrer"
 onClick={() => triggerHaptic('single')}
 className="w-full basis-full sm:w-auto sm:basis-auto sm:flex-1 sm:min-w-[150px] py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba59] font-bold text-white rounded-full shadow-xs flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm transition-all touch-press"
 >
 <MessageCircleMore className="w-4 h-4 shrink-0 stroke-[1.5]" />
 <span>{t.remindWhatsApp}</span>
 </a>

 <a
 href={getShareLink(selectedCustomer, 'sms')}
 onClick={() => triggerHaptic('single')}
 className="flex-1 min-w-[140px] py-2.5 px-4 bg-blue-600 hover:bg-blue-700 font-bold text-white rounded-full shadow-xs flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm transition-all touch-press"
 >
 <Send className="w-4 h-4 shrink-0 stroke-[1.5]" />
 <span>{t.sendSmsReminder}</span>
 </a>
 </>
 )}
 
 {/* DELETE ACCOUNT BUTTON */}
 <button
   onClick={() => {
     triggerHaptic('double');
     handleDelete(selectedCustomer);
   }}
   className="py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center gap-2 cursor-pointer text-xs font-bold transition-all touch-press"
 >
 <Trash2 className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />
 <span>{t.deleteAccount}</span>
 </button>
 </div>
 </SpotlightCard>

 {/* TWO DUAL BIG DIRECT ENTRY CAPSULE CARDS */}
 <div className="grid grid-cols-2 gap-3 sm:gap-4">
 <button
 onClick={() => {
   setActionTargetCycle(cardCycleTab);
   setOpenActionType('due');
   setActionTag(null);
   setPaymentQuickFillIntent(null);
 }}
 className={`py-4 px-3 rounded-[24px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all touch-press shadow-xs ${
 openActionType === 'due' 
 ? 'bg-rose-600 border-2 border-rose-500 text-white font-black' 
 : 'border surface-glass-interactive border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold hover:border-rose-500/40'
 }`}
 >
 <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
   openActionType === 'due'
     ? 'bg-white/20 text-white'
     : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
 }`}>
   {selectedCustomer.accountType === 'credit_card' ? (
     <CreditCard className="w-4.5 h-4.5 stroke-[1.5]" />
   ) : (
     <ArrowUpRight className="w-4.5 h-4.5 stroke-[1.5]" />
   )}
 </div>
 <span className="font-extrabold text-xs sm:text-sm text-center leading-snug">
   + {selectedCustomer.accountType === 'credit_card'
       ? (lang === 'bn' ? 'কার্ড বিল যোগ' : 'Add Card Bill')
       : t.letThemBuy}
 </span>
 </button>

 <button
 onClick={() => {
   setActionTargetCycle('unbilled');
   setOpenActionType('payment');
   setActionTag(null);
   setPaymentQuickFillIntent(null);
 }}
 className={`py-4 px-3 rounded-[24px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all touch-press shadow-xs ${
 openActionType === 'payment' 
 ? 'bg-emerald-600 border-2 border-emerald-500 text-white font-black' 
 : 'border surface-glass-interactive border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold hover:border-emerald-500/40'
 }`}
 >
 <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
   openActionType === 'payment'
     ? 'bg-white/20 text-white'
     : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
 }`}>
   <ArrowDownLeft className="w-4.5 h-4.5 stroke-[1.5]" />
 </div>
 <span className="font-extrabold text-xs sm:text-sm text-center leading-snug">
   + {selectedCustomer.accountType === 'credit_card'
       ? (lang === 'bn' ? 'কার্ড বিল পরিশোধ' : 'Pay Card Bill')
       : t.gotCash}
 </span>
 </button>
 </div>

 {/* INLINE INJECT TRANSACTION MODIFIER FORM */}
 <AnimatePresence>
 {openActionType && (
 <motion.div
 initial={{ opacity: 0, scale: 0.97, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.97, y: 8 }}
 transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
 className="surface-glass border p-5 rounded-[28px] space-y-4"
 >
 <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-3">
 <h4 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
 {selectedCustomer.accountType === 'credit_card'
   ? (openActionType === 'due'
       ? (lang === 'bn' ? `${selectedCustomer.name}-এর জন্য কার্ড বিল লিখুন` : `Record Card Bill for ${selectedCustomer.name}`)
       : (lang === 'bn' ? `${selectedCustomer.name}-এর জন্য কার্ড বিল পরিশোধ লিখুন` : `Record Card Bill Payment for ${selectedCustomer.name}`))
   : (openActionType === 'due'
       ? (lang === 'bn' ? `${selectedCustomer.name}-এর জন্য নতুন বাকি লিখুন` : `Record New Due for ${selectedCustomer.name}`)
       : (lang === 'bn' ? `${selectedCustomer.name}-এর জন্য আদায়কৃত পেমেন্ট লিখুন` : `Record Received Payment for ${selectedCustomer.name}`))}
 </h4>
 <button
   type="button"
   onClick={() => {
     triggerHaptic('medium');
     setOpenActionType(null);
     setActionTag(null);
   }}
   className="w-8 h-8 bg-slate-100/80 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/70 dark:border-white/[0.08] rounded-full text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center justify-center touch-press"
 >
 <X className="w-4 h-4 stroke-[1.5]" />
 </button>
 </div>

 <form onSubmit={handleAddInlineTransaction} className="space-y-4">
 {/* Compact Inline Cycle Selector for Credit Card bill expenses */}
 {selectedCustomer.accountType === 'credit_card' && openActionType === 'due' && (
   <div className="flex items-center justify-between gap-2 px-1 py-0.5">
     <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
       {lang === 'bn' ? 'কোন বিলিং সাইকেলে যুক্ত করবেন?' : 'Add bill to which statement cycle?'}
     </span>
     <div className="flex items-center gap-1 p-0.5 rounded-full bg-slate-200/60 dark:bg-white/[0.06] shrink-0">
       <button
         type="button"
         onClick={() => setActionTargetCycle('unbilled')}
         className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
           actionTargetCycle === 'unbilled'
             ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-2xs font-bold'
             : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
         }`}
       >
         {lang === 'bn' ? 'আনবিল্ড' : 'Unbilled'}
       </button>
       <button
         type="button"
         onClick={() => setActionTargetCycle('billed')}
         className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
           actionTargetCycle === 'billed'
             ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-2xs font-bold'
             : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
         }`}
       >
         {lang === 'bn' ? 'বিল্ড' : 'Billed'}
       </button>
     </div>
   </div>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={lang === 'bn' ? 'text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label text-slate-500 dark:text-slate-400 font-bold'}>{t.amount} (৳) *</label>
 <input
 type="text"
 inputMode="decimal"
 data-numpad="true"
 placeholder="0"
 value={actionAmount}
 onChange={(e) => {
 setPaymentQuickFillIntent(null);
 const val = e.target.value;
 const clean = val.replace(/[^0-9.]/g, '');
 const dots = clean.split('.');
 let sanitized = clean;
 if (dots.length > 2) {
 sanitized = dots[0] + '.' + dots.slice(1).join('');
 }
 setActionAmount(formatIndianNumberString(sanitized));
 }}
 className="w-full px-4 py-3 bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.1] rounded-2xl text-slate-950 dark:text-white text-xl font-mono font-bold focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
 required
 autoFocus
 />

              {activeRealtimeDuplicate && (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-500 mt-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[1.25]" />
                  {t.duplicateRealtimeWarning}
                </p>
              )}

              {openActionType === 'payment' && selectedCustomer && selectedCustomer.accountType === 'credit_card' && creditCardCycleData && creditCardCycleData.unpaidCarryOver > 0 && (() => {
                const cleanedAmt = actionAmount.replace(/,/g, '');
                const targetBilled = creditCardCycleData.unpaidCarryOver;
                const billedStr = targetBilled.toString();
                const totalStr = selectedCustomer.outstandingDue.toString();
                const isChecked =
                  cleanedAmt === billedStr &&
                  (billedStr !== totalStr || paymentQuickFillIntent === 'billed');
                return (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      if (!isChecked) {
                        setPaymentQuickFillIntent('billed');
                        setActionAmount(formatIndianNumberString(billedStr));
                        if (!actionDesc.trim()) {
                          setActionDesc(lang === 'bn' ? 'পূর্ববর্তী মাসের বিল পরিশোধ' : 'Billed Statement Payment');
                        }
                      } else {
                        setPaymentQuickFillIntent(null);
                        setActionAmount('');
                      }
                    }}
                    className="w-full flex items-center text-left gap-2.5 mt-2 p-3 rounded-2xl surface-subcard hover:bg-slate-200/50 dark:hover:bg-white/[0.06] border-[1.5px] border-slate-300/85 dark:border-white/[0.16] cursor-pointer transition-colors select-none"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded-md border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-amber-500/70 bg-white/70 dark:bg-white/[0.05]'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </span>
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-200 select-none">
                      {lang === 'bn' ? 'পূর্ববর্তী মাসের বিল্ড বকেয়া পরিশোধ করুন' : "Pay billed (previous month's)"} (৳{formatNumber(targetBilled, lang)})
                    </span>
                  </button>
                );
              })()}

              {openActionType === 'payment' && selectedCustomer && selectedCustomer.outstandingDue > 0 && (() => {
                const cleanedAmt = actionAmount.replace(/,/g, '');
                const targetDue = selectedCustomer.outstandingDue;
                const totalStr = targetDue.toString();
                const billedStr = creditCardCycleData ? creditCardCycleData.unpaidCarryOver.toString() : '';
                const isChecked =
                  cleanedAmt === totalStr &&
                  (selectedCustomer.accountType !== 'credit_card' ||
                    billedStr !== totalStr ||
                    paymentQuickFillIntent !== 'billed');
                return (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      if (!isChecked) {
                        setPaymentQuickFillIntent('total');
                        setActionAmount(formatIndianNumberString(totalStr));
                      } else {
                        setPaymentQuickFillIntent(null);
                        setActionAmount('');
                      }
                    }}
                    className="w-full flex items-center text-left gap-2.5 mt-2 p-3 rounded-2xl surface-subcard hover:bg-slate-200/50 dark:hover:bg-white/[0.06] border-[1.5px] border-slate-300/85 dark:border-white/[0.16] cursor-pointer transition-colors select-none"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded-md border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-emerald-600/65 dark:border-emerald-400/65 bg-white/70 dark:bg-white/[0.05]'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 select-none">
                      {selectedCustomer.accountType === 'credit_card'
                        ? (lang === 'bn' ? 'মোট কার্ড ব্যালেন্স পরিশোধ করুন' : 'Pay total card balance')
                        : (lang === 'bn' ? 'সম্পূর্ণ বকেয়া পরিশোধ করুন' : 'Settle complete due')} (৳{formatNumber(targetDue, lang)})
                    </span>
                  </button>
                );
              })()}

 {/* Tap amount quick-add preset buttons */}
 <div className="flex flex-wrap gap-1.5 mt-2">
 {[50, 100, 500, 1000, 5000].map((preset) => (
 <button
 key={preset}
 type="button"
 onClick={() => {
 setPaymentQuickFillIntent(null);
 const cleaned = actionAmount.replace(/,/g, '');
 const currentVal = parseFloat(cleaned) || 0;
 const newVal = (currentVal + preset).toString();
 setActionAmount(formatIndianNumberString(newVal));
 }}
 className="bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/70 dark:border-white/[0.08] px-3 py-1 rounded-full text-xs font-mono font-bold text-slate-900 dark:text-slate-100 transition-colors cursor-pointer touch-press"
 >
 +৳{formatNumber(preset, lang)}
 </button>
 ))}
 <button
 key="clear"
 type="button"
 onClick={() => {
 setPaymentQuickFillIntent(null);
 setActionAmount('');
 }}
 className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer touch-press"
 >
 {lang === 'bn' ? 'মুছে ফেলুন' : 'Clear'}
 </button>
 </div>
 </div>

 {openActionType && (
   <TagPickerBar
     type={openActionType}
     selectedTag={actionTag}
     onSelectTag={(tag) => setActionTag(tag)}
     transactions={transactions}
     lang={lang}
   />
 )}

 <div className="space-y-1.5">
 <label className={lang === 'bn' ? 'text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label text-slate-500 dark:text-slate-400 font-bold'}>{t.notes}</label>
 <input
 type="text"
 placeholder={actionTag ? getTagDefaultDescription(actionTag, lang) : (selectedCustomer.accountType === 'credit_card'
   ? (openActionType === 'due'
       ? (lang === 'bn' ? 'যেমন: দারাজ শপিং, বিদ্যুৎ বিল, গ্রোসারি...' : 'e.g. Grocery, Electricity Bill, Online Shopping...')
       : (lang === 'bn' ? 'যেমন: বিকাশ / ব্যাংক ট্রান্সফার পেমেন্ট...' : 'e.g. Paid via Bank Transfer / bKash...'))
   : t.notesPlaceholder)}
 value={actionDesc}
 onChange={(e) => setActionDesc(e.target.value)}
 className="w-full px-4 py-3 bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.1] rounded-2xl text-slate-950 dark:text-white text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
 />
 </div>
 </div>

 <div className="flex justify-end items-center gap-2 pt-1">
 <button
 type="button"
 onClick={() => {
   setOpenActionType(null);
   setActionTag(null);
   setPaymentQuickFillIntent(null);
 }}
 className="px-5 py-2.5 text-xs bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] font-bold rounded-full cursor-pointer transition-colors touch-press"
 >
 {t.cancel}
 </button>
 <button
 type="submit"
 disabled={txSubmitting}
 className={`px-5 py-2.5 text-xs text-white font-bold rounded-full transition-all cursor-pointer shadow-xs touch-press ${
 openActionType === 'due' 
 ? 'bg-rose-600 hover:bg-rose-700' 
 : 'bg-emerald-600 hover:bg-emerald-700'
 } disabled:opacity-70 disabled:cursor-not-allowed`}
 >
 {txSubmitting ? (
 <span className="flex items-center gap-1.5">
 <LoadingSpinner size="xs" />
 {t.saving || (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')}
 </span>
 ) : (
 t.addToLedger
 )}
 </button>
 </div>
 </form>
 </motion.div>
 )}
 </AnimatePresence>

   {/* HISTORICAL LEDGER FOR THIS CUSTOMER */}
  <div id="statements_timeline" className="space-y-3.5">
    <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
      {selectedCustomer.accountType === 'credit_card' && creditCardCycleData ? (
        <div className="flex items-center gap-2">
          {/* Segmented Cycle Switcher Capsule (Clearly distinct from Tag Filter pills below) */}
          <div className="relative inline-grid grid-cols-2 p-1 rounded-full surface-subcard overflow-hidden border border-slate-200/75 dark:border-white/[0.08]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-slate-950 dark:bg-white shadow-xs will-change-transform transition-transform duration-200 ease-[cubic-bezier(0.22,1.12,0.36,1)]"
              style={{
                transform: `translate3d(${cardCycleTab === 'billed' ? '100%' : '0%'}, 0, 0)`
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (cardCycleTab !== 'unbilled') {
                  triggerHaptic('single');
                  setCardCycleTab('unbilled');
                }
              }}
              className={`relative z-10 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                cardCycleTab === 'unbilled'
                  ? 'text-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <span>{lang === 'bn' ? 'আনবিল্ড' : 'Unbilled'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                cardCycleTab === 'unbilled'
                  ? 'bg-white/20 dark:bg-slate-950/15'
                  : 'bg-slate-500/15'
              }`}>
                {formatNumber(creditCardCycleData.unbilledTxs.length, lang)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (cardCycleTab !== 'billed') {
                  triggerHaptic('single');
                  setCardCycleTab('billed');
                }
              }}
              className={`relative z-10 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                cardCycleTab === 'billed'
                  ? 'text-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <span>{lang === 'bn' ? 'বিল্ড' : 'Billed'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                cardCycleTab === 'billed'
                  ? 'bg-white/20 dark:bg-slate-950/15'
                  : 'bg-slate-500/15'
              }`}>
                {formatNumber(creditCardCycleData.billedTxs.length, lang)}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              setShowMonthlyCycle(prev => !prev);
            }}
            title={lang === 'bn' ? 'মাসিক কার্ড সাইকেল' : 'Monthly card cycle'}
            aria-label={lang === 'bn' ? 'মাসিক কার্ড সাইকেল' : 'Monthly card cycle'}
            aria-expanded={showMonthlyCycle}
            className={`w-9 h-9 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center touch-press ${
              showMonthlyCycle
                ? 'bg-slate-950 text-white border border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-xs'
                : 'border surface-glass-interactive border-slate-200/75 dark:border-white/[0.08] text-slate-600 dark:text-slate-400'
            }`}
          >
            <ListClockIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <span className={`block ${lang === 'bn' ? 'text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal' : 'micro-mono-label text-slate-500 dark:text-slate-400 font-bold'}`}>
          {t.statements} ({formatNumber(activeCustomerTxCount, lang)})
        </span>
      )}

      {/* Client Statement Tools / Minimal Icon + Text Merge Trigger */}
      {archiveCustomerExcessStatements && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic('single');
            openManageStatementsModal();
          }}
          className="inline-flex items-center gap-1.5 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white text-xs font-semibold cursor-pointer transition-colors touch-press"
        >
          <Archive className="w-3.5 h-3.5 stroke-[1.25]" />
          <span>{lang === 'bn' ? 'মার্জ' : 'Merge'}</span>
        </button>
      )}
    </div>

    {/* EXPANDABLE MONTHLY CARD CYCLE HISTORY CARDS (Toggled via list-clock icon button) */}
    <AnimatePresence>
      {selectedCustomer.accountType === 'credit_card' && creditCardCycleData && showMonthlyCycle && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="surface-subcard p-4 sm:p-5 rounded-[24px] border border-slate-200/70 dark:border-white/[0.08] space-y-4"
        >
            {/* Two-Card Comparison Grid: Unbilled (Before Billing Date) & Billed (Moved on Billing Day) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. UNBILLED CARD */}
              <div className="surface-glass p-4 rounded-2xl border flex flex-col justify-between gap-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold text-slate-900 dark:text-white px-2.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/[0.08] ${lang === 'bn' ? 'tracking-normal' : 'font-mono uppercase tracking-wider'}`}>
                      {lang === 'bn' ? 'আনবিল্ড • চলতি সাইকেল' : 'Unbilled • Open Cycle'}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                      {creditCardCycleData.lastStatementDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {creditCardCycleData.thisMonthEndDisplay.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="pt-1 flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-ledger-red tabular-nums">
                        ৳ {formatNumber(creditCardCycleData.thisMonthSpend, lang)}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {lang === 'bn'
                          ? `${creditCardCycleData.nextStatementDate.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })}-এর আগে করা লেনদেন (বিলিং দিনে বিল্ড হবে)`
                          : `Before ${creditCardCycleData.nextStatementDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · moves to Billed on billing day`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                        {formatNumber(creditCardCycleData.unbilledTxs.length, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Carry-Over Indicator inside Open Cycle */}
                {creditCardCycleData.unpaidCarryOver > 0 ? (
                  <div className="mt-1 pt-2.5 border-t border-amber-500/20 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <span>{lang === 'bn' ? '+ পূর্বের বিল্ড বকেয়া জের:' : '+ Unpaid billed balance:'}</span>
                      <span className="font-mono">৳ {formatNumber(creditCardCycleData.unpaidCarryOver, lang)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-950 dark:text-white">
                      <span>{lang === 'bn' ? 'মোট পরিশোধযোগ্য:' : 'Total Payable Now:'}</span>
                      <span className="font-mono text-ledger-red">
                        ৳ {formatNumber(creditCardCycleData.totalPayableWithCarryOver, lang)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 pt-2.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>{lang === 'bn' ? 'পূর্বের কোনো বিল্ড বকেয়া জের নেই' : 'No unpaid billed carry-over'}</span>
                    <Check className="w-3.5 h-3.5 text-ledger-green shrink-0 stroke-[1.5]" />
                  </div>
                )}
              </div>

              {/* 2. BILLED CARD */}
              <div className="surface-glass p-4 rounded-2xl border flex flex-col justify-between gap-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold text-slate-700 dark:text-slate-200 px-2.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/[0.08] ${lang === 'bn' ? 'tracking-normal' : 'font-mono uppercase tracking-wider'}`}>
                      {lang === 'bn' ? 'বিল্ড • ক্লোজড স্টেটমেন্ট' : 'Billed • Statement Closed'}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                      {creditCardCycleData.lastStatementDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="pt-1 flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                        ৳ {formatNumber(creditCardCycleData.billedStatementAmount > 0 ? creditCardCycleData.billedStatementAmount : creditCardCycleData.lastMonthCycleSpend, lang)}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {lang === 'bn'
                          ? `${creditCardCycleData.lastStatementDate.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })} বিলিং দিনে বিল্ড-এ স্থানান্তরিত`
                          : `Moved into Billed on ${creditCardCycleData.lastStatementDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                        {formatNumber(creditCardCycleData.billedTxs.length, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statement Settlement Status */}
                <div className="mt-1 pt-2.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-1">
                  {creditCardCycleData.billedStatementAmount === 0 && creditCardCycleData.lastMonthCycleSpend === 0 ? (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>{lang === 'bn' ? 'কোনো বিল্ড বকেয়া ছিল না' : 'No billed statement due'}</span>
                      <Check className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[1.5]" />
                    </div>
                  ) : creditCardCycleData.unpaidCarryOver === 0 ? (
                    <div className="flex items-center justify-between text-[11px] font-bold text-ledger-green">
                      <span>{lang === 'bn' ? 'বিল্ড স্টেটমেন্ট সম্পূর্ণ পরিশোধিত' : 'Billed statement paid in full'}</span>
                      <Check className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <span>
                        {lang === 'bn'
                          ? `অপরিশোধিত বিল্ড বকেয়া ৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'bn')}`
                          : `৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'en')} unpaid billed due remaining`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Billing Cycle Rule Notice & Spend Comparison */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 stroke-[1.25]" />
                <div className="space-y-0.5">
                  <div>
                    {creditCardCycleData.lastMonthCycleSpend === 0 ? (
                      <span>
                        {lang === 'bn'
                          ? `চলতি আনবিল্ড সাইকেলে মোট খরচ ৳${formatNumber(creditCardCycleData.thisMonthSpend, 'bn')}`
                          : `৳${formatNumber(creditCardCycleData.thisMonthSpend, 'en')} in unbilled charges before next billing date`}
                      </span>
                    ) : creditCardCycleData.thisMonthSpend > creditCardCycleData.lastMonthCycleSpend ? (
                      <span>
                        {lang === 'bn'
                          ? `গত সাইকেলের তুলনায় এবার ৳${formatNumber(creditCardCycleData.thisMonthSpend - creditCardCycleData.lastMonthCycleSpend, 'bn')} বেশি আনবিল্ড খরচ`
                          : `৳${formatNumber(creditCardCycleData.thisMonthSpend - creditCardCycleData.lastMonthCycleSpend, 'en')} more unbilled vs last cycle`}
                      </span>
                    ) : creditCardCycleData.thisMonthSpend < creditCardCycleData.lastMonthCycleSpend ? (
                      <span>
                        {lang === 'bn'
                          ? `গত সাইকেলের তুলনায় এবার ৳${formatNumber(creditCardCycleData.lastMonthCycleSpend - creditCardCycleData.thisMonthSpend, 'bn')} কম আনবিল্ড খরচ`
                          : `৳${formatNumber(creditCardCycleData.lastMonthCycleSpend - creditCardCycleData.thisMonthSpend, 'en')} less unbilled vs last cycle`}
                      </span>
                    ) : (
                      <span>
                        {lang === 'bn'
                          ? 'চলতি ও গত সাইকেলের খরচের পরিমাণ সমান'
                          : 'Unbilled spending matches last closed cycle'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? `বিলিং তারিখ (${formatNumber(creditCardCycleData.billingDay, 'bn')} তারিখ)-এর আগের লেনদেন আনবিল্ড থাকে এবং বিলিং দিনে স্বয়ংক্রিয়ভাবে বিল্ড-এ চলে যায়।`
                      : `Transactions before the billing date stay Unbilled and move into Billed automatically on day ${creditCardCycleData.billingDay}.`}
                  </div>
                </div>
              </div>

              {/* 1-Tap Quick Settle Action Button */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {creditCardCycleData.unpaidCarryOver > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      setOpenActionType('payment');
                      setActionAmount(formatIndianNumberString(creditCardCycleData.unpaidCarryOver.toString()));
                      setActionDesc(lang === 'bn' ? 'বিল্ড স্টেটমেন্ট পরিশোধ' : 'Billed Statement Payment');
                    }}
                    className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs cursor-pointer transition-all shadow-xs touch-press"
                  >
                    {lang === 'bn'
                      ? `বিল্ড বকেয়া পরিশোধ (৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'bn')})`
                      : `Pay Billed Due (৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'en')})`}
                  </button>
                )}
              </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>

    <div className="surface-glass border rounded-[28px] overflow-hidden">
      {/* Integrated Ledger Tag Filter Strip (scoped inside the ledger card header; supports PC wheel & drag scroll) */}
      {(availableLedgerTags.length > 0 || ledgerTagFilter) && (
        <div className="relative px-3.5 sm:px-4 py-2.5 border-b border-slate-900/[0.06] dark:border-white/[0.06] bg-slate-900/[0.015] dark:bg-white/[0.02]">
          {ledgerTagEdges.left && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Scroll tag filters left"
              onClick={() => scrollLedgerTagsByStep(-1)}
              className="hidden sm:flex absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full surface-glass-interactive border items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}

          <div
            ref={ledgerTagScrollRef}
            {...ledgerTagScrollHandlers}
            className={`flex items-center gap-1.5 overflow-x-auto hide-scrollbar select-none whitespace-nowrap ${
              isDraggingLedgerTags ? 'cursor-grabbing' : 'sm:cursor-grab'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic('level3');
                setLedgerTagFilter(null);
              }}
              className={`touch-press shrink-0 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors duration-150 ${
                !ledgerTagFilter
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                  : 'surface-subcard border text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {lang === 'bn' ? 'সব লেনদেন' : 'All Tags'}
            </button>

            {availableLedgerTags.map((tagId) => {
              const meta = getTagMeta(tagId);
              if (!meta) return null;
              const isSelected = ledgerTagFilter === tagId;
              return (
                <button
                  key={tagId}
                  type="button"
                  onClick={() => {
                    triggerHaptic('level3');
                    setLedgerTagFilter(isSelected ? null : tagId);
                  }}
                  className={`touch-press shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors duration-150 ${
                    isSelected
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xs ring-1 ring-slate-950 dark:ring-white font-bold'
                      : 'surface-subcard border text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <TagIcon tag={tagId} className="w-3.5 h-3.5 stroke-[1.5]" style={{ color: isSelected ? undefined : meta.color }} />
                  <span>{lang === 'bn' ? meta.bn : meta.en}</span>
                </button>
              );
            })}
          </div>

          {ledgerTagEdges.right && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Scroll tag filters right"
              onClick={() => scrollLedgerTagsByStep(1)}
              className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full surface-glass-interactive border items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>
      )}

      {groupedTransactions.length === 0 ? (
        <div className="p-10 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
          <ReceiptText className="w-10 h-10 stroke-[1.25]" />
          <p className="font-bold text-slate-800 dark:text-slate-200">
            {selectedCustomer.accountType === 'credit_card'
              ? (cardCycleTab === 'unbilled'
                  ? (lang === 'bn' ? 'বিলিং তারিখের আগে কোনো আনবিল্ড লেনদেন নেই' : 'No unbilled transactions before billing date')
                  : (lang === 'bn' ? 'এখনো কোনো বিল্ড লেনদেন নেই' : 'No billed transactions moved into statement yet'))
              : t.noHistory}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {selectedCustomer.accountType === 'credit_card'
              ? (lang === 'bn' ? 'উপরের বাটন চেপে কার্ড বিল বা পরিশোধ যোগ করুন' : 'Use the buttons above to log card spend or bill payments')
              : t.duesVisibleHere}
          </p>
        </div>
      ) : (() => {
        const isStandardLedger = selectedCustomer.accountType !== 'credit_card';
        const activeLimit = ledgerTagFilter ? tagFilterLimit : customerTxLimit;
        const showMoreVisible = isStandardLedger && filteredTotalCount > Math.max(5, displayedCount);
        const showLessVisible = isStandardLedger && displayedCount > 5 && activeLimit > 5;
        const hasLedgerFooter = showMoreVisible || showLessVisible;

        return (
        <>
          <div className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] transition-none">
            {groupedTransactions.map((group, groupIdx) => (
              <div key={group.dateStr} className="flex flex-col">
                {/* Date or Tag Header Indicator */}
                <div className="px-4 sm:px-5 py-2.5 bg-slate-900/[0.025] dark:bg-white/[0.03] border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between transition-none">
                  <span className={`text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'uppercase tracking-wider'}`}>
                    {group.isTagGroup ? (
                      <span className="flex items-center gap-1.5 normal-case font-sans font-bold text-slate-700 dark:text-slate-200">
                        <TagIcon tag={group.tagKey !== 'untagged' ? group.tagKey : undefined} type="due" className="w-3.5 h-3.5 stroke-[1.5]" />
                        <span>{group.label}</span>
                      </span>
                    ) : (
                      (lang === 'bn' ? LEDGER_DATE_FMT_BN : LEDGER_DATE_FMT_EN).format(group.dateObj)
                    )}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                    {formatNumber(group.items.length, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                  </span>
                </div>
                
                {/* Grouped Transactions List */}
                <div className="flex flex-col divide-y divide-slate-900/[0.05] dark:divide-white/[0.05] transition-none">
                  {group.items.map((tx: Transaction, itemIdx: number) => {
                    const isVeryLastVisibleRow =
                      !hasLedgerFooter &&
                      groupIdx === groupedTransactions.length - 1 &&
                      itemIdx === group.items.length - 1;
                    return (
                    <div 
                      key={tx.id} 
                      id={`tx-row-${tx.id}`}
                      className={`p-4 sm:px-5 flex flex-col hover:bg-slate-900/[0.02] dark:hover:bg-white/[0.02] transition-[background-color,box-shadow] duration-150 group cursor-default ${
                        isVeryLastVisibleRow ? 'rounded-b-[27px]' : ''
                      } ${
                        highlightedTxId === tx.id 
                          ? 'ring-2 ring-inset ring-amber-500/80 dark:ring-amber-400/80 bg-amber-500/10' 
                          : recentlyEditedTxId === tx.id
                          ? 'ring-2 ring-inset ring-emerald-500 dark:ring-emerald-400 bg-emerald-500/10'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            tx.type === 'due' 
                              ? 'bg-ledger-red-subtle text-ledger-red' 
                              : 'bg-ledger-green-subtle text-ledger-green'
                          }`}>
                            <TagIcon tag={tx.tag} type={tx.type} className="w-4 h-4 stroke-[1.5]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {tx.description || (tx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                            </div>
                            <div className={`text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap ${lang === 'bn' ? 'tracking-normal' : 'uppercase'}`}>
                              <span className="font-mono">{(lang === 'bn' ? LEDGER_TIME_FMT_BN : LEDGER_TIME_FMT_EN).format(parseFirestoreDate(tx.date))}</span>
                              {(tx.isEdited || recentlyEditedTxId === tx.id || (tx.auditHistory && tx.auditHistory.length > 0)) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic('single');
                                    openAuditLogModal(tx);
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 hover:bg-slate-500/20 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-600 dark:text-slate-300 normal-case tracking-normal leading-none cursor-pointer transition-colors"
                                  title={lang === 'bn' ? 'সম্পাদনার ইতিহাস দেখুন' : 'View edit audit history'}
                                >
                                  <History className="w-2.5 h-2.5 stroke-[1.5]" />
                                  <span>{lang === 'bn' ? 'সম্পাদিত' : 'Edited'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end shrink-0">
                          <div className={`text-base sm:text-lg font-black font-mono tabular-nums ${
                            tx.type === 'due' ? 'text-ledger-red' : 'text-ledger-green'
                          }`}>
                            {tx.type === 'due' ? '+' : '-'} ৳{formatNumber(tx.amount, lang)}
                          </div>
                          <div className="flex items-center gap-1 mt-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('single');
                                openEditTxModal(tx);
                              }}
                              className="w-7 h-7 rounded-full text-slate-400 hover:text-ledger-green hover:bg-slate-200/60 dark:hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors"
                              title={lang === 'bn' ? 'পরিবর্তন' : 'Edit'}
                            >
                              <Pencil className="w-3.5 h-3.5 stroke-[1.25]" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('double');
                                openDeleteTxModal(tx);
                              }}
                              className="w-7 h-7 rounded-full text-slate-400 hover:text-ledger-red hover:bg-slate-200/60 dark:hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors"
                              title={lang === 'bn' ? 'মুছুন' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5 stroke-[1.25]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hasLedgerFooter && (
            <div className="p-3.5 text-center flex justify-center gap-2.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-slate-900/[0.015] dark:bg-white/[0.015]">
              {showMoreVisible && (
                <button 
                  type="button"
                  onClick={() => {
                    triggerHaptic('single');
                    if (ledgerTagFilter) {
                      setTagFilterLimit((prev) => prev + 10);
                    } else {
                      loadMoreTransactions();
                    }
                  }}
                  className="surface-glass-interactive flex items-center justify-center gap-1.5 px-5 py-2 border border-slate-200/80 dark:border-white/[0.1] text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full shadow-2xs touch-press transition-all cursor-pointer"
                >
                  <span>{lang === 'bn' ? 'আরও দেখুন' : 'Show More'}</span>
                  <ChevronDown className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              )}
              {showLessVisible && (
                <button 
                  type="button"
                  onClick={() => {
                    triggerHaptic('single');
                    if (ledgerTagFilter) {
                      setTagFilterLimit(5);
                    } else {
                      resetCustomerTxLimit();
                    }
                  }}
                  className="surface-glass-interactive flex items-center justify-center gap-1.5 px-5 py-2 border border-slate-200/80 dark:border-white/[0.1] text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full shadow-2xs touch-press transition-all cursor-pointer"
                >
                  <span>{lang === 'bn' ? 'কম দেখুন' : 'Show Less'}</span>
                  <ChevronUp className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              )}
            </div>
          )}
        </>
        );
      })()}
    </div>

    {/* ARCHIVED STATEMENTS STORED ON THIS CUSTOMER'S PROFILE */}
    {(() => {
      if (activeCustomerArchives.length === 0) return null;
      const totalArchivedTxCount = activeCustomerArchives.reduce(
        (sum: number, a: any) => sum + (typeof a.entriesCount === 'number' ? a.entriesCount : 1),
        0
      );

      return (
        <div className="surface-glass border rounded-[28px] p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-slate-100/80 dark:bg-white/[0.06] border border-slate-200/70 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                <Archive className="w-4 h-4 text-slate-600 dark:text-slate-300 stroke-[1.25]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white truncate">
                  {lang === 'bn' ? 'আর্কাইভকৃত পুরনো স্টেটমেন্ট' : 'Archived Profile Statements'}
                </h4>
                <p className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {formatNumber(totalArchivedTxCount, lang)} {lang === 'bn' ? 'টি সংরক্ষিত এন্ট্রি' : 'archived entries'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                triggerHaptic('single');
                try {
                  let records: any[] = [];
                  if (exportArchivedStatements) {
                    const res = await exportArchivedStatements(selectedCustomer.id);
                    if (Array.isArray(res) && res.length > 0) {
                      records = res;
                    }
                  }
                  if (records.length === 0) {
                    records = activeCustomerArchives.map((item: any) => ({
                      id: item.id,
                      customerId: item.customerId,
                      customerName: item.customerName || selectedCustomer.name,
                      type: item.type,
                      amount: item.amount,
                      description: item.description || '',
                      date: parseFirestoreDate(item.date || item.archivedAt).toISOString(),
                      archivedAt: parseFirestoreDate(item.archivedAt || item.date).toISOString()
                    }));
                  }
                  const exportPayload = {
                    app: 'ChallanTrack Archived Profile Statements',
                    exportedAt: new Date().toISOString(),
                    customerName: selectedCustomer.name,
                    customerPhone: selectedCustomer.phone || '',
                    totalArchivedEntries: records.length,
                    archivedTransactions: records
                  };
                  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const safeName = selectedCustomer.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'client';
                  a.href = url;
                  a.download = `challantrack-archive-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(
                    lang === 'bn'
                      ? `${formatNumber(records.length, lang)}টি আর্কাইভ এন্ট্রি ডাউনলোড সম্পন্ন হয়েছে`
                      : `Downloaded ${records.length} archived statements`
                  );
                } catch (err) {
                  console.error(err);
                  toast.error(lang === 'bn' ? 'ডাউনলোড করতে সমস্যা হয়েছে' : 'Failed to download archive');
                }
              }}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold text-xs rounded-full flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow-2xs touch-press"
            >
              <Download className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] border-t border-slate-900/[0.06] dark:border-white/[0.06] pt-2">
            {activeCustomerArchives.slice(0, 4).map((arch: any) => {
              const txDate = parseFirestoreDate(arch.date || arch.archivedAt);
              const isBatch = typeof arch.entriesCount === 'number';
              return (
                <div key={arch.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {isBatch ? (
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                        {formatNumber(arch.entriesCount, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {arch.description || (arch.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                      </span>
                    )}
                    <span className="text-slate-400 shrink-0">•</span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {(lang === 'bn' ? LEDGER_SHORT_DATE_FMT_BN : LEDGER_SHORT_DATE_FMT_EN).format(txDate)}
                    </span>
                  </div>
                  {isBatch ? (
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      {lang === 'bn' ? 'বাকি' : 'Due'}: ৳{formatNumber(arch.totalMergedDue || 0, lang)} |{' '}
                      {lang === 'bn' ? 'জমা' : 'Paid'}: ৳{formatNumber(arch.totalMergedPayment || 0, lang)}
                    </div>
                  ) : (
                    <div
                      className={`font-mono font-bold text-xs shrink-0 ${
                        arch.type === 'due'
                          ? 'text-ledger-red'
                          : 'text-ledger-green'
                      }`}
                    >
                      {arch.type === 'due' ? '+' : '-'} ৳{formatNumber(arch.amount || 0, lang)}
                    </div>
                  )}
                </div>
              );
            })}
            {activeCustomerArchives.length > 4 && (
              <div className="pt-2.5 text-[11px] font-mono text-slate-400 dark:text-slate-500 text-center">
                {lang === 'bn'
                  ? `+ আরও ${formatNumber(activeCustomerArchives.length - 4, lang)}টি আর্কাইভকৃত লেনদেন (ডাউনলোড ফাইলে সম্পূর্ণ তালিকা)`
                  : `+ ${activeCustomerArchives.length - 4} more archived entries available in download`}
              </div>
            )}
          </div>
        </div>
      );
    })()}
  </div>
 
 </div>
 )}

  {/* Edit Transaction Modal */}
  {editingTx && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
          onClick={closeTxModals}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 border max-h-[90dvh] overflow-y-auto hide-scrollbar"
        >
          <div className="sm:hidden w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto -mt-2 mb-4" />
        <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-slate-900/[0.06] dark:border-white/[0.06]">
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            {lang === 'bn' ? 'লেনদেন পরিবর্তন' : 'Edit Transaction'}
          </h3>
          <button type="button" aria-label="Close" onClick={closeTxModals} className="w-8 h-8 bg-slate-100/80 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/70 dark:border-white/[0.08] rounded-full text-slate-600 dark:text-slate-300 cursor-pointer transition-colors flex items-center justify-center touch-press">
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{t.amount} (৳)</label>
            <input
              id="edit-tx-amount-input"
              type="text"
              inputMode="decimal"
              data-numpad="true"
              value={editTxAmount}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9.]/g, '');
                setEditTxAmount(clean);
              }}
              className="w-full px-4 py-3 bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.1] rounded-2xl text-slate-950 dark:text-white text-xl font-mono font-bold focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{t.notes}</label>
            <input
              id="edit-tx-desc-input"
              type="text"
              value={editTxDesc}
              onChange={(e) => setEditTxDesc(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.1] rounded-2xl text-slate-950 dark:text-white text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
            />
          </div>
          {/* Editable Tag Assignment */}
          <div className="pt-0.5">
            <TagPickerBar
              type={editingTx.type}
              selectedTag={editTxTag}
              onSelectTag={setEditTxTag}
              transactions={selectedCustomerTransactions}
              lang={lang}
            />
          </div>
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeTxModals}
              className="flex-1 py-2.5 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold text-xs rounded-full border border-slate-200/80 dark:border-white/[0.08] cursor-pointer transition-colors touch-press"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                const newAmount = parseFloat(editTxAmount.replace(/,/g, ''));
                if (!newAmount || isNaN(newAmount) || newAmount <= 0) {
                  toast.error(lang === 'bn' ? 'সঠিক পরিমাণ লিখুন' : 'Please enter a valid amount');
                  return;
                }
                const trimmedDesc = editTxDesc.trim();
                const origDesc = (editingTx.description || '').trim();
                const origTag = editingTx.tag || null;
                const newTagVal = editTxTag || null;
                if (editTransaction) {
                  const hasChanged = Math.abs(newAmount - editingTx.amount) > 0.001 || trimmedDesc !== origDesc || newTagVal !== origTag;
                  const editedId = editingTx.id;
                  if (hasChanged) {
                    triggerHaptic('double');
                    const finalDesc = trimmedDesc || (newTagVal ? getTagDefaultDescription(newTagVal, lang) : '');
                    editTransaction(editedId, editingTx.type, newAmount, finalDesc, newTagVal);
                    setRecentlyEditedTxId(editedId);
                    setTimeout(() => {
                      setRecentlyEditedTxId(prev => (prev === editedId ? null : prev));
                    }, 1500);
                  }
                  closeTxModals();
                }
              }}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full cursor-pointer transition-colors touch-press"
            >
              {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}

 {/* Delete Transaction Modal */}
  {deletingTx && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
          onClick={closeTxModals}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 border max-h-[90dvh] overflow-y-auto hide-scrollbar"
        >
          <div className="sm:hidden w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto -mt-2 mb-4" />
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-3.5">
            <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400 stroke-[1.5]" />
          </div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white mb-1.5">
            {lang === 'bn' ? 'হিসাব মুছুন' : 'Delete Transaction'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'আপনি কি নিশ্চিত এই লেনদেন মুছে ফেলতে চান?' : 'Are you sure you want to delete this transaction?'}
          </p>
          
          {/* Details Card showing what is being deleted */}
          <div className="surface-subcard border border-slate-200/70 dark:border-white/[0.08] rounded-2xl p-4 text-left space-y-2.5 mt-4">
            <div className="flex justify-between items-center">
              <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'ধরন' : 'Type'}</span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${lang === 'bn' ? 'tracking-normal' : 'uppercase'} ${
                deletingTx.type === 'due' 
                  ? 'bg-ledger-red-subtle text-ledger-red border-ledger-red-subtle' 
                  : 'bg-ledger-green-subtle text-ledger-green border-ledger-green-subtle'
              }`}>
                {deletingTx.type === 'due' ? (lang === 'bn' ? 'বকেয়া (+)' : 'Due (+)') : (lang === 'bn' ? 'আদায় (-)' : 'Payment (-)')}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</span>
              <span className={`text-sm font-black font-mono ${
                deletingTx.type === 'due' ? 'text-ledger-red' : 'text-ledger-green'
              }`}>
                ৳ {formatNumber(deletingTx.amount, lang)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'তারিখ' : 'Date'}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {new Date(deletingTx.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium' })}
              </span>
            </div>
            {deletingTx.description && (
              <div className="pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex justify-between items-start gap-4">
                <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'বিবরণ' : 'Notes'}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[200px]">{deletingTx.description}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              if (deleteTransaction) {
                deleteTransaction(deletingTx.id);
                closeTxModals();
              }
            }}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full cursor-pointer text-xs transition-colors touch-press"
          >
            {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
          </button>
          <button
            onClick={closeTxModals}
            className="w-full py-3 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold rounded-full border border-slate-200/80 dark:border-white/[0.08] cursor-pointer text-xs transition-colors touch-press"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}


  {/* Phone Warning Modal */}
  {phoneWarningCustomer && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
          onClick={closePhoneWarningModal}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 border max-h-[90dvh] overflow-y-auto hide-scrollbar"
        >
          <div className="sm:hidden w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto -mt-2 mb-4" />
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3.5">
            <Phone className="w-6 h-6 text-amber-600 dark:text-amber-400 stroke-[1.5]" />
          </div>
          <h3 className="font-display text-lg font-bold text-amber-600 dark:text-amber-400 mb-1.5">
            {lang === 'bn' ? 'মোবাইল নম্বর নেই' : 'No Phone Number'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'bn' 
              ? 'হোয়াটসঅ্যাপ রিমাইন্ডার পাঠাতে অনুগ্রহ করে প্রথমে এই গ্রাহকের প্রোফাইলে একটি মোবাইল নম্বর যুক্ত করুন।' 
              : 'Please add/link a phone number to this customer profile first to send WhatsApp reminders.'}
          </p>
          
          <div className="surface-subcard border border-slate-200/70 dark:border-white/[0.08] rounded-2xl p-4 text-left mt-4 flex justify-between items-baseline">
            <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'গ্রাহক' : 'Customer'}</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{phoneWarningCustomer.name}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              const targetCustomer = phoneWarningCustomer;
              if (window.history.state?.modal === 'phoneWarningCustomer') {
                window.history.replaceState({ tab: 'customers', customerId: targetCustomer.id, quickEntry: false }, '', `?tab=customers&c=${targetCustomer.id}`);
              }
              window.history.replaceState({ tab: 'customers', customerId: targetCustomer.id, modal: 'editingCustomer', quickEntry: false }, '', `?tab=customers&c=${targetCustomer.id}`);
              
              setSelectedCustomerId(targetCustomer.id);
              setPhoneWarningCustomer(null);
              
              setEditName(targetCustomer.name);
              setEditPhone('');
              setEditAccountType(targetCustomer.accountType || 'standard');
              setEditBillingDay(targetCustomer.billingDay ? String(targetCustomer.billingDay) : '');
              setEditError('');
              setIsEditingCustomer(true);
              setTimeout(() => {
                const phoneInput = document.getElementById('edit_customer_phone');
                if (phoneInput) phoneInput.focus();
              }, 150);
            }}
            className="w-full py-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full cursor-pointer text-xs transition-colors touch-press"
          >
            {lang === 'bn' ? 'মোবাইল নম্বর যুক্ত করুন' : 'Add Phone Number'}
          </button>
          <button
            onClick={() => {
              setPhoneWarningCustomer(null);
              if (window.history.state?.modal === 'phoneWarningCustomer') {
                window.history.back();
              }
            }}
            className="w-full py-3 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold rounded-full border border-slate-200/80 dark:border-white/[0.08] cursor-pointer text-xs transition-colors touch-press"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}

  {/* Pin Action Modal */}
  {pinActionCustomer && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
          onClick={closePinActionModal}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 border max-h-[90dvh] overflow-y-auto hide-scrollbar"
        >
          <div className="sm:hidden w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto -mt-2 mb-4" />
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3.5">
            <Pin className={`w-6 h-6 text-amber-500 stroke-[1.5] ${pinnedCustomerNameSet.has(pinActionCustomer.name) ? 'rotate-45 fill-amber-500' : ''}`} />
          </div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white mb-1.5">
            {pinnedCustomerNameSet.has(pinActionCustomer.name) 
              ? (lang === 'bn' ? 'গ্রাহক আনপিন করুন' : 'Unpin Customer') 
              : (lang === 'bn' ? 'গ্রাহক পিন করুন' : 'Pin Customer')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {pinnedCustomerNameSet.has(pinActionCustomer.name)
              ? (lang === 'bn' 
                  ? `আপনি কি নিশ্চিত ${pinActionCustomer.name}-কে তালিকা থেকে আনপিন করতে চান?` 
                  : `Are you sure you want to unpin ${pinActionCustomer.name} from the top?`)
              : (lang === 'bn' 
                  ? `আপনি কি নিশ্চিত ${pinActionCustomer.name}-কে তালিকার শীর্ষে পিন করতে চান?` 
                  : `Are you sure you want to pin ${pinActionCustomer.name} to the top of the list?`)}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              togglePinCustomer(pinActionCustomer.id);
              setPinActionCustomer(null);
              if (window.history.state?.modal === 'pinActionCustomer') {
                window.history.back();
              }
            }}
            className="w-full py-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full cursor-pointer text-xs transition-colors touch-press"
          >
            {pinnedCustomerNameSet.has(pinActionCustomer.name)
              ? (lang === 'bn' ? 'হ্যাঁ, আনপিন করুন' : 'Yes, Unpin')
              : (lang === 'bn' ? 'হ্যাঁ, পিন করুন' : 'Yes, Pin to top')}
          </button>
          <button
            type="button"
            onClick={() => {
              setPinActionCustomer(null);
              if (window.history.state?.modal === 'pinActionCustomer') {
                window.history.back();
              }
            }}
            className="w-full py-3 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold rounded-full border border-slate-200/80 dark:border-white/[0.08] cursor-pointer text-xs transition-colors touch-press"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}

  {/* Delete Customer Account Modal */}
  {deletingCustomer && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
          onClick={closeDeleteCustomerModal}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 border max-h-[90dvh] overflow-y-auto hide-scrollbar"
        >
          <div className="sm:hidden w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto -mt-2 mb-4" />
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-3.5">
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 stroke-[1.5]" />
          </div>
          <h3 className="font-display text-lg font-bold text-rose-600 dark:text-rose-400 mb-1.5">
            {lang === 'bn' ? 'গ্রাহক অ্যাকাউন্ট ট্র্যাশে সরান' : 'Move Customer to Trash'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'bn' 
              ? 'আপনি কি নিশ্চিত এই গ্রাহকের সম্পূর্ণ অ্যাকাউন্ট ট্র্যাশে স্থানান্তর করতে চান? এটি ১৪ দিন পর স্থায়ীভাবে মুছে যাবে।' 
              : 'Are you sure you want to move this customer account to the trash? It will be permanently deleted after 14 days.'}
          </p>
          
          {/* Details Card showing customer name, phone, and outstanding balance */}
          <div className="surface-subcard border border-slate-200/70 dark:border-white/[0.08] rounded-2xl p-4 text-left space-y-2.5 mt-4">
            <div className="flex justify-between items-baseline">
              <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'নাম' : 'Name'}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{deletingCustomer.name}</span>
            </div>
            {deletingCustomer.phone && (
              <div className="flex justify-between items-baseline">
                <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'মোবাইল' : 'Mobile'}</span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{deletingCustomer.phone}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline">
              <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Current Balance'}</span>
              <span className={`text-sm font-black font-mono ${
                deletingCustomer.outstandingDue > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : deletingCustomer.outstandingDue < 0
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-slate-500'
              }`}>
                {deletingCustomer.outstandingDue === 0
                  ? (lang === 'bn' ? 'পরিশোধিত' : 'Settled')
                  : `৳ ${formatNumber(deletingCustomer.outstandingDue, lang)}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={async () => {
              triggerHaptic('double');
              const id = deletingCustomer.id;
              setDeletingCustomer(null);
              if (window.history.state?.modal === 'deleteCustomer') {
                window.history.back();
              }
              await deleteCustomer(id);
              setSelectedCustomerId(null);
              toast.info(lang === 'bn' ? 'গ্রাহক ট্র্যাশে স্থানান্তরিত হয়েছে' : 'Customer account moved to trash');
            }}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full cursor-pointer text-xs transition-colors touch-press"
          >
            {lang === 'bn' ? 'হ্যাঁ, ট্র্যাশে পাঠান' : 'Yes, Trash'}
          </button>
          <button
            onClick={() => {
              setDeletingCustomer(null);
              if (window.history.state?.modal === 'deleteCustomer') {
                window.history.back();
              }
            }}
            className="w-full py-3 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold rounded-full border border-slate-200/80 dark:border-white/[0.08] cursor-pointer text-xs transition-colors touch-press"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}
  {/* Duplicate Entry Warning Modal */}
  {duplicateTxWarning && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
          onClick={() => setDuplicateTxWarning(null)}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 border max-h-[90dvh] overflow-y-auto hide-scrollbar"
        >
          <div className="sm:hidden w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto -mt-2 mb-4" />
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3.5">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 stroke-[1.5]" />
          </div>
          <h3 className="font-display text-lg font-bold text-amber-600 dark:text-amber-400 mb-1.5">
            {t.duplicateWarningTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.duplicateWarningDesc}
          </p>
          
          {/* Details Card */}
          <div className="surface-subcard border border-slate-200/70 dark:border-white/[0.08] rounded-2xl p-4 text-left space-y-2.5 mt-4">
            <div className="flex justify-between items-baseline">
              <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{t.type}</span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                duplicateTxWarning.type === 'due' 
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}>
                {duplicateTxWarning.type === 'due' ? t.duePlus : t.paymentMinus}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>{t.amount}</span>
              <span className={`text-sm font-black font-mono ${
                duplicateTxWarning.type === 'due' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                ৳ {formatNumber(duplicateTxWarning.amount, lang)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (setHighlightedTxId) {
                setHighlightedTxId(duplicateTxWarning.id);
              }
              setDuplicateTxWarning(null);
            }}
            className="w-full py-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full cursor-pointer text-xs transition-colors touch-press"
          >
            {t.viewExistingEntry}
          </button>
          <button
            type="button"
            onClick={async () => {
              setHasShownDuplicateWarning(true);
              setDuplicateTxWarning(null);
              await executeInlineTransaction(true);
            }}
            className="w-full py-3 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold rounded-full border border-slate-200/80 dark:border-white/[0.08] cursor-pointer text-xs transition-colors touch-press"
          >
            {t.addAnyway}
          </button>
          <button
            type="button"
            onClick={() => {
              setDuplicateTxWarning(null);
            }}
            className="w-full py-3 bg-transparent hover:bg-slate-100/60 dark:hover:bg-white/[0.05] text-slate-500 dark:text-slate-400 font-bold rounded-full text-xs cursor-pointer transition-colors touch-press"
          >
            {t.cancel}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}

  {/* RECEIPT / STATEMENT PREVIEW MODAL */}
  {receiptResult && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/65 dark:bg-black/80 animate-backdrop-blur"
          onClick={closeReceiptModal}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full max-w-sm sm:max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] border"
        >
          {/* Modal Header */}
          <div className="p-4 px-5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between bg-slate-900/[0.02] dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                {receiptResult.kind === 'pdf' ? (
                  <FileText className="w-4 h-4 stroke-[1.5]" />
                ) : (
                  <ReceiptText className="w-4 h-4 stroke-[1.5]" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-sm text-slate-950 dark:text-white truncate">
                  {receiptResult.kind === 'pdf'
                    ? (lang === 'bn' ? 'বিল্ড কার্ড স্টেটমেন্ট (PDF)' : 'Billed Card Statement (PDF)')
                    : (lang === 'bn' ? 'ডিজিটাল রসিদ স্লিপ' : 'Digital Receipt Slip')}
                </h3>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {receiptResult.fileName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeReceiptModal}
              className="w-8 h-8 rounded-full bg-slate-100/80 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/70 dark:border-white/[0.08] text-slate-500 dark:text-slate-300 transition-colors cursor-pointer shrink-0 ml-2 flex items-center justify-center touch-press"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>

          {/* Preview Container */}
          {receiptResult.kind === 'pdf' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-slate-100 dark:bg-[#07090E] flex flex-col items-center gap-3 hide-scrollbar transition-colors">
              {receiptResult.previewPages.map((pageUrl, pageIdx) => (
                <div
                  key={pageIdx}
                  className="w-full max-w-[330px] bg-white rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shadow-[0_12px_26px_-6px_rgba(15,23,42,0.16)] dark:shadow-[0_20px_32px_-6px_rgba(0,0,0,0.75)] will-change-transform"
                  style={{ transform: 'translate3d(0, 0, 0)' }}
                >
                  <img
                    src={pageUrl}
                    alt={`Statement Page ${pageIdx + 1}`}
                    decoding="async"
                    className="w-full h-auto block select-none"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 bg-white dark:bg-[#07090E] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:14px_14px] flex justify-center items-start hide-scrollbar transition-colors">
              <div
                className="max-w-[272px] sm:max-w-[290px] w-full shadow-[0_14px_28px_-6px_rgba(15,23,42,0.16)] dark:shadow-[0_22px_34px_-6px_rgba(0,0,0,0.78)] will-change-transform"
                style={{ transform: 'translate3d(0, 0, 0)' }}
              >
                <img 
                  src={receiptResult.dataUrl} 
                  alt="Customer Receipt" 
                  decoding="async"
                  className="w-full h-auto block select-none"
                />
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] space-y-2 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('double');
                if (receiptResult.kind === 'pdf') {
                  downloadReceiptPdf(receiptResult.blob, receiptResult.fileName);
                  showNotification(lang === 'bn' ? 'স্টেটমেন্ট PDF ডাউনলোড সম্পন্ন' : 'Statement PDF Downloaded', {
                    body: lang === 'bn' ? `${receiptResult.fileName} সফলভাবে ডাউনলোড হয়েছে` : `${receiptResult.fileName} downloaded successfully.`,
                    icon: '/icon-192.png'
                  });
                  toast.success(lang === 'bn' ? 'PDF স্টেটমেন্ট ডাউনলোড সম্পন্ন হয়েছে' : 'Statement PDF downloaded successfully');
                } else {
                  downloadReceiptImage(receiptResult.dataUrl, receiptResult.fileName);
                  showNotification(lang === 'bn' ? 'রসিদ ডাউনলোড সম্পন্ন' : 'Receipt Downloaded', {
                    body: lang === 'bn' ? `${receiptResult.fileName} সফলভাবে ডাউনলোড হয়েছে` : `${receiptResult.fileName} downloaded successfully.`,
                    icon: '/icon-192.png'
                  });
                  toast.success(lang === 'bn' ? 'রসিদ ইমেজ ডাউনলোড সম্পন্ন হয়েছে' : 'Receipt downloaded successfully');
                }
              }}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer touch-press"
            >
              <Download className="w-4 h-4 stroke-[1.5]" />
              <span>
                {receiptResult.kind === 'pdf'
                  ? (lang === 'bn' ? 'ডাউনলোড PDF' : 'Download PDF')
                  : (lang === 'bn' ? 'ডাউনলোড PNG' : 'Download PNG')}
              </span>
            </button>

            <button
              type="button"
              onClick={async () => {
                triggerHaptic('single');
                const success = receiptResult.kind === 'pdf'
                  ? await copyPlainTextReceipt(receiptResult.plainTextSummary)
                  : await copyReceiptImage(receiptResult.blob);
                if (success) {
                  setIsCopiedReceipt(true);
                  toast.success(
                    receiptResult.kind === 'pdf'
                      ? (lang === 'bn' ? 'স্টেটমেন্ট টেক্সট ক্লিপবোর্ডে কপি হয়েছে' : 'Statement text copied to clipboard')
                      : (lang === 'bn' ? 'ছবি ক্লিপবোর্ডে কপি হয়েছে (হোয়াটসঅ্যাপে পেস্ট করুন)' : 'Image copied to clipboard')
                  );
                  setTimeout(() => setIsCopiedReceipt(false), 2500);
                } else {
                  toast.error(lang === 'bn' ? 'কপি সমর্থিত নয়, ডাউনলোড বাটন ব্যবহার করুন' : 'Copy not supported on this browser');
                }
              }}
              className="px-4 py-2.5 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold rounded-full border border-slate-200/80 dark:border-white/[0.08] text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer touch-press"
              title={receiptResult.kind === 'pdf' ? (lang === 'bn' ? 'টেক্সট কপি করুন' : 'Copy Text') : (lang === 'bn' ? 'ক্লিপবোর্ডে কপি করুন' : 'Copy Image')}
            >
              {isCopiedReceipt ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[1.5]" /> : <Copy className="w-4 h-4 stroke-[1.5]" />}
              <span className="hidden sm:inline">{isCopiedReceipt ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied!') : (lang === 'bn' ? 'কপি' : 'Copy')}</span>
            </button>

            {typeof navigator !== 'undefined' && 'canShare' in navigator && (
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('single');
                  if (receiptResult.kind === 'pdf') {
                    await shareReceiptPdf(receiptResult.blob, receiptResult.fileName, selectedCustomer?.name || 'Customer');
                  } else {
                    await shareReceiptImage(receiptResult.blob, receiptResult.fileName, selectedCustomer?.name || 'Customer');
                  }
                }}
                className="px-4 py-2.5 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-200 font-bold rounded-full border border-slate-200/80 dark:border-white/[0.08] text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer touch-press"
                title={lang === 'bn' ? 'শেয়ার করুন' : 'Share'}
              >
                <Share2 className="w-4 h-4 stroke-[1.5]" />
                <span className="hidden sm:inline">{lang === 'bn' ? 'শেয়ার' : 'Share'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}

  {/* Modern Contact Phone Selector Modal */}
  {pendingContactChoice && (
    <ContactNumberPickerModal
      isOpen={true}
      contactName={pendingContactChoice.contactName}
      numbers={pendingContactChoice.numbers}
      isNewAccount={pendingContactChoice.isNewAccount}
      onSelectNumber={(chosen, finalName) => {
        pendingContactChoice.onSelect(chosen, finalName);
        setPendingContactChoice(null);
      }}
      onClose={() => setPendingContactChoice(null)}
      lang={lang}
    />
  )}

  {/* Client-Specific Statement Merge & Fresh Ledger Modal */}
  {isManageStatementsOpen && selectedCustomer && archiveCustomerExcessStatements && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
          onClick={() => { if (!isManualArchiving) closeManageStatementsModal(); }}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl border overflow-hidden max-h-[90dvh] flex flex-col"
        >
          <div className="sm:hidden pt-3 flex justify-center shrink-0">
            <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto" />
          </div>

          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                {lang === 'bn' ? 'খতিয়ান স্টেটমেন্ট ব্যবস্থাপনা' : 'Manage Client Ledger'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {selectedCustomer.name} • {formatNumber(activeCustomerTxCount, lang)} {lang === 'bn' ? 'টি সক্রিয় এন্ট্রি' : 'active entries'}
              </p>
            </div>
            <button
              type="button"
              disabled={isManualArchiving}
              onClick={() => {
                triggerHaptic('medium');
                closeManageStatementsModal();
              }}
              className="w-8 h-8 bg-slate-100/80 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/70 dark:border-white/[0.08] rounded-full text-slate-600 dark:text-slate-300 cursor-pointer transition-colors flex items-center justify-center touch-press"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>

          <div className="flex-1 min-h-0 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5 space-y-4 overflow-y-auto hide-scrollbar">
          {/* Option 1: Keep Last N Entries (Manual Merge) */}
          <div className="p-4 rounded-2xl surface-subcard border border-slate-200/70 dark:border-white/[0.08] space-y-3.5">
            <div className="space-y-1">
              <h4 className={`text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>
                <Archive className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>{lang === 'bn' ? 'নির্দিষ্ট সংখ্যক এন্ট্রি রেখে বাকিগুলো মার্জ করুন' : 'Merge & Keep Recent Entries'}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'বর্তমান ব্যালেন্স অপরিবর্তিত রেখে সর্বশেষ কয়েকটি লেনদেন খতিয়ানে রাখুন এবং পুরনোগুলো আর্কাইভে সরিয়ে নিন।'
                  : 'Keep only the latest entries in this statement and archive older ones without changing the current balance.'}
              </p>
            </div>

            {/* Borderless + / - Stepper + Merge Action */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="inline-flex items-center gap-2 shrink-0 select-none">
                <button
                  type="button"
                  disabled={isManualArchiving}
                  onClick={() => {
                    triggerHaptic('tick');
                    const cur = snapKeepCountToFive(manualKeepCountInput, 15);
                    setManualKeepCountInput(String(Math.max(5, cur - 5)));
                  }}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                  aria-label="Decrease count"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
                <span className="min-w-[2.25rem] text-center text-base font-mono font-black text-slate-950 dark:text-white tabular-nums">
                  {formatNumber(snapKeepCountToFive(manualKeepCountInput, 15), lang)}
                </span>
                <button
                  type="button"
                  disabled={isManualArchiving}
                  onClick={() => {
                    triggerHaptic('tick');
                    const cur = snapKeepCountToFive(manualKeepCountInput, 15);
                    setManualKeepCountInput(String(Math.min(500, cur + 5)));
                  }}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                  aria-label="Increase count"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              </div>

              <button
                type="button"
                disabled={isManualArchiving}
                onClick={async () => {
                  const keepCount = snapKeepCountToFive(manualKeepCountInput, 15);
                  setManualKeepCountInput(String(keepCount));
                  if (activeCustomerTxCount <= keepCount) {
                    toast.info(
                      lang === 'bn'
                        ? `এই প্রোফাইলে বর্তমানে মাত্র ${formatNumber(activeCustomerTxCount, lang)}টি এন্ট্রি আছে।`
                        : `This client only has ${activeCustomerTxCount} active entries (need more than ${keepCount} to merge).`
                    );
                    return;
                  }
                  setIsManualArchiving(true);
                  triggerHaptic('double');
                  try {
                    const count = await archiveCustomerExcessStatements(selectedCustomer.id, keepCount);
                    toast.success(
                      lang === 'bn'
                        ? `${formatNumber(count, lang)}টি পুরনো এন্ট্রি সফলভাবে আর্কাইভ করা হয়েছে`
                        : `Archived ${count} older entries (kept latest ${keepCount})`
                    );
                    closeManageStatementsModal();
                  } catch {
                    toast.error(lang === 'bn' ? 'মার্জ করতে সমস্যা হয়েছে' : 'Failed to merge entries');
                  } finally {
                    setIsManualArchiving(false);
                  }
                }}
                className="flex-1 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold text-xs rounded-full cursor-pointer transition-all touch-press disabled:opacity-60"
              >
                {isManualArchiving
                  ? (lang === 'bn' ? 'প্রসেস হচ্ছে...' : 'Merging...')
                  : (lang === 'bn' ? 'মার্জ ও আর্কাইভ করুন' : 'Merge & Archive Older')}
              </button>
            </div>
          </div>

          {/* Option 2: Start Fresh Ledger after a settlement (download previous entries in background) */}
          <div className="p-4 rounded-2xl surface-subcard border border-slate-200/70 dark:border-white/[0.08] space-y-3">
            <div className="space-y-1">
              <h4 className={`text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>
                <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>{lang === 'bn' ? 'হিসাব নিষ্পত্তির পর নতুন খতিয়ান শুরু করুন' : 'Start Fresh Ledger (Post-Settlement)'}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'পূর্ববর্তী সকল লেনদেনের রেকর্ড স্বয়ংক্রিয়ভাবে ব্যাকআপ ডাউনলোড হবে এবং খতিয়ানটি নতুনভাবে পরিষ্কার হয়ে যাবে।'
                  : 'Automatically downloads a backup of previous entries in the background and archives all current rows so you can start a fresh statement.'}
              </p>
            </div>

            <button
              type="button"
              disabled={isManualArchiving || activeCustomerTxCount === 0}
              onClick={async () => {
                setIsManualArchiving(true);
                triggerHaptic('double');
                try {
                  // 1. Download current & archived entries for this client in the background
                  const existingArchives = archivedStatements.filter((a: any) => a && a.customerId === selectedCustomer.id);
                  const backupPayload = {
                    app: 'ChallanTrack Client Statement History',
                    exportedAt: new Date().toISOString(),
                    customerName: selectedCustomer.name,
                    customerPhone: selectedCustomer.phone || '',
                    currentBalanceAtExport: selectedCustomer.outstandingDue,
                    activeStatements: selectedCustomerTransactions,
                    previousArchives: existingArchives
                  };
                  const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const safeName = selectedCustomer.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'client';
                  a.href = url;
                  a.download = `challantrack-fresh-ledger-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);

                  // 2. Archive all active entries (keepCount = 0)
                  const count = await archiveCustomerExcessStatements(selectedCustomer.id, 0);
                  toast.success(
                    lang === 'bn'
                      ? `নতুন খতিয়ান শুরু হয়েছে (${formatNumber(count, lang)}টি এন্ট্রি ডাউনলোড ও আর্কাইভ হয়েছে)`
                      : `Started fresh ledger (${count} entries downloaded & archived)`
                  );
                  closeManageStatementsModal();
                } catch {
                  toast.error(lang === 'bn' ? 'নতুন খতিয়ান শুরু করতে সমস্যা হয়েছে' : 'Failed to start fresh ledger');
                } finally {
                  setIsManualArchiving(false);
                }
              }}
              className="w-full py-2.5 px-4 bg-slate-100/90 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-900 dark:text-white font-bold text-xs rounded-full border border-slate-200/80 dark:border-white/[0.08] cursor-pointer transition-all flex items-center justify-center gap-2 touch-press disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>{lang === 'bn' ? 'পূর্বের হিসাব ডাউনলোড করে নতুন খতিয়ান শুরু করুন' : 'Download History & Start Fresh Ledger'}</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}

  {/* Transaction Audit History Log Modal */}
  {auditLogTx && (
    <ModalPortal lockScroll={false}>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
          onClick={closeAuditLogModal}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl border overflow-hidden flex flex-col max-h-[90dvh]"
        >
          <div className="sm:hidden pt-3 flex justify-center shrink-0">
            <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto" />
          </div>
          <div className="p-4 sm:p-5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100/80 dark:bg-white/[0.06] border border-slate-200/70 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <History className="w-4 h-4 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
                  {lang === 'bn' ? 'লেনদেনের পরিবর্তনের ইতিহাস (Audit Log)' : 'Transaction Audit History'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'প্রতিটি পরিবর্তনের রেকর্ড ও বিবরণ' : 'Complete record of revisions made'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeAuditLogModal}
              className="w-8 h-8 bg-slate-100/80 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/70 dark:border-white/[0.08] rounded-full text-slate-600 dark:text-slate-300 cursor-pointer transition-colors flex items-center justify-center touch-press"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>

          <div className="flex-1 min-h-0 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5 overflow-y-auto hide-scrollbar space-y-4">
          {/* Current Version */}
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>
                {lang === 'bn' ? 'বর্তমান সক্রিয় হিসাব' : 'Current Active Record'}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                ৳ {formatNumber(auditLogTx.amount, lang)}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {auditLogTx.description || (auditLogTx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
            </div>
            {auditLogTx.editedAt && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'সর্বশেষ সম্পাদনা: ' : 'Last edited: '}
                {(lang === 'bn' ? LEDGER_AUDIT_FMT_BN : LEDGER_AUDIT_FMT_EN).format(parseFirestoreDate(auditLogTx.editedAt))}
              </div>
            )}
          </div>

          {/* Past Audit History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className={`text-xs font-bold text-slate-500 dark:text-slate-400 ${lang === 'bn' ? 'tracking-normal' : 'micro-mono-label'}`}>
                {lang === 'bn' ? 'পূর্ববর্তী সংস্করণসমূহ' : 'Prior Revisions'}
              </h4>
              {auditLogTx.auditHistory && auditLogTx.auditHistory.length > 0 && (
                <span className="text-[11px] font-bold text-slate-400 font-mono">
                  {auditLogTx.auditHistory.length} / 5
                </span>
              )}
            </div>

            {/* Inform user if maximum 5 revisions limit is reached */}
            {auditLogTx.auditHistory && auditLogTx.auditHistory.length >= 5 && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 stroke-[1.5]" />
                <span>
                  {lang === 'bn' 
                    ? 'সর্বোচ্চ ৫টি পূর্ববর্তী সংস্করণ প্রদর্শিত হচ্ছে। এর আগের কোনো সংস্করণ থাকলে তা স্বয়ংক্রিয়ভাবে মুছে দেওয়া হয়েছে।'
                    : 'Showing maximum of 5 recent prior revisions. Older revisions are pruned.'}
                </span>
              </div>
            )}
            {auditLogTx.auditHistory && auditLogTx.auditHistory.length > 0 ? (
              <div className="space-y-2.5">
                {auditLogTx.auditHistory.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl border border-slate-200/70 dark:border-white/[0.08] surface-subcard space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        {lang === 'bn' ? `সংস্করণ #${auditLogTx.auditHistory!.length - idx}` : `Revision #${auditLogTx.auditHistory!.length - idx}`}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        ৳ {formatNumber(item.amount, lang)}
                      </span>
                    </div>
                    {item.description && (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        {item.description}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono">
                      {(lang === 'bn' ? LEDGER_AUDIT_FMT_BN : LEDGER_AUDIT_FMT_EN).format(parseFirestoreDate(item.editedAt))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                {lang === 'bn' ? 'কোনো পূর্ববর্তী সংস্করণ পাওয়া যায়নি।' : 'No earlier revision entries recorded.'}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </ModalPortal>
  )}
  {pendingPhotoCrop && (
    <ContactPhotoCropModal
      file={pendingPhotoCrop.file}
      lang={lang}
      onConfirm={handleCropComplete}
      onCancel={() => setPendingPhotoCrop(null)}
      onError={handleCropError}
    />
  )}
 </div>
 );
});

export default CustomerManager;
