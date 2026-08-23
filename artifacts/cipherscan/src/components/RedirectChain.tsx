import React from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RedirectChainProps {
  chain: string[];
  className?: string;
}

export function RedirectChain({ chain, className }: RedirectChainProps) {
  if (!chain || chain.length === 0) return null;

  return (
    <div className={cn("space-y-3 font-mono text-sm", className)}>
      <h4 className="text-muted-foreground uppercase text-xs tracking-widest font-semibold mb-4 flex items-center gap-2">
        <Globe size={14} />
        Redirect Chain ({chain.length} hops)
      </h4>
      <div className="relative border-l-2 border-muted pl-4 ml-2 space-y-6">
        {chain.map((url, i) => {
          const isLast = i === chain.length - 1;
          const isFirst = i === 0;
          
          let domain = url;
          try {
            const urlObj = new URL(url);
            domain = urlObj.hostname;
          } catch (e) {
            // ignore
          }

          return (
            <div key={i} className="relative">
              {/* Node dot */}
              <div className={cn(
                "absolute -left-[21px] w-2.5 h-2.5 rounded-full",
                isFirst ? "bg-primary" : isLast ? "bg-destructive" : "bg-muted-foreground"
              )} />
              
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Hop {i + 1}</span>
                <div className="break-all bg-card p-2 border rounded-md">
                  <span className={cn(
                    "font-bold",
                    isFirst ? "text-primary" : isLast ? "text-destructive" : "text-foreground"
                  )}>
                    {domain}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    {url.substring(url.indexOf(domain) + domain.length)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
