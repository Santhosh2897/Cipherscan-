import React from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { ScanResultVerdict } from '@workspace/api-client-react/src/generated/api.schemas';

export interface VerdictBadgeProps {
  verdict: ScanResultVerdict | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function VerdictBadge({ verdict, className, size = 'md' }: VerdictBadgeProps) {
  const v = verdict.toLowerCase();
  
  let Icon = ShieldCheck;
  let colorClass = '';
  
  if (v === 'safe') {
    Icon = ShieldCheck;
    colorClass = 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20';
  } else if (v === 'suspicious') {
    Icon = ShieldAlert;
    colorClass = 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20';
  } else if (v === 'malicious') {
    Icon = ShieldX;
    colorClass = 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';
  }

  const sizeClass = {
    sm: 'text-[10px] px-1.5 py-0.5 space-x-1',
    md: 'text-xs px-2.5 py-1 space-x-1.5',
    lg: 'text-sm px-3 py-1.5 space-x-2'
  }[size];

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16
  }[size];

  return (
    <div className={cn('inline-flex items-center border font-mono tracking-wider uppercase font-bold rounded-full', colorClass, sizeClass, className)}>
      <Icon size={iconSize} className="shrink-0" />
      <span>{verdict}</span>
    </div>
  );
}
