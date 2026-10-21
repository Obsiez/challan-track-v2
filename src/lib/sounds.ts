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
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } else if (type === 'done') {
      // Pleasant affirmative dual-chime for done
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.045);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } else {
      // Subtle crisp iOS / Gboard style acoustic mechanical key click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.022);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.022);
    }
  } catch {
    // Graceful fallback if audio context cannot be initialized
  }
};
