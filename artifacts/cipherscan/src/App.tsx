import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout/Layout';
import Login, { isAuthenticated, getStoredToken } from '@/pages/Login';
import { DeviceProvider } from '@/context/DeviceContext';

// Pages
import Dashboard from '@/pages/Dashboard';
import Analyze from '@/pages/Analyze';
import ScanHistory from '@/pages/ScanHistory';
import ScanDetail from '@/pages/ScanDetail';
import ThreatIntel from '@/pages/ThreatIntel';

// Force dark mode
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}

/**
 * Patch global fetch so every /api/* request automatically carries the
 * X-Dashboard-Token header. This covers all TanStack Query hooks without
 * touching them individually.
 */
const _nativeFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isApiCall = url.startsWith('/api/') || url.startsWith('./api/');

  if (isApiCall) {
    const token = getStoredToken();
    if (token) {
      init = {
        ...init,
        headers: {
          ...(init?.headers || {}),
          'x-dashboard-token': token,
        },
      };
    }
  }
  return _nativeFetch(input, init);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchInterval: false,
      staleTime: 0,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/analyze" component={Analyze} />
        <Route path="/scans" component={ScanHistory} />
        <Route path="/scans/:id" component={ScanDetail} />
        <Route path="/threat-intel" component={ThreatIntel} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

/**
 * AuthGuard: Shows PIN login until authenticated.
 * No DASHBOARD_PIN configured on server → always passes through (dev mode).
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => isAuthenticated());

  if (!authed) {
    return (
      <Login
        onSuccess={() => setAuthed(true)}
      />
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGuard>
          <DeviceProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
          </DeviceProvider>
        </AuthGuard>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

