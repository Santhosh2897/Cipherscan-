import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Shield, Smartphone, Lock, ArrowRight, Activity, AlertCircle } from 'lucide-react';

const SESSION_TOKEN_KEY = 'cs_auth_token';
const SESSION_ROLE_KEY = 'cs_auth_role';
const SESSION_DEVICE_KEY = 'cs_auth_device_id';
const PIN_LENGTH = 6;

export type UserRole = 'admin' | 'device';

export interface SessionInfo {
  token: string | null;
  role: UserRole | null;
  deviceId: string | null;
}

/** Retrieve stored token from sessionStorage */
export function getStoredToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

/** Retrieve stored role from sessionStorage */
export function getStoredRole(): UserRole {
  const role = sessionStorage.getItem(SESSION_ROLE_KEY);
  return role === 'device' ? 'device' : 'admin';
}

/** Retrieve stored deviceId for device role */
export function getStoredDeviceId(): string | null {
  return sessionStorage.getItem(SESSION_DEVICE_KEY);
}

/**
 * Returns true if the user has a valid session token stored.
 */
export function isAuthenticated(): boolean {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  return token !== null && token !== '';
}

/** Store the session info received from /api/auth */
export function storeSession(token: string, role: UserRole, deviceId?: string) {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  sessionStorage.setItem(SESSION_ROLE_KEY, role);
  if (deviceId) {
    sessionStorage.setItem(SESSION_DEVICE_KEY, deviceId);
    try {
      localStorage.setItem('cipherscan_device_id', deviceId);
    } catch {
      // ignore
    }
  } else {
    sessionStorage.removeItem(SESSION_DEVICE_KEY);
  }
}

/** Clear auth (logout) */
export function clearAuth() {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_ROLE_KEY);
  sessionStorage.removeItem(SESSION_DEVICE_KEY);
}

interface LoginProps {
  onSuccess: (token: string, role: UserRole, deviceId?: string) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [mode, setMode] = useState<UserRole>('device');
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);
  const pinInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Check URL param ?deviceId=... on mount for 1-click Android app / Custom Tab auto-login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDeviceId = params.get('deviceId');

    if (urlDeviceId && urlDeviceId.trim() !== '' && urlDeviceId !== 'all') {
      submitDeviceLogin(urlDeviceId.trim(), true);
    } else {
      setAutoChecking(false);
      // Pre-fill device ID from localStorage if exists
      const stored = localStorage.getItem('cipherscan_device_id');
      if (stored && stored.trim() !== '' && stored !== 'all') {
        setDeviceIdInput(stored.trim());
      }
    }
  }, []);

  async function submitDeviceLogin(deviceId: string, isAuto = false) {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        storeSession(data.token, 'device', data.deviceId);
        onSuccess(data.token, 'device', data.deviceId);
      } else {
        setAutoChecking(false);
        triggerError(data.error || 'Failed to authenticate device.');
      }
    } catch {
      setAutoChecking(false);
      triggerError('Network error connecting to security server.');
    } finally {
      setLoading(false);
    }
  }

  async function submitPin(pin: string) {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        storeSession(data.token, 'admin');
        onSuccess(data.token, 'admin');
      } else {
        triggerError(data.error || 'Incorrect Admin PIN. Please try again.');
      }
    } catch {
      triggerError('Network error connecting to security server.');
    } finally {
      setLoading(false);
    }
  }

  function triggerError(message: string) {
    setError(message);
    setShake(true);
    if (mode === 'admin') {
      setDigits(Array(PIN_LENGTH).fill(''));
      setTimeout(() => {
        setShake(false);
        pinInputsRef.current[0]?.focus();
      }, 600);
    } else {
      setTimeout(() => setShake(false), 600);
    }
  }

  function handlePinChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    setError('');

    if (value && index < PIN_LENGTH - 1) {
      pinInputsRef.current[index + 1]?.focus();
    }

    if (value && index === PIN_LENGTH - 1) {
      const pin = [...next.slice(0, PIN_LENGTH - 1), value.slice(-1)].join('');
      if (pin.length === PIN_LENGTH) submitPin(pin);
    }
  }

  function handlePinKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      pinInputsRef.current[index - 1]?.focus();
    }
  }

  function handlePinPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (text.length === PIN_LENGTH) {
      setDigits(text.split(''));
      submitPin(text);
    }
    e.preventDefault();
  }

  function handleDeviceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (deviceIdInput.trim() && !loading) {
      submitDeviceLogin(deviceIdInput.trim());
    }
  }

  function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pin = digits.join('');
    if (pin.length === PIN_LENGTH && !loading) {
      submitPin(pin);
    }
  }

  if (autoChecking) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 text-cyan-400 font-mono">
        <Activity size={36} className="animate-pulse mb-3" />
        <p className="text-sm tracking-widest animate-pulse">CONNECTING DEVICE TELEMETRY...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Brand Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">CIPHERSCAN</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-mono mt-1">Mobile Threat Defense & Command Center</p>
        </div>

        {/* Card Container */}
        <div
          className={`bg-gray-900/90 backdrop-blur-md border rounded-2xl p-6 sm:p-8 shadow-2xl transition-all ${
            shake ? 'animate-[shake_0.5s_ease-in-out]' : ''
          } ${error ? 'border-red-500/50' : 'border-gray-800'}`}
        >
          {/* Dual-Mode Selector Tabs */}
          <div className="flex rounded-xl bg-gray-800/80 p-1 mb-6 border border-gray-700/50 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('device');
                setError('');
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === 'device'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone size={14} />
              <span>Device View</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setError('');
                setTimeout(() => pinInputsRef.current[0]?.focus(), 50);
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === 'admin'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Lock size={14} />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* Mode 1: Device View Login */}
          {mode === 'device' && (
            <form onSubmit={handleDeviceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-gray-300 mb-1.5">
                  Your Android Device ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3a7f9201-4bc1-..."
                  value={deviceIdInput}
                  onChange={(e) => {
                    setDeviceIdInput(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all placeholder:text-gray-500"
                />
                <p className="text-[11px] text-gray-400 font-mono mt-1.5 leading-relaxed">
                  Enter your phone's identifier to view only your device's scans and live threat intelligence.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-mono bg-red-950/30 p-2.5 rounded-lg border border-red-500/30">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!deviceIdInput.trim() || loading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm font-mono
                  bg-gradient-to-r from-cyan-500 to-blue-600
                  text-white shadow-lg shadow-cyan-500/20
                  hover:shadow-cyan-500/30 hover:scale-[1.01]
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100
                  transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Connecting...</span>
                ) : (
                  <>
                    <span>Unlock Device View</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Mode 2: Admin Portal Login */}
          {mode === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-6">
              <div className="text-center">
                <p className="text-gray-300 text-xs font-mono">
                  Enter 6-digit Admin PIN for Fleet Overview
                </p>
              </div>

              {/* PIN Inputs */}
              <div className="flex gap-2 justify-center" onPaste={handlePinPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      pinInputsRef.current[i] = el;
                    }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    disabled={loading}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    className={`w-10 sm:w-11 h-14 text-center text-xl font-mono font-bold rounded-xl border bg-gray-800 text-white outline-none transition-all
                      focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      disabled:opacity-50
                      ${error ? 'border-red-500 bg-red-950/20' : 'border-gray-700'}
                    `}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-mono bg-red-950/30 p-2.5 rounded-lg border border-red-500/30">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={digits.join('').length < PIN_LENGTH || loading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm font-mono
                  bg-gradient-to-r from-blue-600 to-indigo-600
                  text-white shadow-lg shadow-blue-500/20
                  hover:shadow-blue-500/30 hover:scale-[1.01]
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100
                  transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying...' : 'Unlock Fleet Admin Center'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-gray-500 text-xs font-mono mt-6">
          CipherScan Security Operations Center • Multi-Tenant Defense
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-8px); }
          30%, 70% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
