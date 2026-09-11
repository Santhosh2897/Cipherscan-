import React, { useState } from 'react';
import { 
  useGetDashboardStats, 
  useGetScanTimeline, 
  useGetThreatBreakdown,
  useListScans,
  useClearScans,
  useGetCommunityStats,
  useGetTrendingThreats,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, ShieldX, Activity, Crosshair, Smartphone, Globe, Camera, Lock, RefreshCw, Trash2, Zap, Users, TrendingUp, Flag } from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { ScanTimelineChart, ThreatCategoryChart } from '@/components/Charts';
import { formatNumber } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Link } from 'wouter';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: timeline, isLoading: timelineLoading } = useGetScanTimeline();
  const { data: threats, isLoading: threatsLoading } = useGetThreatBreakdown();
  const { data: recentScans, isLoading: recentLoading } = useListScans({ limit: 5 });
  const { data: communityStats } = useGetCommunityStats();
  const { data: trending } = useGetTrendingThreats();
  const clearScansMutation = useClearScans();

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleResetData = () => {
    if (window.confirm("Are you sure you want to delete all scan records and reset the telemetry graph and threat taxonomy to zero level?")) {
      clearScansMutation.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries();
        }
      });
    }
  };

  if (statsLoading || timelineLoading || threatsLoading || recentLoading) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Activity size={32} className="animate-pulse" />
          <span className="font-mono tracking-widest text-sm animate-pulse">GATHERING INTEL...</span>
        </div>
      </div>
    );
  }

  const getSourceBadge = (triggerType: string, deviceName?: string | null) => {
    const label = deviceName && deviceName.trim() !== '' ? deviceName : null;
    switch (triggerType) {
      case 'link':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1 shrink-0">
            <Smartphone size={10} /> {label || 'Android Mobile'}
          </Badge>
        );
      case 'camera':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border-purple-500/30 flex items-center gap-1 shrink-0">
            <Camera size={10} /> {label ? `${label} (QR)` : 'QR Camera'}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 shrink-0">
            <Globe size={10} /> Web Dashboard
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight flex items-center gap-2.5 sm:gap-3">
            <Crosshair className="text-primary shrink-0" size={24} />
            <span>COMMAND CENTER</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Real-time threat intelligence & mobile ecosystem defense status.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="font-mono text-xs gap-1.5 border-border/50 bg-card/50"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"} />
            REFRESH
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetData}
            disabled={clearScansMutation.isPending}
            className="font-mono text-xs gap-1.5 bg-red-950/40 text-red-400 border border-red-500/30 hover:bg-red-900/60"
          >
            <Trash2 size={14} />
            RESET TELEMETRY
          </Button>

          {/* Security Level Indicator Card */}
          {stats && (
            <Card className="border-emerald-500/30 bg-emerald-950/20 backdrop-blur p-2.5 px-3.5 flex items-center gap-3 shrink-0 hidden md:flex">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Lock size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Protection</span>
                  <Badge className="bg-emerald-500 text-black font-mono font-bold text-[9px] uppercase px-1.5 py-0">
                    {stats.securityLevel || 'OPTIMAL'} ({stats.securityScore || 98}%)
                  </Badge>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Total Scans" 
            value={formatNumber(stats.totalScans)} 
            icon={Activity} 
            colorClass="text-primary border-primary/20 bg-primary/10"
          />
          <StatsCard 
            title="Threats Blocked" 
            value={formatNumber(stats.threatsBlocked)} 
            icon={ShieldX} 
            colorClass="text-destructive border-destructive/20 bg-destructive/10"
            trend={{ value: 12.5, label: "vs last week" }}
          />
          <StatsCard 
            title="Mobile Link Scans" 
            value={formatNumber(stats.mobileScans || 0)} 
            icon={Smartphone} 
            colorClass="text-blue-400 border-blue-500/20 bg-blue-500/10"
          />
          <StatsCard 
            title="Avg Risk Score" 
            value={stats.avgRiskScore.toFixed(1)} 
            icon={ShieldAlert} 
            colorClass="text-amber-500 border-amber-500/20 bg-amber-500/10"
          />
        </div>
      )}

      {/* Community Threat Intelligence Network Panel */}
      {communityStats && (
        <Card className="border-cyan-500/20 bg-cyan-950/10 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between border-b border-cyan-500/20 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
                <Users size={14} className="text-cyan-400" />
              </div>
              <CardTitle className="text-sm font-mono tracking-widest text-cyan-400/80 uppercase">
                Community Threat Intelligence Network
              </CardTitle>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 font-mono text-[9px] uppercase">
                LIVE
              </Badge>
            </div>
            <Link href="/threat-intel" className="text-xs font-mono text-cyan-400 hover:underline uppercase tracking-widest">
              Full Feed →
            </Link>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-md bg-black/20 border border-border/30 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  <Zap size={10} className="text-cyan-400" /> URLs Cached
                </div>
                <div className="text-xl font-bold font-mono text-cyan-300">
                  {formatNumber(communityStats.totalCachedUrls)}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {formatNumber(communityStats.totalScanHits)} total hits
                </div>
              </div>

              <div className="p-3 rounded-md bg-black/20 border border-border/30 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  <TrendingUp size={10} className="text-emerald-400" /> Safe URLs
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {formatNumber(communityStats.verdictBreakdown.safe)}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">community verified</div>
              </div>

              <div className="p-3 rounded-md bg-black/20 border border-border/30 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  <ShieldX size={10} className="text-red-400" /> Malicious Cached
                </div>
                <div className="text-xl font-bold font-mono text-red-400">
                  {formatNumber(communityStats.verdictBreakdown.malicious)}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">flagged by intelligence</div>
              </div>

              <div className="p-3 rounded-md bg-black/20 border border-border/30 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  <Flag size={10} className="text-amber-400" /> Reports Filed
                </div>
                <div className="text-xl font-bold font-mono text-amber-400">
                  {formatNumber(communityStats.totalReports)}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">by users like you</div>
              </div>
            </div>

            {/* Trending threat categories */}
            {trending && trending.trendingCategories.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <TrendingUp size={10} /> Trending Threat Categories (24h)
                </p>
                <div className="flex flex-wrap gap-2">
                  {trending.trendingCategories.slice(0, 6).map((cat) => (
                    <Badge
                      key={cat.category}
                      variant="outline"
                      className="text-[10px] font-mono bg-red-500/10 text-red-400 border-red-500/20"
                    >
                      {cat.category} <span className="ml-1 opacity-60">×{cat.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground uppercase">Threat Volume (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline ? <ScanTimelineChart data={timeline} /> : null}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground uppercase">Threat Taxonomy</CardTitle>
          </CardHeader>
          <CardContent>
            {threats ? <ThreatCategoryChart data={threats} /> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
          <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground uppercase">Live Multi-Device Scan Feed</CardTitle>
          <Link href="/scans" className="text-xs font-mono text-primary hover:underline uppercase tracking-widest">
            View All
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {(!recentScans?.items || recentScans.items.length === 0) ? (
            <div className="p-8 text-center text-muted-foreground font-mono text-sm">
              No recent scans recorded yet. Use Deep Scan or scan from an Android phone to see live activity.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentScans.items.map((scan) => (
                <Link 
                  key={scan.id} 
                  href={`/scans/${scan.id}`}
                  className="block p-4 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-4 truncate">
                      <VerdictBadge verdict={scan.verdict} size="sm" className="shrink-0" />
                      <div className="truncate space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {scan.originalUrl}
                          </p>
                          {getSourceBadge(scan.triggerType, scan.deviceName)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(scan.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right ml-4">
                      <div className="text-xl font-mono font-bold">{scan.riskScore}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Score</div>
                    </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
