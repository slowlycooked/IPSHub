import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-app text-text">
      <Sidebar />
      <main className="min-w-0 px-4 py-4 md:px-6 lg:ml-[288px] lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
