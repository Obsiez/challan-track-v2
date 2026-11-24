import React, { useState, useEffect } from 'react';
import { X, Check, Palette, Pipette, RefreshCcw, Sliders } from 'lucide-react';
import { 
  PRESET_ACCENTS, 
  getSavedAccentColor, 
  applyAccentColor,
  THEME_PALETTES,
  getSavedThemePalette,
  getSavedThemeIntensity,
  applyThemePalette
} from '../lib/accentTheme';
import { triggerHaptic } from '../lib/haptics';
import { Language, formatNumber } from '../lib/translations';
import ScrollSafeSlider from './ScrollSafeSlider';
import ModalPortal from './ModalPortal';

interface AccentColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export default function AccentColorPickerModal({
  isOpen,
  onClose,
  lang,
}: AccentColorPickerModalProps) {
  const [currentColor, setCurrentColor] = useState(getSavedAccentColor);
  const [customHex, setCustomHex] = useState(getSavedAccentColor);
  const [currentThemePalette, setCurrentThemePalette] = useState(getSavedThemePalette);
  const [surfaceIntensity, setSurfaceIntensity] = useState<number>(getSavedThemeIntensity);

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedAccentColor();
      setCurrentColor(saved);
      setCustomHex(saved);
      setCurrentThemePalette(getSavedThemePalette());
      setSurfaceIntensity(getSavedThemeIntensity());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        triggerHaptic('single');
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectColor = (hex: string) => {
    triggerHaptic('single');
    setCurrentColor(hex);
    setCustomHex(hex);
    applyAccentColor(hex);
  };

  const handleSelectThemePalette = (paletteId: string) => {
    triggerHaptic('single');
    setCurrentThemePalette(paletteId);
    applyThemePalette(paletteId, surfaceIntensity);
  };

  const handleIntensityChange = (newIntensity: number) => {
    setSurfaceIntensity(newIntensity);
    applyThemePalette(currentThemePalette, newIntensity);
  };

  const handleCustomHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setCurrentColor(val);
      applyAccentColor(val);
    }
  };

  const resetToDefault = () => {
    triggerHaptic('single');
    handleSelectColor('#059669');
    setSurfaceIntensity(50);
    setCurrentThemePalette('obsidian');
    applyThemePalette('obsidian', 50);
  };

  const labelClass = lang === 'bn'
    ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block'
    : 'micro-mono-label text-slate-500 dark:text-slate-400 font-semibold block';

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div
        onClick={() => {
          triggerHaptic('single');
          onClose();
        }}
        className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up relative z-10 w-full sm:max-w-md glass-modal border rounded-t-[2rem] sm:rounded-3xl text-slate-900 dark:text-slate-100 max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-400/40 dark:bg-white/20 mx-auto" />
        </div>

        {/* Sticky Header */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] px-5 sm:px-6 pt-3 sm:pt-5 pb-3.5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.08] border border-slate-900/[0.08] dark:border-white/[0.1] flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4 stroke-[1.25] text-slate-950 dark:text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold tracking-tight text-slate-950 dark:text-white truncate">
                {lang === 'bn' ? 'থিম ও অ্যাকসেন্ট প্যালেট' : 'Theme & Accent Palette'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {lang === 'bn' ? 'অ্যাপের থিম, শেড এবং হাইলাইট রঙ পছন্দমতো সাজান' : 'Personalize surface shade and highlight colors'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer text-slate-700 dark:text-slate-200 shrink-0 touch-press"
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
          >
            <X className="w-4 h-4 stroke-[1.25]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 sm:p-6 space-y-5">
        {/* 1. Theme Surface Palettes */}
        <div className="space-y-3">
          <label className={labelClass}>
            {lang === 'bn' ? 'থিম কালার প্যালেট (ব্যাকগ্রাউন্ড ও সারফেস)' : 'Theme Surface Palette'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEME_PALETTES.map((palette) => {
              const isSelected = currentThemePalette === palette.id;
              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => handleSelectThemePalette(palette.id)}
                  className={`p-3 rounded-2xl flex flex-col gap-2 text-left transition-all cursor-pointer touch-press ${
                    isSelected
                      ? 'border-2 border-slate-950 dark:border-white bg-slate-950/[0.06] dark:bg-white/[0.12] shadow-sm font-bold'
                      : 'border border-slate-900/[0.08] dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.03] hover:bg-white/70 dark:hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center -space-x-1">
                      {palette.previewSwatches.map((hex, idx) => (
                        <span
                          key={idx}
                          className="w-4 h-4 rounded-full border border-white/50 dark:border-black/40 shadow-2xs"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 dark:text-white stroke-[1.5]" />}
                  </div>
                  <span className="text-xs font-semibold truncate text-slate-900 dark:text-white">
                    {lang === 'bn' ? palette.nameBn : palette.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Minimal Surface Shade Slider */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal' : 'micro-mono-label font-semibold'}>
                {lang === 'bn' ? 'শেড' : 'Shade'}
              </span>
              <span className="font-mono text-[11px] font-semibold tabular-nums">
                {formatNumber(surfaceIntensity, lang)}%
              </span>
            </div>
            <ScrollSafeSlider
              min={0}
              max={100}
              step={1}
              value={surfaceIntensity}
              ariaLabel={lang === 'bn' ? 'শেড' : 'Shade'}
              onChange={(val) => {
                triggerHaptic('tick');
                handleIntensityChange(val);
              }}
            />
          </div>
        </div>

        {/* 2. Preset Accent Color Swatches */}
        <div className="space-y-2.5 pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
          <label className={labelClass}>
            {lang === 'bn' ? 'অ্যাকসেন্ট কালার প্যালেট' : 'Accent Color Swatches'}
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_ACCENTS.map((preset) => {
              const isSelected = currentColor.toLowerCase() === preset.lightHex.toLowerCase() ||
                                 currentColor.toLowerCase() === preset.previewHex.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectColor(preset.lightHex)}
                  className={`px-3 py-2.5 rounded-full flex items-center gap-2 text-left transition-all cursor-pointer touch-press ${
                    isSelected
                      ? 'border-2 border-slate-950 dark:border-white bg-slate-950/[0.06] dark:bg-white/[0.12] shadow-sm font-bold'
                      : 'border border-slate-900/[0.08] dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.03] hover:bg-white/70 dark:hover:bg-white/[0.07]'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/15 dark:border-white/25 shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: preset.previewHex }}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[2.2]" />}
                  </span>
                  <span className="text-xs truncate text-slate-900 dark:text-white">
                    {lang === 'bn' ? preset.nameBn : preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Hex Color Picker */}
        <div className="space-y-2.5 pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
          <label className={labelClass}>
            {lang === 'bn' ? 'কাস্টম হেক্স কোড বা কালার পিকার' : 'Custom Hex or Spectrum'}
          </label>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                data-numpad="false"
                value={customHex}
                onChange={handleCustomHexChange}
                placeholder="#059669"
                maxLength={7}
                className="w-full pl-4 pr-10 py-2.5 bg-white/50 dark:bg-white/[0.05] border border-slate-900/[0.08] dark:border-white/[0.1] rounded-full text-slate-950 dark:text-white font-mono text-sm focus:outline-none focus:border-slate-900/40 dark:focus:border-white/40 font-semibold"
              />
              <span
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-black/15 dark:border-white/25"
                style={{ backgroundColor: currentColor }}
              />
            </div>

            <label className="relative w-10 h-10 bg-white/60 hover:bg-white/80 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] border border-slate-900/[0.08] dark:border-white/[0.1] rounded-full cursor-pointer flex items-center justify-center shrink-0 transition-colors touch-press">
              <input
                type="color"
                value={currentColor}
                onChange={(e) => handleSelectColor(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              <Pipette className="w-4 h-4 stroke-[1.25] text-slate-900 dark:text-white" />
            </label>
          </div>
        </div>

        </div>

        {/* Sticky Footer Actions */}
        <div className="px-5 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 flex items-center justify-between border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] backdrop-blur-md shrink-0">
          <button
            type="button"
            onClick={resetToDefault}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 cursor-pointer py-1.5 px-2 rounded-full transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5 stroke-[1.25]" />
            <span>{lang === 'bn' ? 'ডিফল্ট রিসেট' : 'Reset Default'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              onClose();
            }}
            className="px-6 py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-semibold text-xs rounded-full cursor-pointer shadow-md active:scale-[0.97] transition-all"
          >
            {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}
