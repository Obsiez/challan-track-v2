import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12" aria-busy="true" aria-label="Loading ledger">
      {/* 1. Editorial Hero Statement Skeleton */}
      <div className="surface-hero-glass border rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md skeleton-shimmer" />
            <div className="w-36 h-4 rounded-md skeleton-shimmer" />
          </div>
          <div className="w-28 h-4 rounded-md skeleton-shimmer" />
        </div>

        <div className="py-2 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="w-56 sm:w-72 h-12 sm:h-14 rounded-2xl skeleton-shimmer" />
            <div className="w-48 sm:w-64 h-4 rounded-md skeleton-shimmer" />
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-3 shrink-0">
            <div className="h-12 sm:w-36 rounded-2xl skeleton-shimmer" />
            <div className="h-12 sm:w-36 rounded-2xl skeleton-shimmer" />
          </div>
        </div>

        <div className="pt-5 border-t border-slate-200/60 dark:border-white/[0.07] grid grid-cols-3 gap-4 divide-x divide-slate-200/60 dark:divide-white/[0.07]">
          {[0, 1, 2].map((col) => (
            <div key={col} className="px-2 flex flex-col items-center space-y-2.5">
              <div className="w-20 sm:w-24 h-3.5 rounded-md skeleton-shimmer" />
              <div className="w-14 sm:w-18 h-7 rounded-lg skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Today's Pulse Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:hidden surface-glass border rounded-2xl p-5">
          <div className="grid grid-cols-2 divide-x divide-slate-200/60 dark:divide-white/[0.07]">
            {[0, 1].map((col) => (
              <div key={col} className="px-3 flex flex-col items-center space-y-2.5">
                <div className="w-20 h-3.5 rounded-md skeleton-shimmer" />
                <div className="w-24 h-7 rounded-lg skeleton-shimmer" />
                <div className="w-16 h-3 rounded-md skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>

        {[0, 1].map((card) => (
          <div
            key={card}
            className="hidden md:flex surface-glass border rounded-2xl p-6 flex-col justify-between space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="w-32 h-4 rounded-md skeleton-shimmer" />
              <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
            </div>
            <div className="space-y-3">
              <div className="w-36 h-9 rounded-xl skeleton-shimmer" />
              <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.07] flex justify-between">
                <div className="w-24 h-3.5 rounded-md skeleton-shimmer" />
                <div className="w-10 h-3.5 rounded-md skeleton-shimmer" />
              </div>
            </div>
          </div>
        ))}

        <div className="surface-glass border rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="w-28 h-4 rounded-md skeleton-shimmer" />
              <div className="w-20 h-3 rounded-md skeleton-shimmer" />
            </div>
            <div className="w-16 h-9 rounded-xl skeleton-shimmer" />
          </div>
          <div className="space-y-2.5">
            <div className="w-full h-3.5 rounded-full skeleton-shimmer" />
            <div className="flex justify-between">
              <div className="w-20 h-3.5 rounded-md skeleton-shimmer" />
              <div className="w-20 h-3.5 rounded-md skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Today's Ledger Journal Skeleton */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-36 h-5 rounded-md skeleton-shimmer" />
            <div className="w-16 h-4 rounded-md skeleton-shimmer" />
          </div>
          <div className="w-full sm:w-64 h-11 rounded-xl skeleton-shimmer" />
        </div>

        <div className="surface-glass border rounded-2xl divide-y divide-slate-200/60 dark:divide-white/[0.06] overflow-hidden">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-xl skeleton-shimmer shrink-0" />
                <div className="space-y-2.5 flex-1 max-w-xs">
                  <div className="w-40 sm:w-48 h-4.5 rounded-md skeleton-shimmer" />
                  <div className="w-28 sm:w-36 h-3.5 rounded-md skeleton-shimmer" />
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2 shrink-0">
                <div className="w-24 h-5 rounded-md skeleton-shimmer" />
                <div className="w-14 h-3.5 rounded-md skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="relative min-h-screen app-canvas-bg flex flex-col lg:flex-row transition-colors">
      <div aria-hidden="true" className="app-ambient-backdrop">
        <div className="app-ambient-grid" />
      </div>

      {/* Desktop Left Rail Skeleton */}
      <aside className="hidden lg:flex w-64 shrink-0 sticky top-0 h-screen exec-sidebar px-4 py-6 flex-col justify-between z-30">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
            <div className="w-32 h-5 rounded-lg skeleton-shimmer" />
          </div>
          <div className="w-full h-12 rounded-2xl skeleton-shimmer" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="w-full h-11 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
          <div className="h-11 rounded-xl skeleton-shimmer" />
          <div className="h-11 rounded-xl skeleton-shimmer" />
          <div className="h-11 rounded-xl skeleton-shimmer" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-10">
        {/* Mobile & Tablet Header Placeholder */}
        <header className="lg:hidden glass-chrome-header bg-white/75 dark:bg-[#121215]/75 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/[0.08] py-3 px-4 sticky top-0 z-30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
              <div className="w-28 h-5 rounded-lg skeleton-shimmer" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-11 h-11 rounded-xl skeleton-shimmer" />
              <div className="w-11 h-11 rounded-xl skeleton-shimmer" />
              <div className="w-11 h-11 rounded-xl skeleton-shimmer" />
              <div className="w-11 h-11 rounded-xl skeleton-shimmer" />
            </div>
          </div>
        </header>

        {/* Main Content Skeleton */}
        <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-5 sm:px-8 sm:py-8">
          <DashboardSkeleton />
        </main>
      </div>

      {/* Mobile Bottom Dock Placeholder */}
      <nav className="fixed bottom-0 inset-x-0 glass-chrome-bottom bg-white/80 dark:bg-[#121215]/80 backdrop-blur-xl border-t border-slate-200/70 dark:border-white/[0.08] h-[72px] px-4 z-40 lg:hidden flex items-center">
        <div className="max-w-md w-full mx-auto flex items-center justify-between">
          {[0, 1, 2, 3].map((tab) => (
            <div key={tab} className="flex flex-col items-center gap-1.5 w-16">
              <div className="w-5 h-5 rounded-md skeleton-shimmer" />
              <div className="w-12 h-3 rounded-sm skeleton-shimmer" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
