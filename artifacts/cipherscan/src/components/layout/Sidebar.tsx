import React from 'react';
import { Link, useLocation } from 'wouter';
import { Shield, LayoutDashboard, Search, History, Activity, X, Zap, Smartphone, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDevice } from '@/context/DeviceContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/analyze', label: 'URL Analyzer', icon: Search },
    { href: '/scans', label: 'Scan History', icon: History },
    { href: '/threat-intel', label: 'Threat Intel Feed', icon: Zap, badge: 'LIVE' },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside 
        className={cn(
          "w-64 border-r border-sidebar-border bg-sidebar flex flex-col h-[100dvh] fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
          <Link href="/" onClick={onClose} className="flex items-center gap-3 text-sidebar-primary">
            <div className="p-1.5 bg-sidebar-primary/10 rounded-lg border border-sidebar-primary/20">
              <Shield size={20} className="text-sidebar-primary" />
            </div>
            <span className="font-bold tracking-widest font-mono text-lg text-sidebar-foreground">CIPHERSCAN</span>
          </Link>
          
          {/* Close button on mobile */}
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground md:hidden rounded-md focus:outline-none"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          <div className="px-2 pb-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-sidebar-foreground/50 font-semibold">Intelligence</p>
          </div>
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all group cursor-pointer",
                  isActive 
                    ? "bg-sidebar-primary/10 text-sidebar-primary border border-sidebar-primary/20" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
                )}
              >
                <item.icon size={18} className={cn("transition-colors", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
                <span className="flex-1">{item.label}</span>
                {'badge' in item && item.badge && (
                  <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          {/* Active Device Scope Widget */}
          <DeviceScopeWidget />

          <div className="flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/50">
            <Activity size={16} className="text-emerald-500 animate-pulse" />
            <span className="font-mono text-xs">AGENT ACTIVE</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function DeviceScopeWidget() {
  const { selectedDeviceId, selectedDevice, clearDeviceFilter, isFleetView } = useDevice();

  if (isFleetView) {
    return (
      <div className="p-2.5 bg-secondary/30 rounded-lg border border-border/40 font-mono text-[11px] space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Globe size={12} className="text-primary" /> Scope
          </span>
          <span className="text-primary font-semibold text-[10px]">FLEET VIEW</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">All endpoints aggregated</p>
      </div>
    );
  }

  return (
    <div className="p-2.5 bg-cyan-950/40 rounded-lg border border-cyan-500/30 font-mono text-[11px] space-y-1">
      <div className="flex items-center justify-between text-cyan-300">
        <span className="flex items-center gap-1.5">
          <Smartphone size={12} className="text-cyan-400" /> Device Scope
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      </div>
      <p className="font-semibold text-foreground truncate text-xs">
        {selectedDevice?.deviceName || selectedDeviceId.slice(0, 10)}
      </p>
      <button
        onClick={clearDeviceFilter}
        className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 pt-0.5"
      >
        ✕ Switch to Fleet
      </button>
    </div>
  );
}
