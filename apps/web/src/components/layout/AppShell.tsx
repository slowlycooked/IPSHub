import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      {/* On mobile: top-bar is h-14, so pt-14. On md+: sidebar is fixed left, ml-64 */}
      <main className="min-w-0 px-4 py-6 pt-20 sm:px-6 md:ml-64 md:pt-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
