import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout/Layout';

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchInterval: false, // Auto-refresh removed; user triggers manual refresh on demand
      staleTime: 0, // Always refetch when invalidated (e.g. after a new scan is submitted)
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
