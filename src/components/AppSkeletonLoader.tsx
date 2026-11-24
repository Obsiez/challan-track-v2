import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12" aria-busy="true" aria-label="Loading ledger">
      {/* 1. Open Cardless Hero Stage Skeleton */}
      <div className="pt-2 pb-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="w-36 h-3 rounded-full skeleton-shimmer" />
          <div className="w-24 h-3 rounded-full skeleton-shimmer" />
        </div>

        <div className="space-y-3 py-1">
          <div className="w-64 sm:w-80 h-14 sm:h-16 rounded-2xl skeleton-shimmer" />
          <div className="w-44 sm:w-56 h-3.5 rounded-full skeleton-shimmer" />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div className="h-12 flex-1 sm:flex-none sm:w-40 rounded-full skeleton-shimmer" />
          <div className="h-12 flex-1 sm:flex-none sm:w-36 rounded-full skeleton-shimmer" />
        </div>

        <div className="pt-4 border-t border-slate-200/50 dark:border-white/[0.06] grid grid-cols-3 gap-4">
          {[0, 1, 2].map((col) => (
            <div key={col} className="space-y-2">
              <div className="w-16 h-2.5 rounded-full skeleton-shimmer" />
              <div className="w-12 h-6 rounded-lg skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Horizontal Snap Pulse Carousel Skeleton */}
      <div className="flex md:grid md:grid-cols-3 gap-3.5 overflow-hidden">
        {[0, 1, 2].map((card) => (
          <div
            key={card}
            className="min-w-[76%] sm:min-w-[46%] md:min-w-0 surface-glass border rounded-[26px] p-5 flex flex-col justify-between space-y-5 shrink-0"
          >
            <div className="flex items-center justify-between">
              <div className="w-28 h-3 rounded-full skeleton-shimmer" />
              <div className="w-7 h-7 rounded-full skeleton-shimmer" />
            </div>
            <div className="space-y-2.5">
              <div className="w-32 h-8 rounded-xl skeleton-shimmer" />
              <div className="w-20 h-3 rounded-full skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Hairline Today's Journal Skeleton */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="w-32 h-4 rounded-full skeleton-shimmer" />
          <div className="w-40 h-8 rounded-full skeleton-shimmer" />
        </div>

        <div className="surface-glass border rounded-[26px] divide-y divide-slate-200/50 dark:divide-white/[0.06] overflow-hidden">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full skeleton-shimmer shrink-0" />
                <div className="space-y-2 flex-1 max-w-xs">
                  <div className="w-36 sm:w-44 h-4 rounded-full skeleton-shimmer" />
                  <div className="w-24 sm:w-32 h-3 rounded-full skeleton-shimmer" />
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2 shrink-0">
                <div className="w-20 h-4.5 rounded-full skeleton-shimmer" />
                <div className="w-12 h-3 rounded-full skeleton-shimmer" />
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
    <div className="relative min-h-screen app-canvas-bg flex flex-col md:flex-row transition-colors">
      <div aria-hidden="true" className="app-ambient-backdrop">
        <div className="app-ambient-grid" />
        <div className="app-ambient-noise" />
      </div>

      <aside className="hidden md:flex w-60 lg:w-64 shrink-0 sticky top-3 md:m-3 md:mr-0 h-[calc(100vh-1.5rem)] rounded-3xl exec-sidebar px-4 py-5 flex-col justify-between z-30 border">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
            <div className="w-28 h-5 rounded-full skeleton-shimmer" />
          </div>
          <div className="w-full h-11 rounded-full skeleton-shimmer" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="w-full h-10 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200/50 dark:border-white/[0.06]">
          <div className="h-9 rounded-xl skeleton-shimmer" />
          <div className="h-9 rounded-xl skeleton-shimmer" />
          <div className="h-9 rounded-xl skeleton-shimmer" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-6">
        <header className="md:hidden sticky top-3 z-30 px-4 pointer-events-none">
          <div className="max-w-6xl mx-auto glass-chrome-header rounded-full p-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-[38px] h-[38px] rounded-full skeleton-shimmer shrink-0" />
              <div className="w-28 h-5 rounded-full skeleton-shimmer" />
            </div>
            <div className="w-28 h-9 rounded-full skeleton-shimmer" />
          </div>
        </header>

        <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto mt-3 sm:mt-4 pt-4 sm:pt-6 px-4 pb-6 sm:px-6">
          <DashboardSkeleton />
        </main>
      </div>

      {/* Dynamic-Island Dock + Action Orb Skeleton */}
      <div className="fixed bottom-4 inset-x-4 z-40 md:hidden flex items-center justify-between gap-3">
        <nav className="flex-1 glass-chrome-bottom rounded-full border border-slate-200/60 dark:border-white/[0.1] h-[58px] px-4 flex items-center justify-around">
          {[0, 1, 2, 3].map((tab) => (
            <div key={tab} className="w-6 h-6 rounded-full skeleton-shimmer" />
          ))}
        </nav>
        <div className="w-[54px] h-[54px] rounded-full skeleton-shimmer shrink-0" />
      </div>
    </div>
  );
}
