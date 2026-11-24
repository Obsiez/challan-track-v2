import React, { useRef, useEffect, useCallback } from 'react';

interface ScrollSafeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  ariaLabel?: string;
}

export default function ScrollSafeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  className = '',
  ariaLabel = 'Slider',
}: ScrollSafeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);
  const pendingValueRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const mouseDownRef = useRef<boolean>(false);
  const touchHandledRef = useRef<boolean>(false);
  const lastTouchEndAtRef = useRef<number>(0);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setVisualPercent = useCallback(
    (val: number) => {
      const pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`;
      }
      if (thumbRef.current) {
        thumbRef.current.style.left = `${pct}%`;
      }
    },
    [min, max]
  );

  // Sync external value updates when not actively dragging
  useEffect(() => {
    valueRef.current = value;
    if (!isDraggingRef.current) {
      setVisualPercent(value);
    }
  }, [value, setVisualPercent]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const emitChange = useCallback(
    (nextVal: number, flushImmediate = false) => {
      valueRef.current = nextVal;
      setVisualPercent(nextVal);

      if (flushImmediate) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        pendingValueRef.current = null;
        onChangeRef.current(nextVal);
        return;
      }

      pendingValueRef.current = nextVal;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (pendingValueRef.current !== null) {
            const valToEmit = pendingValueRef.current;
            pendingValueRef.current = null;
            onChangeRef.current(valToEmit);
          }
        });
      }
    },
    [setVisualPercent]
  );

  const computeValueFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return valueRef.current;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return valueRef.current;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round((raw - min) / step) * step + min;
      return Math.max(min, Math.min(max, Number(stepped.toFixed(4))));
    },
    [min, max, step]
  );

  const touchStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    startTime: number;
    maxDist: number;
    scrolledDuringTouch: boolean;
    mode: 'undecided' | 'horizontal' | 'vertical';
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    startTime: 0,
    maxDist: 0,
    scrolledDuringTouch: false,
    mode: 'undecided',
  });

  // Track active scroll ONLY while a touch gesture is in progress so prior scrolls never block clicks/taps
  useEffect(() => {
    const handleScroll = () => {
      if (touchStateRef.current.active && touchStateRef.current.mode !== 'horizontal') {
        touchStateRef.current.scrolledDuringTouch = true;
        touchStateRef.current.mode = 'vertical';
        isDraggingRef.current = false;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  // Native non-passive touch listeners: instant taps, smooth horizontal scrubbing, unblocked vertical scroll
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const setThumbActive = (active: boolean) => {
      if (!thumbRef.current) return;
      thumbRef.current.style.transform = active
        ? 'translate3d(-50%, -50%, 0) scale(1.22)'
        : 'translate3d(-50%, -50%, 0) scale(1)';
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchStateRef.current.active = false;
        touchStateRef.current.mode = 'vertical';
        isDraggingRef.current = false;
        setThumbActive(false);
        return;
      }

      const t = e.touches[0];
      touchHandledRef.current = false;
      touchStateRef.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        startTime: performance.now(),
        maxDist: 0,
        scrolledDuringTouch: false,
        mode: 'undecided',
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = touchStateRef.current;
      if (!state.active || state.mode === 'vertical' || e.touches.length !== 1) return;

      const t = e.touches[0];
      state.lastX = t.clientX;
      const dx = Math.abs(t.clientX - state.startX);
      const dy = Math.abs(t.clientY - state.startY);
      const dist = Math.hypot(dx, dy);
      if (dist > state.maxDist) state.maxDist = dist;

      if (state.mode === 'undecided') {
        if (state.scrolledDuringTouch) {
          state.mode = 'vertical';
          isDraggingRef.current = false;
          setThumbActive(false);
          return;
        }
        // Wait for crisp slop before deciding direction so micro-rolls don't falsely lock vertical
        if (dist < 7) return;

        if (dy > 10 && dy > dx * 1.18) {
          state.mode = 'vertical';
          isDraggingRef.current = false;
          setThumbActive(false);
          return;
        }

        if (dx >= 6 && dx >= dy * 0.72) {
          state.mode = 'horizontal';
          isDraggingRef.current = true;
          touchHandledRef.current = true;
          setThumbActive(true);
        } else {
          return;
        }
      }

      if (state.mode === 'horizontal') {
        if (e.cancelable) {
          e.preventDefault();
        }
        const next = computeValueFromClientX(t.clientX);
        if (next !== valueRef.current) {
          emitChange(next, false);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const now = performance.now();
      lastTouchEndAtRef.current = now;
      const state = touchStateRef.current;

      if (state.active) {
        const endClientX =
          e.changedTouches.length > 0 ? e.changedTouches[0].clientX : state.lastX;

        if (state.mode === 'horizontal') {
          const finalVal = computeValueFromClientX(endClientX);
          touchHandledRef.current = true;
          emitChange(finalVal, true);
        } else if (
          state.mode === 'undecided' &&
          !state.scrolledDuringTouch &&
          state.maxDist < 14
        ) {
          // Clean tap anywhere on track jumps immediately to tapped point
          const tapVal = computeValueFromClientX(endClientX);
          touchHandledRef.current = true;
          emitChange(tapVal, true);
        }
      }

      touchStateRef.current.active = false;
      touchStateRef.current.mode = 'undecided';
      isDraggingRef.current = false;
      setThumbActive(false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [computeValueFromClientX, emitChange]);

  // Desktop mouse drag listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;
      const next = computeValueFromClientX(e.clientX);
      if (next !== valueRef.current) {
        emitChange(next, false);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;
      mouseDownRef.current = false;
      isDraggingRef.current = false;
      if (thumbRef.current) {
        thumbRef.current.style.transform = 'translate3d(-50%, -50%, 0) scale(1)';
      }
      const finalVal = computeValueFromClientX(e.clientX);
      emitChange(finalVal, true);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [computeValueFromClientX, emitChange]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Only skip synthetic mouse event if touch ALREADY handled this exact tap/drag
    if (touchHandledRef.current && performance.now() - lastTouchEndAtRef.current < 450) {
      return;
    }
    mouseDownRef.current = true;
    isDraggingRef.current = true;
    if (thumbRef.current) {
      thumbRef.current.style.transform = 'translate3d(-50%, -50%, 0) scale(1.22)';
    }
    const next = computeValueFromClientX(e.clientX);
    emitChange(next, true);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Fallback for trackpad/tap/synthesized clicks where mousedown/touchend didn't update
    if (touchHandledRef.current && performance.now() - lastTouchEndAtRef.current < 450) {
      touchHandledRef.current = false;
      return;
    }
    if (e.clientX === 0 && e.clientY === 0) return;
    const next = computeValueFromClientX(e.clientX);
    if (next !== valueRef.current) {
      emitChange(next, true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = Math.min(max, value + step);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = Math.max(min, value - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = min;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = max;
    }
    if (next !== value) {
      emitChange(next, true);
    }
  };

  const percent = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ touchAction: 'pan-y' }}
      className={`relative w-full py-4 -my-2.5 flex items-center cursor-pointer select-none focus:outline-none ${className}`}
    >
      {/* Track */}
      <div className="w-full h-1.5 bg-slate-900/12 dark:bg-white/15 rounded-full overflow-hidden relative pointer-events-none">
        <div
          ref={fillRef}
          className="h-full bg-slate-950 dark:bg-white rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Thumb */}
      <div
        ref={thumbRef}
        className="w-4.5 h-4.5 rounded-full bg-slate-950 dark:bg-white border-2 border-white dark:border-slate-900 shadow-md absolute top-1/2 pointer-events-none transition-transform duration-150 ease-out"
        style={{
          left: `${percent}%`,
          transform: 'translate3d(-50%, -50%, 0) scale(1)',
        }}
      />
    </div>
  );
}
