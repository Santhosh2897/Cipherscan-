import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function getVerdictColor(verdict: string) {
  switch (verdict.toLowerCase()) {
    case 'safe':
      return 'text-[#10B981]';
    case 'suspicious':
      return 'text-[#F59E0B]';
    case 'malicious':
      return 'text-[#EF4444]';
    default:
      return 'text-muted-foreground';
  }
}

export function getVerdictBgColor(verdict: string) {
  switch (verdict.toLowerCase()) {
    case 'safe':
      return 'bg-[#10B981]/10 border-[#10B981]/20';
    case 'suspicious':
      return 'bg-[#F59E0B]/10 border-[#F59E0B]/20';
    case 'malicious':
      return 'bg-[#EF4444]/10 border-[#EF4444]/20';
    default:
      return 'bg-muted border-border';
  }
}
