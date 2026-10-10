import React, { useState } from 'react';
import { useListScans, useClearScans } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Shield, Search, Filter, Loader2, Smartphone, Globe, Camera, RefreshCw, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Link } from 'wouter';
import { formatDate, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ListScansVerdict } from '@workspace/api-client-react/src/generated/api.schemas';
import { useDevice } from '@/context/DeviceContext';
import { DeviceSelector, ActiveDeviceBanner } from '@/components/DeviceSelector';
import { useLanguage } from '@/context/LanguageContext';

export default function ScanHistory() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [filterVerdict, setFilterVerdict] = useState<ListScansVerdict | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    selectedDeviceId,
    setSelectedDeviceId,
    clearDeviceFilter,
    devices,
    selectedDevice,
    isFleetView,
    isAdmin,
    isDeviceUser,
  } = useDevice();

  const clearScansMutation = useClearScans();
  
  const { data, isLoading } = useListScans({ 
    limit: 100, 
    verdict: filterVerdict ? (filterVerdict as ListScansVerdict) : undefined,
    deviceId: selectedDeviceId || undefined,
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClearHistory = () => {
    const targetDevice = selectedDeviceId || 'all';
    const confirmMsg = selectedDeviceId
      ? `Are you sure you want to clear scan history records for device "${selectedDevice?.deviceName || selectedDeviceId}"?`
      : "Are you sure you want to clear all scan history records across all devices?";

    if (window.confirm(confirmMsg)) {
      clearScansMutation.mutate(targetDevice, {
        onSuccess: () => {
          queryClient.invalidateQueries();
        }
      });
    }
  };

  const getSourceBadge = (triggerType: string, deviceName?: string | null) => {
    const label = deviceName && deviceName.trim() !== '' ? deviceName : null;
    switch (triggerType) {
      case 'link':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1 shrink-0">
            <Smartphone size={10} /> {label || 'Android'}
          </Badge>
        );
      case 'camera':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border-purple-500/30 flex items-center gap-1 shrink-0">
            <Camera size={10} /> {label ? `${label} (QR)` : 'QR'}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 shrink-0">
            <Globe size={10} /> Web
          </Badge>
        );
    }
  };

  const filteredItems = (data?.items ?? []).filter((scan) => {
    if (filterVerdict && scan.verdict !== filterVerdict) return false;
    if (selectedDeviceId && scan.deviceId !== selectedDeviceId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesUrl = scan.originalUrl.toLowerCase().includes(q) || scan.finalUrl.toLowerCase().includes(q);
      const matchesCategory = (scan.threatCategory ?? '').toLowerCase().includes(q);
      const matchesVerdict = scan.verdict.toLowerCase().includes(q);
      const matchesDevice = (scan.deviceName ?? '').toLowerCase().includes(q);
      if (!matchesUrl && !matchesCategory && !matchesVerdict && !matchesDevice) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col space-y-4 md:space-y-6 overflow-hidden max-w-7xl mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight flex items-center gap-2.5 sm:gap-3">
            <Shield className="text-primary shrink-0" size={24} />
            <span>{t('scan_history_title')}</span>
            {!isFleetView && (
              <Badge variant="outline" className="text-xs font-mono bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                {selectedDevice?.deviceName || t('device_scope')}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {t('scan_history_subtitle')}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <DeviceSelector />

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="font-mono text-xs gap-1.5 border-border/50 bg-card/50"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"} />
            {t('refresh')}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearHistory}
            disabled={clearScansMutation.isPending}
            className="font-mono text-xs gap-1.5 bg-red-950/40 text-red-400 border border-red-500/30 hover:bg-red-900/60"
          >
            <Trash2 size={14} />
            {t('clear_history')}
          </Button>
        </div>
      </div>

      <ActiveDeviceBanner />

      {/* Scope Switcher: All Fleet Scans vs Filtered Devices */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {isAdmin ? (
          <>
            <button
              type="button"
              onClick={clearDeviceFilter}
              className={cn(
                "px-3 py-1.5 text-xs font-mono rounded-md border transition-all flex items-center gap-1.5 shrink-0",
                isFleetView
                  ? "bg-primary/20 text-primary border-primary/50 font-bold shadow-sm"
                  : "bg-black/20 text-muted-foreground border-border/40 hover:text-foreground hover:bg-black/40"
              )}
            >
              <Globe size={12} />
              {t('fleet_view').toUpperCase()} ({isFleetView ? (data?.items?.length ?? 0) : 'Fleet'})
            </button>

            {devices.map((dev) => (
              <button
                key={dev.deviceId}
                type="button"
                onClick={() => setSelectedDeviceId(dev.deviceId)}
                className={cn(
                  "px-3 py-1.5 text-xs font-mono rounded-md border transition-all flex items-center gap-1.5 shrink-0",
                  selectedDeviceId === dev.deviceId
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold shadow-sm"
                    : "bg-black/20 text-muted-foreground border-border/40 hover:text-foreground hover:bg-black/40"
                )}
              >
                <Smartphone size={12} />
                <span>{dev.deviceName || dev.deviceId.slice(0, 8)}</span>
                <span className="opacity-60 text-[10px]">({dev.totalScans})</span>
              </button>
            ))}
          </>
        ) : (
          <div className="px-3 py-1.5 text-xs font-mono rounded-md border bg-cyan-500/15 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm flex items-center gap-2">
            <Smartphone size={13} className="text-cyan-400" />
            <span>{selectedDevice?.deviceName || t('device_scope')}</span>
            <span className="opacity-70 text-[11px] font-normal">({data?.items?.length ?? 0} scans)</span>
          </div>
        )}

      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur p-3 sm:p-4 flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center justify-between shrink-0">
        <div className="relative w-full md:max-w-md flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder={t('search_placeholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-black/20 border-input/50 focus-visible:ring-primary font-mono text-xs sm:text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <Filter size={16} className="text-muted-foreground mr-1 shrink-0" />
          <Button 
            variant={filterVerdict === '' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilterVerdict('')}
            className="rounded-full font-mono text-xs tracking-wider border-border/50 shrink-0"
          >
            {t('filter_all')}
          </Button>
          <Button 
            variant={filterVerdict === 'safe' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilterVerdict('safe')}
            className="rounded-full font-mono text-xs tracking-wider border-[#10B981]/20 hover:bg-[#10B981]/10 hover:text-[#10B981] shrink-0"
          >
            {t('filter_safe')}
          </Button>
          <Button 
            variant={filterVerdict === 'suspicious' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilterVerdict('suspicious')}
            className="rounded-full font-mono text-xs tracking-wider border-[#F59E0B]/20 hover:bg-[#F59E0B]/10 hover:text-[#F59E0B] shrink-0"
          >
            {t('filter_suspicious')}
          </Button>
          <Button 
            variant={filterVerdict === 'malicious' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilterVerdict('malicious')}
            className="rounded-full font-mono text-xs tracking-wider border-[#EF4444]/20 hover:bg-[#EF4444]/10 hover:text-[#EF4444] shrink-0"
          >
            {t('filter_malicious')}
          </Button>
        </div>
      </Card>

      <Card className="flex-1 border-border/50 bg-card/50 backdrop-blur overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-[80px] sm:w-[100px] font-mono text-xs uppercase tracking-widest">{t('table_score')}</TableHead>
                <TableHead className="w-[120px] sm:w-[140px] font-mono text-xs uppercase tracking-widest">{t('table_verdict')}</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-widest min-w-[200px]">{t('table_url')}</TableHead>
                <TableHead className="w-[140px] font-mono text-xs uppercase tracking-widest">{t('device_scope')}</TableHead>
                <TableHead className="w-[140px] sm:w-[160px] font-mono text-xs uppercase tracking-widest">{t('threat_breakdown')}</TableHead>
                <TableHead className="w-[160px] sm:w-[180px] font-mono text-xs uppercase tracking-widest text-right">{t('table_time')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground font-mono text-sm">
                    {t('no_records_found')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((scan) => (
                  <TableRow key={scan.id} className="border-border/50 cursor-pointer hover:bg-muted/30 group">
                    <TableCell>
                      <Link href={`/scans/${scan.id}`}>
                        <div className="font-mono font-bold text-base sm:text-lg">{scan.riskScore}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/scans/${scan.id}`}>
                        <VerdictBadge verdict={scan.verdict} size="sm" />
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] sm:max-w-[320px] lg:max-w-[450px]">
                      <Link href={`/scans/${scan.id}`} className="block truncate">
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm">
                          {scan.originalUrl}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/scans/${scan.id}`}>
                        {getSourceBadge(scan.triggerType, scan.deviceName)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/scans/${scan.id}`} className="block">
                        <span className="text-muted-foreground text-xs uppercase font-mono tracking-wider">
                          {scan.threatCategory || '-'}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/scans/${scan.id}`} className="block">
                        <span className="text-muted-foreground text-xs font-mono">
                          {formatDate(scan.createdAt)}
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
