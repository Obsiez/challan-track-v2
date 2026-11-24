// Web Audio API procedural keyboard click sound generator
// Zero external assets, works 100% offline, zero latency (<2ms)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export const isKeypadSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  // If custom keypad is disabled, keyboard sound is also disabled
  if (localStorage.getItem('custom_keypad_enabled') === 'false') return false;
  return localStorage.getItem('custom_keypad_sound_enabled') === 'true';
};

export const setKeypadSoundEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('custom_keypad_sound_enabled', enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('keypad-sound-changed', { detail: { enabled } }));
};

export const playKeypadClick = (type: 'tick' | 'delete' | 'done' = 'tick'): void => {
  if (!isKeypadSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'delete') {
      // Slightly lower-pitched soft pop for delete
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.038);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.038);
    } else if (type === 'done') {
      // Pleasant affirmative dual-chime for done
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else {
      // Crisp iOS / Gboard style acoustic mechanical key click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1350, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.028);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.028);
    }
  } catch {
    // Graceful fallback if audio context cannot be initialized
  }
};

let lastWheelTickAt = 0;

export const unlockWheelAudio = (): void => {
  try {
    getAudioContext();
  } catch {
    // Ignore audio context unlock failure
  }
};

/**
 * Crisp, ultra-short Apple UIDatePicker / UIPickerView mechanical wheel tick.
 * Fires cleanly as each number crosses the center selection lens.
 */
export const playWheelTick = (): void => {
  if (typeof window === 'undefined') return;
  const perfNow = performance.now();
  if (perfNow - lastWheelTickAt < 16) return;
  lastWheelTickAt = perfNow;

  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(1.8, now);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1550, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.008);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.0012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.011);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.012);
  } catch {
    // Graceful fallback if audio context cannot be initialized
  }
};

