import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskGauge } from './RiskGauge';
import { VerdictBadge } from './VerdictBadge';
import { RedirectChain } from './RedirectChain';
import { ThreatReasonsList } from './ThreatReasonsList';
import { ScanResult } from '@workspace/api-client-react/src/generated/api.schemas';
import { ExternalLink, Shield, ImageIcon, Globe, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface ScanResultCardProps {
  scan: ScanResult;
  className?: string;
  isDetailed?: boolean;
}

export function ScanResultCard({ scan, className, isDetailed = false }: ScanResultCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border/50 bg-card/50 backdrop-blur", className)}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50">
        
        {/* Left Column: Verdict & Score */}
        <div className="lg:col-span-4 p-8 flex flex-col items-center justify-center space-y-8 bg-black/10 relative overflow-hidden">
          {/* Subtle glow behind gauge */}
          <div className={cn(
            "absolute inset-0 opacity-10 blur-3xl rounded-full translate-y-1/2 scale-150",
            scan.verdict === 'safe' ? "bg-emerald-500" :
            scan.verdict === 'suspicious' ? "bg-amber-500" : "bg-destructive"
          )} />

          <VerdictBadge verdict={scan.verdict} size="lg" className="relative z-10" />
          <RiskGauge score={scan.riskScore} size={220} className="relative z-10" />
          
          {scan.threatCategory && (
            <Badge variant="outline" className="relative z-10 bg-background/50 backdrop-blur border-border/50 text-muted-foreground">
              {scan.threatCategory}
            </Badge>
          )}
        </div>

        {/* Right Column: Details */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="p-6 border-b border-border/50 bg-muted/10 space-y-4">
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Globe size={12} />
                Original Target
              </p>
              <div className="flex items-start gap-3">
                <a href={scan.originalUrl} target="_blank" rel="noreferrer" className="text-lg font-medium text-foreground hover:text-primary transition-colors break-all">
                  {scan.originalUrl}
                </a>
                <a href={scan.originalUrl} target="_blank" rel="noreferrer" className="mt-1 text-muted-foreground hover:text-primary">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            {scan.finalUrl !== scan.originalUrl && (
              <div className="pt-2">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Server size={12} />
                  Final Destination
                </p>
                <div className="text-sm font-medium text-foreground/80 break-all">
                  {scan.finalUrl}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
            <div className="space-y-8">
              <ThreatReasonsList reasons={scan.reasons} />
              <RedirectChain chain={scan.redirectChain} />
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-muted-foreground uppercase text-xs font-mono tracking-widest font-semibold flex items-center gap-2">
                  <ImageIcon size={14} />
                  Live Preview
                </h4>
                <div className="aspect-video w-full rounded-md border border-border/50 bg-black/40 overflow-hidden relative group">
                  {scan.previewImageUrl ? (
                    <img 
                      src={scan.previewImageUrl} 
                      alt="Target preview" 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 flex-col gap-2">
                      <ImageIcon size={32} />
                      <span className="text-xs font-mono">No Preview</span>
                    </div>
                  )}
                </div>
              </div>

              {isDetailed && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-md border border-border/50 bg-black/20">
                    <p className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-2">VirusTotal</p>
                    <div className="flex items-center gap-2">
                      <Shield size={16} className={scan.virusTotalScore && scan.virusTotalScore > 0 ? "text-amber-500" : "text-emerald-500"} />
                      <span className="font-mono text-sm">
                        {scan.virusTotalScore !== null ? `${scan.virusTotalScore} detections` : 'Unscanned'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 rounded-md border border-border/50 bg-black/20">
                    <p className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-2">Safe Browsing</p>
                    <div className="flex items-center gap-2">
                      <Shield size={16} className={scan.googleSafeBrowsing ? "text-emerald-500" : "text-destructive"} />
                      <span className="font-mono text-sm">
                        {scan.googleSafeBrowsing ? 'Clean' : 'Flagged'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
