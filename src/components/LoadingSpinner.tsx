import React from 'react';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  strokeWidth?: number;
  label?: string;
}

const SIZE_MAP: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function LoadingSpinner({
  className = '',
  size = 'sm',
  strokeWidth = 2.6,
  label = 'Loading',
}: LoadingSpinnerProps) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.sm;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
      className={`${sizeClass} shrink-0 animate-spin ${className}`.trim()}
    >
      <circle
        cx="12"
        cy="12"
        r="9.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeOpacity={0.22}
      />
      <path
        d="M12 2.75a9.25 9.25 0 0 1 9.25 9.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default LoadingSpinner;
