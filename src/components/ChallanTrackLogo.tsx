import React from 'react';
import { BookOpen } from 'lucide-react';

interface ChallanTrackLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'icon' | 'full' | 'compact' | 'text-only' | 'mark-and-text';
  withGlow?: boolean;
  className?: string;
}

/**
 * Blended Circular Smoked-Glass & Aurora-Frosted Folio Mark for Challan Track.
 * Combines sleek high-contrast translucent slate glass with a soft blurred accent aura.
 */
export const ChallanTrackMark: React.FC<{ size?: number; className?: string }> = ({
  size = 38,
  className = ''
}) => {
  const iconSize = Math.max(15, Math.round(size * 0.44));
  return (
    <div
      className={`challan-mark-surface relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden select-none backdrop-blur-xl border text-white transition-all duration-300 ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-label="Challan Track"
    >
      {/* Translucent blurry accent-tinted aurora orb beneath the frosted glass */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/4 -left-1/4 w-[85%] h-[85%] rounded-full blur-md opacity-60 dark:opacity-45 transition-colors duration-300"
        style={{ backgroundColor: 'var(--accent-color, #059669)' }}
      />
      <BookOpen
        style={{ width: iconSize, height: iconSize }}
        className="relative z-10 text-white stroke-[1.55] dark:stroke-[1.45] drop-shadow-[0_1px_2.5px_rgba(0,0,0,0.28)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.20)]"
      />
    </div>
  );
};

/**
 * Editorial typographic proportion split for Challan Track.
 */
export default function ChallanTrackLogo({
  size = 'md',
  variant = 'compact',
  className = ''
}: ChallanTrackLogoProps) {
  const pixelTextSize = typeof size === 'number'
    ? size
    : size === 'xs'
    ? 'text-base'
    : size === 'sm'
    ? 'text-lg sm:text-xl'
    : size === 'md'
    ? 'text-xl sm:text-[22px]'
    : size === 'lg'
    ? 'text-3xl sm:text-4xl'
    : 'text-4xl sm:text-5xl';

  const markSize =
    typeof size === 'number'
      ? size
      : size === 'xl'
      ? 48
      : size === 'lg'
      ? 42
      : variant === 'full'
      ? 38
      : 34;

  if (variant === 'icon') {
    return <ChallanTrackMark size={markSize} className={className} />;
  }

  if (variant === 'mark-and-text' || variant === 'full') {
    return (
      <div className={`inline-flex items-center gap-3 select-none ${className}`}>
        <ChallanTrackMark size={markSize} />
        <div className="flex flex-col leading-none">
          <div className={`flex items-baseline font-display ${pixelTextSize}`}>
            <span className="font-extrabold text-slate-950 dark:text-white tracking-[-0.04em]">
              Challan
            </span>
            <span className="font-light text-slate-500 dark:text-slate-400 tracking-[-0.02em] ml-1">
              Track
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-baseline gap-1 select-none ${className}`}>
      <div className={`flex items-baseline font-display ${pixelTextSize}`}>
        <span className="font-extrabold text-slate-950 dark:text-white tracking-[-0.04em]">
          Challan
        </span>
        <span className="font-light text-slate-500 dark:text-slate-400 tracking-[-0.02em] ml-1">
          Track
        </span>
      </div>
    </div>
  );
}
