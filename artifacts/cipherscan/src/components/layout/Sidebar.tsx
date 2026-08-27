import React from 'react';
import { Link, useLocation } from 'wouter';
import { Shield, LayoutDashboard, Search, History, Activity, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-sidebar-border space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-sidebar-foreground/50">
            <Activity size={16} className="text-emerald-500 animate-pulse" />
            <span className="font-mono text-xs">AGENT ACTIVE</span>
          </div>
        </div>
      </aside>
    </>
  );
}
