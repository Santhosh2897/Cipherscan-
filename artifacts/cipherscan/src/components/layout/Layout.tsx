import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Link, useLocation } from 'wouter';
import { Menu, Shield, LayoutDashboard, Search, History, Activity, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDevice } from '@/context/DeviceContext';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSelector } from '@/components/LanguageSelector';

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { selectedDeviceId, selectedDevice, isFleetView } = useDevice();
  const { t } = useLanguage();

  const mobileNavItems = [
    { href: '/', label: t('nav_dashboard'), icon: LayoutDashboard },
    { href: '/analyze', label: t('nav_analyzer'), icon: Search },
    { href: '/scans', label: t('nav_history'), icon: History },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col md:flex-row">
      {/* Top Navigation Bar on Mobile */}
      <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-30 md:hidden">
        <Link href="/" className="flex items-center gap-2.5 text-primary">
          <div className="p-1 bg-primary/10 rounded-md border border-primary/20">
            <Shield size={18} className="text-primary" />
          </div>
          <span className="font-bold tracking-wider font-mono text-base text-foreground">CIPHERSCAN</span>
        </Link>

        <div className="flex items-center gap-2">
          {!isFleetView ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono truncate max-w-[130px]">
              <Smartphone size={11} className="text-cyan-400 shrink-0" />
              <span className="truncate">
                {selectedDevice?.deviceName && selectedDevice.deviceName !== selectedDeviceId
                  ? selectedDevice.deviceName
                  : selectedDeviceId
                  ? `${selectedDeviceId.slice(0, 8)}...`
                  : 'Device'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
              <Activity size={12} className="animate-pulse" />
              <span>ACTIVE</span>
            </div>
          )}

          <LanguageSelector variant="compact" />

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md bg-secondary/50 focus:outline-none"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Responsive Sidebar & Drawer */}
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 min-w-0 flex flex-col pb-16 md:pb-0 overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Navigation Bar for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur border-t border-border/50 flex items-center justify-around z-30 md:hidden px-2">
        {mobileNavItems.map((item) => {
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors",
                isActive 
                  ? "text-primary font-semibold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon size={18} className={cn("mb-0.5", isActive ? "text-primary" : "text-muted-foreground")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
