import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { useGetScan, getGetScanQueryKey, useGetCommunityTrust, useReportThreat } from '@workspace/api-client-react';
import { ScanResultCard } from '@/components/ScanResultCard';
import { ArrowLeft, Loader2, Calendar, Users, Flag, CheckCircle, Zap, ShieldCheck, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Pull stored device ID from localStorage (written by Android WebView bridge or from the web analyze form)
function getLocalDeviceId(): string | null {
  return localStorage.getItem('cipherscan_device_id') ?? null;
}

export default function ScanDetail() {
  const [, params] = useRoute('/scans/:id');
  const id = params?.id ? parseInt(params.id, 10) : null;
  const deviceId = getLocalDeviceId();
  const [reportSent, setReportSent] = useState(false);

  const { data: scan, isLoading, isError } = useGetScan(id as number, {
    query: {
      enabled: id !== null && !isNaN(id),
      queryKey: getGetScanQueryKey(id as number)
    }
  });

  const { data: communityTrust } = useGetCommunityTrust(
    scan?.originalUrl ?? null,
    { enabled: !!scan?.originalUrl }
  );

  const reportThreat = useReportThreat();

  const handleReport = (verdict: 'malicious' | 'suspicious') => {
    if (!scan?.originalUrl || !deviceId) return;
    reportThreat.mutate(
      { url: scan.originalUrl, deviceId, reportedVerdict: verdict },
      { onSuccess: () => setReportSent(true) }
    );
  };

  if (!id || isNaN(id)) {
    return <div className="p-8 text-destructive font-mono">Invalid Scan ID</div>;
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !scan) {
    return <div className="p-8 text-destructive font-mono">Failed to load scan details.</div>;
  }

  const trustScore = communityTrust?.trustScore ?? -1;
  const trustColor =
    trustScore < 0 ? 'text-muted-foreground' :
    trustScore >= 70 ? 'text-emerald-400' :
    trustScore >= 30 ? 'text-amber-400' : 'text-red-400';
  const trustBorderColor =
    trustScore < 0 ? 'border-border/50' :
    trustScore >= 70 ? 'border-emerald-500/30' :
    trustScore >= 30 ? 'border-amber-500/30' : 'border-red-500/30';
  const trustBgColor =
    trustScore < 0 ? 'bg-card/50' :
    trustScore >= 70 ? 'bg-emerald-950/20' :
    trustScore >= 30 ? 'bg-amber-950/20' : 'bg-red-950/20';

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border/50 pb-6">
        <Link href="/scans">
          <Button variant="outline" size="icon" className="shrink-0 bg-transparent border-border/50 hover:bg-muted/50">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground truncate">
              Scan #{scan.id}
            </h1>
            <div className="px-2 py-1 rounded bg-muted/50 border border-border/50 text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Calendar size={12} />
              {formatDate(scan.createdAt)}
            </div>
            {/* Cache indicator */}
            {(scan as any).fromCache && (
              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-mono text-[10px] gap-1 flex items-center">
                <Zap size={9} /> Instant (Cached)
              </Badge>
            )}
            {(scan as any).fromTrustedDomain && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-[10px] gap-1 flex items-center">
                <ShieldCheck size={9} /> Trusted Domain
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            Trigger: <span className="uppercase font-mono tracking-wider">{scan.triggerType}</span>
            {scan.deviceName && (
              <span className="text-xs text-muted-foreground/70">· {scan.deviceName}</span>
            )}
          </p>
        </div>
      </div>

      {/* Community Trust + Report Panel */}
      {communityTrust && (
        <Card className={cn('backdrop-blur border', trustBorderColor, trustBgColor)}>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Trust Score */}
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-14 h-14 rounded-full border-2 flex items-center justify-center flex-col shrink-0',
                trustScore >= 70 ? 'border-emerald-500/50 bg-emerald-950/30' :
                trustScore >= 30 ? 'border-amber-500/50 bg-amber-950/30' :
                trustScore < 0 ? 'border-border/30 bg-muted/10' : 'border-red-500/50 bg-red-950/30'
              )}>
                {trustScore >= 0 ? (
                  <>
                    <span className={cn('text-lg font-bold font-mono leading-none', trustColor)}>
                      {trustScore}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground">/ 100</span>
                  </>
                ) : (
                  <Users size={20} className="text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Users size={10} /> Community Trust Score
                </p>
                {trustScore >= 0 ? (
                  <div className="space-y-0.5">
                    <p className={cn('text-sm font-semibold font-mono', trustColor)}>
                      {trustScore >= 70 ? 'Community Verified Safe' :
                       trustScore >= 30 ? 'Low Community Confidence' :
                       'Community Flagged as Threat'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {communityTrust.scanCount.toLocaleString()} users scanned · {communityTrust.communityFlags} community flags
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-mono">
                    First to scan this URL — no community data yet
                  </p>
                )}
              </div>
            </div>

            {/* Report Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {reportSent ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-mono">
                  <CheckCircle size={16} /> Report submitted — thank you!
                </div>
              ) : deviceId ? (
                <>
                  <p className="text-[10px] font-mono text-muted-foreground mr-1 hidden sm:block">Report as:</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReport('suspicious')}
                    disabled={reportThreat.isPending}
                    className="font-mono text-xs border-amber-500/30 text-amber-400 hover:bg-amber-950/30 gap-1.5"
                  >
                    <AlertTriangle size={12} /> Suspicious
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReport('malicious')}
                    disabled={reportThreat.isPending}
                    className="font-mono text-xs border-red-500/30 text-red-400 hover:bg-red-950/30 gap-1.5"
                  >
                    <Flag size={12} /> Malicious
                  </Button>
                </>
              ) : (
                <p className="text-[10px] font-mono text-muted-foreground italic">
                  Scan from Android app to report threats
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Result Card */}
      <div className="max-w-5xl">
        <ScanResultCard scan={scan} isDetailed />
      </div>
    </div>
  );
}
