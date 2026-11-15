import React from 'react';
import { BookOpen } from 'lucide-react';

interface ChallanTrackLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'icon' | 'full' | 'compact' | 'text-only' | 'mark-and-text';
  withGlow?: boolean;
  className?: string;
}

/**
 * Architectural Private-Banking Folio Mark for Challan Track.
 */
export const ChallanTrackMark: React.FC<{ size?: number; className?: string }> = ({
  size = 38,
  className = ''
}) => {
  const iconSize = Math.max(16, Math.round(size * 0.48));
  const radius = Math.max(10, Math.round(size * 0.28));
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold select-none shadow-sm transition-all duration-200 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: `${radius}px`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 12px -4px rgba(15,23,42,0.28)'
      }}
      aria-label="Challan Track"
    >
      <BookOpen style={{ width: iconSize, height: iconSize }} className="stroke-[2] transition-colors duration-200" />
    </div>
  );
};

/**
 * Refined geometric fintech brand typography for Challan Track.
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

  if (variant === 'icon') {
    return <ChallanTrackMark size={typeof size === 'number' ? size : 36} className={className} />;
  }

  if (variant === 'mark-and-text' || variant === 'full') {
    return (
      <div className={`inline-flex items-center gap-3 select-none ${className}`}>
        <ChallanTrackMark size={variant === 'full' ? 42 : 36} />
        <div className="flex flex-col leading-none">
          <div className={`flex items-baseline font-display ${pixelTextSize}`}>
            <span className="font-extrabold text-slate-950 dark:text-white tracking-[-0.03em]">
              Challan
            </span>
            <span className="font-medium text-slate-500 dark:text-slate-400 tracking-[-0.015em] ml-1">
              Track
            </span>
          </div>
          {variant === 'full' && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tracking-wide mt-1">
              Client Credit &amp; Ledger
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-baseline gap-1.5 select-none ${className}`}>
      <div className={`flex items-baseline font-display ${pixelTextSize}`}>
        <span className="font-extrabold text-slate-950 dark:text-white tracking-[-0.03em]">
          Challan
        </span>
        <span className="font-medium text-slate-500 dark:text-slate-400 tracking-[-0.015em] ml-1">
          Track
        </span>
      </div>
    </div>
  );
}
