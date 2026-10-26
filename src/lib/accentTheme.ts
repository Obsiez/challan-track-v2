// Accent Theme Configuration and Custom Color Manager

export interface AccentOption {
  id: string;
  name: string;
  nameBn: string;
  lightHex: string;
  darkHex: string;
  previewHex: string;
}

export const PRESET_ACCENTS: AccentOption[] = [
  {
    id: 'emerald',
    name: 'Emerald Green',
    nameBn: 'পান্না সবুজ',
    lightHex: '#059669',
    darkHex: '#10B981',
    previewHex: '#10B981',
  },
  {
    id: 'indigo',
    name: 'Electric Indigo',
    nameBn: 'ইন্ডিগো নীল',
    lightHex: '#4F46E5',
    darkHex: '#818CF8',
    previewHex: '#6366F1',
  },
  {
    id: 'sapphire',
    name: 'Sapphire Blue',
    nameBn: 'নীলকান্তমণি',
    lightHex: '#0284C7',
    darkHex: '#38BDF8',
    previewHex: '#0284C7',
  },
  {
    id: 'amber',
    name: 'Amber Gold',
    nameBn: 'আম্বর সোনালী',
    lightHex: '#D97706',
    darkHex: '#FBBF24',
    previewHex: '#F59E0B',
  },
  {
    id: 'rose',
    name: 'Crimson Rose',
    nameBn: 'গোলাপী লাল',
    lightHex: '#E11D48',
    darkHex: '#FB7185',
    previewHex: '#F43F5E',
  },
  {
    id: 'purple',
    name: 'Royal Violet',
    nameBn: 'রয়েল বেগুনী',
    lightHex: '#7C3AED',
    darkHex: '#C084FC',
    previewHex: '#9333EA',
  },
  {
    id: 'teal',
    name: 'Ocean Teal',
    nameBn: 'সমুদ্র টিল',
    lightHex: '#0D9488',
    darkHex: '#2DD4BF',
    previewHex: '#14B8A6',
  },
];

const STORAGE_KEY = 'challan_custom_accent_color';
const THEME_PALETTE_STORAGE_KEY = 'challan_theme_palette';
const THEME_INTENSITY_STORAGE_KEY = 'challan_theme_intensity';

export interface ThemePaletteOption {
  id: string;
  name: string;
  nameBn: string;
  desc: string;
  descBn: string;
  canvasDark: string;
  surfaceDark: string;
  elevatedDark: string;
  canvasLight: string;
  surfaceLight: string;
  previewSwatches: [string, string, string];
  scale: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
}

export const THEME_PALETTES: ThemePaletteOption[] = [
  {
    id: 'obsidian',
    name: 'Obsidian Zinc',
    nameBn: 'অবসিডিয়ান জিঙ্ক',
    desc: 'Neutral carbon & zinc',
    descBn: 'নিউট্রাল চারকোল ও জিঙ্ক',
    canvasDark: '#09090B',
    surfaceDark: '#121215',
    elevatedDark: '#1A1A1F',
    canvasLight: '#F8F8FA',
    surfaceLight: '#FFFFFF',
    previewSwatches: ['#09090B', '#18181B', '#3F3F46'],
    scale: {
      50: '#FAFAFA',
      100: '#F4F4F5',
      200: '#E4E4E7',
      300: '#D4D4D8',
      400: '#A1A1AA',
      500: '#71717A',
      600: '#52525B',
      700: '#3F3F46',
      800: '#27272A',
      900: '#18181B',
      950: '#09090B',
    },
  },
  {
    id: 'oled',
    name: 'Pitch Black',
    nameBn: 'পিচ ব্ল্যাক (OLED)',
    desc: 'True black high-contrast',
    descBn: 'ট্রু ব্ল্যাক হাই-কন্ট্রাস্ট',
    canvasDark: '#000000',
    surfaceDark: '#0A0A0A',
    elevatedDark: '#141414',
    canvasLight: '#FFFFFF',
    surfaceLight: '#FFFFFF',
    previewSwatches: ['#000000', '#121212', '#333333'],
    scale: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#E5E5E5',
      300: '#D4D4D4',
      400: '#A3A3A3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#050505',
    },
  },
  {
    id: 'espresso',
    name: 'Warm Espresso',
    nameBn: 'ওয়ার্ম এসপ্রেসো',
    desc: 'Warm stone & umber',
    descBn: 'উষ্ণ স্টোন ও কফি টেক্সচার',
    canvasDark: '#0C0A09',
    surfaceDark: '#161311',
    elevatedDark: '#211D1A',
    canvasLight: '#FAF7F5',
    surfaceLight: '#FFFFFF',
    previewSwatches: ['#0C0A09', '#1C1917', '#44403C'],
    scale: {
      50: '#FAFAF9',
      100: '#F5F5F4',
      200: '#E7E5E4',
      300: '#D6D3D1',
      400: '#A8A29E',
      500: '#78716C',
      600: '#57534E',
      700: '#44403C',
      800: '#292524',
      900: '#1C1917',
      950: '#0C0A09',
    },
  },
  {
    id: 'forest',
    name: 'Deep Forest',
    nameBn: 'ডিপ ফরেস্ট',
    desc: 'Botanical pine & sage',
    descBn: 'বোটানিক্যাল পাইন ও সেজ',
    canvasDark: '#060C09',
    surfaceDark: '#0C1611',
    elevatedDark: '#14241C',
    canvasLight: '#F4F9F6',
    surfaceLight: '#FFFFFF',
    previewSwatches: ['#060C09', '#11221A', '#2D4F3E'],
    scale: {
      50: '#F4F9F6',
      100: '#E6F2EC',
      200: '#CEE4D9',
      300: '#A9CEBC',
      400: '#77AC93',
      500: '#52886F',
      600: '#3D6B56',
      700: '#2E5242',
      800: '#1E362B',
      900: '#112119',
      950: '#060C09',
    },
  },
  {
    id: 'plum',
    name: 'Velvet Plum',
    nameBn: 'ভেলভেট প্লাম',
    desc: 'Amethyst & dusk rose',
    descBn: 'অ্যামেথিস্ট ও ডাস্ক রোজ',
    canvasDark: '#0B070E',
    surfaceDark: '#140D19',
    elevatedDark: '#201528',
    canvasLight: '#F9F5FC',
    surfaceLight: '#FFFFFF',
    previewSwatches: ['#0B070E', '#1D1224', '#4A3259'],
    scale: {
      50: '#FAF7FC',
      100: '#F3ECF8',
      200: '#E6D8F0',
      300: '#D1BAE2',
      400: '#AC8BC6',
      500: '#8664A2',
      600: '#694B82',
      700: '#503864',
      800: '#342342',
      900: '#1E1326',
      950: '#0B070E',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Slate',
    nameBn: 'মিডনাইট স্লেট',
    desc: 'Classic deep navy slate',
    descBn: 'ক্লাসিক ডিপ নেভি ব্লু',
    canvasDark: '#07090E',
    surfaceDark: '#0D121D',
    elevatedDark: '#161F30',
    canvasLight: '#F5F8FC',
    surfaceLight: '#FFFFFF',
    previewSwatches: ['#07090E', '#0D121D', '#334155'],
    scale: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
      950: '#020617',
    },
  },
];

export function getSavedAccentColor(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.startsWith('#')) return saved;
    return '#059669'; // Default Emerald
  } catch {
    return '#059669';
  }
}

export function getSavedThemePalette(): string {
  try {
    const saved = localStorage.getItem(THEME_PALETTE_STORAGE_KEY);
    if (saved && THEME_PALETTES.some(p => p.id === saved)) return saved;
    return 'obsidian'; // Default to neutral Obsidian Zinc
  } catch {
    return 'obsidian';
  }
}

export function getSavedThemeIntensity(): number {
  try {
    const saved = localStorage.getItem(THEME_INTENSITY_STORAGE_KEY);
    if (saved !== null) {
      const parsed = Number(saved);
      if (!isNaN(parsed)) return Math.max(0, Math.min(100, parsed));
    }
    return 50;
  } catch {
    return 50;
  }
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16),
      g: parseInt(cleanHex[1] + cleanHex[1], 16),
      b: parseInt(cleanHex[2] + cleanHex[2], 16),
    };
  }
  if (cleanHex.length === 6) {
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16),
    };
  }
  return null;
}

export function mixHex(hexA: string, hexB: string, ratio: number): string {
  const rgbA = hexToRgb(hexA) || { r: 0, g: 0, b: 0 };
  const rgbB = hexToRgb(hexB) || { r: 0, g: 0, b: 0 };
  const t = Math.max(0, Math.min(1, ratio));
  const r = Math.round(rgbA.r * (1 - t) + rgbB.r * t);
  const g = Math.round(rgbA.g * (1 - t) + rgbB.g * t);
  const b = Math.round(rgbA.b * (1 - t) + rgbB.b * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

// Map slider 0..100% into the 20..80% effective shade range (20% -> new 0%, 80% -> new 100%)
function toEffectiveIntensity(sliderIntensity: number): number {
  const clamped = Math.max(0, Math.min(100, sliderIntensity));
  return 20 + (clamped / 100) * 60;
}

export function updateKeypadThemeVariables() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const accentHex = getSavedAccentColor();
  const paletteId = getSavedThemePalette();
  const intensity = toEffectiveIntensity(getSavedThemeIntensity());
  const palette = THEME_PALETTES.find(p => p.id === paletteId) || THEME_PALETTES[0];

  let canvasDark = palette.canvasDark;
  let surfaceDark = palette.surfaceDark;
  let elevatedDark = palette.elevatedDark;
  let canvasLight = palette.canvasLight;
  let surfaceLight = palette.surfaceLight;
  const adjustedScale = { ...palette.scale };

  if (intensity < 50) {
    const t = (50 - intensity) / 50;
    canvasDark = mixHex(palette.canvasDark, '#000000', t * 0.9);
    surfaceDark = mixHex(palette.surfaceDark, '#050507', t * 0.75);
    elevatedDark = mixHex(palette.elevatedDark, '#0C0C0F', t * 0.65);
    canvasLight = mixHex(palette.canvasLight, '#FFFFFF', t);
    surfaceLight = '#FFFFFF';
    adjustedScale[300] = mixHex(palette.scale[300], '#CBD5E1', t * 0.4);
    adjustedScale[700] = mixHex(palette.scale[700], '#1E293B', t * 0.5);
  } else if (intensity > 50) {
    const t = (intensity - 50) / 50;
    canvasDark = mixHex(palette.canvasDark, palette.scale[800], t * 0.75);
    surfaceDark = mixHex(palette.surfaceDark, palette.scale[700], t * 0.65);
    elevatedDark = mixHex(palette.elevatedDark, palette.scale[600], t * 0.55);
    canvasLight = mixHex(palette.canvasLight, palette.scale[200], t * 0.75);
    surfaceLight = mixHex('#FFFFFF', palette.scale[100], t * 0.65);
  }

  // Blend theme surface palette with the active accent color for the keypad & hide button
  const keypadBgLight = mixHex(surfaceLight, accentHex, 0.06);
  const keypadBgDark = mixHex(surfaceDark, accentHex, 0.08);
  const keypadKeyLight = mixHex(canvasLight, accentHex, 0.035);
  const keypadKeyDark = mixHex(elevatedDark, accentHex, 0.06);
  const keypadActionLight = mixHex(adjustedScale[100], accentHex, 0.11);
  const keypadActionDark = mixHex(adjustedScale[800], accentHex, 0.14);
  const keypadPressedLight = mixHex(adjustedScale[200], accentHex, 0.22);
  const keypadPressedDark = mixHex(adjustedScale[700], accentHex, 0.25);
  const keypadBorderLight = mixHex(adjustedScale[300], accentHex, 0.22);
  const keypadBorderDark = mixHex(adjustedScale[700], accentHex, 0.26);

  root.style.setProperty('--keypad-bg-light', keypadBgLight);
  root.style.setProperty('--keypad-bg-dark', keypadBgDark);
  root.style.setProperty('--keypad-key-light', keypadKeyLight);
  root.style.setProperty('--keypad-key-dark', keypadKeyDark);
  root.style.setProperty('--keypad-action-light', keypadActionLight);
  root.style.setProperty('--keypad-action-dark', keypadActionDark);
  root.style.setProperty('--keypad-pressed-light', keypadPressedLight);
  root.style.setProperty('--keypad-pressed-dark', keypadPressedDark);
  root.style.setProperty('--keypad-border-light', keypadBorderLight);
  root.style.setProperty('--keypad-border-dark', keypadBorderDark);
}

export function applyAccentColor(hex: string) {
  if (!hex || !hex.startsWith('#')) return;

  try {
    localStorage.setItem(STORAGE_KEY, hex);
  } catch (e) {
    // Ignore storage issues
  }

  const rgb = hexToRgb(hex) || { r: 5, g: 150, b: 105 };
  const root = document.documentElement;

  // Set CSS Custom Properties
  root.style.setProperty('--accent-color', hex);
  root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty('--accent-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
  root.style.setProperty('--accent-subtle-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
  root.style.setProperty('--accent-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);

  updateKeypadThemeVariables();

  // Dispatch custom event for real-time reactivity in components
  window.dispatchEvent(new CustomEvent('accent-color-changed', { detail: { hex } }));
}

export function applyThemePalette(paletteId: string, intensityOverride?: number) {
  const palette = THEME_PALETTES.find(p => p.id === paletteId) || THEME_PALETTES[0];
  const rawIntensity = intensityOverride !== undefined
    ? Math.max(0, Math.min(100, intensityOverride))
    : getSavedThemeIntensity();

  try {
    localStorage.setItem(THEME_PALETTE_STORAGE_KEY, palette.id);
    localStorage.setItem(THEME_INTENSITY_STORAGE_KEY, String(rawIntensity));
  } catch (e) {
    // Ignore storage issues
  }

  const intensity = toEffectiveIntensity(rawIntensity);
  const root = document.documentElement;

  // Calculate dynamic shade adjustments based on effective intensity (20..80 mapped from 0..100, default 50)
  let canvasDark = palette.canvasDark;
  let surfaceDark = palette.surfaceDark;
  let elevatedDark = palette.elevatedDark;
  let canvasLight = palette.canvasLight;
  let surfaceLight = palette.surfaceLight;

  const adjustedScale = { ...palette.scale };

  if (intensity < 50) {
    const t = (50 - intensity) / 50; // 0 at 50, 0.6 at 20 (slider 0%)
    canvasDark = mixHex(palette.canvasDark, '#000000', t * 0.9);
    surfaceDark = mixHex(palette.surfaceDark, '#050507', t * 0.75);
    elevatedDark = mixHex(palette.elevatedDark, '#0C0C0F', t * 0.65);

    canvasLight = mixHex(palette.canvasLight, '#FFFFFF', t);
    surfaceLight = '#FFFFFF';

    adjustedScale[950] = mixHex(palette.scale[950], '#000000', t * 0.9);
    adjustedScale[900] = mixHex(palette.scale[900], '#070709', t * 0.7);
    adjustedScale[800] = mixHex(palette.scale[800], '#121216', t * 0.5);
    adjustedScale[50] = mixHex(palette.scale[50], '#FFFFFF', t * 0.8);
    adjustedScale[100] = mixHex(palette.scale[100], '#FAFAFA', t * 0.6);
  } else if (intensity > 50) {
    const t = (intensity - 50) / 50; // 0 at 50, 0.6 at 80 (slider 100%)
    canvasDark = mixHex(palette.canvasDark, palette.scale[800], t * 0.75);
    surfaceDark = mixHex(palette.surfaceDark, palette.scale[700], t * 0.65);
    elevatedDark = mixHex(palette.elevatedDark, palette.scale[600], t * 0.55);

    // In light mode, higher intensity tints the website background & cards with a richer shade of the palette
    canvasLight = mixHex(palette.canvasLight, palette.scale[200], t * 0.75);
    surfaceLight = mixHex('#FFFFFF', palette.scale[100], t * 0.65);

    adjustedScale[950] = mixHex(palette.scale[950], palette.scale[800], t * 0.7);
    adjustedScale[900] = mixHex(palette.scale[900], palette.scale[700], t * 0.6);
    adjustedScale[800] = mixHex(palette.scale[800], palette.scale[600], t * 0.45);
    adjustedScale[50] = mixHex(palette.scale[50], palette.scale[200], t * 0.6);
    adjustedScale[100] = mixHex(palette.scale[100], palette.scale[300], t * 0.45);
  }

  root.style.setProperty('--theme-bg-canvas', canvasDark);
  root.style.setProperty('--theme-bg-surface', surfaceDark);
  root.style.setProperty('--theme-bg-elevated', elevatedDark);
  root.style.setProperty('--theme-light-canvas', canvasLight);
  root.style.setProperty('--theme-light-surface', surfaceLight);

  // Override Tailwind v4 slate & zinc color tokens dynamically so all surfaces, borders & text adapt
  (Object.keys(adjustedScale) as unknown as Array<keyof typeof adjustedScale>).forEach((step) => {
    const hexVal = adjustedScale[step];
    root.style.setProperty(`--color-slate-${step}`, hexVal);
    root.style.setProperty(`--color-zinc-${step}`, hexVal);
  });

  updateKeypadThemeVariables();

  window.dispatchEvent(
    new CustomEvent('theme-palette-changed', {
      detail: { paletteId: palette.id, intensity: rawIntensity }
    })
  );
}


