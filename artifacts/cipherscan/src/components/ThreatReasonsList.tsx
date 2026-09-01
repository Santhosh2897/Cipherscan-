import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ThreatReasonsListProps {
  reasons: string[];
  className?: string;
}

export function ThreatReasonsList({ reasons, className }: ThreatReasonsListProps) {
  const normalizedReasons: string[] = Array.isArray(reasons)
    ? reasons
    : typeof reasons === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(reasons);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];

  if (normalizedReasons.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-muted-foreground uppercase text-xs font-mono tracking-widest font-semibold mb-3">
        Detected Threats
      </h4>
      <ul className="space-y-2">
        {normalizedReasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-2 bg-destructive/5 border border-destructive/20 rounded-md p-3">
            <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={16} />
            <span className="text-sm font-medium text-destructive-foreground">{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
