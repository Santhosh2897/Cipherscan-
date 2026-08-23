import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  colorClass?: string;
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, colorClass = "text-primary", className }: StatsCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border/50 bg-card/50 backdrop-blur", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{title}</p>
            <div className="text-3xl font-bold font-mono tracking-tight text-foreground">{value}</div>
            {trend && (
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className={trend.value >= 0 ? "text-emerald-500" : "text-destructive"}>
                  {trend.value >= 0 ? "+" : ""}{trend.value}%
                </span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn("p-4 rounded-xl bg-muted/50 border border-border/50", colorClass)}>
            <Icon size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
