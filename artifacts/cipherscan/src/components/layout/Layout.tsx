import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-w-0 flex flex-col">
        {children}
      </main>
    </div>
  );
}
