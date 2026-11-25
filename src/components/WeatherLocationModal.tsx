import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  MapPin,
  Navigation,
  Sun,
  Moon,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Droplets,
  Wind,
  RefreshCw,
} from 'lucide-react';
import ModalPortal, { useModalScrollLock } from './ModalPortal';
import LoadingSpinner from './LoadingSpinner';
import { Language, formatNumber } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import {
  WeatherData,
  WeatherIconKind,
  WeatherLocation,
  describeWeatherCode,
  reverseGeocodeLocation,
  searchWeatherLocations,
} from '../lib/weather';

export function WeatherGlyph({
  kind,
  className = 'w-5 h-5 stroke-[1.5]',
  style
}: {
  kind: WeatherIconKind;
  className?: string;
  style?: React.CSSProperties;
}) {
  switch (kind) {
    case 'sun':
      return <Sun className={className} style={style} />;
    case 'moon':
      return <Moon className={className} style={style} />;
    case 'partly-cloudy':
      return <CloudSun className={className} style={style} />;
    case 'cloud':
      return <Cloud className={className} style={style} />;
    case 'fog':
      return <CloudFog className={className} style={style} />;
    case 'drizzle':
      return <CloudDrizzle className={className} style={style} />;
    case 'rain':
      return <CloudRain className={className} style={style} />;
    case 'snow':
      return <CloudSnow className={className} style={style} />;
    case 'storm':
      return <CloudLightning className={className} style={style} />;
    default:
      return <CloudSun className={className} style={style} />;
  }
}

interface WeatherLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  weather: WeatherData | null;
  currentLocation: WeatherLocation;
  isLoadingWeather: boolean;
  onSelectLocation: (location: WeatherLocation, forceRefresh?: boolean) => void;
  lang: Language;
}

export default function WeatherLocationModal({
  isOpen,
  onClose,
  weather,
  currentLocation,
  isLoadingWeather,
  onSelectLocation,
  lang,
}: WeatherLocationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setResults([]);
      setIsSearching(false);
      return;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setErrorMsg(null);

    const timer = window.setTimeout(async () => {
      try {
        const matches = await searchWeatherLocations(trimmed, controller.signal);
        if (!controller.signal.aborted) {
          setResults(matches);
          setIsSearching(false);
        }
      } catch (err: any) {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          setIsSearching(false);
          setErrorMsg(
            lang === 'bn'
              ? 'এলাকা খুঁজে পাওয়া যায়নি। আবার চেষ্টা করুন।'
              : 'Could not search areas right now. Please try again.'
          );
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, isOpen, lang]);

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMsg(
        lang === 'bn'
          ? 'এই ব্রাউজারে লোকেশন সুবিধা নেই।'
          : 'Geolocation is not supported in this browser.'
      );
      return;
    }

    triggerHaptic('single');
    setIsLocating(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await reverseGeocodeLocation(
            pos.coords.latitude,
            pos.coords.longitude
          );
          onSelectLocation(loc, true);
          setIsLocating(false);
          setSearchQuery('');
          setResults([]);
        } catch {
          setIsLocating(false);
          setErrorMsg(
            lang === 'bn'
              ? 'লোকেশন শনাক্ত করা যায়নি।'
              : 'Unable to determine your area.'
          );
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg(
            lang === 'bn'
              ? 'লোকেশন অনুমতি দেওয়া হয়নি। নিচে আপনার এলাকা সার্চ করুন।'
              : 'Location permission denied. Search your area below instead.'
          );
        } else {
          setErrorMsg(
            lang === 'bn'
              ? 'বর্তমান লোকেশন পাওয়া যায়নি। নিচে আপনার এলাকা সার্চ করুন।'
              : 'Could not pinpoint your location. Search an area below.'
          );
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handlePickResult = (loc: WeatherLocation) => {
    triggerHaptic('single');
    onSelectLocation(loc, true);
    setSearchQuery('');
    setResults([]);
    onClose();
  };

  const weatherMeta = weather
    ? describeWeatherCode(weather.weatherCode, weather.isDay, lang)
    : null;

  return (
    <ModalPortal lockScroll={false}>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col relative z-10"
            >
              {/* Mobile Top Indicator Bar */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label text-slate-500 dark:text-slate-400'}>
                    {lang === 'bn' ? 'আবহাওয়া ও অবস্থান' : 'Weather & Location'}
                  </p>
                  <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white tracking-tight truncate mt-0.5">
                    {currentLocation.name}
                    {currentLocation.country ? `, ${currentLocation.country}` : ''}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer shrink-0 touch-press"
                  aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                >
                  <X className="w-4 h-4 stroke-[1.5]" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 space-y-4">
                {/* Current Weather Readout */}
                <div className="surface-subcard rounded-2xl p-4 border">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--accent-color)]/12 text-[var(--accent-color)] flex items-center justify-center shrink-0">
                        {isLoadingWeather && !weather ? (
                          <LoadingSpinner size="md" />
                        ) : (
                          <WeatherGlyph
                            kind={weatherMeta?.icon || 'partly-cloudy'}
                            className="w-6 h-6 stroke-[1.5]"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-3xl font-bold tabular-nums text-slate-950 dark:text-white leading-none">
                            {weather ? `${formatNumber(weather.temperature, lang)}°C` : '--°C'}
                          </span>
                          {weather && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              {lang === 'bn'
                                ? `অনুভূত ${formatNumber(weather.apparentTemperature, lang)}°`
                                : `Feels ${weather.apparentTemperature}°`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 truncate">
                          {weatherMeta?.label || (lang === 'bn' ? 'আবহাওয়া লোড হচ্ছে...' : 'Loading weather...')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        onSelectLocation(currentLocation, true);
                      }}
                      disabled={isLoadingWeather}
                      className="w-9 h-9 rounded-full bg-white/60 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-75"
                      title={lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
                    >
                      <RefreshCw className={`w-4 h-4 stroke-[1.5] ${isLoadingWeather ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
                    </button>
                  </div>

                  {weather && (
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] text-xs">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Droplets className="w-3.5 h-3.5 stroke-[1.5] text-sky-500 shrink-0" />
                        <span>{lang === 'bn' ? 'আর্দ্রতা' : 'Humidity'}</span>
                        <span className="ml-auto font-semibold tabular-nums text-slate-950 dark:text-white">
                          {formatNumber(weather.humidity, lang)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Wind className="w-3.5 h-3.5 stroke-[1.5] text-emerald-500 shrink-0" />
                        <span>{lang === 'bn' ? 'বাতাস' : 'Wind'}</span>
                        <span className="ml-auto font-semibold tabular-nums text-slate-950 dark:text-white">
                          {formatNumber(weather.windSpeed, lang)} km/h
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pinpoint Current Location Button */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-semibold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer touch-press disabled:opacity-60"
                >
                  {isLocating ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Navigation className="w-4 h-4 stroke-[1.75]" />
                  )}
                  <span>
                    {isLocating
                      ? (lang === 'bn' ? 'অবস্থান নির্ণয় করা হচ্ছে...' : 'Pinpointing your location...')
                      : (lang === 'bn' ? 'বর্তমান অবস্থান ব্যবহার করুন' : 'Use Current Location')}
                  </span>
                </button>

                {/* Area Search */}
                <div className="space-y-2.5">
                  <label
                    htmlFor="weather_area_search"
                    className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 block' : 'micro-mono-label text-slate-500 dark:text-slate-400 block'}
                  >
                    {lang === 'bn' ? 'অথবা যেকোনো এলাকা খুঁজুন' : 'Or Search an Area'}
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 stroke-[1.5] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={inputRef}
                      id="weather_area_search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={lang === 'bn' ? 'শহর বা এলাকার নাম লিখুন (যেমন: ঢাকা, চট্টগ্রাম)' : 'Search city or area (e.g. Dhaka, Chattogram, London)'}
                      className="w-full pl-10 pr-9 py-2.5 bg-white/55 dark:bg-white/[0.05] border border-slate-900/[0.08] dark:border-white/[0.1] rounded-xl text-sm text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900/40 dark:focus:border-white/40 outline-none transition-colors"
                    />
                    {isSearching && (
                      <LoadingSpinner size="sm" className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {errorMsg && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 px-1">
                      {errorMsg}
                    </p>
                  )}

                  {/* Search Results */}
                  {results.length > 0 && (
                    <div className="rounded-2xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-white/55 dark:bg-white/[0.03] divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] overflow-hidden">
                      {results.map((item, idx) => (
                        <button
                          key={`${item.name}-${item.latitude}-${item.longitude}-${idx}`}
                          type="button"
                          onClick={() => handlePickResult(item)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.07] transition-colors flex items-center gap-3 cursor-pointer"
                        >
                          <MapPin className="w-4 h-4 stroke-[1.5] text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-950 dark:text-white truncate">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {[item.admin1, item.country].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.trim().length >= 2 && !isSearching && results.length === 0 && !errorMsg && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
                      {lang === 'bn' ? 'কোনো এলাকা পাওয়া যায়নি।' : 'No matching areas found.'}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
