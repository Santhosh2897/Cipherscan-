import React, { useState } from 'react';
import { useGetTrendingThreats, useGetCommunityStats, useGetUserPatterns, useTrustDomain } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Shield, TrendingUp, Flag, Users, Zap, Hash, RefreshCw, CheckCircle, XCircle, RotateCcw, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';

// Read stored device ID from localStorage (set by the Android app or dashboard)
function getLocalDeviceId(): string | null {
  return localStorage.getItem('cipherscan_device_id') ?? null;
}

export default function ThreatIntel() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const deviceId = getLocalDeviceId();

  const { data: trending, isLoading: trendingLoading } = useGetTrendingThreats();
  const { data: communityStats, isLoading: statsLoading } = useGetCommunityStats();
  const { data: userPatterns } = useGetUserPatterns(deviceId);
  const trustDomain = useTrustDomain();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['community'] });
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleTrustAction = (domain: string, action: 'trust' | 'block' | 'reset') => {
    if (!deviceId) return;
    trustDomain.mutate({ deviceId, domain, action }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', 'patterns'] }),
    });
  };

  const isLoading = trendingLoading || statsLoading;

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight flex items-center gap-2.5">
            <Shield className="text-cyan-400 shrink-0" size={24} />
            <span>THREAT INTEL FEED</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Community-powered threat intelligence — privacy-preserving, crowd-sourced.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="font-mono text-xs gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-950/30"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          REFRESH
        </Button>
      </div>

      {/* Community Stats Row */}
      {communityStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'URLs in Cache', value: communityStats.totalCachedUrls, icon: Zap, color: 'text-cyan-400' },
            { label: 'Total Scan Hits', value: communityStats.totalScanHits, icon: Activity, color: 'text-blue-400' },
            { label: 'Community Reports', value: communityStats.totalReports, icon: Flag, color: 'text-amber-400' },
            { label: 'Malicious Cached', value: communityStats.verdictBreakdown.malicious, icon: Shield, color: 'text-red-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/50 bg-card/50 backdrop-blur p-4 space-y-1">
              <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground`}>
                <Icon size={10} className={color} /> {label}
              </div>
              <div className={`text-2xl font-bold font-mono ${color}`}>{formatNumber(value)}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Trending Threat Categories */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2">
              <TrendingUp size={14} className="text-red-400" />
              Trending Threats (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoading ? (
              <div className="text-muted-foreground font-mono text-xs py-4 text-center animate-pulse">Loading...</div>
            ) : trending && trending.trendingCategories.length > 0 ? (
              trending.trendingCategories.map((cat, i) => (
                <div key={cat.category} className="flex items-center justify-between gap-3 p-3 rounded-md bg-black/20 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[10px] font-mono text-red-400 font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-mono font-medium text-foreground">{cat.category}</p>
                      <p className="text-[10px] text-muted-foreground">Avg risk: {cat.avgRiskScore}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-red-500/10 text-red-400 border-red-500/20 shrink-0">
                    ×{cat.count} scans
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground font-mono text-xs py-6 text-center">
                <Shield size={24} className="mx-auto mb-2 opacity-30" />
                No trending threats in the last 24h — community is safe!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Flagged URLs (hashed — privacy preserved) */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2">
              <Flag size={14} className="text-amber-400" />
              Top Flagged URLs (Hashed)
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-mono">
                Privacy Protected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {trending && trending.topFlaggedUrls.length > 0 ? (
              trending.topFlaggedUrls.map((entry) => (
                <div key={entry.urlHash} className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-black/20 border border-border/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <Hash size={12} className="text-amber-400 shrink-0" />
                    <code className="text-[10px] font-mono text-muted-foreground truncate">
                      {entry.urlHash.slice(0, 20)}…{entry.urlHash.slice(-8)}
                    </code>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20 shrink-0">
                    {entry.flagCount} flags
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground font-mono text-xs py-6 text-center">
                <Flag size={24} className="mx-auto mb-2 opacity-30" />
                No community reports yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Device Domain Patterns */}
      {deviceId && userPatterns ? (
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2">
              <Users size={14} className="text-blue-400" />
              My Domain Intelligence
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] font-mono">
                {userPatterns.totalDomainsTracked} domains tracked
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {userPatterns.topDomains.length > 0 ? (
              <div className="space-y-2">
                {userPatterns.topDomains.slice(0, 12).map((d) => (
                  <div key={d.domain} className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-black/20 border border-border/30 group">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${d.isTrusted ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                      <div>
                        <p className="text-sm font-mono text-foreground">{d.domain}</p>
                        <p className="text-[10px] text-muted-foreground">{d.scanCount} scans</p>
                      </div>
                      {d.isTrusted && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-mono">
                          Trusted
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleTrustAction(d.domain, d.isTrusted ? 'reset' : 'trust')}
                        title={d.isTrusted ? 'Remove trust' : 'Mark as trusted'}
                        className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                      >
                        {d.isTrusted ? <RotateCcw size={12} /> : <CheckCircle size={12} />}
                      </button>
                      <button
                        onClick={() => handleTrustAction(d.domain, 'block')}
                        title="Block this domain"
                        className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                      >
                        <XCircle size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground font-mono text-xs text-center py-6">
                No domain patterns yet. Start scanning links to build your personal intelligence profile.
              </p>
            )}
          </CardContent>
        </Card>
      ) : !deviceId ? (
        <Card className="border-border/50 bg-card/50 backdrop-blur p-6">
          <p className="text-muted-foreground font-mono text-xs text-center">
            Scan from the Android app to see your personal domain intelligence profile here.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
