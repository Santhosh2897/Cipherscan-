import React from 'react';
import { 
  useGetDashboardStats, 
  useGetScanTimeline, 
  useGetThreatBreakdown,
  useListScans
} from '@workspace/api-client-react';
import { ShieldCheck, ShieldAlert, ShieldX, Activity, Crosshair } from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { ScanTimelineChart, ThreatCategoryChart } from '@/components/Charts';
import { formatNumber } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Link } from 'wouter';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: timeline, isLoading: timelineLoading } = useGetScanTimeline();
  const { data: threats, isLoading: threatsLoading } = useGetThreatBreakdown();
  const { data: recentScans, isLoading: recentLoading } = useListScans({ limit: 5 });

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

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight flex items-center gap-2.5 sm:gap-3">
          <Crosshair className="text-primary shrink-0" size={24} />
          <span>COMMAND CENTER</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Real-time threat intelligence overview.</p>
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
            title="Safe Links" 
            value={formatNumber(stats.safeLinks)} 
            icon={ShieldCheck} 
            colorClass="text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
          />
          <StatsCard 
            title="Avg Risk Score" 
            value={stats.avgRiskScore.toFixed(1)} 
            icon={ShieldAlert} 
            colorClass="text-amber-500 border-amber-500/20 bg-amber-500/10"
          />
        </div>
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
          <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground uppercase">Live Scan Feed</CardTitle>
          <Link href="/scans" className="text-xs font-mono text-primary hover:underline uppercase tracking-widest">
            View All
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {recentScans?.items.map((scan) => (
              <Link 
                key={scan.id} 
                href={`/scans/${scan.id}`}
                className="block p-4 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group"
              >
                  <div className="flex items-center gap-4 truncate">
                    <VerdictBadge verdict={scan.verdict} size="sm" className="shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {scan.originalUrl}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
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
        </CardContent>
      </Card>
    </div>
  );
}
