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
  const lastScrollTimeRef = useRef<number>(0);
  const valueRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

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
    (nextVal: number) => {
      if (nextVal === valueRef.current) return;
      valueRef.current = nextVal;
      setVisualPercent(nextVal);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        onChangeRef.current(nextVal);
      });
    },
    [setVisualPercent]
  );

  const touchStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    mode: 'undecided' | 'horizontal' | 'vertical';
  }>({
    active: false,
    startX: 0,
    startY: 0,
    mode: 'undecided',
  });

  const mouseDownRef = useRef<boolean>(false);

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

  // Track any page or container scroll so touches midway through scrolling never activate the slider
  useEffect(() => {
    const handleScroll = () => {
      lastScrollTimeRef.current = performance.now();
      if (touchStateRef.current.active && touchStateRef.current.mode !== 'horizontal') {
        touchStateRef.current.mode = 'vertical';
        isDraggingRef.current = false;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  // Mouse drag listeners for desktop
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;
      const next = computeValueFromClientX(e.clientX);
      emitChange(next);
    };
    const handleMouseUp = () => {
      mouseDownRef.current = false;
      isDraggingRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [computeValueFromClientX, emitChange]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) {
      touchStateRef.current.active = false;
      touchStateRef.current.mode = 'vertical';
      isDraggingRef.current = false;
      return;
    }
    const now = performance.now();
    // If user is currently scrolling or just scrolled within 240ms, ignore touch completely
    if (now - lastScrollTimeRef.current < 240) {
      touchStateRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        mode: 'vertical',
      };
      isDraggingRef.current = false;
      return;
    }

    const t = e.touches[0];
    touchStateRef.current = {
      active: true,
      startX: t.clientX,
      startY: t.clientY,
      mode: 'undecided',
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = touchStateRef.current;
    if (!state.active || state.mode === 'vertical' || e.touches.length !== 1) return;

    // If any scroll occurred since touchstart, abort slider activation
    if (performance.now() - lastScrollTimeRef.current < 240) {
      state.mode = 'vertical';
      isDraggingRef.current = false;
      return;
    }

    const t = e.touches[0];
    const dx = Math.abs(t.clientX - state.startX);
    const dy = Math.abs(t.clientY - state.startY);

    if (state.mode === 'undecided') {
      // Any vertical movement >= 5px immediately locks to vertical page scroll
      if (dy >= 5 && dy >= dx * 0.7) {
        state.mode = 'vertical';
        isDraggingRef.current = false;
        return;
      }
      // Require intentional horizontal drag (> 7px and clearly horizontal) before activating slider
      if (dx > 7 && dx > dy * 1.5) {
        state.mode = 'horizontal';
        isDraggingRef.current = true;
      } else {
        return;
      }
    }

    if (state.mode === 'horizontal') {
      const next = computeValueFromClientX(t.clientX);
      emitChange(next);
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current.active = false;
    touchStateRef.current.mode = 'undecided';
    isDraggingRef.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    mouseDownRef.current = true;
    isDraggingRef.current = true;
    const next = computeValueFromClientX(e.clientX);
    emitChange(next);
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
      emitChange(next);
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      style={{ touchAction: 'pan-y' }}
      className={`relative w-full py-2.5 -my-1.5 flex items-center cursor-pointer select-none focus:outline-none ${className}`}
    >
      {/* Track */}
      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative pointer-events-none">
        <div
          ref={fillRef}
          className="h-full bg-slate-950 dark:bg-white rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Thumb */}
      <div
        ref={thumbRef}
        className="w-4 h-4 rounded-full bg-slate-950 dark:bg-white border-2 border-white dark:border-slate-900 shadow-sm absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
        style={{ left: `${percent}%` }}
      />
    </div>
  );
}
