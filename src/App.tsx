import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { 
 onAuthStateChanged, 
 signInWithPopup, 
 signInAnonymously, 
 signOut, 
 updateProfile,
 User 
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { useLedger } from './hooks/useLedger';
import Dashboard from './components/Dashboard';
import CustomerManager from './components/CustomerManager';
import RemindersManager from './components/RemindersManager';
import SettingsManager from './components/SettingsManager';
import GoalsManager from './components/GoalsManager';
import QuickEntryModal from './components/QuickEntryModal';
import AnalyticsManager from './components/AnalyticsManager';
import ChallanTrackLogo, { ChallanTrackMark } from './components/ChallanTrackLogo';
import AccentColorPickerModal from './components/AccentColorPickerModal';
import BiometricLockScreen from './components/BiometricLockScreen';
import CalculatorKeypad from './components/CalculatorKeypad';
import ManageTagsModal from './components/ManageTagsModal';
import ModalPortal from './components/ModalPortal';
import LoadingSpinner from './components/LoadingSpinner';
import { NativeDatePicker } from './components/NativePickers';
import { isBiometricEnabled, setBiometricEnabledState, isBiometricSessionUnlocked, setBiometricSessionUnlocked } from './lib/biometrics';
import { getSavedAccentColor, applyAccentColor, getSavedThemePalette, applyThemePalette } from './lib/accentTheme';
import {
  House, Users, Bell, BellDot, Settings, BookOpen, Clock, Globe, Plus, Moon, Sun, ArrowUpRight, ArrowDownLeft, ChevronRight, BarChart3, ArrowLeft, ClipboardList, Lock, Loader2, Calendar, PiggyBank, Goal, Palette, LogOut, AlertTriangle
} from 'lucide-react';
import { AppShellSkeleton, DashboardSkeleton } from './components/AppSkeletonLoader';
import { ViewTransition, usePrefersReducedMotion } from './components/MotionPrimitives';
import { TagIcon } from './lib/tagSystem';
import { showNotification } from './lib/notifications';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { triggerHaptic } from './lib/haptics';
import { translations, Language, formatNumber } from './lib/translations';

const parseFirestoreDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const APP_TIME_FORMATTER_EN = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
const APP_TIME_FORMATTER_BN = new Intl.DateTimeFormat('bn-BD', { hour: '2-digit', minute: '2-digit' });

type AppTab = 'home' | 'customers' | 'analytics' | 'reminders' | 'settings' | 'daily_transactions' | 'goals';

const DOCK_TABS: readonly AppTab[] = ['home', 'customers', 'goals', 'settings'] as const;

const MobileBottomDock = React.memo(({
  syncedTab,
  syncedCustomerId,
  onNavigate,
  onOpenQuickEntry,
  labels,
  reducedMotion,
}: {
  syncedTab: AppTab;
  syncedCustomerId: string | null;
  onNavigate: (tab: AppTab, customerId?: string | null) => void;
  onOpenQuickEntry: () => void;
  labels: {
    dashboard: string;
    clients: string;
    goals: string;
    settings: string;
    recordEntry: string;
  };
  reducedMotion: boolean;
}) => {
  const dockRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const pillRef = React.useRef<HTMLDivElement>(null);
  const trackLeftRef = React.useRef<number | null>(null);
  const dragRafRef = React.useRef<number | null>(null);
  const [dockWidth, setDockWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 360;
    return Math.min(420, Math.max(260, window.innerWidth - 32));
  });

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const measure = () => {
      const viewportCap = typeof window !== 'undefined' ? Math.max(260, window.innerWidth - 32) : 420;
      const w = Math.min(el.clientWidth || viewportCap, viewportCap, 420);
      if (w > 0) {
        setDockWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
      }
      if (trackRef.current) {
        trackLeftRef.current = trackRef.current.getBoundingClientRect().left;
      }
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      window.addEventListener('resize', measure, { passive: true });
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', measure);
      };
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, []);

  const [navState, setNavState] = useState<{
    tab: AppTab;
    customerId: string | null;
    transitionMode: 'none' | 'hide-fab' | 'show-fab';
  }>(() => ({
    tab: syncedTab,
    customerId: syncedCustomerId,
    transitionMode: 'none',
  }));

  const [hoveredDragTab, setHoveredDragTab] = useState<AppTab | null>(null);

  const gestureRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    startTab: AppTab;
    isSliding: boolean;
    holdExpired: boolean;
    hoveredIdx: number;
    holdTimer: number | null;
  } | null>(null);

  const computeTransitionMode = useCallback(
    (
      prevTab: AppTab,
      prevCid: string | null,
      nextTab: AppTab,
      nextCid: string | null
    ): 'none' | 'hide-fab' | 'show-fab' => {
      const wasShowingFab = prevTab === 'home' || (prevTab === 'customers' && !prevCid);
      const willShowFab = nextTab === 'home' || (nextTab === 'customers' && !nextCid);
      return wasShowingFab && !willShowFab
        ? 'hide-fab'
        : !wasShowingFab && willShowFab
        ? 'show-fab'
        : 'none';
    },
    []
  );

  useEffect(() => {
    const handleNavIntent = (e: Event) => {
      const detail = (e as CustomEvent<{ tab: AppTab; customerId: string | null }>).detail;
      if (!detail) return;
      setNavState((prev) => {
        if (prev.tab === detail.tab && prev.customerId === detail.customerId) return prev;
        const mode = computeTransitionMode(prev.tab, prev.customerId, detail.tab, detail.customerId);
        return {
          tab: detail.tab,
          customerId: detail.customerId,
          transitionMode: mode,
        };
      });
    };

    window.addEventListener('challan-nav-intent', handleNavIntent);
    return () => {
      window.removeEventListener('challan-nav-intent', handleNavIntent);
    };
  }, [computeTransitionMode]);

  useEffect(() => {
    setNavState((prev) => {
      if (prev.tab === syncedTab && prev.customerId === syncedCustomerId) return prev;
      const mode = computeTransitionMode(prev.tab, prev.customerId, syncedTab, syncedCustomerId);
      return {
        tab: syncedTab,
        customerId: syncedCustomerId,
        transitionMode: mode,
      };
    });
  }, [syncedTab, syncedCustomerId, computeTransitionMode]);

  useEffect(() => {
    return () => {
      if (gestureRef.current?.holdTimer) {
        window.clearTimeout(gestureRef.current.holdTimer);
      }
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
      }
    };
  }, []);

  const activeTab = navState.tab;
  const activeCid = navState.customerId;
  const showQuickEntryFab =
    activeTab === 'home' || (activeTab === 'customers' && !activeCid);

  const activeNavIndex =
    activeTab === 'customers'
      ? 1
      : activeTab === 'goals'
      ? 2
      : activeTab === 'settings'
      ? 3
      : 0;

  // Pixel geometry for dock pill transitions (pure compositor transform — zero CSS width/layout transitions)
  const shrunkDockWidth = Math.max(194, dockWidth - 66);
  const fullTrackWidth = Math.max(184, dockWidth - 10);
  const shrunkTrackWidth = Math.max(184, shrunkDockWidth - 10);
  const fullColWidth = fullTrackWidth / 4;
  const shrunkColWidth = shrunkTrackWidth / 4;
  const activeTrackWidth = showQuickEntryFab ? shrunkTrackWidth : fullTrackWidth;
  const activeColWidth = showQuickEntryFab ? shrunkColWidth : fullColWidth;
  const activeDockWidth = showQuickEntryFab ? shrunkDockWidth : dockWidth;
  const capsuleShrinkOffset = Math.max(0, dockWidth - activeDockWidth);
  const restingPillCenterX = (activeNavIndex + 0.5) * activeColWidth;
  const highlightedTab = hoveredDragTab ?? activeTab;

  // Choreography (pure transform + opacity only for locked 60fps mobile compositor):
  // - Expanding (hide-fab): + button drops & hides first (0..110ms), THEN navbar expands cleanly (125ms delay)
  // - Shrinking (show-fab): navbar shrinks immediately without right-side overshoot, + button rises cleanly (90ms delay)
  const isExpanding = navState.transitionMode === 'hide-fab';
  const isShrinking = navState.transitionMode === 'show-fab';
  const shouldAnimateMorph = !reducedMotion && (isExpanding || isShrinking);
  const navDelayMs = isExpanding ? 125 : 0;
  const navDurationMs = isExpanding ? 260 : 250;
  const capsuleMorphEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const indicatorMorphEasing = 'cubic-bezier(0.32, 1.32, 0.64, 1)';

  const getIndexFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return { idx: activeNavIndex, pillCenterX: restingPillCenterX, relX: restingPillCenterX };
    let trackLeft = trackLeftRef.current;
    if (trackLeft === null) {
      trackLeft = track.getBoundingClientRect().left;
      trackLeftRef.current = trackLeft;
    }
    const colW = activeTrackWidth / 4;
    const relX = clientX - trackLeft;
    const idx = Math.max(0, Math.min(3, Math.floor(relX / colW)));
    const clampedCenterX = Math.max(colW / 2, Math.min(activeTrackWidth - colW / 2, relX));
    return { idx, pillCenterX: clampedCenterX, relX };
  };

  const clearGesture = () => {
    if (gestureRef.current?.holdTimer) {
      window.clearTimeout(gestureRef.current.holdTimer);
    }
    if (dragRafRef.current !== null) {
      window.cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    gestureRef.current = null;
    setHoveredDragTab(null);
  };

  const handleNavPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (trackRef.current) {
      trackLeftRef.current = trackRef.current.getBoundingClientRect().left;
    }
    const { idx, relX } = getIndexFromClientX(e.clientX);
    if (showQuickEntryFab && relX > shrunkTrackWidth + 5) return;
    const startTab = DOCK_TABS[idx];

    if (gestureRef.current?.holdTimer) {
      window.clearTimeout(gestureRef.current.holdTimer);
    }

    const holdTimer = window.setTimeout(() => {
      if (gestureRef.current && !gestureRef.current.isSliding) {
        gestureRef.current.holdExpired = true;
      }
    }, 420);

    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      startTab,
      isSliding: false,
      holdExpired: false,
      hoveredIdx: idx,
      holdTimer,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleNavPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (!g.isSliding) {
      if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy) * 0.75) {
        g.isSliding = true;
        g.holdExpired = false;
        if (g.holdTimer) {
          window.clearTimeout(g.holdTimer);
          g.holdTimer = null;
        }
        setHoveredDragTab(DOCK_TABS[g.hoveredIdx]);
      } else {
        return;
      }
    }

    const { idx, pillCenterX } = getIndexFromClientX(e.clientX);
    if (idx !== g.hoveredIdx) {
      g.hoveredIdx = idx;
      triggerHaptic('single');
      setHoveredDragTab(DOCK_TABS[idx]);
    }

    // Mutate pill transform directly on next rAF for zero-re-render 60/120fps finger scrub
    const nextTranslateX = pillCenterX - fullColWidth / 2;
    if (dragRafRef.current !== null) {
      window.cancelAnimationFrame(dragRafRef.current);
    }
    dragRafRef.current = window.requestAnimationFrame(() => {
      dragRafRef.current = null;
      const pillEl = pillRef.current;
      if (pillEl && gestureRef.current?.isSliding) {
        pillEl.style.transition = 'none';
        pillEl.style.transform = `translate3d(${nextTranslateX.toFixed(2)}px, 0, 0) scale(1.015)`;
      }
    });
  };

  const handleNavPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const { isSliding, holdExpired, startX, startY, startTime, startTab } = g;
    const { idx } = getIndexFromClientX(e.clientX);
    clearGesture();

    if (isSliding) {
      const targetTab = DOCK_TABS[idx];
      onNavigate(targetTab);
      return;
    }

    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    const elapsed = performance.now() - startTime;
    if (!holdExpired && elapsed < 420 && dist <= 18) {
      onNavigate(startTab);
    }
  };

  const handleNavPointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    clearGesture();
  };

  const handleKeyboardClick = (e: React.MouseEvent<HTMLButtonElement>, targetTab: AppTab) => {
    if (e.detail === 0) {
      onNavigate(targetTab);
    }
  };

  const pillTranslateX = restingPillCenterX - fullColWidth / 2;
  const pillSideInset = Math.max(0, (fullColWidth - activeColWidth) / 2);
  const pillRadius = Math.min(23, activeColWidth / 2);
  const pillScale = hoveredDragTab ? 1.015 : 1;

  const pillTransition =
    reducedMotion || hoveredDragTab
      ? 'none'
      : shouldAnimateMorph
      ? `transform ${navDurationMs}ms ${indicatorMorphEasing} ${navDelayMs}ms, clip-path ${navDurationMs}ms ${capsuleMorphEasing} ${navDelayMs}ms`
      : 'transform 300ms cubic-bezier(0.32, 1.32, 0.64, 1)';

  const capsuleTransformTransition = reducedMotion
    ? 'none'
    : `transform ${navDurationMs}ms ${capsuleMorphEasing} ${navDelayMs}ms`;

  const tabButtonTransition = reducedMotion
    ? 'none'
    : `transform ${navDurationMs}ms ${capsuleMorphEasing} ${navDelayMs}ms`;

  const fabTransition = reducedMotion
    ? 'none'
    : showQuickEntryFab
    ? 'transform 300ms cubic-bezier(0.34, 1.48, 0.64, 1) 80ms, opacity 160ms ease-out 80ms'
    : 'transform 135ms cubic-bezier(0.4, 0, 0.88, 0.55) 0ms, opacity 105ms ease-out 0ms';

  return (
    <div
      className="fixed bottom-4 inset-x-4 z-40 md:hidden flex justify-center pointer-events-none"
      style={{ transform: 'translate3d(0, 0, 0)', isolation: 'isolate', contain: 'layout style' }}
    >
      <div ref={dockRef} className="relative w-full max-w-[420px] h-[56px] flex items-center">
        {/* Composited Outer Elevation Shadow (centered under capsule so circular ends never show stretched corner glow) */}
        <div
          aria-hidden="true"
          className="glass-chrome-bottom-shadow pointer-events-none absolute top-0 h-[56px] rounded-full"
          style={{
            left: '12px',
            width: `${Math.max(120, dockWidth - 24)}px`,
            transformOrigin: 'left center',
            transform: `translate3d(0, 0, 0) scaleX(${(Math.max(120, activeDockWidth - 24) / Math.max(120, dockWidth - 24)).toFixed(4)})`,
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: capsuleTransformTransition,
          }}
        />

        {/* Pure Compositor Morphing Glass Capsule Backdrop */}
        <div
          aria-hidden="true"
          className="glass-chrome-bottom pointer-events-none absolute left-0 top-0 h-[56px] rounded-full"
          style={{
            width: `${dockWidth}px`,
            clipPath: `inset(0px ${capsuleShrinkOffset.toFixed(2)}px 0px 0px round 28px)`,
            WebkitClipPath: `inset(0px ${capsuleShrinkOffset.toFixed(2)}px 0px 0px round 28px)`,
            transform: 'translate3d(0, 0, 0)',
            willChange: 'clip-path, transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: reducedMotion
              ? 'none'
              : `clip-path ${navDurationMs}ms ${capsuleMorphEasing} ${navDelayMs}ms`,
          }}
        />

        {/* Zero-Stretch 3-Part Capsule Hairline Border (True 28px circular caps + straight scaleX horizontal edges) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[56px]"
          style={{ width: `${dockWidth}px` }}
        >
          {/* Left True 28px Semicircle */}
          <div className="absolute left-0 top-0 bottom-0 w-[28px] overflow-hidden">
            <div className="w-[56px] h-[56px] rounded-full border border-slate-950/[0.06] dark:border-white/[0.09]" />
          </div>

          {/* Center Straight Top & Bottom Borders (scaling straight lines preserves exact 1px stroke weight) */}
          <div
            className="absolute top-0 bottom-0 border-t border-b border-slate-950/[0.06] dark:border-white/[0.09]"
            style={{
              left: '28px',
              width: `${Math.max(1, dockWidth - 56)}px`,
              transformOrigin: 'left center',
              transform: `translate3d(0, 0, 0) scaleX(${(Math.max(1, activeDockWidth - 56) / Math.max(1, dockWidth - 56)).toFixed(4)})`,
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transition: capsuleTransformTransition,
            }}
          />

          {/* Right True 28px Semicircle (translates cleanly with zero scaling) */}
          <div
            className="absolute right-0 top-0 bottom-0 w-[28px] overflow-hidden"
            style={{
              transform: `translate3d(-${capsuleShrinkOffset.toFixed(2)}px, 0, 0)`,
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transition: capsuleTransformTransition,
            }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-[56px] rounded-full border border-slate-950/[0.06] dark:border-white/[0.09]" />
          </div>
        </div>

        {/* Constant-size Interactive Overlay Track */}
        <nav
          onPointerDown={handleNavPointerDown}
          onPointerMove={handleNavPointerMove}
          onPointerUp={handleNavPointerUp}
          onPointerCancel={handleNavPointerCancel}
          className="relative z-10 w-full h-[56px] p-[5px] flex items-center touch-none select-none pointer-events-auto"
        >
          <div ref={trackRef} className="relative w-full h-full">
            {/* Borderless GPU Sliding Active Pill (clip-path preserves exact circular ends at any width) */}
            <div
              ref={pillRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-slate-950/[0.085] dark:bg-white/[0.14] border-0"
              style={{
                width: `${fullColWidth}px`,
                transformOrigin: 'center center',
                transform: `translate3d(${pillTranslateX.toFixed(2)}px, 0, 0) scale(${pillScale})`,
                clipPath: `inset(0px ${pillSideInset.toFixed(2)}px 0px ${pillSideInset.toFixed(2)}px round ${pillRadius.toFixed(1)}px)`,
                WebkitClipPath: `inset(0px ${pillSideInset.toFixed(2)}px 0px ${pillSideInset.toFixed(2)}px round ${pillRadius.toFixed(1)}px)`,
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transition: pillTransition,
              }}
            />

            {(() => {
              const isHomeActive = highlightedTab === 'home' || highlightedTab === 'daily_transactions';
              const isCustomersActive = highlightedTab === 'customers';
              const isGoalsActive = highlightedTab === 'goals';
              const isSettingsActive = highlightedTab === 'settings';
              const iconSpringStyle = (isActive: boolean): React.CSSProperties => ({
                transform: isActive
                  ? 'translate3d(0, -1px, 0) scale(1.07)'
                  : 'translate3d(0, 0, 0) scale(1)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transition: reducedMotion
                  ? 'none'
                  : 'transform 280ms cubic-bezier(0.32, 1.36, 0.64, 1)',
              });
              const labelSpringStyle = (isActive: boolean): React.CSSProperties => ({
                transform: isActive ? 'translate3d(0, 0, 0) scale(1.01)' : 'translate3d(0, 0.5px, 0) scale(0.99)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transition: reducedMotion
                  ? 'none'
                  : 'transform 260ms cubic-bezier(0.32, 1.32, 0.64, 1)',
              });

              const tabItems: Array<{
                id?: string;
                tab: AppTab;
                isActive: boolean;
                label: string;
                Icon: typeof House;
              }> = [
                { tab: 'home', isActive: isHomeActive, label: labels.dashboard, Icon: House },
                { id: 'nav_customers_tab', tab: 'customers', isActive: isCustomersActive, label: labels.clients, Icon: Users },
                { id: 'nav_goals_tab', tab: 'goals', isActive: isGoalsActive, label: labels.goals, Icon: Goal },
                { id: 'nav_settings_tab', tab: 'settings', isActive: isSettingsActive, label: labels.settings, Icon: Settings },
              ];

              return tabItems.map(({ id, tab, isActive, label, Icon }, idx) => {
                const tabTranslateX = (idx + 0.5) * activeColWidth - shrunkColWidth / 2;
                return (
                  <button
                    key={tab}
                    id={id}
                    type="button"
                    onClick={(e) => handleKeyboardClick(e, tab)}
                    className={`absolute inset-y-0 left-0 z-10 rounded-full cursor-pointer transition-colors duration-150 will-change-transform ${
                      isActive
                        ? 'text-slate-950 dark:text-white font-bold'
                        : 'text-slate-500 dark:text-slate-400 font-medium'
                    }`}
                    style={{
                      width: `${shrunkColWidth}px`,
                      transform: `translate3d(${tabTranslateX.toFixed(2)}px, 0, 0)`,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transition: tabButtonTransition,
                    }}
                  >
                    <span className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                      <Icon className="w-4.5 h-4.5 stroke-[1.35]" style={iconSpringStyle(isActive)} />
                      <span className="text-[10px] leading-tight" style={labelSpringStyle(isActive)}>{label}</span>
                    </span>
                  </button>
                );
              });
            })()}
          </div>
        </nav>

        <button
          type="button"
          onClick={showQuickEntryFab ? onOpenQuickEntry : undefined}
          aria-hidden={!showQuickEntryFab}
          tabIndex={showQuickEntryFab ? 0 : -1}
          className={`absolute right-0 bottom-0 z-20 touch-manipulation w-[56px] h-[56px] rounded-full text-white shrink-0 ${
            showQuickEntryFab ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
          }`}
          style={{
            backgroundColor: 'var(--accent-color)',
            boxShadow: '0 18px 36px -8px var(--accent-glow), 0 6px 14px -4px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255,255,255,0.35)',
            transform: showQuickEntryFab
              ? 'translate3d(0, 0, 0) scale(1)'
              : 'translate3d(0, 76px, 0) scale(0.74)',
            opacity: showQuickEntryFab ? 1 : 0,
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transition: fabTransition,
          }}
          title={labels.recordEntry}
          id="fab_entry_btn"
        >
          <span className="w-full h-full rounded-full flex items-center justify-center transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.86] hover:scale-[1.03]">
            <Plus className="w-6 h-6 stroke-[1.5]" />
          </span>
        </button>
      </div>
    </div>
  );
});

export default function App() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <AppContent reducedMotion={reducedMotion} />
    </MotionConfig>
  );
}

function AppContent({ reducedMotion }: { reducedMotion: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  const [selectedCustomerIdForDetail, setSelectedCustomerIdForDetail] = useState<string | null>(null);
  const navRafRef = React.useRef<number | null>(null);
  const navTimerRef = React.useRef<number | null>(null);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() =>
    typeof window !== 'undefined' ? (window as any).__deferredInstallPrompt || null : null
  );
  const [googleLoading, setGoogleLoading] = useState(false);
  const [swipeGesturesEnabled, setSwipeGesturesEnabled] = useState(() => localStorage.getItem('swipe_gestures_enabled') !== 'false');
  const [showDashboardReminders, setShowDashboardReminders] = useState(() => localStorage.getItem('show_dashboard_reminders') !== 'false');
  const [showTagChart, setShowTagChart] = useState(() => localStorage.getItem('show_tag_chart') !== 'false');
  const [highlightedTxId, setHighlightedTxId] = useState<string | null>(null);
  const [isAccentModalOpen, setIsAccentModalOpen] = useState(false);
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  const [activeAccentHex, setActiveAccentHex] = useState(getSavedAccentColor);
  const [biometricUnlocked, setBiometricUnlocked] = useState<boolean>(() => isBiometricSessionUnlocked());

  const handleToggleDashboardReminders = useCallback((val: boolean) => {
    setShowDashboardReminders(val);
    try {
      localStorage.setItem('show_dashboard_reminders', val ? 'true' : 'false');
    } catch {}
  }, []);

  const handleToggleTagChart = useCallback((val: boolean) => {
    setShowTagChart(val);
    try {
      localStorage.setItem('show_tag_chart', val ? 'true' : 'false');
    } catch {}
  }, []);

  const handleSwipeGesturesToggle = useCallback((val: boolean) => {
    setSwipeGesturesEnabled(val);
    try {
      localStorage.setItem('swipe_gestures_enabled', val ? 'true' : 'false');
    } catch {}
  }, []);

  const handleLockBiometricSession = useCallback(() => {
    const activeUid = user?.uid || auth.currentUser?.uid || 'local-guest-session';
    setBiometricEnabledState(true, activeUid);
    setBiometricSessionUnlocked(false);
    setBiometricUnlocked(false);
  }, [user]);

  const handleInstallComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      (window as any).__deferredInstallPrompt = null;
    }
    setDeferredPrompt(null);
  }, []);

  useEffect(() => {
    applyAccentColor(getSavedAccentColor());
    applyThemePalette(getSavedThemePalette());
    const handleAccentChange = (e: any) => {
      if (e.detail?.hex) {
        setActiveAccentHex(e.detail.hex);
      }
    };
    window.addEventListener('accent-color-changed', handleAccentChange);
    return () => window.removeEventListener('accent-color-changed', handleAccentChange);
  }, []);

  const isQuickEntryOpenRef = React.useRef(isQuickEntryOpen);
  React.useEffect(() => {
    isQuickEntryOpenRef.current = isQuickEntryOpen;
  }, [isQuickEntryOpen]);

  const isAccentModalOpenRef = React.useRef(isAccentModalOpen);
  React.useEffect(() => {
    isAccentModalOpenRef.current = isAccentModalOpen;
  }, [isAccentModalOpen]);

  // Reset scroll height to top on tab or selected customer changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentTab, selectedCustomerIdForDetail]);

 useEffect(() => {
   if ((window as any).__deferredInstallPrompt) {
     setDeferredPrompt((window as any).__deferredInstallPrompt);
   }
   const handleBeforeInstallPrompt = (e: any) => {
     e.preventDefault();
     (window as any).__deferredInstallPrompt = e;
     setDeferredPrompt(e);
   };
   const handleEarlyPromptReady = () => {
     if ((window as any).__deferredInstallPrompt) {
       setDeferredPrompt((window as any).__deferredInstallPrompt);
     }
   };
   const handleAppInstalled = () => {
     (window as any).__deferredInstallPrompt = null;
     setDeferredPrompt(null);
   };
   window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
   window.addEventListener('challan-install-prompt-ready', handleEarlyPromptReady);
   window.addEventListener('appinstalled', handleAppInstalled);
   window.addEventListener('challan-app-installed', handleAppInstalled);
   return () => {
     window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
     window.removeEventListener('challan-install-prompt-ready', handleEarlyPromptReady);
     window.removeEventListener('appinstalled', handleAppInstalled);
     window.removeEventListener('challan-app-installed', handleAppInstalled);
   };
 }, []);

  const reducedMotionRef = React.useRef<boolean>(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    return () => {
      if (navRafRef.current !== null) {
        window.cancelAnimationFrame(navRafRef.current);
      }
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
      }
    };
  }, []);

  // History API / Breadcrumbs for Android Back Button support
  const navigateTo = useCallback((tab: AppTab, customerId: string | null = null, replace = false) => {
    triggerHaptic('single');

    const isMobileDockVisible = typeof window !== 'undefined' && window.innerWidth < 768;

    window.dispatchEvent(
      new CustomEvent('challan-nav-intent', {
        detail: { tab, customerId },
      })
    );
    if (navRafRef.current !== null) {
      window.cancelAnimationFrame(navRafRef.current);
      navRafRef.current = null;
    }
    if (navTimerRef.current !== null) {
      window.clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }

    const commitTabChange = () => {
      React.startTransition(() => {
        setCurrentTab(tab);
        setSelectedCustomerIdForDetail(customerId);
      });
      try {
        const state = { tab, customerId, quickEntry: false };
        const url = `?tab=${tab}${customerId ? `&c=${customerId}` : ''}`;
        if (replace) {
          window.history.replaceState(state, '', url);
        } else {
          window.history.pushState(state, '', url);
        }
      } catch {}
    };

    // Paint frame 0 of the dock animation first, then immediately mount the next tab cleanly
    if (isMobileDockVisible && !reducedMotionRef.current && !replace) {
      navRafRef.current = window.requestAnimationFrame(() => {
        navRafRef.current = null;
        navTimerRef.current = window.setTimeout(() => {
          navTimerRef.current = null;
          commitTabChange();
        }, 0);
      });
      return;
    }

    commitTabChange();
  }, []);

  const handleOpenReminders = useCallback(() => {
    navigateTo('reminders');
  }, [navigateTo]);

  const openQuickEntry = useCallback(() => {
    triggerHaptic('single');
    window.history.pushState({ ...window.history.state, quickEntry: true }, '', window.location.href);
    setIsQuickEntryOpen(true);
  }, []);

  const closeQuickEntry = useCallback(() => {
    triggerHaptic('tick');
    isQuickEntryOpenRef.current = false;
    setIsQuickEntryOpen(false);
    if (window.history.state?.quickEntry) {
      window.history.back();
    }
  }, []);

  const openAccentModal = useCallback(() => {
    triggerHaptic('single');
    window.history.pushState({ ...window.history.state, modal: 'accentPalette' }, '', window.location.href);
    setIsAccentModalOpen(true);
  }, []);

  const closeAccentModal = useCallback(() => {
    triggerHaptic('tick');
    isAccentModalOpenRef.current = false;
    setIsAccentModalOpen(false);
    if (window.history.state?.modal === 'accentPalette') {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    // Force open dashboard on fresh load regardless of previous URL
    setCurrentTab('home');
    setSelectedCustomerIdForDetail(null);
    setIsQuickEntryOpen(false);
    
    window.history.replaceState({ tab: 'home', customerId: null, quickEntry: false }, '', window.location.pathname + '?tab=home');

    const handlePopState = (e: PopStateEvent) => {
      setAppDialog(null);
      if (isAccentModalOpenRef.current && e.state?.modal !== 'accentPalette') {
        isAccentModalOpenRef.current = false;
        setIsAccentModalOpen(false);
      }
      const wasQuickEntryOpen = isQuickEntryOpenRef.current;
      const isNowQuickEntryOpen = e.state?.quickEntry || false;
      if (wasQuickEntryOpen && !isNowQuickEntryOpen) {
        triggerHaptic('tick');
      }
      if (e.state) {
        if (e.state.tab) {
          const nextTab = e.state.tab as AppTab;
          const nextCid = e.state.customerId !== undefined ? e.state.customerId : null;
          window.dispatchEvent(new CustomEvent('challan-nav-intent', { detail: { tab: nextTab, customerId: nextCid } }));
          React.startTransition(() => {
            setCurrentTab(nextTab);
            setSelectedCustomerIdForDetail(nextCid);
          });
        }
        if (!isNowQuickEntryOpen) {
          isQuickEntryOpenRef.current = false;
          setIsQuickEntryOpen(false);
        }
      } else {
        isQuickEntryOpenRef.current = false;
        setIsQuickEntryOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Cleanup any old senior mode remnants on mount + listen for open-daily-transactions
  useEffect(() => {
    document.documentElement.classList.remove('senior-mode');
    localStorage.removeItem('senior_mode');

    const handleOpenDailyTxs = () => {
      navigateTo('daily_transactions');
    };
    window.addEventListener('open-daily-transactions', handleOpenDailyTxs);
    return () => {
      window.removeEventListener('open-daily-transactions', handleOpenDailyTxs);
    };
  }, []);
 // Multilingual State ('bn' is Bangla, 'en' is English)
 const [lang, setLang] = useState<Language>(() => {
 return (localStorage.getItem('lang') as Language) || 'en';
 });

  const handleLangChange = useCallback((newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

 const t = translations[lang];

 const dockLabels = useMemo(() => ({
   dashboard: t.dashboard,
   clients: t.clients,
   goals: t.goals,
   settings: t.settings,
   recordEntry: t.recordEntry,
 }), [t.dashboard, t.clients, t.goals, t.settings, t.recordEntry]);



 // State for Theme
 const [theme, setTheme] = useState<'light' | 'dark'>(() => {
 return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
 });

 // Apply theme class to document element dynamically
 useEffect(() => {
 const root = document.documentElement;
 if (theme === 'dark') {
 root.classList.add('dark');
 } else {
 root.classList.remove('dark');
 }
 localStorage.setItem('theme', theme);
 }, [theme]);

 const [authError, setAuthError] = useState<string | null>(null);

  const [customDisplayName, setCustomDisplayName] = useState<string>('');

  // Sync Auth State
  useEffect(() => {
    const isGuest = localStorage.getItem('local_guest_session') === 'true';
    if (isGuest) {
      const savedGuestName = localStorage.getItem('custom_display_name_local-guest-session') || 'Guest Owner';
      setCustomDisplayName(savedGuestName);
      setUser({
        uid: 'local-guest-session',
        email: 'guest@challantrack.local',
        displayName: savedGuestName
      } as any);
      setAuthLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const savedOverride = localStorage.getItem(`custom_display_name_${currentUser.uid}`);
        setCustomDisplayName(currentUser.displayName || savedOverride || '');
        setUser(currentUser);
        localStorage.removeItem('local_guest_session');
      } else {
        if (localStorage.getItem('local_guest_session') !== 'true') {
          setCustomDisplayName('');
          setUser(null);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resolvedUserName = useMemo(() => {
    if (!user) return '';
    return (
      customDisplayName.trim() ||
      user.displayName ||
      localStorage.getItem(`custom_display_name_${user.uid}`) ||
      user.email?.split('@')[0] ||
      ''
    );
  }, [user, customDisplayName]);

  const greetingMessage = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return lang === 'bn' ? 'শুভ সকাল' : 'Good Morning';
    if (hour >= 12 && hour < 17) return lang === 'bn' ? 'শুভ দুপুর' : 'Good Afternoon';
    if (hour >= 17 && hour < 21) return lang === 'bn' ? 'শুভ সন্ধ্যা' : 'Good Evening';
    return lang === 'bn' ? 'শুভ রাত্রি' : 'Good Night';
  }, [lang]);

  const handleUpdateDisplayName = useCallback(async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || !user) return;
    localStorage.setItem(`custom_display_name_${user.uid}`, trimmed);
    setCustomDisplayName(trimmed);
    if (user.uid !== 'local-guest-session' && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: trimmed });
    } else {
      setUser((prev) => (prev ? ({ ...prev, displayName: trimmed } as User) : prev));
    }
  }, [user]);

  const [selectedDailyDate, setSelectedDailyDate] = useState<Date>(new Date());

 // Hook for full database state & synced offline storage
  const {
    customers,
    customerTransactions,
    allCustomerTransactions,
    dailyTransactions,
    todayTransactions,
    tagIntelligenceTransactions,
    reminders,
    settings,
    loading: ledgerLoading,
    isOfflineFallback,
    updateTheme,
    updateSettings,
    createCustomer,
    updateCustomerDetails,
    addTransaction,
    editTransaction,
    deleteTransaction,
    addReminder,
    toggleReminder,
    deleteReminder,
    deleteCustomer,
    trashCustomers,
    restoreCustomer,
    permanentlyDeleteCustomer,
    emptyTrash,
    importLedgerData,
    hasMoreCustomerTxs,
    customerTxLimit,
    loadMoreCustomerTransactions,
    resetCustomerTxLimit,
    monthlySummaries,
    sixMonthChartData,
    activeCustomerTxCount,
    exportBackup,
    rebuildMonthlySummaries,
    goals,
    goalsSynced,
    createGoal,
    addGoalContribution,
    deleteGoal,
    updateGoalStatus,
    updateGoalTitle,
    updateGoalNotes,
    editGoalContribution,
    deleteGoalContribution,
    archivedStatements,
    updateStatementAutoMerge,
    archiveCustomerExcessStatements,
    exportArchivedStatements,
    tagConfig,
    saveTagConfig
  } = useLedger(user?.uid, selectedDailyDate, selectedCustomerIdForDetail);

// End-of-Day Cash Summary Notification
  useEffect(() => {
    if (!user || !dailyTransactions || dailyTransactions.length === 0) return;

    if ('Notification' in window && window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }

    const checkAndNotify = () => {
      const now = new Date();
      if (now.getHours() >= 20) { // 8 PM or later
        const todayStr = now.toDateString();
        const lastNotifiedDate = localStorage.getItem('last_cash_summary_date');
        
        if (lastNotifiedDate !== todayStr && 'Notification' in window && window.Notification && window.Notification.permission === 'granted') {
          let todaysCash = 0;
          dailyTransactions.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate.toDateString() === todayStr && tx.type === 'payment') {
              todaysCash += tx.amount;
            }
          });
          
          if (todaysCash > 0) {
            showNotification(lang === 'bn' ? 'আজকের নগদ আদায়' : 'Daily Cash Summary', {
              body: lang === 'bn' 
                ? `আজকের মোট নগদ আদায়: ৳${formatNumber(todaysCash, 'bn')}` 
                : `Total cash collected today: ৳${formatNumber(todaysCash, 'en')}`,
              icon: '/icon-192.png'
            });
            localStorage.setItem('last_cash_summary_date', todayStr);
          }
        }
      }
    };

    checkAndNotify();
    const interval = setInterval(checkAndNotify, 60000);
    return () => clearInterval(interval);
  }, [user, dailyTransactions, lang]);

  // Automated Reminders & Monthly EMI 7-Day Advance Notification Scheduler
  useEffect(() => {
    if (!user || !reminders || reminders.length === 0) return;

    if ('Notification' in window && window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }

    const checkRemindersAndAlert = () => {
      const now = new Date();
      const todayDateStr = getLocalDateString(now);
      const nowTime = now.getTime();

      reminders.forEach((rem) => {
        if (!rem.active) return;

        // 1. Monthly EMI Reminder (7 days prior daily alert)
        if (rem.type === 'emi') {
          const dueDay = rem.emiDayOfMonth || new Date(rem.dueDate).getDate() || 1;
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();
          
          let targetDate = new Date(currentYear, currentMonth, dueDay);
          if (now.getDate() > dueDay) {
            targetDate = new Date(currentYear, currentMonth + 1, dueDay);
          }
          
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
          const diffDays = Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));

          // Send reminders frequently (every 2.5 hours) if within 7 days (7, 6, 5, 4, 3, 2, 1, 0 days remaining)
          if (diffDays >= 0 && diffDays <= 7) {
            const lastNotifiedKey = `last_notified_emi_${rem.id}`;
            const lastNotifiedTime = parseInt(localStorage.getItem(lastNotifiedKey) || '0');
            const hoursPassed = (nowTime - lastNotifiedTime) / (1000 * 60 * 60);

            if (hoursPassed >= 2.5) {
              const amountStr = rem.installmentAmount ? ` (৳${formatNumber(rem.installmentAmount, lang)})` : '';
              let bodyText = '';
              if (diffDays === 0) {
                bodyText = lang === 'bn' 
                  ? `আজ ${rem.customerName}-এর মাসিক কিস্তি${amountStr} পরিশোধের শেষ দিন!` 
                  : `Today is the due date for ${rem.customerName} monthly installment${amountStr}!`;
              } else if (diffDays === 1) {
                bodyText = lang === 'bn'
                  ? `আগামীকাল ${rem.customerName}-এর কিস্তি${amountStr} দেওয়ার সময় এসেছে।`
                  : `Tomorrow is the due date for ${rem.customerName} installment${amountStr}.`;
              } else {
                bodyText = lang === 'bn'
                  ? `আর মাত্র ${formatNumber(diffDays, 'bn')} দিন বাকি: ${rem.customerName}-এর মাসিক কিস্তি${amountStr} পরিশোধ করার প্রস্তুতি রাখুন।`
                  : `${diffDays} days remaining: Remember to prepare ${rem.customerName} monthly installment${amountStr}.`;
              }

              showNotification(lang === 'bn' ? 'চালান ট্র্যাক - কিস্তি রিমাইন্ডার' : 'Challan Track - EMI Reminder', {
                body: bodyText,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: `emi-${rem.id}`
              });

              triggerHaptic([300, 150, 300]);
              localStorage.setItem(lastNotifiedKey, String(nowTime));
            }
          }
        } else {
          // 2. Standard Customer Follow-up Reminder
          const remDueDate = new Date(rem.dueDate).getTime();
          if (remDueDate <= nowTime) {
            const lastNotifiedKey = `last_notified_rem_${rem.id}`;
            const lastNotifiedTime = parseInt(localStorage.getItem(lastNotifiedKey) || '0');
            const hoursPassed = (nowTime - lastNotifiedTime) / (1000 * 60 * 60);

            if (hoursPassed >= 2.5) {
              showNotification(lang === 'bn' ? 'চালান ট্র্যাক - বকেয়া তাগাদা' : 'Challan Track - Reminder', {
                body: lang === 'bn'
                  ? `${rem.customerName}: ${rem.notes || 'বকেয়া আদায়ের ফলো-আপ করার সময় হয়েছে।'}`
                  : `${rem.customerName}: ${rem.notes || 'Time to follow up on pending dues.'}`,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: `rem-${rem.id}`
              });

              triggerHaptic([200, 100, 200]);
              localStorage.setItem(lastNotifiedKey, String(nowTime));
            }
          }
        }
      });
    };

    checkRemindersAndAlert();
    const interval = setInterval(checkRemindersAndAlert, 60000);
    return () => clearInterval(interval);
  }, [user, reminders, lang]);



 // Virtual Custom Dialogue Popups to bypass sandboxed iframe alert()/confirm() blocks
 const [appDialog, setAppDialog] = useState<{
 isOpen: boolean;
 type: 'alert' | 'confirm';
 title: string;
 message: string;
 onConfirm: () => void;
 onCancel?: () => void;
 } | null>(null);

  useEffect(() => {
    if (!appDialog?.isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (appDialog.onCancel) appDialog.onCancel();
        setAppDialog(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [appDialog]);

  const triggerAlert = useCallback((title: string, message: string) => {
    toast.error(title, { description: message });
  }, []);

  const triggerConfirm = useCallback((title: string, message: string, onConfirmCallback: () => void) => {
    window.history.pushState({ ...window.history.state, dialogOpen: true }, '', window.location.href);
    setAppDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm: () => {
        if (window.history.state?.dialogOpen) {
          window.history.replaceState({ ...window.history.state, dialogOpen: false }, '', window.location.href);
        }
        onConfirmCallback();
        setAppDialog(null);
      },
      onCancel: () => {
        if (window.history.state?.dialogOpen) window.history.back();
        setAppDialog(null);
      }
    });
  }, []);

  const activeViewTransitionRef = React.useRef<any>(null);
  const themeSwitchTimerRef = React.useRef<number | null>(null);

  const handleThemeChange = useCallback(async (newTheme: 'light' | 'dark', origin?: { x: number; y: number }) => {
    if (typeof document === 'undefined') {
      setTheme(newTheme);
      return;
    }

    const root = document.documentElement;
    const currentIsDark = root.classList.contains('dark');
    const nextIsDark = newTheme === 'dark';
    if (currentIsDark === nextIsDark) return;

    if (activeViewTransitionRef.current && typeof activeViewTransitionRef.current.skipTransition === 'function') {
      try {
        activeViewTransitionRef.current.skipTransition();
      } catch {}
    }
    if (themeSwitchTimerRef.current !== null) {
      window.clearTimeout(themeSwitchTimerRef.current);
      themeSwitchTimerRef.current = null;
    }

    const systemReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const startViewTransition = (document as any).startViewTransition?.bind(document);

    if (typeof startViewTransition === 'function' && !reducedMotion && !systemReduced) {
      const cx = origin ? Math.round(origin.x) : Math.round(window.innerWidth / 2);
      const cy = origin ? Math.round(origin.y) : Math.round(window.innerHeight / 2);
      const maxRadius = Math.ceil(
        Math.hypot(
          Math.max(cx, window.innerWidth - cx),
          Math.max(cy, window.innerHeight - cy)
        )
      ) + 32;

      root.style.setProperty('--theme-clip-x', `${cx}px`);
      root.style.setProperty('--theme-clip-y', `${cy}px`);
      root.style.setProperty('--theme-clip-r', `${maxRadius}px`);
      root.setAttribute('data-theme-transition', nextIsDark ? 'expand' : 'collapse');

      try {
        const vt = startViewTransition(() => {
          root.classList.add('theme-switching');
          flushSync(() => {
            root.classList.toggle('dark', nextIsDark);
            setTheme(newTheme);
          });
          try {
            localStorage.setItem('theme', newTheme);
          } catch {}
        });

        activeViewTransitionRef.current = vt;

        vt.ready
          .then(() => {
            if (activeViewTransitionRef.current !== vt) return;
            if (nextIsDark) {
              // Expand outward from click point: new dark mode grows to cover entire screen
              root.animate(
                {
                  clipPath: [
                    `circle(0px at ${cx}px ${cy}px)`,
                    `circle(${maxRadius}px at ${cx}px ${cy}px)`,
                  ],
                },
                {
                  duration: 480,
                  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                  fill: 'both',
                  pseudoElement: '::view-transition-new(root)',
                }
              );
            } else {
              // Collapse inward into click point: old dark mode shrinks into point zero revealing light mode underneath
              root.animate(
                {
                  clipPath: [
                    `circle(${maxRadius}px at ${cx}px ${cy}px)`,
                    `circle(0px at ${cx}px ${cy}px)`,
                  ],
                },
                {
                  duration: 480,
                  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                  fill: 'both',
                  pseudoElement: '::view-transition-old(root)',
                }
              );
            }
          })
          .catch(() => {});

        vt.finished.finally(() => {
          if (activeViewTransitionRef.current === vt) {
            activeViewTransitionRef.current = null;
            root.classList.remove('theme-switching');
            root.removeAttribute('data-theme-transition');
            root.style.removeProperty('--theme-clip-x');
            root.style.removeProperty('--theme-clip-y');
            root.style.removeProperty('--theme-clip-r');
          }
        });
        return;
      } catch {
        root.removeAttribute('data-theme-transition');
        root.style.removeProperty('--theme-clip-x');
        root.style.removeProperty('--theme-clip-y');
        root.style.removeProperty('--theme-clip-r');
      }
    }

    root.classList.add('theme-switching');
    flushSync(() => {
      root.classList.toggle('dark', nextIsDark);
      setTheme(newTheme);
    });
    try {
      localStorage.setItem('theme', newTheme);
    } catch {}
    themeSwitchTimerRef.current = window.setTimeout(() => {
      root.classList.remove('theme-switching');
      themeSwitchTimerRef.current = null;
    }, 60);
  }, []);

 // Handle Log In Mechanisms
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const errCode = err?.code || '';

      // If user closed or cancelled the popup window, do not trigger a disruptive error alert
      if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
        setGoogleLoading(false);
        return;
      }

      let userFriendlyMessage = lang === 'bn'
        ? 'এই মুহূর্তে গুগল দিয়ে লগইন করা যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা গেস্ট মোড ব্যবহার করুন।'
        : 'Google sign-in is unavailable right now. Please try again later or continue as Guest.';

      if (errCode === 'auth/popup-blocked') {
        userFriendlyMessage = lang === 'bn'
          ? 'আপনার ব্রাউজার লগইন পপআপ উইন্ডোটি ব্লক করেছে। অনুগ্রহ করে এই সাইটের জন্য পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন।'
          : 'Your browser blocked the sign-in window. Please allow popups for this site and try again.';
      } else if (errCode === 'auth/network-request-failed') {
        userFriendlyMessage = lang === 'bn'
          ? 'ইন্টারনেট সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আপনার সংযোগ যাচাই করে আবার চেষ্টা করুন।'
          : 'Unable to connect right now. Please check your internet connection and try again.';
      } else if (errCode === 'auth/too-many-requests') {
        userFriendlyMessage = lang === 'bn'
          ? 'অনেকবার চেষ্টা করার কারণে সাময়িকভাবে লগইন স্থগিত আছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
          : 'Too many sign-in attempts. Please wait a moment and try again.';
      }

      setAuthError(userFriendlyMessage);

      triggerAlert(
        lang === 'bn' ? 'লগইন সম্পন্ন হয়নি' : 'Sign-In Unavailable',
        userFriendlyMessage
      );
    } finally {
      setGoogleLoading(false);
    }
  };

 const handleGuestSignIn = () => {
 localStorage.setItem('local_guest_session', 'true');
 const savedGuestName = localStorage.getItem('custom_display_name_local-guest-session') || 'Guest Owner';
 setCustomDisplayName(savedGuestName);
 setUser({
 uid: 'local-guest-session',
 email: 'guest@challantrack.local',
 displayName: savedGuestName
 } as any);
 };

 const handleSignOut = async () => {
  triggerHaptic('double');
 triggerConfirm(
 lang === 'bn' ? 'লগ আউট নিশ্চিতকরণ' : 'Confirm Sign Out',
 t.signOutConfirm,
 async () => {
 try {
 localStorage.removeItem('local_guest_session');
 setBiometricSessionUnlocked(false);
 setBiometricUnlocked(false);
 setUser(null);
 await signOut(auth);
 navigateTo('home', null, true);
 } catch (err) {
 console.error(err);
 }
 }
 );
 };

  // Nav helpers
  const navigateToCustomer = useCallback((id: string, replace = false) => {
    setIsQuickEntryOpen(false);
    navigateTo('customers', id, replace);
  }, [navigateTo]);

  const handleSelectCustomerId = useCallback((id: string | null) => {
    navigateTo('customers', id);
  }, [navigateTo]);

  const handleViewDailyTxs = useCallback(() => {
    navigateTo('daily_transactions');
  }, [navigateTo]);

  const activeRemindersCount = useMemo(
    () => reminders.reduce((count, r) => (r.active ? count + 1 : count), 0),
    [reminders]
  );

  const dailyTotals = useMemo(() => {
    let dues = 0;
    let got = 0;
    for (const tx of dailyTransactions) {
      if (tx.type === 'due') dues += tx.amount;
      else if (tx.type === 'payment') got += tx.amount;
    }
    return { dues, got, count: dailyTransactions.length };
  }, [dailyTransactions]);

  if (authLoading) {
    return (
      <>
        <Toaster 
          theme={theme} 
          position="bottom-center"
          duration={2500}
          toastOptions={{ 
            className: 'sonner-custom-toast',
            style: {
              backgroundColor: theme === 'dark' ? 'rgba(var(--theme-bg-surface-rgb, 18, 18, 22), 0.97)' : 'rgba(var(--theme-light-surface-rgb, 255, 255, 255), 0.97)',
              backdropFilter: 'blur(28px) saturate(190%)',
              WebkitBackdropFilter: 'blur(28px) saturate(190%)',
              color: theme === 'dark' ? '#FAFAFA' : '#09090B',
              border: theme === 'dark' ? '1px solid rgba(var(--accent-rgb, 16, 185, 129), 0.32)' : '1px solid rgba(var(--accent-rgb, 5, 150, 105), 0.28)',
              boxShadow: theme === 'dark' ? '0 24px 48px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(var(--accent-rgb, 16, 185, 129), 0.18)' : '0 20px 40px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(var(--accent-rgb, 5, 150, 105), 0.14)'
            }
          }} 
        />
        <AppShellSkeleton />
      </>
    );
  }

  // --- 1. SIGN IN LANDING SCREEN (REDESIGNED FOR DESKTOP & MOBILE) ---
  if (!user) {
    return (
      <div
        key="auth-view"
        id="auth_view"
        className="shell-fade-enter relative min-h-[100dvh] bg-white dark:bg-[#090D14] text-slate-900 dark:text-slate-100 flex flex-col justify-between px-5 py-6 sm:px-8 sm:py-8 no-select transition-colors"
      >
        <div aria-hidden="true" className="app-ambient-backdrop">
          <div className="app-ambient-grid" />
          <div className="app-ambient-noise" />
        </div>
        <Toaster
          theme={theme}
          position="bottom-center"
          duration={2500}
          toastOptions={{
            className: 'sonner-custom-toast',
            style: {
              backgroundColor: theme === 'dark' ? 'rgba(var(--theme-bg-surface-rgb, 18, 18, 22), 0.97)' : 'rgba(var(--theme-light-surface-rgb, 255, 255, 255), 0.97)',
              backdropFilter: 'blur(28px) saturate(190%)',
              WebkitBackdropFilter: 'blur(28px) saturate(190%)',
              color: theme === 'dark' ? '#FAFAFA' : '#09090B',
              border: theme === 'dark' ? '1px solid rgba(var(--accent-rgb, 16, 185, 129), 0.32)' : '1px solid rgba(var(--accent-rgb, 5, 150, 105), 0.28)',
              boxShadow: theme === 'dark' ? '0 24px 48px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(var(--accent-rgb, 16, 185, 129), 0.18)' : '0 20px 40px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(var(--accent-rgb, 5, 150, 105), 0.14)'
            }
          }}
        />

        {/* Minimal Top Utility Bar */}
        <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className={lang === 'bn' ? 'font-bold text-slate-700 dark:text-slate-300' : 'micro-mono-label text-slate-600 dark:text-slate-300'}>
              {lang === 'bn' ? 'ডিজিটাল খতিয়ান ও হিসাব' : 'Personal & Business Ledger'}
            </span>
          </div>

          <div className="hidden md:flex items-center justify-end gap-2 w-auto">
            <button
              type="button"
              onClick={(e) => {
                triggerHaptic('single');
                const iconEl = e.currentTarget.querySelector('svg');
                const rect = (iconEl ?? e.currentTarget).getBoundingClientRect();
                handleThemeChange(theme === 'dark' ? 'light' : 'dark', {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                });
              }}
              className="touch-press surface-glass-interactive px-3.5 py-2 border rounded-full text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-2 text-xs font-semibold"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 stroke-[1.35]" /> : <Moon className="w-3.5 h-3.5 stroke-[1.35]" />}
              <span>{theme === 'dark' ? (lang === 'bn' ? 'লাইট' : 'Light') : (lang === 'bn' ? 'ডার্ক' : 'Dark')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('single');
                handleLangChange(lang === 'bn' ? 'en' : 'bn');
              }}
              className="touch-press surface-glass-interactive px-3.5 py-2 border rounded-full font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 stroke-[1.35]" />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>
          </div>
        </header>

        {/* Main Center Stage: Asymmetric Editorial Desktop / Above-the-Fold Mobile */}
        <main className="relative z-10 w-full max-w-md md:max-w-5xl mx-auto my-auto py-8 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-7 md:gap-14 lg:gap-16 items-center">
            {/* Brand Hero (Order 1 on Mobile & Left Column Top on Desktop) */}
            <div className="md:col-span-7 flex flex-col space-y-6 md:space-y-8">
              <div className="space-y-3.5">
                <ChallanTrackLogo size="xl" variant="full" />
                <p className="text-sm sm:text-base md:text-[17px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-md">
                  {t.ledgerForTablet}
                </p>
              </div>

              {/* Quick Descriptions Section — Above Auth Sheet on Mobile, Left Column on Desktop */}
              <div className="block divide-y divide-slate-900/[0.08] dark:divide-white/[0.08] border-y border-slate-900/[0.08] dark:border-white/[0.08] max-w-lg">
                <div className="flex items-start gap-4 py-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.05] flex items-center justify-center shrink-0 mt-0.5">
                    <ArrowUpRight className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--accent-color)' }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-950 dark:text-white">{t.trackAndDeduct}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{t.trackDesc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 py-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.05] flex items-center justify-center shrink-0 mt-0.5">
                    <Globe className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--accent-color)' }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-950 dark:text-white">{t.cloudSync}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{t.cloudDesc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 py-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.05] flex items-center justify-center shrink-0 mt-0.5">
                    <Bell className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--accent-color)' }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-950 dark:text-white">{t.simpleAlerts}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{t.alertsDesc}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Auth Sheet (Below Quick Descriptions on Mobile, Right Column on Desktop) */}
            <div className="md:col-span-5 relative overflow-hidden surface-hero-glass border rounded-[32px] p-6 sm:p-8 space-y-6">
              {/* Specular Top Accent Rim */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 top-0 h-[1px] opacity-75"
                style={{
                  background: 'linear-gradient(90deg, transparent, var(--accent-color), transparent)'
                }}
              />

              <div className="space-y-1.5">
                <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold text-slate-500 dark:text-slate-400'}>
                  {lang === 'bn' ? 'অ্যাকাউন্ট অ্যাক্সেস' : 'Workspace Access'}
                </span>
                <h2 className="text-2xl font-display font-extrabold tracking-tight text-slate-950 dark:text-white leading-tight">
                  {lang === 'bn' ? 'অ্যাকাউন্টে প্রবেশ করুন' : 'Sign in to Continue'}
                </h2>
                <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'bn'
                    ? 'আপনার ব্যবসা খতিয়ান ও ব্যাকআপ সিঙ্ক করতে যুক্ত হন'
                    : 'Access live balances, reminders, and automatic cloud sync'}
                </p>
              </div>

              {/* Preserved Login Button Design */}
              <div className="space-y-3">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="touch-press w-full py-3.5 rounded-full text-white font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer text-sm disabled:opacity-75 disabled:cursor-not-allowed select-none"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    boxShadow: '0 14px 30px -10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.28)'
                  }}
                  id="google_signin_btn"
                >
                  {googleLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  {googleLoading ? (lang === 'bn' ? 'লগইন হচ্ছে...' : 'Signing in...') : t.googleSignIn}
                </button>

                <button
                  onClick={handleGuestSignIn}
                  className="touch-press w-full py-3.5 surface-subcard border rounded-full text-slate-900 dark:text-white font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-sm select-none"
                  id="guest_signin_btn"
                >
                  {t.guestSignIn}
                </button>
              </div>

              {authError && (
                <div className="bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-medium flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{authError}</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-900/[0.06] dark:border-white/[0.07] text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed flex items-start gap-2.5">
                <Lock className="w-3.5 h-3.5 stroke-[1.35] shrink-0 mt-0.5 opacity-75" />
                <span>
                  {lang === 'bn'
                    ? 'ক্লাউড সিঙ্ক: আপনার হিসাব সুরক্ষিত রাখতে গুগল দিয়ে নিরাপদে লগইন করুন।'
                    : 'Cloud Sync keeps your ledger calculations protected and synced across devices.'}
                </span>
              </div>
            </div>
          </div>
        </main>

        {/* Anchored Minimal Footer */}
        <footer className="relative z-10 w-full max-w-5xl mx-auto pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <span className="hidden sm:inline">{t.offlineNotice}</span>
          <span className="hidden sm:inline font-mono text-[10px] opacity-70">ChallanTrack</span>
        </footer>
      </div>
    );
  }

 // --- 1.5 SEPARATE BIOMETRIC AUTHENTICATION LOGIN SCREEN ---
 if (user && isBiometricEnabled(user.uid) && !biometricUnlocked) {
   return (
     <>
       <Toaster 
         theme={theme} 
         position="bottom-center" 
         offset={{ bottom: 24 }}
         mobileOffset={{ bottom: 76, left: 16, right: 16 }}
         duration={2500}
         visibleToasts={2}
         gap={8}
         toastOptions={{
           className: 'sonner-custom-toast',
           style: {
             backgroundColor: theme === 'dark' ? 'rgba(var(--theme-bg-surface-rgb, 18, 18, 22), 0.97)' : 'rgba(var(--theme-light-surface-rgb, 255, 255, 255), 0.97)',
             backdropFilter: 'blur(28px) saturate(190%)',
             WebkitBackdropFilter: 'blur(28px) saturate(190%)',
             color: theme === 'dark' ? '#FAFAFA' : '#09090B',
             border: theme === 'dark' ? '1px solid rgba(var(--accent-rgb, 16, 185, 129), 0.32)' : '1px solid rgba(var(--accent-rgb, 5, 150, 105), 0.28)',
             boxShadow: theme === 'dark' ? '0 24px 48px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(var(--accent-rgb, 16, 185, 129), 0.18)' : '0 20px 40px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(var(--accent-rgb, 5, 150, 105), 0.14)'
           }
         }}
       />
       <BiometricLockScreen
         userId={user.uid}
         userEmail={user.email || 'ChallanTrack User'}
         userName={resolvedUserName || undefined}
         theme={theme}
         onThemeChange={handleThemeChange}
         lang={lang}
         onLangChange={handleLangChange}
         onUnlocked={() => setBiometricUnlocked(true)}
         onSignOut={async () => {
           try {
             localStorage.removeItem('local_guest_session');
             setBiometricSessionUnlocked(false);
             setBiometricUnlocked(false);
             setUser(null);
             await signOut(auth);
             navigateTo('home', null, true);
           } catch (err) {
             console.error(err);
           }
         }}
       />
     </>
   );
 }

  // --- 2. MAIN APP CONTAINER (LOGGED IN & TRANSLATED) ---
  return (
    <div
      key={`app-shell-${user.uid}`}
      className="shell-fade-enter relative min-h-screen bg-white dark:bg-[#090D14] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row no-select transition-colors"
    >
      <div aria-hidden="true" className="app-ambient-backdrop">
        <div className="app-ambient-grid" />
        <div className="app-ambient-noise" />
      </div>

      <Toaster 
        theme={theme} 
        position="bottom-center" 
        offset={{ bottom: 24 }}
        mobileOffset={{ bottom: 84, left: 16, right: 16 }}
        duration={2500}
        visibleToasts={2}
        gap={8}
        toastOptions={{
          className: 'sonner-custom-toast',
          style: {
            backgroundColor: theme === 'dark' ? 'rgba(var(--theme-bg-surface-rgb, 18, 18, 22), 0.97)' : 'rgba(var(--theme-light-surface-rgb, 255, 255, 255), 0.97)',
            backdropFilter: 'blur(28px) saturate(190%)',
            WebkitBackdropFilter: 'blur(28px) saturate(190%)',
            color: theme === 'dark' ? '#FAFAFA' : '#09090B',
            border: theme === 'dark' ? '1px solid rgba(var(--accent-rgb, 16, 185, 129), 0.32)' : '1px solid rgba(var(--accent-rgb, 5, 150, 105), 0.28)',
            boxShadow: theme === 'dark' ? '0 24px 48px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(var(--accent-rgb, 16, 185, 129), 0.18)' : '0 20px 40px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(var(--accent-rgb, 5, 150, 105), 0.14)'
          }
        }}
      />

      {/* DESKTOP ONLY: Left Sidebar (Floating Pill-Sculpted Executive Rail) */}
      <aside className="hidden md:flex flex-col w-60 lg:w-64 shrink-0 sticky top-3 md:m-3 md:mr-0 h-[calc(100vh-1.5rem)] rounded-3xl exec-sidebar z-20 transition-colors justify-between p-4 lg:p-5 select-none overflow-hidden">
        <div aria-hidden="true" className="exec-sidebar-glass" />

        {/* Top: Brand & Primary Navigation */}
        <div className="relative z-10 space-y-4">
          <div 
            onClick={() => { triggerHaptic('single'); navigateTo('home'); }}
            className="flex items-center gap-3 py-1 cursor-pointer group select-none active:scale-[0.98] transition-transform"
            role="button"
            tabIndex={0}
            title={lang === 'bn' ? 'হোমে ফিরে যান' : 'Go to Home'}
          >
            <ChallanTrackLogo size="md" variant="full" />
          </div>

          {/* Primary Quick Entry Button */}
          <button
            onClick={openQuickEntry}
            className="w-full py-2.5 px-3.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] transition-all border border-slate-950 dark:border-white"
            id="sidebar_quick_entry_btn"
          >
            <Plus className="w-4 h-4 stroke-[1.5]" />
            <span>{lang === 'bn' ? 'হিসাব লিখুন' : 'New Entry'}</span>
          </button>

          {/* Sidebar Navigation Items */}
          {(() => {
            const activeSidebarIndex =
              currentTab === 'customers'
                ? 1
                : currentTab === 'goals'
                ? 2
                : currentTab === 'reminders'
                ? 3
                : currentTab === 'settings'
                ? 4
                : 0;

            return (
              <nav className="relative flex flex-col gap-1.5 mt-2">
                {/* Single Container-Relative GPU Sliding Pill (Immune to scroll resets & sub-view switches) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-slate-950 dark:bg-white rounded-xl border-2 border-slate-950 dark:border-white shadow-xs z-0 will-change-transform"
                  style={{
                    transform: `translate3d(0, ${activeSidebarIndex * 46}px, 0)`,
                    transition: 'transform 340ms cubic-bezier(0.34, 1.38, 0.64, 1)',
                  }}
                />

                {/* Home */}
                <button
                  onClick={() => navigateTo('home')}
                  className={`relative z-10 w-full h-10 flex items-center gap-3 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-98 ${
                    currentTab === 'home' || currentTab === 'daily_transactions'
                      ? 'text-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-900/[0.04] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.05]'
                  }`}
                  id="sidebar_nav_home"
                >
                  <House className="w-4 h-4 stroke-[1.25] shrink-0" />
                  <span className="flex-1 text-left">{t.dashboard}</span>
                </button>

                {/* Customers / Clients */}
                <button
                  onClick={() => navigateTo('customers')}
                  className={`relative z-10 w-full h-10 flex items-center gap-3 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-98 ${
                    currentTab === 'customers'
                      ? 'text-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-900/[0.04] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.05]'
                  }`}
                  id="sidebar_nav_customers"
                >
                  <Users className="w-4 h-4 stroke-[1.25] shrink-0" />
                  <span className="flex-1 text-left">{t.clients}</span>
                </button>

                {/* Goals */}
                <button
                  onClick={() => navigateTo('goals')}
                  className={`relative z-10 w-full h-10 flex items-center gap-3 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-98 ${
                    currentTab === 'goals'
                      ? 'text-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-900/[0.04] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.05]'
                  }`}
                  id="sidebar_nav_goals"
                >
                  <Goal className="w-4 h-4 stroke-[1.25] shrink-0" />
                  <span className="flex-1 text-left">{t.goals}</span>
                </button>

                {/* Reminders */}
                <button
                  onClick={() => { triggerHaptic('single'); navigateTo('reminders'); }}
                  className={`relative z-10 w-full h-10 flex items-center gap-3 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-98 ${
                    currentTab === 'reminders'
                      ? 'text-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-900/[0.04] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.05]'
                  }`}
                  id="sidebar_nav_reminders"
                >
                  {activeRemindersCount > 0 ? (
                    <BellDot className="w-4 h-4 stroke-[1.25] shrink-0 text-amber-500" />
                  ) : (
                    <Bell className="w-4 h-4 stroke-[1.25] shrink-0" />
                  )}
                  <span className="flex-1 text-left">{t.reminders}</span>
                  {activeRemindersCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      {formatNumber(activeRemindersCount, lang)}
                    </span>
                  )}
                </button>

                {/* Settings */}
                <button
                  onClick={() => navigateTo('settings')}
                  className={`relative z-10 w-full h-10 flex items-center gap-3 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-98 ${
                    currentTab === 'settings'
                      ? 'text-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-900/[0.04] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.05]'
                  }`}
                  id="sidebar_nav_settings"
                >
                  <Settings className="w-4 h-4 stroke-[1.25] shrink-0" />
                  <span className="flex-1 text-left">{t.settings}</span>
                </button>
              </nav>
            );
          })()}
        </div>

        {/* Bottom Utility Controls & Profile */}
        <div className="relative z-10 pt-4 border-t border-slate-200/70 dark:border-white/[0.08] space-y-3">
          {/* Quick Utility Row: Theme, Palette, Lang */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={(e) => {
                triggerHaptic('single');
                const iconEl = e.currentTarget.querySelector('svg');
                const rect = (iconEl ?? e.currentTarget).getBoundingClientRect();
                handleThemeChange(theme === 'dark' ? 'light' : 'dark', {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                });
              }}
              className="py-2 px-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 stroke-[1.25]" /> : <Moon className="w-4 h-4 stroke-[1.25]" />}
            </button>

            <button
              onClick={openAccentModal}
              className="py-2 px-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              title={lang === 'bn' ? 'থিম ও কালার' : 'Theme & Palette'}
            >
              <Palette className="w-4 h-4 stroke-[1.25]" />
            </button>

            <button
              onClick={() => {
                triggerHaptic('single');
                handleLangChange(lang === 'bn' ? 'en' : 'bn');
              }}
              className="py-2 px-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer transition-colors text-xs font-bold"
              title="Toggle language"
            >
              {lang === 'bn' ? 'EN' : 'বাং'}
            </button>
          </div>

          {/* User Account / Sign Out Row */}
          {user && (
            <div className="flex items-center justify-between p-2.5 rounded-xl surface-subcard border border-slate-200/60 dark:border-white/[0.06]">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                  {resolvedUserName || user.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  {user.email || ''}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                title={t.signOutBtn}
              >
                <LogOut className="w-4 h-4 stroke-[1.25]" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-6">
        {/* Floating Glass Capsule Mobile Top Bar */}
        <header className="md:hidden sticky top-3 z-30 px-4 pointer-events-none">
          <div className="pointer-events-auto relative overflow-hidden max-w-6xl mx-auto glass-chrome-header rounded-full p-1 flex items-center justify-between gap-2 transition-colors">
            {/* Subtle Ambient Top Edge Rim Highlight */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-0 h-[1px] opacity-70"
              style={{
                background: 'linear-gradient(90deg, transparent, var(--accent-color), transparent)'
              }}
            />

            <button
              type="button"
              onClick={() => { triggerHaptic('single'); navigateTo('home'); }}
              className="flex items-center gap-2.5 cursor-pointer select-none touch-press min-w-0 text-left focus:outline-none"
              title={lang === 'bn' ? 'হোমে ফিরে যান' : 'Go to Home'}
            >
              <ChallanTrackMark size={38} className="ml-[2px] shrink-0" />
              <ChallanTrackLogo size="sm" variant="compact" className="pr-1" />
            </button>

            {/* Recessed Liquid Utility Capsule */}
            <div className="flex items-center gap-0.5 p-1 rounded-full bg-slate-900/[0.045] dark:bg-white/[0.06] border border-slate-900/[0.05] dark:border-white/[0.07] shrink-0">
              <button
                type="button"
                onClick={openAccentModal}
                className="touch-press relative w-8 h-8 rounded-full flex items-center justify-center text-slate-800 dark:text-white hover:bg-white/75 dark:hover:bg-white/[0.1] cursor-pointer transition-colors"
                title={lang === 'bn' ? 'থিম ও অ্যাকসেন্ট কালার' : 'Theme & Palette'}
                id="header_accent_palette_btn"
              >
                <Palette className="w-[15px] h-[15px] stroke-[1.35]" />
              </button>

              <button
                type="button"
                onClick={() => { triggerHaptic('single'); navigateTo('reminders'); }}
                className={`touch-press relative w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  currentTab === 'reminders'
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                    : 'text-slate-800 dark:text-white hover:bg-white/75 dark:hover:bg-white/[0.1]'
                }`}
                title={t.reminders}
                id="header_reminders_btn"
              >
                {activeRemindersCount > 0 ? (
                  <BellDot className="w-[15px] h-[15px] stroke-[1.35]" />
                ) : (
                  <Bell className="w-[15px] h-[15px] stroke-[1.35]" />
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  triggerHaptic('single');
                  const iconEl = e.currentTarget.querySelector('svg');
                  const rect = (iconEl ?? e.currentTarget).getBoundingClientRect();
                  handleThemeChange(theme === 'dark' ? 'light' : 'dark', {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                  });
                }}
                className="touch-press w-8 h-8 rounded-full flex items-center justify-center text-slate-800 dark:text-white hover:bg-white/75 dark:hover:bg-white/[0.1] cursor-pointer transition-colors"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-[15px] h-[15px] stroke-[1.35]" /> : <Moon className="w-[15px] h-[15px] stroke-[1.35]" />}
              </button>
            </div>
          </div>
        </header>

        {/* Main Core Content Stage (Global top margin compensates for floating navbar) */}
        <main className="relative flex-1 max-w-6xl w-full mx-auto mt-3 sm:mt-4 pt-4 sm:pt-6 px-4 pb-6 sm:px-6 mb-8">
 
 {/* Loading skeleton for ledger initialization */}
 {ledgerLoading && (
   <DashboardSkeleton />
 )}

 {/* Dynamic Route/Component loading */}
 {!ledgerLoading && (
 <ViewTransition viewKey={`${currentTab}-${user.uid}`}>
 <div className="space-y-6">
 {currentTab === 'home' && (
 <Dashboard 
  customers={customers}
  transactions={todayTransactions}
  tagTransactions={tagIntelligenceTransactions}
  transactionsCount={settings?.transactionsCount || 0}
  monthlySummaries={monthlySummaries}
  sixMonthChartData={sixMonthChartData}
  onOpenQuickEntry={openQuickEntry}
  onSelectCustomer={navigateToCustomer}
  lang={lang}
  onViewDailyTxs={handleViewDailyTxs}
  userName={resolvedUserName}
  greetingMessage={greetingMessage}
  reminders={reminders}
  showDashboardReminders={showDashboardReminders}
  onOpenReminders={handleOpenReminders}
  onOpenManageTags={() => setIsManageTagsOpen(true)}
  showTagChart={showTagChart}
  />
 )}

 {currentTab === 'customers' && (
 <CustomerManager 
 customers={customers}
 transactions={customerTransactions}
 allTransactions={allCustomerTransactions}
 createCustomer={createCustomer}
 addTransaction={addTransaction}
 editTransaction={editTransaction}
 deleteTransaction={deleteTransaction}
 updateCustomerDetails={updateCustomerDetails}
 deleteCustomer={deleteCustomer}
 selectedCustomerId={selectedCustomerIdForDetail}
 setSelectedCustomerId={handleSelectCustomerId} hasMoreTxs={hasMoreCustomerTxs} loadMoreTransactions={loadMoreCustomerTransactions} customerTxLimit={customerTxLimit} resetCustomerTxLimit={resetCustomerTxLimit}
 activeCustomerTxCount={activeCustomerTxCount}
 lang={lang}
 triggerConfirm={triggerConfirm}
 swipeGesturesEnabled={swipeGesturesEnabled}
 highlightedTxId={highlightedTxId}
 setHighlightedTxId={setHighlightedTxId}
 archivedStatements={archivedStatements}
 archiveCustomerExcessStatements={archiveCustomerExcessStatements}
 exportArchivedStatements={exportArchivedStatements}
 />
 )}

 {currentTab === 'reminders' && (
 <RemindersManager 
 reminders={reminders}
 customers={customers}
 goals={goals}
 addReminder={addReminder}
 toggleReminder={toggleReminder}
 deleteReminder={deleteReminder}
 dailyReminderTime={settings?.dailyReminderTime || '09:00'}
updateSettings={updateSettings}
 lang={lang}
 />
 )}

 {currentTab === 'goals' && (
  <GoalsManager 
  goals={goals}
  goalsSynced={goalsSynced}
  customers={customers}
  createGoal={createGoal}
  addGoalContribution={addGoalContribution}
  deleteGoal={deleteGoal}
  updateGoalStatus={updateGoalStatus}
  updateGoalTitle={updateGoalTitle}
  updateGoalNotes={updateGoalNotes}
  editGoalContribution={editGoalContribution}
  deleteGoalContribution={deleteGoalContribution}
  reminders={reminders}
  addReminder={addReminder}
  deleteReminder={deleteReminder}
  lang={lang}
  />
  )}

  {currentTab === 'settings' && (
  <SettingsManager 
          theme={theme}
          settings={settings}
          updateTheme={handleThemeChange}
          customers={customers}
          exportBackup={exportBackup}
          rebuildMonthlySummaries={rebuildMonthlySummaries}
          onSignOut={handleSignOut}
          lang={lang}
          onLangChange={handleLangChange}
          deferredPrompt={deferredPrompt}
          onInstallComplete={handleInstallComplete}
          trashCustomers={trashCustomers}
          restoreCustomer={restoreCustomer}
          permanentlyDeleteCustomer={permanentlyDeleteCustomer}
          emptyTrash={emptyTrash}
          swipeGesturesEnabled={swipeGesturesEnabled}
          onSwipeGesturesToggle={handleSwipeGesturesToggle}
          showDashboardReminders={showDashboardReminders}
          onToggleDashboardReminders={handleToggleDashboardReminders}
          importLedgerData={importLedgerData}
          userId={user?.uid}
          userEmail={user?.email || 'ChallanTrack User'}
          userName={resolvedUserName}
          onUpdateDisplayName={handleUpdateDisplayName}
          userPhotoURL={user?.photoURL || user?.providerData?.find((p) => p?.photoURL)?.photoURL || null}
          archivedStatements={archivedStatements}
          updateStatementAutoMerge={updateStatementAutoMerge}
          onUpdateStatementAutoMerge={updateStatementAutoMerge}
          exportArchivedStatements={exportArchivedStatements}
          onExportArchivedStatements={exportArchivedStatements}
          onLockBiometricSession={handleLockBiometricSession}
          showTagChart={showTagChart}
          onToggleTagChart={handleToggleTagChart}
          tagConfig={tagConfig}
          saveTagConfig={saveTagConfig}
        />
  )}

      {currentTab === 'daily_transactions' && (
        <div className="space-y-6 no-select animate-reveal pb-24">
          {/* Open Editorial Date Header */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigateTo('home')}
                className="touch-press w-10 h-10 surface-glass-interactive border rounded-full flex items-center justify-center cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4 stroke-[1.25] text-slate-900 dark:text-white" />
              </button>
              <div className="min-w-0">
                <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                  {lang === 'bn' ? 'দৈনিক খাতা' : 'Daily Journal'}
                </span>
                <p className="text-xl sm:text-2xl font-display font-extrabold text-slate-950 dark:text-white tracking-tight truncate">
                  {selectedDailyDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="relative shrink-0">
              <NativeDatePicker
                value={getLocalDateString(selectedDailyDate)}
                onChange={(val) => {
                  if (val) {
                    const [year, month, day] = val.split('-').map(Number);
                    setSelectedDailyDate(new Date(year, month - 1, day));
                  }
                }}
                lang={lang}
                iconOnly
                title={lang === 'bn' ? 'আর্কাইভ তারিখ নির্বাচন' : 'Select Archive Date'}
              />
            </div>
          </div>

          {/* Open Hairline Telemetry Totals */}
          <div className="pt-2 pb-4 border-b border-slate-900/[0.08] dark:border-white/[0.08] grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                {lang === 'bn' ? 'মোট বকেয়া' : 'Total Dues'}
              </div>
              <div className="text-lg sm:text-xl font-display font-bold text-ledger-red tabular-nums">
                +৳ {formatNumber(dailyTotals.dues, lang)}
              </div>
            </div>
            <div className="space-y-1">
              <div className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                {lang === 'bn' ? 'মোট আদায়' : 'Total Got'}
              </div>
              <div className="text-lg sm:text-xl font-display font-bold text-ledger-green tabular-nums">
                -৳ {formatNumber(dailyTotals.got, lang)}
              </div>
            </div>
            <div className="space-y-1">
              <div className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                {lang === 'bn' ? 'মোট হিসাব' : 'Entries'}
              </div>
              <div className="text-lg sm:text-xl font-display font-bold text-slate-950 dark:text-white tabular-nums">
                {formatNumber(dailyTotals.count, lang)}
              </div>
            </div>
          </div>

          {selectedDailyDate.toDateString() !== new Date().toDateString() && (
            <div className="flex justify-center shrink-0">
              <button
                onClick={() => setSelectedDailyDate(new Date())}
                className="touch-press surface-glass-interactive py-2 px-4 text-slate-950 dark:text-white border text-xs font-bold rounded-full cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 stroke-[1.25]" />
                <span>{lang === 'bn' ? 'আজকের দিনে ফিরে যান' : 'Back to Today'}</span>
              </button>
            </div>
          )}

          {/* Hairline Journal Entries */}
          <div className="surface-glass border rounded-[26px] overflow-hidden">
            <div className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
              {dailyTransactions.length === 0 ? (
                <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <ClipboardList className="w-8 h-8 stroke-[1.25] opacity-40" />
                    <p className="font-semibold text-sm">
                      {selectedDailyDate.toDateString() === new Date().toDateString()
                        ? (lang === 'bn' ? 'আজ কোন লেনদেন হয়নি' : 'No transactions recorded today')
                        : (lang === 'bn' ? 'এই তারিখে কোন লেনদেন নেই' : 'No transactions recorded for this date')}
                    </p>
                  </div>
                </div>
              ) : (
                dailyTransactions.map(tx => (
                  <div
                    key={tx.id}
                    onClick={() => navigateTo('customers', tx.customerId)}
                    className="px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.03] transition-colors cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${
                        tx.type === 'due'
                          ? 'bg-ledger-red-subtle text-ledger-red'
                          : 'bg-ledger-green-subtle text-ledger-green'
                      }`}>
                        <TagIcon tag={tx.tag} type={tx.type} className="w-4 h-4 stroke-[1.25]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm sm:text-base font-semibold text-slate-950 dark:text-white truncate">
                          {tx.customerName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title={tx.description}>
                          {tx.description || (tx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`font-bold text-base sm:text-lg tabular-nums font-mono ${
                        tx.type === 'due' ? 'text-ledger-red' : 'text-ledger-green'
                      }`}>
                        {tx.type === 'due' ? '+' : '-'} ৳{formatNumber(tx.amount, lang)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono tabular-nums flex items-center justify-end gap-1.5">
                        {tx.isEdited && (
                          <span className="font-sans">
                            {lang === 'bn' ? 'সম্পাদিত ·' : 'Edited ·'}
                          </span>
                        )}
                        <span>{(lang === 'bn' ? APP_TIME_FORMATTER_BN : APP_TIME_FORMATTER_EN).format(parseFirestoreDate(tx.date))}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </ViewTransition>
  )}
  </main>
  </div>

  {/* MOBILE DYNAMIC-ISLAND FLOATING DOCK + DETACHED QUICK ENTRY ORB */}
  <MobileBottomDock
    syncedTab={currentTab}
    syncedCustomerId={selectedCustomerIdForDetail}
    onNavigate={navigateTo}
    onOpenQuickEntry={openQuickEntry}
    labels={dockLabels}
    reducedMotion={reducedMotion}
  />

  {/* RENDER MASTER QUICK_ADD FORM MODAL */}
  <QuickEntryModal 
    isOpen={isQuickEntryOpen}
    onClose={closeQuickEntry}
    customers={customers}
    createCustomer={createCustomer}
    addTransaction={addTransaction}
    preselectedCustomerId={selectedCustomerIdForDetail || undefined}
    lang={lang}
    transactions={allCustomerTransactions.length > 0 ? allCustomerTransactions : todayTransactions}
    onViewCustomer={navigateToCustomer}
    highlightedTxId={highlightedTxId}
    setHighlightedTxId={setHighlightedTxId}
  />

  {/* CUSTOM ACCENT COLOR PICKER MODAL */}
  <AccentColorPickerModal
    isOpen={isAccentModalOpen}
    onClose={closeAccentModal}
    lang={lang}
  />

  {/* DASHBOARD MANAGE TAGS MODAL */}
  <ManageTagsModal
    isOpen={isManageTagsOpen}
    onClose={() => setIsManageTagsOpen(false)}
    lang={lang}
    tagConfig={tagConfig}
    onSaveTagConfig={saveTagConfig}
  />

  {/* MOBILE / TABLET CALCULATOR NUMERIC KEYPAD (7-8-9 Top Row) */}
  <CalculatorKeypad lang={lang} />

  {/* BASE DIALOG & CONFIRMATION MODALS */}
  {appDialog && appDialog.isOpen && (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden no-select">
        {/* Backdrop */}
        <div
          onClick={() => {
            if (appDialog.onCancel) appDialog.onCancel();
            setAppDialog(null);
          }}
          className="animate-backdrop-blur absolute inset-0 bg-slate-950/60 dark:bg-black/75"
        />

        {/* Modal Dialog Body */}
        <div
          onClick={e => e.stopPropagation()}
          className="animate-slide-up glass-modal border rounded-t-[2rem] sm:rounded-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 w-full sm:max-w-sm relative z-10 text-center space-y-5 max-h-[90dvh] overflow-y-auto hide-scrollbar shadow-2xl"
        >
          <div className="sm:hidden flex justify-center -mt-1 pb-1.5">
            <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full" />
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white tracking-tight">
              {appDialog.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {appDialog.message}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {appDialog.type === 'confirm' && (
              <button
                type="button"
                onClick={() => {
                  if (appDialog.onCancel) appDialog.onCancel();
                  setAppDialog(null);
                }}
                className="touch-press flex-1 py-3 surface-subcard text-slate-900 dark:text-white font-bold rounded-full text-xs transition-colors cursor-pointer border"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            )}
            <button
              type="button"
              onClick={appDialog.onConfirm}
              className="touch-press flex-1 py-3 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold rounded-full text-xs transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'ঠিক আছে' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )}

  </div>
  );
}
