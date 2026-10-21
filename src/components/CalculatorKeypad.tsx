import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Delete, Check, ChevronDown, ArrowRight, Calculator } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';
import { playKeypadClick } from '../lib/sounds';
import { Language } from '../lib/translations';
import { updateKeypadThemeVariables } from '../lib/accentTheme';

const CUSTOM_KEYPAD_STORAGE_KEY = 'challan_custom_keypad_enabled';

// Deterministic total height of the custom keypad (Hide bar + 4 rows of 56px keys + gaps + padding)
const KEYPAD_ESTIMATED_HEIGHT = 298;

export function isCustomKeypadEnabled(): boolean {
  try {
    const val = localStorage.getItem(CUSTOM_KEYPAD_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setCustomKeypadEnabledState(enabled: boolean): void {
  try {
    localStorage.setItem(CUSTOM_KEYPAD_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }

  if (typeof document !== 'undefined' && !enabled) {
    const inputs = document.querySelectorAll('input[data-orig-inputmode]');
    inputs.forEach((el) => {
      const inp = el as HTMLInputElement;
      const orig = inp.dataset.origInputmode;
      if (orig) {
        inp.setAttribute('inputmode', orig);
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('custom-keypad-changed', { detail: { enabled } }));
  }
}

interface CalculatorKeypadProps {
  lang: Language;
}

function keepFocusAndCaret(input: HTMLInputElement | null, targetRawDigitsBeforeCaret?: number) {
  if (!input || !document.body.contains(input)) return;
  if (document.activeElement !== input) {
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  }
  try {
    const val = input.value || '';
    if (typeof targetRawDigitsBeforeCaret === 'number') {
      // Map raw character index back across formatted commas (e.g. 12,345)
      let rawCount = 0;
      let caretPos = val.length;
      for (let i = 0; i < val.length; i++) {
        if (rawCount >= targetRawDigitsBeforeCaret) {
          caretPos = i;
          break;
        }
        if (val[i] !== ',') {
          rawCount++;
        }
      }
      input.setSelectionRange(caretPos, caretPos);
    } else {
      const len = val.length;
      input.setSelectionRange(len, len);
    }
  } catch {
    // Some input types do not support setSelectionRange
  }
}

function setReactInputValue(
  input: HTMLInputElement,
  newValue: string,
  targetRawCaretIndex?: number
) {
  const previousValue = input.value;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, newValue);
  } else {
    input.value = newValue;
  }

  // React 16+ tracks input value changes via _valueTracker.
  // Setting tracker to a different value guarantees React onChange fires!
  const tracker = (input as any)._valueTracker;
  if (tracker) {
    tracker.setValue(previousValue !== newValue ? previousValue : '');
  }

  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  input.dispatchEvent(inputEvent);
  input.dispatchEvent(changeEvent);

  keepFocusAndCaret(input, targetRawCaretIndex);
  requestAnimationFrame(() => {
    keepFocusAndCaret(input, targetRawCaretIndex);
  });
}

function isTouchMobileOrTablet(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined') {
    if ((navigator as any).userAgentData?.mobile === true) return true;
    if (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(
        navigator.userAgent
      )
    ) {
      return true;
    }
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
      return true;
    }
  }
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  if (window.matchMedia && window.matchMedia('(hover: none)').matches) return true;
  if (
    window.innerWidth < 768 &&
    ('ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches))
  ) {
    return true;
  }
  return false;
}

function isTargetNumericInput(el: Element | null): el is HTMLInputElement {
  if (!el || el.tagName !== 'INPUT') return false;
  const input = el as HTMLInputElement;
  if (input.readOnly || input.disabled) return false;
  if (input.dataset.numpad === 'false') return false;
  if (input.dataset.numpad === 'true') return true;
  const origMode = input.dataset.origInputmode || input.getAttribute('inputmode') || '';
  if (origMode === 'decimal' || origMode === 'numeric') return true;
  if (input.type === 'number') return true;
  return false;
}

function isVisibleAndFocusableField(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if ((el as any).disabled || (el as any).readOnly) return false;
  const type = el.getAttribute('type');
  if (
    type === 'hidden' ||
    type === 'checkbox' ||
    type === 'radio' ||
    type === 'file' ||
    type === 'color' ||
    type === 'range'
  ) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let curr = el?.parentElement || null;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const style = window.getComputedStyle(curr);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return curr;
    }
    curr = curr.parentElement;
  }
  return null;
}

function findModalCard(el: HTMLElement | null, keypadEl: HTMLElement | null): HTMLElement | null {
  const fixedOverlay = el?.closest('.fixed') as HTMLElement | null;
  if (!fixedOverlay || fixedOverlay === keypadEl) return null;
  let curr: HTMLElement | null = el;
  while (curr && curr.parentElement && curr.parentElement !== fixedOverlay) {
    curr = curr.parentElement;
  }
  return curr && curr !== fixedOverlay ? curr : null;
}

export default function CalculatorKeypad({ lang }: CalculatorKeypadProps) {
  const [keypadEnabled, setKeypadEnabled] = useState<boolean>(() => isCustomKeypadEnabled());
  const keypadEnabledRef = useRef<boolean>(keypadEnabled);
  const [activeInput, setActiveInput] = useState<HTMLInputElement | null>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const [desktopFocusedInput, setDesktopFocusedInput] = useState<HTMLInputElement | null>(null);
  const desktopFocusedInputRef = useRef<HTMLInputElement | null>(null);
  const desktopManualOpenRef = useRef<boolean>(false);
  const lastPositionedInputRef = useRef<HTMLInputElement | null>(null);
  const keypadRef = useRef<HTMLDivElement>(null);
  const hardwareKeyDetectedRef = useRef(false);

  // Back gesture & history management refs
  const hasPushedHistoryRef = useRef(false);
  const ignoringSelfPopCountRef = useRef(0);

  // Long-press delete button timer ref
  const deleteHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll container & modal avoidance state refs
  const modifiedScrollContainerRef = useRef<{ el: HTMLElement; origPaddingBottom: string } | null>(null);
  const shiftedModalCardRef = useRef<{ el: HTMLElement; origTransform: string; origTransition: string; appliedTransform?: string; shiftPx?: number } | null>(null);
  const bottomSpacerRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const alignTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedScrollYOnCloseRef = useRef<number | null>(null);
  // Gboard-style key press feedback with guaranteed minimum visual pulse
  const pressTimersMapRef = useRef<WeakMap<HTMLElement, ReturnType<typeof setTimeout>>>(new WeakMap());

  useEffect(() => {
    updateKeypadThemeVariables();
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    const handleScrollTopReset = () => {
      if (!activeInputRef.current && bottomSpacerRef.current) {
        const y = window.scrollY || document.documentElement.scrollTop;
        if (y <= 2 && bottomSpacerRef.current.style.height !== '0px') {
          bottomSpacerRef.current.style.height = '0px';
        }
      }
    };
    window.addEventListener('scroll', handleScrollTopReset, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollTopReset);
  }, []);

  useEffect(() => {
    keypadEnabledRef.current = keypadEnabled;
  }, [keypadEnabled]);

  useEffect(() => {
    activeInputRef.current = activeInput;
  }, [activeInput]);

  const cancelOngoingSmoothScroll = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    if (alignTimeoutRef.current !== null) {
      clearTimeout(alignTimeoutRef.current);
      alignTimeoutRef.current = null;
    }
  }, []);

  // Keep main window document scroll position untouched, while restoring temporary modal padding/transforms for popups
  const restoreScrollPadding = useCallback(() => {
    cancelOngoingSmoothScroll();
    lastPositionedInputRef.current = null;
    if (modifiedScrollContainerRef.current) {
      const { el, origPaddingBottom } = modifiedScrollContainerRef.current;
      el.style.paddingBottom = origPaddingBottom;
      modifiedScrollContainerRef.current = null;
    }
    if (shiftedModalCardRef.current) {
      const { el, origTransform, origTransition } = shiftedModalCardRef.current;
      el.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
      if (origTransform) {
        el.style.setProperty('transform', origTransform);
      } else {
        el.style.removeProperty('transform');
      }
      setTimeout(() => {
        if (el) el.style.transition = origTransition;
      }, 190);
      shiftedModalCardRef.current = null;
    }
  }, [cancelOngoingSmoothScroll]);

  const preserveModalShift = useCallback(() => {
    if (shiftedModalCardRef.current?.el && shiftedModalCardRef.current.appliedTransform) {
      const card = shiftedModalCardRef.current.el;
      const expected = shiftedModalCardRef.current.appliedTransform;
      if (card.style.getPropertyValue('transform') !== expected) {
        card.style.setProperty('transform', expected, 'important');
      }
      requestAnimationFrame(() => {
        if (shiftedModalCardRef.current?.el && shiftedModalCardRef.current.appliedTransform) {
          if (shiftedModalCardRef.current.el.style.getPropertyValue('transform') !== shiftedModalCardRef.current.appliedTransform) {
            shiftedModalCardRef.current.el.style.setProperty('transform', shiftedModalCardRef.current.appliedTransform, 'important');
          }
        }
      });
    }
  }, []);

  // Single-shot, interruptible 60/120fps cubic-out smooth scroll helper
  const animateScrollBy = useCallback(
    (scrollEl: HTMLElement | Window, deltaY: number, durationMs = 180) => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }

      const isWin = scrollEl === window;
      const startScrollTop = isWin
        ? window.scrollY || document.documentElement.scrollTop
        : (scrollEl as HTMLElement).scrollTop;
      const maxDelta = isWin
        ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight - startScrollTop)
        : Math.max(0, (scrollEl as HTMLElement).scrollHeight - (scrollEl as HTMLElement).clientHeight - startScrollTop);
      const clampedDeltaY = deltaY > 0 ? Math.min(deltaY, maxDelta) : Math.max(deltaY, -startScrollTop);
      if (Math.abs(clampedDeltaY) < 2) return;

      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const nextTop = startScrollTop + clampedDeltaY * eased;

        if (isWin) {
          window.scrollTo(0, nextTop);
        } else {
          (scrollEl as HTMLElement).scrollTop = nextTop;
        }

        if (t < 1) {
          scrollRafRef.current = requestAnimationFrame(step);
        } else {
          scrollRafRef.current = null;
        }
      };

      scrollRafRef.current = requestAnimationFrame(step);
    },
    []
  );

  // Swallows any synthetic click or pointerup events during keyboard dismissal to prevent ghost clicks on underlying elements
  const suppressGhostClicks = useCallback(() => {
    const swallow = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    };
    window.addEventListener('click', swallow, { capture: true });
    window.addEventListener('pointerup', swallow, { capture: true });
    window.addEventListener('touchend', swallow, { capture: true });
    window.addEventListener('mouseup', swallow, { capture: true });
    setTimeout(() => {
      window.removeEventListener('click', swallow, { capture: true });
      window.removeEventListener('pointerup', swallow, { capture: true });
      window.removeEventListener('touchend', swallow, { capture: true });
      window.removeEventListener('mouseup', swallow, { capture: true });
    }, 450);
  }, []);

  // Safely close the custom keypad without touching or resetting scroll position
  const closeKeypad = useCallback(
    (fromPopState = false, switchingToAnotherInput = false, keepDesktopToggle = false) => {
      if (deleteHoldTimerRef.current) {
        clearTimeout(deleteHoldTimerRef.current);
        deleteHoldTimerRef.current = null;
      }
      const savedWinScrollY = window.scrollY || document.documentElement.scrollTop;
      lockedScrollYOnCloseRef.current = savedWinScrollY;
      restoreScrollPadding();
      const current = activeInputRef.current;
      activeInputRef.current = null;
      setActiveInput(null);
      if (!keepDesktopToggle) {
        desktopManualOpenRef.current = false;
        if (!switchingToAnotherInput) {
          desktopFocusedInputRef.current = null;
          setDesktopFocusedInput(null);
        }
      }
      if (!switchingToAnotherInput && !keepDesktopToggle && current && document.activeElement === current) {
        current.blur();
      }

      if (!fromPopState && hasPushedHistoryRef.current) {
        hasPushedHistoryRef.current = false;
        if (window.history.state?.numpadOpen) {
          ignoringSelfPopCountRef.current += 1;
          window.history.back();
          setTimeout(() => {
            if (ignoringSelfPopCountRef.current > 0) {
              ignoringSelfPopCountRef.current -= 1;
            }
            lockedScrollYOnCloseRef.current = null;
          }, 350);
        } else {
          lockedScrollYOnCloseRef.current = null;
        }
      } else if (fromPopState) {
        hasPushedHistoryRef.current = false;
        setTimeout(() => {
          lockedScrollYOnCloseRef.current = null;
        }, 120);
      } else {
        lockedScrollYOnCloseRef.current = null;
      }
    },
    [restoreScrollPadding]
  );

  // Precision Centering and Keyboard Avoidance for Custom Keypad
  const ensureInputVisibleOnce = useCallback(
    (target: HTMLInputElement) => {
      if (!target || !document.body.contains(target)) return;
      if (lastPositionedInputRef.current === target) return;
      lastPositionedInputRef.current = target;

      const performAlignment = () => {
        if (!target || !document.body.contains(target) || activeInputRef.current !== target) return;
        // Always use full layout viewport height (window.innerHeight) so calculations are 100% deterministic
        const viewHeight = window.innerHeight;
        const keypadHeight = (keypadRef.current?.offsetHeight || KEYPAD_ESTIMATED_HEIGHT) + 8;
        const safeViewportBottom = viewHeight - keypadHeight;
        const safeViewportTop = 32;

        const scrollParent = findScrollParent(target);
        const modalCard = findModalCard(target, keypadRef.current);

        // Case 1: Inside a modal
        if (modalCard) {
          // Sub-case 1A: Modal has an internal scrollable container (e.g. QuickEntryModal, GoalsManager)
          if (scrollParent && modalCard.contains(scrollParent)) {
            if (!modifiedScrollContainerRef.current || modifiedScrollContainerRef.current.el !== scrollParent) {
              modifiedScrollContainerRef.current = {
                el: scrollParent,
                origPaddingBottom: scrollParent.style.paddingBottom || '',
              };
            }
            const scrollParentRect = scrollParent.getBoundingClientRect();
            const coveredByKeypad = Math.max(0, scrollParentRect.bottom - safeViewportBottom);
            const requiredPad = `${Math.ceil(coveredByKeypad + 16)}px`;
            if (scrollParent.style.paddingBottom !== requiredPad) {
              scrollParent.style.paddingBottom = requiredPad;
            }

            // Center input vertically in the visible space above the keypad
            const visibleTop = Math.max(safeViewportTop, scrollParentRect.top);
            const visibleBottom = Math.min(scrollParentRect.bottom, safeViewportBottom);
            const visibleCenterY = (visibleTop + visibleBottom) / 2;

            const targetRect = target.getBoundingClientRect();
            const targetCenterY = targetRect.top + targetRect.height / 2;
            const deltaY = targetCenterY - visibleCenterY;

            if (Math.abs(deltaY) > 4) {
              animateScrollBy(scrollParent, deltaY, 220);
            }
            return;
          }

          // Sub-case 1B: Modal card itself is fixed without internal scroll container (e.g. Edit Transaction modal)
          const targetRect = target.getBoundingClientRect();
          const visibleCenterY = (safeViewportTop + safeViewportBottom) / 2;
          const targetCenterY = targetRect.top + targetRect.height / 2;

          const currentShift = shiftedModalCardRef.current?.shiftPx || 0;
          const unshiftedTargetCenterY = targetCenterY + currentShift;
          const neededShift = unshiftedTargetCenterY - visibleCenterY;

          const unshiftedModalTop = modalCard.getBoundingClientRect().top + currentShift;
          const maxUp = Math.max(0, unshiftedModalTop - 16);
          const shiftPx = Math.min(Math.max(0, neededShift), maxUp);

          if (shiftPx > 4 || (!shiftedModalCardRef.current && shiftPx > 0)) {
            if (!shiftedModalCardRef.current || shiftedModalCardRef.current.el !== modalCard) {
              shiftedModalCardRef.current = {
                el: modalCard,
                origTransform: modalCard.style.transform || '',
                origTransition: modalCard.style.transition || '',
                shiftPx: 0,
              };
            }
            shiftedModalCardRef.current.shiftPx = shiftPx;
            const applied = `translate3d(0, -${Math.round(shiftPx)}px, 0)`;
            modalCard.style.transition = 'transform 220ms cubic-bezier(0.2, 0, 0, 1)';
            modalCard.style.setProperty('transform', applied, 'important');
            shiftedModalCardRef.current.appliedTransform = applied;
          }
          return;
        }

        // Case 2: Main window document (e.g., Customer Ledger inline form)
        const rect = target.getBoundingClientRect();
        const visibleCenterY = (safeViewportTop + safeViewportBottom) / 2;
        const targetCenterY = rect.top + rect.height / 2;
        const delta = targetCenterY - visibleCenterY;

        if (delta > 4) {
          const currentScrollY = window.scrollY || document.documentElement.scrollTop;
          const maxWindowScroll =
            document.documentElement.scrollHeight - viewHeight - currentScrollY;

          if (maxWindowScroll < delta + 16) {
            if (!bottomSpacerRef.current) {
              const spacer = document.createElement('div');
              spacer.id = 'keypad-bottom-spacer';
              spacer.style.width = '100%';
              spacer.style.pointerEvents = 'none';
              spacer.style.height = '0px';
              document.body.appendChild(spacer);
              bottomSpacerRef.current = spacer;
            }
            bottomSpacerRef.current.style.height = `${Math.ceil(keypadHeight + 40)}px`;
          }
          animateScrollBy(window, delta, 220);
        } else if (delta < -30) {
          animateScrollBy(window, delta, 220);
        }
      };

      // Run immediately via rAF for instant smooth motion
      requestAnimationFrame(performAlignment);

      // Follow-up after 240ms (once any entrance animation completes)
      if (alignTimeoutRef.current !== null) {
        clearTimeout(alignTimeoutRef.current);
      }
      alignTimeoutRef.current = setTimeout(() => {
        alignTimeoutRef.current = null;
        if (activeInputRef.current === target) {
          performAlignment();
        }
      }, 240);
    },
    [animateScrollBy]
  );

  // Listen for custom-keypad-changed event from Settings
  useEffect(() => {
    const handleSettingChange = (e: Event) => {
      const enabled = (e as CustomEvent).detail?.enabled ?? isCustomKeypadEnabled();
      keypadEnabledRef.current = enabled;
      setKeypadEnabled(enabled);
      if (!enabled) {
        desktopManualOpenRef.current = false;
        desktopFocusedInputRef.current = null;
        setDesktopFocusedInput(null);
        if (activeInputRef.current) {
          const inp = activeInputRef.current;
          const orig = inp.dataset.origInputmode || 'decimal';
          inp.setAttribute('inputmode', orig);
          closeKeypad();
        }
      } else if (!isTouchMobileOrTablet()) {
        const currentActive = document.activeElement;
        if (isTargetNumericInput(currentActive)) {
          desktopFocusedInputRef.current = currentActive;
          setDesktopFocusedInput(currentActive);
        }
      }
    };
    window.addEventListener('custom-keypad-changed', handleSettingChange);
    return () => window.removeEventListener('custom-keypad-changed', handleSettingChange);
  }, [closeKeypad]);

  // Cancel programmatic scroll immediately if user manually scrolls with finger or wheel
  useEffect(() => {
    if (!activeInput) return;
    const stopScrollOnUserTouch = (e: TouchEvent | WheelEvent) => {
      if (keypadRef.current && e.target instanceof Node && keypadRef.current.contains(e.target)) {
        return;
      }
      cancelOngoingSmoothScroll();
    };
    window.addEventListener('touchmove', stopScrollOnUserTouch, { passive: true });
    window.addEventListener('wheel', stopScrollOnUserTouch, { passive: true });
    return () => {
      window.removeEventListener('touchmove', stopScrollOnUserTouch);
      window.removeEventListener('wheel', stopScrollOnUserTouch);
    };
  }, [activeInput, cancelOngoingSmoothScroll]);

  // Intercept mobile back gesture in capture phase when keypad is open
  useEffect(() => {
    const handlePopStateCapture = (e: PopStateEvent) => {
      const preserveY = lockedScrollYOnCloseRef.current ?? (window.scrollY || document.documentElement.scrollTop);
      if (ignoringSelfPopCountRef.current > 0) {
        ignoringSelfPopCountRef.current -= 1;
        e.stopImmediatePropagation();
        requestAnimationFrame(() => {
          if (Math.abs((window.scrollY || document.documentElement.scrollTop) - preserveY) > 1) {
            window.scrollTo(0, preserveY);
          }
        });
        return;
      }
      if (activeInputRef.current) {
        e.stopImmediatePropagation();
        triggerHaptic('keypad');
        closeKeypad(true);
        requestAnimationFrame(() => {
          if (Math.abs((window.scrollY || document.documentElement.scrollTop) - preserveY) > 1) {
            window.scrollTo(0, preserveY);
          }
        });
      }
    };

    window.addEventListener('popstate', handlePopStateCapture, true);
    return () => {
      window.removeEventListener('popstate', handlePopStateCapture, true);
    };
  }, [closeKeypad]);

  // Dismiss virtual keypad if physical keyboard typing is detected (Desktop only — never on mobile!)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTouchMobileOrTablet()) return;
      if (
        e.isTrusted &&
        (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Tab')
      ) {
        hardwareKeyDetectedRef.current = true;
        if (activeInputRef.current) {
          const orig = activeInputRef.current.dataset.origInputmode;
          if (orig) activeInputRef.current.setAttribute('inputmode', orig);
          desktopManualOpenRef.current = false;
          closeKeypad(false, false, true);
        }
      }
    };

    const handleTouchStartGlobal = () => {
      hardwareKeyDetectedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('touchstart', handleTouchStartGlobal, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('touchstart', handleTouchStartGlobal);
    };
  }, [closeKeypad]);

  // Clean, non-intrusive input interception (Custom Keypad on mobile; Desktop lets physical keyboard work & shows corner toggle)
  useEffect(() => {
    const openMobileKeypadForTarget = (target: HTMLInputElement) => {
      desktopFocusedInputRef.current = null;
      setDesktopFocusedInput(null);
      if (!target.dataset.origInputmode) {
        target.dataset.origInputmode = target.getAttribute('inputmode') || 'decimal';
      }
      if (target.getAttribute('inputmode') !== 'none') {
        target.setAttribute('inputmode', 'none');
      }

      const wasClosed = !activeInputRef.current;
      const isNewTarget = activeInputRef.current !== target;
      activeInputRef.current = target;
      setActiveInput(target);

      if (wasClosed && !hasPushedHistoryRef.current) {
        try {
          window.history.pushState({ ...window.history.state, numpadOpen: true }, '');
          hasPushedHistoryRef.current = true;
        } catch {
          // ignore history error
        }
      }

      if (isNewTarget || wasClosed) {
        lastPositionedInputRef.current = null;
        ensureInputVisibleOnce(target);
      }
    };

    const suppressNativeKeyboardBeforeFocus = (e: Event) => {
      if (!keypadEnabledRef.current) return;
      if (!isTouchMobileOrTablet()) return;
      const target = e.target as Element | null;
      if (isTargetNumericInput(target)) {
        if (!target.dataset.origInputmode) {
          target.dataset.origInputmode = target.getAttribute('inputmode') || 'decimal';
        }
        if (target.getAttribute('inputmode') !== 'none') {
          target.setAttribute('inputmode', 'none');
        }
        // If input is already focused on mobile and user taps it again while keypad is hidden, re-open keypad immediately
        if (document.activeElement === target && !activeInputRef.current) {
          openMobileKeypadForTarget(target);
        }
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;

      // If custom keypad is disabled, restore native inputmode and let OS handle native keyboard natively
      if (!keypadEnabledRef.current) {
        desktopFocusedInputRef.current = null;
        setDesktopFocusedInput(null);
        if (isTargetNumericInput(target)) {
          const orig = target.dataset.origInputmode;
          if (orig && target.getAttribute('inputmode') === 'none') {
            target.setAttribute('inputmode', orig);
          }
        }
        return;
      }

      if (isTargetNumericInput(target)) {
        // On Desktop/PC: do NOT force-open the custom keypad; let user type with physical keyboard and show small corner toggle
        if (!isTouchMobileOrTablet()) {
          desktopFocusedInputRef.current = target;
          setDesktopFocusedInput(target);

          if (desktopManualOpenRef.current) {
            const wasClosed = !activeInputRef.current;
            const isNewTarget = activeInputRef.current !== target;
            activeInputRef.current = target;
            setActiveInput(target);
            if (isNewTarget || wasClosed) {
              lastPositionedInputRef.current = null;
              ensureInputVisibleOnce(target);
            }
          }
          return;
        }

        // On Mobile: always open the custom keypad directly without any toggle button
        openMobileKeypadForTarget(target);
      } else if (
        target &&
        (!keypadRef.current || !keypadRef.current.contains(target)) &&
        !(target instanceof Element && target.closest('[data-keypad-toggle="true"]')) &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        // Switching to a non-numeric input: close custom keypad & hide desktop corner toggle
        desktopManualOpenRef.current = false;
        desktopFocusedInputRef.current = null;
        setDesktopFocusedInput(null);
        if (activeInputRef.current !== null) {
          closeKeypad(false, true);
        }
      }
    };

    const handleFocusOut = () => {
      requestAnimationFrame(() => {
        const currentActive = document.activeElement;
        if (isTargetNumericInput(currentActive)) return;
        if (activeInputRef.current) return;
        if (desktopFocusedInputRef.current) {
          desktopManualOpenRef.current = false;
          desktopFocusedInputRef.current = null;
          setDesktopFocusedInput(null);
        }
      });
    };

    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (target instanceof Element && target.closest('[data-keypad-toggle="true"]')) return;
      if (keypadRef.current && (keypadRef.current.contains(target) || (target instanceof Element && target.closest('[data-keypad-root="true"]')))) return;

      if (!activeInputRef.current) {
        if (desktopFocusedInputRef.current && !desktopFocusedInputRef.current.contains(target)) {
          if (!(target instanceof Element && isTargetNumericInput(target.closest('input')))) {
            desktopManualOpenRef.current = false;
            desktopFocusedInputRef.current = null;
            setDesktopFocusedInput(null);
          }
        }
        return;
      }

      if (activeInputRef.current && activeInputRef.current.contains(target)) return;
      if (target instanceof Element) {
        const closestInput = target.closest('input, textarea, select');
        if (closestInput) {
          return;
        }

        // Allow users to freely touch and scroll inside the active popup / modal card / form like native keyboard
        const modalCard = findModalCard(activeInputRef.current, keypadRef.current);
        const activeContainer =
          modalCard ||
          activeInputRef.current.closest('[role="dialog"]') ||
          activeInputRef.current.closest('form');

        if (activeContainer && activeContainer.contains(target)) {
          // If user clicked an explicit close / X button inside the popup, dismiss keypad without swallowing the click
          // so the popup itself closes immediately on the very first click!
          const clickedBtn = target.closest('button');
          const isCloseBtn =
            clickedBtn &&
            (clickedBtn.matches(
              'button[aria-label="Close"], button[data-modal-close="true"], button#close_modal_btn, button#close_goal_modal_btn, button[id*="close"], button[title="Close"]'
            ) ||
              clickedBtn.querySelector('svg.lucide-x') !== null);
          if (isCloseBtn) {
            closeKeypad();
            return;
          }
          // User is scrolling or interacting inside the popup: keep keyboard open!
          return;
        }
      }
      closeKeypad();
    };

    const handleClickCheckUnmounted = () => {
      requestAnimationFrame(() => {
        if (activeInputRef.current && !document.body.contains(activeInputRef.current)) {
          closeKeypad();
        }
        if (desktopFocusedInputRef.current && !document.body.contains(desktopFocusedInputRef.current)) {
          desktopManualOpenRef.current = false;
          desktopFocusedInputRef.current = null;
          setDesktopFocusedInput(null);
        }
      });
    };

    document.addEventListener('pointerdown', suppressNativeKeyboardBeforeFocus, { capture: true, passive: true });
    document.addEventListener('touchstart', suppressNativeKeyboardBeforeFocus, { capture: true, passive: true });
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('pointerdown', handlePointerDownOutside, { capture: true, passive: true });
    document.addEventListener('click', handleClickCheckUnmounted, true);

    return () => {
      document.removeEventListener('pointerdown', suppressNativeKeyboardBeforeFocus, true);
      document.removeEventListener('touchstart', suppressNativeKeyboardBeforeFocus, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('pointerdown', handlePointerDownOutside, true);
      document.removeEventListener('click', handleClickCheckUnmounted, true);
    };
  }, [closeKeypad, ensureInputVisibleOnce]);

  // Close keypad or corner toggle if input is unmounted from DOM (e.g. modal closed)
  useEffect(() => {
    if (!activeInput && !desktopFocusedInput) return;
    const interval = setInterval(() => {
      if (activeInput && !document.body.contains(activeInput)) {
        closeKeypad();
      }
      if (
        desktopFocusedInput &&
        (!document.body.contains(desktopFocusedInput) ||
          (!activeInput && document.activeElement !== desktopFocusedInput))
      ) {
        desktopManualOpenRef.current = false;
        desktopFocusedInputRef.current = null;
        setDesktopFocusedInput(null);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [activeInput, desktopFocusedInput, closeKeypad]);

  // Cleanup scroll padding & spacer on unmount
  useEffect(() => {
    return () => {
      restoreScrollPadding();
      if (bottomSpacerRef.current && bottomSpacerRef.current.parentNode) {
        bottomSpacerRef.current.parentNode.removeChild(bottomSpacerRef.current);
        bottomSpacerRef.current = null;
      }
    };
  }, [restoreScrollPadding]);

  const markPressed = (el: HTMLElement) => {
    const existing = pressTimersMapRef.current.get(el);
    if (existing) clearTimeout(existing);
    el.setAttribute('data-pressed', 'true');
  };

  const unmarkPressed = (el: HTMLElement) => {
    const existing = pressTimersMapRef.current.get(el);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      el.removeAttribute('data-pressed');
    }, 45);
    pressTimersMapRef.current.set(el, t);
  };

  const handleOpenDesktopKeypad = (e: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = desktopFocusedInputRef.current || desktopFocusedInput;
    if (!target || !document.body.contains(target)) return;
    triggerHaptic('keypad');
    playKeypadClick('done');
    desktopManualOpenRef.current = true;
    activeInputRef.current = target;
    setActiveInput(target);
    keepFocusAndCaret(target);
    lastPositionedInputRef.current = null;
    ensureInputVisibleOnce(target);
  };

  // On Desktop ONLY: when keypad is enabled in settings and a numeric input is focused, show a small corner toggle button
  if (keypadEnabled && !activeInput && desktopFocusedInput && !isTouchMobileOrTablet()) {
    return (
      <div
        data-keypad-toggle="true"
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed bottom-5 right-5 z-[99999] no-select select-none pointer-events-auto"
      >
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            markPressed(e.currentTarget);
            handleOpenDesktopKeypad(e);
          }}
          onPointerUp={(e) => unmarkPressed(e.currentTarget)}
          onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
          onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
          className="numpad-key numpad-hide-btn px-3.5 py-2 rounded-xl border-2 shadow-lg flex items-center gap-2 text-xs font-bold cursor-pointer transition-transform active:scale-95"
          title={lang === 'bn' ? 'কাস্টম কীপ্যাড খুলুন' : 'Open Custom Keypad'}
          aria-label="Open Custom Keypad"
        >
          <Calculator className="w-4 h-4 stroke-[2.3]" style={{ color: 'var(--accent-color)' }} />
          <span>{lang === 'bn' ? 'কীপ্যাড' : 'Keypad'}</span>
        </button>
      </div>
    );
  }

  if (!keypadEnabled || !activeInput) return null;

  const allowDecimals =
    (activeInput.dataset.origInputmode || 'decimal') === 'decimal' &&
    activeInput.dataset.integerOnly !== 'true';

  // Read current raw value and caret selection mapped to raw (comma-stripped) indices
  const getRawState = () => {
    const inp = activeInputRef.current || activeInput;
    if (!inp) {
      return { inp: null as any, raw: '', rawStart: 0, rawEnd: 0 };
    }
    const formatted = inp.value || '';
    let selStart = formatted.length;
    let selEnd = formatted.length;
    try {
      if (typeof inp.selectionStart === 'number') {
        selStart = inp.selectionStart;
      }
      if (typeof inp.selectionEnd === 'number') {
        selEnd = inp.selectionEnd;
      }
    } catch {
      // Inputs like type="number" do not support selectionStart
    }

    let raw = '';
    let rawStart = 0;
    let rawEnd = 0;

    for (let i = 0; i < formatted.length; i++) {
      if (i === selStart) rawStart = raw.length;
      if (i === selEnd) rawEnd = raw.length;
      const ch = formatted[i];
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        raw += ch;
      }
    }
    if (selStart >= formatted.length) rawStart = raw.length;
    if (selEnd >= formatted.length) rawEnd = raw.length;

    return { inp, raw, rawStart, rawEnd };
  };

  const handleDigit = (digitStr: string) => {
    triggerHaptic('keypad');
    playKeypadClick('tick');
    const { inp, raw, rawStart, rawEnd } = getRawState();
    const before = raw.slice(0, rawStart);
    const after = raw.slice(rawEnd);

    if (digitStr === '.') {
      if (!allowDecimals || (before + after).includes('.')) {
        keepFocusAndCaret(inp, rawEnd);
        preserveModalShift();
        return;
      }
      const insert = before === '' ? '0.' : '.';
      const next = before + insert + after;
      setReactInputValue(inp, next, before.length + insert.length);
      preserveModalShift();
      return;
    }

    let next: string;
    let nextCaret: number;
    if (before === '0' && after === '') {
      next = digitStr === '00' ? '0' : digitStr;
      nextCaret = next.length;
    } else if (before === '' && after === '' && digitStr === '00') {
      next = '0';
      nextCaret = 1;
    } else {
      next = before + digitStr + after;
      nextCaret = before.length + digitStr.length;
    }
    setReactInputValue(inp, next, nextCaret);
    preserveModalShift();
  };

  const handleBackspace = () => {
    triggerHaptic('keypad');
    playKeypadClick('delete');
    const { inp, raw, rawStart, rawEnd } = getRawState();
    if (raw.length === 0) {
      keepFocusAndCaret(inp, 0);
      preserveModalShift();
      return;
    }
    if (rawStart !== rawEnd) {
      // Delete selected range
      const next = raw.slice(0, rawStart) + raw.slice(rawEnd);
      setReactInputValue(inp, next, rawStart);
    } else if (rawStart > 0) {
      const next = raw.slice(0, rawStart - 1) + raw.slice(rawStart);
      setReactInputValue(inp, next, rawStart - 1);
    } else {
      keepFocusAndCaret(inp, 0);
    }
    preserveModalShift();
  };

  const handleClear = () => {
    triggerHaptic('soft');
    playKeypadClick('delete');
    const inp = activeInputRef.current || activeInput;
    setReactInputValue(inp, '', 0);
    preserveModalShift();
  };

  // Delete button: Immediate delete on pointerdown + Hold (360ms) to clear entire input while keeping focus & cursor inside input
  const handleDeletePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    markPressed(e.currentTarget);
    handleBackspace();

    if (deleteHoldTimerRef.current) clearTimeout(deleteHoldTimerRef.current);
    deleteHoldTimerRef.current = setTimeout(() => {
      deleteHoldTimerRef.current = null;
      triggerHaptic('soft');
      const inp = activeInputRef.current || activeInput;
      setReactInputValue(inp, '', 0);
      preserveModalShift();
    }, 360);
  };

  const handleDeletePointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    unmarkPressed(e.currentTarget);
    if (deleteHoldTimerRef.current) {
      clearTimeout(deleteHoldTimerRef.current);
      deleteHoldTimerRef.current = null;
    }
    keepFocusAndCaret(activeInputRef.current || activeInput);
  };

  // Navigate to the next available input field in the current form/modal or page
  const handleNextInput = () => {
    triggerHaptic('soft');
    playKeypadClick('tick');
    const inp = activeInputRef.current || activeInput;
    if (!inp) {
      suppressGhostClicks();
      closeKeypad();
      return;
    }
    const scopeRoot =
      inp.closest('form') ||
      inp.closest('[role="dialog"]') ||
      inp.closest('.fixed') ||
      document.body;

    const allCandidates = Array.from(
      scopeRoot.querySelectorAll('input, textarea, select')
    ).filter(isVisibleAndFocusableField);

    const currentIndex = allCandidates.indexOf(inp);
    if (currentIndex !== -1 && currentIndex + 1 < allCandidates.length) {
      const nextEl = allCandidates[currentIndex + 1];
      if (isTargetNumericInput(nextEl) && keypadEnabledRef.current) {
        if (!nextEl.dataset.origInputmode) {
          nextEl.dataset.origInputmode = nextEl.getAttribute('inputmode') || 'decimal';
        }
        nextEl.setAttribute('inputmode', 'none');
        nextEl.focus({ preventScroll: true });
      } else {
        // Switching to a native keyboard field (e.g. description or notes in Edit Transaction):
        // Suppress any stray ghost clicks from pointerup so backdrop or underlying elements do not get clicked!
        suppressGhostClicks();
        closeKeypad(false, true);
        requestAnimationFrame(() => {
          if (nextEl && document.body.contains(nextEl)) {
            nextEl.focus();
            try {
              const len = (nextEl as HTMLInputElement).value?.length || 0;
              (nextEl as HTMLInputElement).setSelectionRange?.(len, len);
            } catch {}
          }
        });
      }
    } else {
      suppressGhostClicks();
      closeKeypad();
    }
  };

  const handleDone = () => {
    triggerHaptic('soft');
    playKeypadClick('done');
    if (!isTouchMobileOrTablet() && desktopFocusedInputRef.current) {
      desktopManualOpenRef.current = false;
      closeKeypad(false, false, true);
      keepFocusAndCaret(desktopFocusedInputRef.current);
      return;
    }
    suppressGhostClicks();
    closeKeypad();
  };

  return (
    <div
      ref={keypadRef}
      data-keypad-root="true"
      onPointerDown={(e) => {
        e.preventDefault();
      }}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-x-0 bottom-0 z-[99999] sm:max-w-md sm:mx-auto no-select animate-keypad-up select-none pointer-events-none touch-none"
    >
      {/* Hide Keypad Icon Button OUTSIDE the keyboard — adapts to Theme & Accent Palette */}
      <div className="flex justify-end px-3 pb-2 pointer-events-none">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            markPressed(e.currentTarget);
            handleDone();
          }}
          onPointerUp={(e) => unmarkPressed(e.currentTarget)}
          onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
          onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
          className="numpad-key numpad-hide-btn pointer-events-auto touch-none px-3.5 py-1.5 rounded-full border shadow-md flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          aria-label="Hide Keypad"
        >
          <ChevronDown className="w-4 h-4 stroke-[2.5]" style={{ color: 'var(--accent-color)' }} />
          <span>{lang === 'bn' ? 'লুকান' : 'Hide'}</span>
        </button>
      </div>

      {/* Main Gboard-Refined Keypad Body — dynamically styled by Theme Surface Palette, Intensity Slider & Accent Color */}
      <div className="numpad-surface pointer-events-auto touch-none border-t sm:rounded-t-3xl sm:border-x shadow-2xl px-3 pt-3 pb-6">
        <div className="grid grid-cols-4 gap-2">
          {/* ROW 1: 7 8 9 Backspace (Hold to Clear) */}
          {['7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                markPressed(e.currentTarget);
                handleDigit(d);
              }}
              onPointerUp={(e) => unmarkPressed(e.currentTarget)}
              onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
              onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
              className="numpad-key numpad-digit h-14 rounded-2xl border font-mono text-[22px] font-bold flex items-center justify-center cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onPointerDown={handleDeletePointerDown}
            onPointerUp={handleDeletePointerEnd}
            onPointerLeave={handleDeletePointerEnd}
            onPointerCancel={handleDeletePointerEnd}
            title={lang === 'bn' ? 'মুছতে ট্যাপ করুন, সম্পূর্ণ মুছতে চেপে ধরুন' : 'Tap to delete, hold to clear'}
            className="numpad-key numpad-action h-14 rounded-2xl border flex items-center justify-center cursor-pointer"
            aria-label="Backspace (Hold to clear)"
          >
            <Delete className="w-5 h-5 pointer-events-none" />
          </button>

          {/* ROW 2: 4 5 6 Clear (C) */}
          {['4', '5', '6'].map((d) => (
            <button
              key={d}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                markPressed(e.currentTarget);
                handleDigit(d);
              }}
              onPointerUp={(e) => unmarkPressed(e.currentTarget)}
              onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
              onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
              className="numpad-key numpad-digit h-14 rounded-2xl border font-mono text-[22px] font-bold flex items-center justify-center cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              markPressed(e.currentTarget);
              handleClear();
            }}
            onPointerUp={(e) => unmarkPressed(e.currentTarget)}
            onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
            onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
            className="numpad-key h-14 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 font-mono text-base font-extrabold flex items-center justify-center cursor-pointer"
          >
            C
          </button>

          {/* ROW 3: 1 2 3 Next Input */}
          {['1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                markPressed(e.currentTarget);
                handleDigit(d);
              }}
              onPointerUp={(e) => unmarkPressed(e.currentTarget)}
              onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
              onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
              className="numpad-key numpad-digit h-14 rounded-2xl border font-mono text-[22px] font-bold flex items-center justify-center cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              markPressed(e.currentTarget);
              handleNextInput();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              unmarkPressed(e.currentTarget);
            }}
            onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
            onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
            className="numpad-key numpad-action h-14 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            title={lang === 'bn' ? 'পরবর্তী ঘরে যান' : 'Next Input Field'}
          >
            <ArrowRight className="w-4 h-4 stroke-[2.5] pointer-events-none" />
            <span className="text-[10px] font-extrabold uppercase tracking-tight pointer-events-none">
              {lang === 'bn' ? 'পরবর্তী' : 'Next'}
            </span>
          </button>

          {/* ROW 4: 00 0 . Done (Exchanged 00 and .) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              markPressed(e.currentTarget);
              handleDigit('00');
            }}
            onPointerUp={(e) => unmarkPressed(e.currentTarget)}
            onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
            onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
            className="numpad-key numpad-digit h-14 rounded-2xl border font-mono text-lg font-bold flex items-center justify-center cursor-pointer"
          >
            00
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              markPressed(e.currentTarget);
              handleDigit('0');
            }}
            onPointerUp={(e) => unmarkPressed(e.currentTarget)}
            onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
            onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
            className="numpad-key numpad-digit h-14 rounded-2xl border font-mono text-[22px] font-bold flex items-center justify-center cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            disabled={!allowDecimals}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!allowDecimals) return;
              markPressed(e.currentTarget);
              handleDigit('.');
            }}
            onPointerUp={(e) => unmarkPressed(e.currentTarget)}
            onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
            onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
            className="numpad-key numpad-digit h-14 rounded-2xl border font-mono text-2xl font-black flex items-center justify-center cursor-pointer disabled:opacity-35"
          >
            .
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              markPressed(e.currentTarget);
              handleDone();
            }}
            onPointerUp={(e) => unmarkPressed(e.currentTarget)}
            onPointerLeave={(e) => unmarkPressed(e.currentTarget)}
            onPointerCancel={(e) => unmarkPressed(e.currentTarget)}
            className="numpad-key numpad-done h-14 rounded-2xl border font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3] pointer-events-none" />
            <span className="pointer-events-none">{lang === 'bn' ? 'সম্পন্ন' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
