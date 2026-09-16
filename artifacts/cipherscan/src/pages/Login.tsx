import { useState, useRef, useEffect, KeyboardEvent } from 'react';

const SESSION_KEY = 'cs_auth_token';
const PIN_LENGTH = 6;

/** Retrieve stored token from sessionStorage */
export function getStoredToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

/**
 * Returns true if the user has a token stored (i.e. has authenticated this session).
 * Actual token validity is enforced server-side on every proxy request.
 */
export function isAuthenticated(): boolean {
  const token = sessionStorage.getItem(SESSION_KEY);
  return token !== null && token !== '';
}

/** Store the token received from /api/auth */
export function storeToken(token: string) {
  sessionStorage.setItem(SESSION_KEY, token);
}

/** Clear auth (logout) */
export function clearAuth() {
  sessionStorage.removeItem(SESSION_KEY);
}

export default function Login({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    setError('');

    if (value && index < PIN_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (value && index === PIN_LENGTH - 1) {
      const pin = [...next.slice(0, PIN_LENGTH - 1), value.slice(-1)].join('');
      if (pin.length === PIN_LENGTH) submitPin(pin);
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (text.length === PIN_LENGTH) {
      setDigits(text.split(''));
      submitPin(text);
    }
    e.preventDefault();
  }

  async function submitPin(pin: string) {
    setLoading(true);
    setError('');

    try {
      // POST pin to SERVER — PIN never compared in browser
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        storeToken(data.token);
        onSuccess(data.token);
      } else {
        triggerError(data.error || 'Incorrect PIN. Please try again.');
      }
    } catch {
      triggerError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function triggerError(message: string) {
    setError(message);
    setShake(true);
    setDigits(Array(PIN_LENGTH).fill(''));
    setTimeout(() => {
      setShake(false);
      inputsRef.current[0]?.focus();
    }, 600);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pin = digits.join('');
    if (pin.length === PIN_LENGTH && !loading) submitPin(pin);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CipherScan</h1>
          <p className="text-gray-400 text-sm mt-1">Command Center</p>
        </div>

        {/* PIN Card */}
        <form
          onSubmit={handleSubmit}
          className={`bg-gray-900 border rounded-2xl p-8 shadow-2xl transition-all ${
            shake ? 'animate-[shake_0.5s_ease-in-out]' : ''
          } ${error ? 'border-red-500/50' : 'border-gray-800'}`}
        >
          <p className="text-gray-300 text-center text-sm font-medium mb-6">
            Enter your 6-digit access PIN
          </p>

          {/* PIN Inputs */}
          <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputsRef.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                disabled={loading}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={`w-11 h-14 text-center text-xl font-bold rounded-xl border bg-gray-800 text-white outline-none transition-all
                  focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
                  disabled:opacity-50
                  ${error ? 'border-red-500 bg-red-950/20' : 'border-gray-700'}
                `}
              />
            ))}
          </div>

          {/* Status message */}
          <div className={`text-center mb-4 transition-all min-h-[20px]`}>
            {loading && (
              <span className="text-cyan-400 text-xs font-medium flex items-center justify-center gap-1">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Verifying…
              </span>
            )}
            {error && !loading && (
              <span className="text-red-400 text-xs font-medium">⚠ {error}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={digits.join('').length < PIN_LENGTH || loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm
              bg-gradient-to-r from-cyan-500 to-blue-600
              text-white shadow-lg shadow-cyan-500/20
              hover:shadow-cyan-500/30 hover:scale-[1.02]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100
              transition-all duration-150"
          >
            {loading ? 'Verifying…' : 'Unlock Dashboard'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          CipherScan Security Operations Center
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
