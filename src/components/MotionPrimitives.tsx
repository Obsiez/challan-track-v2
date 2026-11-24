import React, { useEffect, useRef, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// Singleton Reduced Motion + User "Disable All Transitions" Subscription
// ---------------------------------------------------------------------------
export const DISABLE_TRANSITIONS_STORAGE_KEY = 'challan_disable_transitions';

let reducedMotionQuery: MediaQueryList | null = null;
const reducedMotionListeners = new Set<() => void>();

export function areTransitionsDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISABLE_TRANSITIONS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTransitionsDisabled(disabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISABLE_TRANSITIONS_STORAGE_KEY, disabled ? 'true' : 'false');
  } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('reduce-motion', disabled);
  }
  reducedMotionListeners.forEach((cb) => cb());
  window.dispatchEvent(new CustomEvent('transitions-toggle-changed', { detail: { disabled } }));
}

// Sync initial class on module load
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('reduce-motion', areTransitionsDisabled());
}

function subscribeReducedMotion(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  if (!reducedMotionQuery && window.matchMedia) {
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionQuery.addEventListener('change', () => {
      reducedMotionListeners.forEach((cb) => cb());
    });
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === DISABLE_TRANSITIONS_STORAGE_KEY) {
      document.documentElement.classList.toggle('reduce-motion', areTransitionsDisabled());
      reducedMotionListeners.forEach((cb) => cb());
    }
  };
  window.addEventListener('storage', onStorage);
  reducedMotionListeners.add(listener);
  return () => {
    reducedMotionListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  if (areTransitionsDisabled()) return true;
  if (!window.matchMedia) return false;
  if (!reducedMotionQuery) {
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  return reducedMotionQuery.matches;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
}

// ---------------------------------------------------------------------------
// Singleton IntersectionObserver for StaggerReveal (0 per-card observers, 0 React re-renders)
// ---------------------------------------------------------------------------
const revealCallbacks = new WeakMap<Element, () => void>();
let sharedRevealObserver: IntersectionObserver | null = null;

function getSharedRevealObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return null;
  }
  if (!sharedRevealObserver) {
    sharedRevealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = revealCallbacks.get(entry.target);
            if (cb) {
              revealCallbacks.delete(entry.target);
              sharedRevealObserver?.unobserve(entry.target);
              cb();
            }
          }
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px 48px 0px' }
    );
  }
  return sharedRevealObserver;
}

interface StaggerRevealProps {
  children: React.ReactNode;
  index?: number;
  staggerMs?: number;
  className?: string;
  as?: 'div' | 'section' | 'li';
}

export function StaggerReveal({
  children,
  index = 0,
  staggerMs = 24,
  className = '',
  as = 'div',
}: StaggerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef<boolean>(false);
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    isVisibleRef.current = true;
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let settleTimer: number | null = null;
    const markSettledLater = () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      const delayMs = Math.min(index, 4) * staggerMs + 280;
      settleTimer = window.setTimeout(() => {
        el.classList.add('reveal-settled');
      }, delayMs);
    };

    if (reducedMotion) {
      isVisibleRef.current = true;
      el.classList.add('is-visible', 'reveal-settled');
      return;
    }

    if (isVisibleRef.current) {
      el.classList.add('is-visible', 'reveal-settled');
      return;
    }

    const observer = getSharedRevealObserver();
    if (!observer) {
      isVisibleRef.current = true;
      el.classList.add('is-visible', 'reveal-settled');
      return;
    }

    revealCallbacks.set(el, () => {
      isVisibleRef.current = true;
      el.classList.add('is-visible');
      markSettledLater();
    });
    observer.observe(el);

    return () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      revealCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, [reducedMotion, index, staggerMs]);

  const delay = Math.min(index, 4) * staggerMs;
  const Tag = as as any;

  return (
    <Tag
      ref={ref}
      className={`motion-stagger-item ${isVisibleRef.current ? 'is-visible reveal-settled' : ''} ${className}`}
      style={
        reducedMotion
          ? undefined
          : ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties)
      }
    >
      {children}
    </Tag>
  );
}

interface ScrollParallaxStageProps {
  children: React.ReactNode;
  className?: string;
  rangePx?: number;
  disabled?: boolean;
}

/**
 * Passive GPU-only scroll parallax stage for open hero balance sections.
 * Gently scales down and softens opacity as the user scrolls past on mobile & desktop.
 */
export function ScrollParallaxStage({
  children,
  className = '',
  rangePx = 220,
  disabled = false,
}: ScrollParallaxStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (disabled || reducedMotion || typeof window === 'undefined') {
      if (el) {
        el.style.transform = '';
        el.style.opacity = '';
      }
      return;
    }
    let rafId: number | null = null;

    const update = () => {
      const node = ref.current;
      if (!node) return;
      const scrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
      const progress = Math.min(1, scrollY / rangePx);
      if (progress <= 0.001) {
        if (node.style.transform) node.style.transform = '';
        if (node.style.opacity) node.style.opacity = '';
        return;
      }
      const scale = 1 - progress * 0.055;
      const translateY = progress * 14;
      const opacity = 1 - progress * 0.45;
      node.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
      node.style.opacity = opacity.toFixed(3);
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion, rangePx, disabled]);

  return (
    <div
      ref={ref}
      className={`origin-top ${disabled || reducedMotion ? '' : 'will-change-transform'} ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Zero-Lag Coordinator for Clients List Cards:
// 1. Subtle blurry reveal ONLY when cards reveal from bottom as user scrolls down
// 2. Absolute compositor scroll shrink-and-fade as cards scroll up past top
// ---------------------------------------------------------------------------
interface ClientCardRegistration {
  revealEl: HTMLElement;
  shrinkEl: HTMLElement;
  revealAnimated: () => void;
  settleImmediately: () => void;
}

const activeClientCards = new Set<ClientCardRegistration>();
let clientShrinkScrollBound = false;
let clientShrinkRafId: number | null = null;
let clientShrinkSettleTimer: number | null = null;

function flushClientCardShrink() {
  if (clientShrinkRafId !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(clientShrinkRafId);
    clientShrinkRafId = null;
  }
  if (typeof window === 'undefined' || activeClientCards.size === 0) return;

  // Trigger shrink only once the card reaches the header/top exit zone (not too early)
  const topTriggerY = window.innerWidth >= 768 ? 24 : 54;
  const vh = window.innerHeight;

  // Pass 1: batched layout reads on untransformed outer revealEl boxes
  const measurements: Array<{
    reg: ClientCardRegistration;
    top: number;
    bottom: number;
    height: number;
  }> = [];

  activeClientCards.forEach((reg) => {
    const rect = reg.revealEl.getBoundingClientRect();
    measurements.push({
      reg,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
    });
  });

  // Pass 2: batched compositor writes along exact, deterministic path
  for (let i = 0; i < measurements.length; i++) {
    const { reg, top, bottom, height } = measurements[i];
    const { shrinkEl } = reg;

    // Trigger smooth blurry reveal for newer cards entering from below,
    // and only settle immediately if already scrolled completely off-screen above.
    if (bottom < 0) {
      reg.settleImmediately();
    } else if (top < vh + 24) {
      reg.revealAnimated();
    }

    if (top >= topTriggerY) {
      if (shrinkEl.style.transform) shrinkEl.style.transform = '';
      if (shrinkEl.style.opacity) shrinkEl.style.opacity = '';
      if (shrinkEl.style.willChange) shrinkEl.style.willChange = '';
      continue;
    }

    const shrinkRange = Math.max(115, Math.min(168, (height || 134) * 1.0));
    const progress = Math.min(1, Math.max(0, (topTriggerY - top) / shrinkRange));

    if (progress <= 0.001) {
      if (shrinkEl.style.transform) shrinkEl.style.transform = '';
      if (shrinkEl.style.opacity) shrinkEl.style.opacity = '';
      if (shrinkEl.style.willChange) shrinkEl.style.willChange = '';
      continue;
    }

    const scale = 1 - progress * 0.14;
    const translateY = progress * 14;
    const opacity = Math.max(0, 1 - progress * 0.98);

    shrinkEl.style.transformOrigin = '50% 0%';
    shrinkEl.style.willChange = progress < 1 ? 'transform, opacity' : 'auto';
    shrinkEl.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
    shrinkEl.style.opacity = opacity.toFixed(3);
  }
}

function scheduleClientCardShrink() {
  if (clientShrinkRafId !== null || typeof window === 'undefined') return;
  clientShrinkRafId = window.requestAnimationFrame(flushClientCardShrink);
}

function onClientScrollOrResize() {
  if (activeClientCards.size === 0) return;
  // Immediate synchronous pass eliminates 1-frame lag during ultra-fast wheel/touch flings
  flushClientCardShrink();

  if (clientShrinkSettleTimer !== null) {
    window.clearTimeout(clientShrinkSettleTimer);
  }
  clientShrinkSettleTimer = window.setTimeout(() => {
    clientShrinkSettleTimer = null;
    flushClientCardShrink();
  }, 48);
}

function ensureClientShrinkListeners(bind: boolean) {
  if (typeof window === 'undefined') return;
  if (bind && !clientShrinkScrollBound) {
    window.addEventListener('scroll', onClientScrollOrResize, { passive: true });
    window.addEventListener('scrollend', flushClientCardShrink, { passive: true });
    window.addEventListener('resize', onClientScrollOrResize, { passive: true });
    clientShrinkScrollBound = true;
  } else if (!bind && clientShrinkScrollBound) {
    window.removeEventListener('scroll', onClientScrollOrResize);
    window.removeEventListener('scrollend', flushClientCardShrink);
    window.removeEventListener('resize', onClientScrollOrResize);
    clientShrinkScrollBound = false;
    if (clientShrinkRafId !== null) {
      window.cancelAnimationFrame(clientShrinkRafId);
      clientShrinkRafId = null;
    }
    if (clientShrinkSettleTimer !== null) {
      window.clearTimeout(clientShrinkSettleTimer);
      clientShrinkSettleTimer = null;
    }
  }
}

interface ClientCardStageProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
}

export function ClientCardStage({
  children,
  index = 0,
  className = '',
}: ClientCardStageProps) {
  const revealRef = useRef<HTMLDivElement>(null);
  const shrinkRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef<boolean>(false);
  const settledRef = useRef<boolean>(false);
  const reducedMotion = usePrefersReducedMotion();

  // Top-of-page cards on initial load stay crisp (no blur); newer cards scrolling up from bottom get smooth blurry reveal
  useEffect(() => {
    const revealEl = revealRef.current;
    const shrinkEl = shrinkRef.current;
    if (!revealEl || !shrinkEl) return;

    if (reducedMotion) {
      revealedRef.current = true;
      settledRef.current = true;
      revealEl.classList.remove('client-card-reveal');
      revealEl.classList.add('is-visible', 'reveal-settled');
      shrinkEl.style.transform = '';
      shrinkEl.style.opacity = '';
      shrinkEl.style.willChange = '';
      return;
    }

    revealEl.classList.add('client-card-reveal');

    let settleTimer: number | null = null;
    const finishBlurReveal = () => {
      if (settledRef.current) return;
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      const delayMs = Math.min(index % 4, 3) * 18 + 300;
      settleTimer = window.setTimeout(() => {
        settledRef.current = true;
        revealEl.classList.add('reveal-settled');
      }, delayMs);
    };

    const revealAnimated = () => {
      if (revealedRef.current) return;
      revealedRef.current = true;
      revealCallbacks.delete(revealEl);
      sharedRevealObserver?.unobserve(revealEl);
      // Force initial blur frame to paint before transitioning to sharp when revealed synchronously
      if (!revealEl.classList.contains('is-visible')) {
        void revealEl.offsetHeight;
        revealEl.classList.add('is-visible');
      }
      finishBlurReveal();
    };

    const settleImmediately = () => {
      revealedRef.current = true;
      settledRef.current = true;
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      revealEl.classList.add('is-visible', 'reveal-settled');
      revealCallbacks.delete(revealEl);
      sharedRevealObserver?.unobserve(revealEl);
    };

    const reg: ClientCardRegistration = {
      revealEl,
      shrinkEl,
      revealAnimated,
      settleImmediately,
    };

    activeClientCards.add(reg);
    ensureClientShrinkListeners(true);
    scheduleClientCardShrink();

    if (settledRef.current) {
      revealEl.classList.add('is-visible', 'reveal-settled');
    } else if (revealedRef.current) {
      revealEl.classList.add('is-visible');
      finishBlurReveal();
    } else {
      const rect = revealEl.getBoundingClientRect();
      const initiallyVisible = rect.top < (window.innerHeight || 900) - 16;
      if (initiallyVisible) {
        settleImmediately();
      } else {
        const revealObserver = getSharedRevealObserver();
        if (!revealObserver) {
          settleImmediately();
        } else {
          revealCallbacks.set(revealEl, revealAnimated);
          revealObserver.observe(revealEl);
        }
      }
    }

    return () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      revealCallbacks.delete(revealEl);
      sharedRevealObserver?.unobserve(revealEl);
      activeClientCards.delete(reg);
      shrinkEl.style.transform = '';
      shrinkEl.style.opacity = '';
      shrinkEl.style.willChange = '';
      if (activeClientCards.size === 0) {
        ensureClientShrinkListeners(false);
      }
    };
  }, [reducedMotion, index]);

  const delay = Math.min(index % 4, 3) * 18;

  return (
    <div
      ref={revealRef}
      className={`client-card-reveal ${
        reducedMotion || settledRef.current
          ? 'is-visible reveal-settled'
          : revealedRef.current
          ? 'is-visible'
          : ''
      } ${className}`}
      style={
        reducedMotion
          ? undefined
          : ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties)
      }
    >
      <div ref={shrinkRef} className="origin-top">
        {children}
      </div>
    </div>
  );
}

interface CircularGaugeProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
  strokeColor?: string;
  trackColorClass?: string;
  label?: React.ReactNode;
  className?: string;
}

/**
 * Ultra-minimal SVG radial arc gauge for Collection Efficiency and Goal Progress rings.
 */
export function CircularGauge({
  percent,
  size = 64,
  strokeWidth = 4,
  colorClass = 'text-[var(--accent-color)]',
  strokeColor,
  trackColorClass = 'text-slate-900/10 dark:text-white/10',
  label,
  className = '',
}: CircularGaugeProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackColorClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor || 'currentColor'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`${strokeColor ? '' : colorClass} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      {label !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center">
          {label}
        </div>
      )}
    </div>
  );
}

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function SpotlightCard({
  children,
  className = '',
  onPointerMove,
  onPointerLeave,
  ...rest
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const isInsideRef = useRef<boolean>(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const clearSpotlight = () => {
    isInsideRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = cardRef.current;
    if (el) {
      el.style.setProperty('--spot-opacity', '0');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (onPointerMove) onPointerMove(e);
    if (reducedMotion || e.pointerType === 'touch') return;
    const el = cardRef.current;
    if (!el) return;

    isInsideRef.current = true;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (!isInsideRef.current) {
        el.style.setProperty('--spot-opacity', '0');
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      el.style.setProperty('--spot-x', `${x}px`);
      el.style.setProperty('--spot-y', `${y}px`);
      el.style.setProperty('--spot-opacity', '1');
    });
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (onPointerLeave) onPointerLeave(e);
    clearSpotlight();
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((rest as any).onMouseLeave) (rest as any).onMouseLeave(e);
    clearSpotlight();
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onMouseLeave={handleMouseLeave}
      className={`spotlight-surface relative overflow-hidden ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

interface ViewTransitionProps {
  viewKey: string;
  children: React.ReactNode;
  className?: string;
}

export function ViewTransition({ viewKey, children, className = '' }: ViewTransitionProps) {
  return (
    <div key={viewKey} className={`motion-view-enter ${className}`}>
      {children}
    </div>
  );
}
