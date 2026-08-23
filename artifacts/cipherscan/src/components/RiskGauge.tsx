import React from 'react';
import { cn } from '@/lib/utils';

export interface RiskGaugeProps {
  score: number;
  className?: string;
  size?: number;
}

export function RiskGauge({ score, className, size = 200 }: RiskGaugeProps) {
  // Normalize score between 0 and 100
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  // Calculate colors based on score zones
  let strokeColor = '#10B981'; // Safe
  if (normalizedScore > 30) strokeColor = '#F59E0B'; // Amber
  if (normalizedScore > 69) strokeColor = '#EF4444'; // Red

  // Math for semi-circle
  const strokeWidth = size * 0.12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI;
  // Dash offset representing the score (score is 0-100, map to 0-circumference)
  // For a semi-circle, full is circumference, empty is 0. 
  // Wait, strokeDasharray="circumference circumference"
  // strokeDashoffset = circumference - (score / 100) * circumference
  const dashOffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className={cn('relative flex flex-col items-center justify-end', className)} style={{ width: size, height: size / 2 + strokeWidth }}>
      <svg
        width={size}
        height={size / 2 + strokeWidth / 2}
        className="overflow-visible"
      >
        {/* Background Arc */}
        <path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          fill="none"
          stroke="currentColor"
          className="text-muted/50"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Foreground Arc */}
        <path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center justify-end pb-2">
        <span className="text-3xl font-bold font-mono tracking-tight" style={{ color: strokeColor }}>
          {normalizedScore}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-1">Risk Score</span>
      </div>
    </div>
  );
}
