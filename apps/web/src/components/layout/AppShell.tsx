import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface text-text">
      <Sidebar />
      <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
