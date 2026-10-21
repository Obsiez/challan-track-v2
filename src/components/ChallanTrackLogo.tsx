import React from 'react';
import { BookOpen } from 'lucide-react';

interface ChallanTrackLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'icon' | 'full' | 'compact' | 'text-only' | 'mark-and-text';
  withGlow?: boolean;
  className?: string;
}

/**
 * Architectural Obsidian Slate icon mark with the signature BookOpen symbol.
 * Matches the updated favicon, PWA icon, and splash screen design.
 */
export const ChallanTrackMark: React.FC<{ size?: number; className?: string }> = ({
  size = 34,
  className = ''
}) => {
  const iconSize = Math.max(15, Math.round(size * 0.52));
  const radius = Math.max(7, Math.round(size * 0.24));
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold select-none border border-slate-800 dark:border-slate-200 shadow-xs transition-colors duration-200 ${className}`}
      style={{ width: size, height: size, borderRadius: `${radius}px` }}
      aria-label="Challan Track"
    >
      <BookOpen style={{ width: iconSize, height: iconSize }} className="stroke-[2.2] text-white dark:text-slate-950 transition-colors duration-200" />
    </div>
  );
};

/**
 * Pure, high-end typographic brand identity for Challan Track.
 * Sophisticated geometric typography inspired by Stripe and Linear:
 * High contrast, razor-sharp letter-spacing, and zero cheap gradients or colorful vomit.
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
    ? 'text-xl sm:text-2xl'
    : size === 'lg'
    ? 'text-3xl sm:text-4xl'
    : 'text-4xl sm:text-5xl';

  if (variant === 'icon') {
    return <ChallanTrackMark size={typeof size === 'number' ? size : 30} className={className} />;
  }

  return (
    <div className={`inline-flex items-baseline gap-1.5 select-none ${className}`}>
      <div className={`flex items-baseline tracking-tight ${pixelTextSize}`}>
        <span className="font-extrabold text-slate-950 dark:text-white tracking-[-0.035em]">
          Challan
        </span>
        <span className="font-light text-slate-400 dark:text-slate-400 tracking-[-0.015em] ml-1">
          Track
        </span>
      </div>
    </div>
  );
}

