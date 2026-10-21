export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

export const isHapticsEnabled = (): boolean => {
  if (typeof localStorage === 'undefined') return true;
  const stored = localStorage.getItem('haptics');
  // Default to true unless explicitly disabled
  return stored === null ? true : stored === 'true';
};

let lastIosHapticTimestamp = 0;

/**
 * Fires a single native iOS Taptic Engine switch tick using WebKit's
 * <label><input type="checkbox" switch></label> activation exploit.
 * Must be invoked within an active user gesture on iOS Safari / Standalone PWA.
 */
function fireSingleIosSwitchClick() {
  if (typeof document === 'undefined') return;
  try {
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    // Keep out of visual layout without using pointer-events:none (which blocks WebKit switch activation)
    label.style.position = 'fixed';
    label.style.bottom = '0px';
    label.style.left = '0px';
    label.style.width = '1px';
    label.style.height = '1px';
    label.style.opacity = '0.01';
    label.style.zIndex = '-1';
    label.style.overflow = 'hidden';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);

    const container = document.body || document.head;
    if (!container) return;

    container.appendChild(label);
    label.click();
    container.removeChild(label);
  } catch (e) {
    // Ignore DOM errors on unsupported environments
  }
}

function triggerIosHaptic(deduplicateWindowMs = 60) {
  const now = Date.now();
  if (now - lastIosHapticTimestamp < deduplicateWindowMs) return;
  lastIosHapticTimestamp = now;
  fireSingleIosSwitchClick();
}

// Install a lightweight global touch/pointer listener on iOS so buttons that call
// triggerHaptic() after an async await still fire during the synchronous WebKit user gesture.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const handleIosInteractiveGesture = (e: Event) => {
    if (!isIOSDevice() || !isHapticsEnabled()) return;
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    // Skip custom keypad keys since they handle haptics directly on pointerdown
    if (target.closest('[data-keypad-root="true"]')) return;

    const interactive = target.closest(
      'button:not(:disabled), [role="button"], a[href], input[type="checkbox"], input[type="radio"], select, summary'
    );
    if (interactive) {
      triggerIosHaptic(110);
    }
  };

  document.addEventListener('click', handleIosInteractiveGesture, { capture: true, passive: true });
}

export type HapticType = 'single' | 'double' | 'tick' | 'keypad' | 'soft' | 'medium' | number | number[];

export const triggerHaptic = (type: HapticType = 'single') => {
  if (!isHapticsEnabled()) return;

  // 1. iOS Safari / Standalone PWA Taptic Engine workaround
  if (isIOSDevice()) {
    triggerIosHaptic(type === 'keypad' || type === 'tick' ? 45 : 80);
    return;
  }

  // 2. Standard Web Vibration API (Android Chrome, etc.)
  const intensity = parseInt(localStorage.getItem('haptic_intensity') || '3', 10);

  // Lowered, crisp native-like vibration durations (in ms):
  // 1: Ultra-light micro-tick (1ms)
  // 2: Soft tap (3ms)
  // 3: Balanced crisp tap (8ms — lowered from 28ms)
  // 4: Firm tap (15ms — lowered from 55ms)
  // 5: Strong tap (28ms — lowered from 110ms)
  const baseDuration =
    intensity === 1
      ? 1
      : intensity === 2
      ? 3
      : intensity === 3
      ? 8
      : intensity === 4
      ? 15
      : 28;

  let pattern: number | number[];

  if (typeof type === 'number') {
    const ratio = baseDuration / 10;
    pattern = Math.max(1, Math.round(type * ratio));
  } else if (Array.isArray(type)) {
    const ratio = baseDuration / 10;
    pattern = type.map((val, idx) => {
      if (idx % 2 === 0) {
        return Math.max(1, Math.round(val * ratio));
      }
      return val;
    });
  } else if (type === 'keypad' || type === 'tick') {
    // Ultra-light micro-pulse for keyboard typing & slider ticks (1ms - 4ms)
    pattern = Math.max(1, Math.round(baseDuration * 0.4));
  } else if (type === 'soft') {
    pattern = Math.max(1, Math.round(baseDuration * 0.65));
  } else if (type === 'medium') {
    pattern = Math.max(2, Math.round(baseDuration * 1.25));
  } else if (type === 'double') {
    pattern = [baseDuration, 35, baseDuration];
  } else {
    pattern = baseDuration;
  }

  try {
    if (window.navigator?.vibrate) {
      window.navigator.vibrate(pattern);
    }
  } catch (e) {
    // Ignore vibration errors
  }
};
