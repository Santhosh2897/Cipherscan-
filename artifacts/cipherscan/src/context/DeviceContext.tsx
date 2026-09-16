import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useListDevices, type DeviceInfo } from '@workspace/api-client-react';

interface DeviceContextType {
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  clearDeviceFilter: () => void;
  devices: DeviceInfo[];
  selectedDevice: DeviceInfo | null;
  isFleetView: boolean;
  isLoadingDevices: boolean;
  refetchDevices: () => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

const STORAGE_KEY = 'cipherscan_device_id';

function getInitialDeviceId(): string {
  if (typeof window === 'undefined') return '';
  // 1. Check URL param first (e.g. ?deviceId=xxx)
  const params = new URLSearchParams(window.location.search);
  const urlDevice = params.get('deviceId');
  if (urlDevice && urlDevice.trim() !== '' && urlDevice !== 'all') {
    try {
      localStorage.setItem(STORAGE_KEY, urlDevice.trim());
    } catch {
      // ignore storage errors
    }
    return urlDevice.trim();
  }
  // 2. Check localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim() !== '' && stored !== 'all') {
      return stored.trim();
    }
  } catch {
    // ignore
  }
  return '';
}

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>(getInitialDeviceId);
  const { data: devicesData, isLoading: isLoadingDevices, refetch: refetchDevices } = useListDevices();

  const devices = useMemo(() => devicesData?.items ?? [], [devicesData]);

  // Sync state to URL & localStorage
  const setSelectedDeviceId = (id: string) => {
    const cleanId = id.trim();
    setSelectedDeviceIdState(cleanId);

    try {
      if (cleanId && cleanId !== 'all') {
        localStorage.setItem(STORAGE_KEY, cleanId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }

    // Sync URL search params
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (cleanId && cleanId !== 'all') {
        url.searchParams.set('deviceId', cleanId);
      } else {
        url.searchParams.delete('deviceId');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const clearDeviceFilter = () => {
    setSelectedDeviceId('');
  };

  // Sync if URL query param changes via browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlDevice = params.get('deviceId') ?? '';
      setSelectedDeviceIdState(urlDevice === 'all' ? '' : urlDevice);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectedDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    return devices.find((d) => d.deviceId === selectedDeviceId) ?? {
      deviceId: selectedDeviceId,
      deviceName: selectedDeviceId,
      lastScanAt: '',
      totalScans: 0,
    };
  }, [selectedDeviceId, devices]);

  const isFleetView = !selectedDeviceId || selectedDeviceId === 'all';

  return (
    <DeviceContext.Provider
      value={{
        selectedDeviceId,
        setSelectedDeviceId,
        clearDeviceFilter,
        devices,
        selectedDevice,
        isFleetView,
        isLoadingDevices,
        refetchDevices,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceContextType {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}
