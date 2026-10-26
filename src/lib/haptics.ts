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

export type HapticType = 'single' | 'double' | 'tick' | 'keypad' | 'soft' | 'medium' | 'punchy' | number | number[];

let lastTickHapticTimestamp = 0;

export const triggerHaptic = (type: HapticType = 'single') => {
  if (!isHapticsEnabled()) return;

  if (type === 'tick') {
    const now = performance.now();
    if (now - lastTickHapticTimestamp < 45) return;
    lastTickHapticTimestamp = now;
  }

  // 1. iOS Safari / Standalone PWA Taptic Engine workaround
  if (isIOSDevice()) {
    triggerIosHaptic(type === 'keypad' || type === 'tick' ? 45 : 80);
    return;
  }

  // 2. Standard Web Vibration API (Android Chrome, etc.)
  const intensity = parseInt(localStorage.getItem('haptic_intensity') || '3', 10);

  // Scaled crisp native-like vibration durations (in ms):
  // Level 1: Soft tap (3ms — shifted from old level 2)
  // Level 2: Balanced crisp tap (8ms — shifted from old level 3)
  // Level 3: Firm tap (16ms — shifted from old level 4)
  // Level 4: Strong tap (28ms — shifted from old level 5)
  // Level 5: High intensity / vigorous tap (50ms — brand new punchy level 5)
  const baseDuration =
    intensity === 1
      ? 3
      : intensity === 2
      ? 8
      : intensity === 3
      ? 16
      : intensity === 4
      ? 28
      : 50;

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
    // Ultra-light micro-pulse for keyboard typing & slider ticks
    pattern = Math.max(1, Math.round(baseDuration * 0.4));
  } else if (type === 'soft') {
    pattern = Math.max(1, Math.round(baseDuration * 0.65));
  } else if (type === 'medium') {
    pattern = Math.max(10, Math.round(baseDuration * 1.25));
  } else if (type === 'punchy') {
    // Punchy, satisfying tactile snap for gesture thresholds / critical release points
    pattern = Math.max(12, Math.round(baseDuration * 1.4));
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
