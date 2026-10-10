import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useListDevices, type DeviceInfo } from '@workspace/api-client-react';
import { getStoredRole, getStoredDeviceId, storeSession, type UserRole } from '@/pages/Login';

interface DeviceContextType {
  role: UserRole;
  isAdmin: boolean;
  isDeviceUser: boolean;
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  clearDeviceFilter: () => void;
  devices: DeviceInfo[];
  selectedDevice: DeviceInfo | null;
  isFleetView: boolean;
  isLoadingDevices: boolean;
  refetchDevices: () => void;
  unlockAdmin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

const STORAGE_KEY = 'cipherscan_device_id';

function getInitialDeviceId(): string {
  if (typeof window === 'undefined') return '';

  // 1. Check URL param (e.g. ?deviceId=xxx) with highest priority
  const params = new URLSearchParams(window.location.search);
  const urlDevice = params.get('deviceId');
  if (urlDevice && urlDevice.trim() !== '' && urlDevice !== 'all') {
    return urlDevice.trim();
  }

  // 2. Check if authenticated as a device user
  const storedRole = getStoredRole();
  const sessionDeviceId = getStoredDeviceId();
  if (storedRole === 'device' && sessionDeviceId) {
    return sessionDeviceId;
  }

  // 3. Check localStorage
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
  const [role, setRole] = useState<UserRole>(getStoredRole);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>(getInitialDeviceId);

  // If user is locked to a device, /api/devices returns their device
  const { data: devicesData, isLoading: isLoadingDevices, refetch: refetchDevices } = useListDevices();

  const isAdmin = role === 'admin';
  const isDeviceUser = role === 'device';

  // Sync state if role or session changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDevice = params.get('deviceId');
    const currentRole = getStoredRole();
    setRole(currentRole);

    if (urlDevice && urlDevice.trim() !== '' && urlDevice !== 'all') {
      setSelectedDeviceIdState(urlDevice.trim());
    } else if (currentRole === 'device') {
      const devId = getStoredDeviceId();
      if (devId) {
        setSelectedDeviceIdState(devId);
      }
    }
  }, []);

  const rawDevices = useMemo(() => devicesData?.items ?? [], [devicesData]);

  // For device users, filter out any devices that don't match their own
  const devices = useMemo(() => {
    if (isDeviceUser && selectedDeviceId) {
      const match = rawDevices.find((d) => d.deviceId === selectedDeviceId);
      return match ? [match] : [{
        deviceId: selectedDeviceId,
        deviceName: selectedDeviceId,
        lastScanAt: '',
        totalScans: 0,
      }];
    }
    return rawDevices;
  }, [rawDevices, isDeviceUser, selectedDeviceId]);

  // Sync state to URL & localStorage
  const setSelectedDeviceId = (id: string) => {
    // Device users cannot switch to other devices
    if (isDeviceUser) return;

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
    if (isDeviceUser) return; // cannot clear if locked to single device
    setSelectedDeviceId('');
  };

  const unlockAdmin = async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        storeSession(data.token, 'admin');
        setRole('admin');
        refetchDevices();
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Incorrect Admin PIN' };
    } catch {
      return { ok: false, error: 'Network error connecting to security server.' };
    }
  };

  const logout = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  // Sync if URL query param changes via browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      if (isDeviceUser) return;
      const params = new URLSearchParams(window.location.search);
      const urlDevice = params.get('deviceId') ?? '';
      setSelectedDeviceIdState(urlDevice === 'all' ? '' : urlDevice);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDeviceUser]);

  const selectedDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    return devices.find((d) => d.deviceId === selectedDeviceId) ?? {
      deviceId: selectedDeviceId,
      deviceName: selectedDeviceId,
      lastScanAt: '',
      totalScans: 0,
    };
  }, [selectedDeviceId, devices]);

  // If in device mode, isFleetView is NEVER true
  const isFleetView = isAdmin && (!selectedDeviceId || selectedDeviceId === 'all');

  return (
    <DeviceContext.Provider
      value={{
        role,
        isAdmin,
        isDeviceUser,
        selectedDeviceId,
        setSelectedDeviceId,
        clearDeviceFilter,
        devices,
        selectedDevice,
        isFleetView,
        isLoadingDevices,
        refetchDevices,
        unlockAdmin,
        logout,
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
