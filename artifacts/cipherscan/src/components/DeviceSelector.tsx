import React, { useState } from 'react';
import { useDevice } from '@/context/DeviceContext';
import { Smartphone, Globe, Check, ChevronDown, X, Shield, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

export function DeviceSelector({ className }: { className?: string }) {
  const {
    selectedDeviceId,
    setSelectedDeviceId,
    clearDeviceFilter,
    devices,
    selectedDevice,
    isFleetView,
    isLoadingDevices,
  } = useDevice();

  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      setSelectedDeviceId(customInput.trim());
      setCustomInput('');
      setShowCustomInput(false);
    }
  };

  const truncateId = (id: string) => {
    if (!id) return '';
    if (id.length <= 14) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`font-mono text-xs gap-2 border transition-all h-9 px-3 ${
              isFleetView
                ? 'border-border/80 bg-secondary/30 text-foreground hover:bg-secondary/60'
                : 'border-cyan-500/50 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
            }`}
          >
            {isFleetView ? (
              <>
                <Globe size={14} className="text-primary" />
                <span className="font-semibold">Fleet Overview (All Devices)</span>
                {devices.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono ml-1">
                    {devices.length}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <Smartphone size={14} className="text-cyan-400 shrink-0" />
                <span className="font-semibold truncate max-w-[160px] sm:max-w-[220px]">
                  {selectedDevice?.deviceName || 'Device'}: {truncateId(selectedDeviceId)}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
              </>
            )}
            <ChevronDown size={13} className="text-muted-foreground opacity-60 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72 sm:w-80 p-2 font-mono text-xs bg-popover/95 backdrop-blur-md border-border">
          <DropdownMenuLabel className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-2 py-1.5 flex items-center justify-between">
            <span>Device Scope</span>
            {isLoadingDevices && <span className="text-[9px] lowercase text-primary animate-pulse">refreshing...</span>}
          </DropdownMenuLabel>

          {/* All Devices / Fleet Option */}
          <DropdownMenuItem
            onClick={clearDeviceFilter}
            className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer ${
              isFleetView ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-secondary/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Globe size={16} className={isFleetView ? 'text-primary' : 'text-muted-foreground'} />
              <div>
                <p className="font-medium">All Devices (Fleet View)</p>
                <p className="text-[10px] text-muted-foreground">Aggregated telemetry from all endpoints</p>
              </div>
            </div>
            {isFleetView && <Check size={14} className="text-primary shrink-0" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5 bg-border/60" />

          {/* Registered Devices List */}
          <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground">
            Registered Devices ({devices.length})
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            {devices.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-[11px] text-muted-foreground italic">
                No active devices detected yet. Scans sent from the Android app will appear here.
              </div>
            ) : (
              devices.map((device) => {
                const isSelected = selectedDeviceId === device.deviceId;
                return (
                  <DropdownMenuItem
                    key={device.deviceId}
                    onClick={() => setSelectedDeviceId(device.deviceId)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-500/15 text-cyan-300 font-semibold' : 'hover:bg-secondary/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Smartphone
                        size={15}
                        className={isSelected ? 'text-cyan-400 shrink-0' : 'text-muted-foreground shrink-0'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate text-foreground text-xs">
                            {device.deviceName || 'Android Device'}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({truncateId(device.deviceId)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{device.totalScans} scan{device.totalScans === 1 ? '' : 's'}</span>
                          {device.lastScanAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(device.lastScanAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-cyan-400 shrink-0 ml-2" />}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          <DropdownMenuSeparator className="my-1.5 bg-border/60" />

          {/* Manual Device ID input toggle */}
          {!showCustomInput ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowCustomInput(true);
              }}
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 hover:bg-secondary/40 rounded transition-colors"
            >
              <Filter size={12} />
              <span>Filter by custom Device ID...</span>
            </button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="p-1 space-y-1.5">
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  placeholder="Paste device UUID..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="h-7 text-xs font-mono py-1 px-2"
                  autoFocus
                />
                <Button type="submit" size="sm" className="h-7 text-[10px] px-2">
                  Apply
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomInput(false)}
                  className="h-7 w-7 p-0 text-muted-foreground"
                >
                  <X size={12} />
                </Button>
              </div>
            </form>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick Reset Pill if a device is filtered */}
      {!isFleetView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearDeviceFilter}
          title="Reset to All Devices (Fleet View)"
          className="h-8 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/50 gap-1"
        >
          <X size={12} />
          <span className="hidden sm:inline">Reset to All</span>
        </Button>
      )}
    </div>
  );
}

/**
 * Banner shown on top of pages when a device filter is currently applied.
 */
export function ActiveDeviceBanner() {
  const { selectedDeviceId, selectedDevice, clearDeviceFilter, isFleetView } = useDevice();

  if (isFleetView) return null;

  return (
    <div className="w-full bg-cyan-950/40 border border-cyan-500/30 rounded-lg p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono shadow-[0_0_15px_rgba(6,182,212,0.08)]">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
          <Smartphone size={18} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-cyan-300 text-sm">
              {selectedDevice?.deviceName || 'Device Filter Active'}
            </span>
            <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              SINGLE DEVICE SCOPE
            </Badge>
          </div>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            Showing metrics and scan records exclusively for device ID:{' '}
            <span className="text-cyan-200 select-all font-semibold">{selectedDeviceId}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={clearDeviceFilter}
          className="text-xs font-mono h-8 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50 gap-1.5"
        >
          <Globe size={13} />
          <span>Switch to Fleet View</span>
        </Button>
      </div>
    </div>
  );
}
