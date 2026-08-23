import React, { useState } from 'react';
import { useAnalyzeUrl, AnalyzeInputTriggerType } from '@workspace/api-client-react';
import { Search, Loader2, ScanLine, Link as LinkIcon, Smartphone, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanResultCard } from '@/components/ScanResultCard';

export default function Analyze() {
  const [url, setUrl] = useState('');
  const [triggerType, setTriggerType] = useState<AnalyzeInputTriggerType>('manual');
  
  const analyzeMutation = useAnalyzeUrl();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    analyzeMutation.mutate({
      data: {
        targetUrl: url,
        triggerType
      }
    });
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-8 flex flex-col items-center">
      <div className="w-full max-w-4xl text-center space-y-4 pt-12">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
          <ScanLine size={32} className="text-primary" />
        </div>
        <h1 className="text-4xl font-bold font-mono tracking-tight">
          DEEP SCAN <span className="text-primary">ANALYSIS</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Submit a URL or UPI payment string for real-time threat analysis. Our engine performs deep inspection including redirect tracing, domain reputation checking, and content analysis.
        </p>
      </div>

      <Card className="w-full max-w-4xl border-primary/20 bg-card/50 backdrop-blur shadow-2xl shadow-primary/5">
        <CardContent className="p-2">
          <form onSubmit={handleAnalyze} className="flex gap-2">
            <div className="flex-1 relative flex items-center bg-black/20 rounded-md overflow-hidden border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <div className="pl-4 pr-2 flex items-center gap-2 border-r border-border/50 text-muted-foreground">
                <select 
                  className="bg-transparent border-none text-xs font-mono uppercase tracking-widest focus:ring-0 cursor-pointer outline-none"
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as AnalyzeInputTriggerType)}
                >
                  <option value="manual">MANUAL</option>
                  <option value="link">SMS/LINK</option>
                  <option value="camera">QR/CAMERA</option>
                </select>
              </div>
              <input 
                type="text" 
                className="flex-1 bg-transparent border-none px-4 py-4 focus:outline-none font-mono text-sm placeholder:text-muted-foreground/50"
                placeholder="https://example.com or upi://pay?pa=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button 
              type="submit" 
              size="lg" 
              className="h-auto py-4 px-8 font-mono tracking-widest font-bold"
              disabled={analyzeMutation.isPending || !url}
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin mr-2" />
                  ANALYZING...
                </>
              ) : (
                <>
                  <Search size={18} className="mr-2" />
                  SCAN
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {analyzeMutation.isPending && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-ping"></div>
            <div className="absolute inset-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin"></div>
            <ShieldCheck size={32} className="text-primary animate-pulse" />
          </div>
          <p className="font-mono text-primary text-sm tracking-widest uppercase animate-pulse">Running diagnostics...</p>
        </div>
      )}

      {analyzeMutation.data && !analyzeMutation.isPending && (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h3 className="text-sm font-mono tracking-widest text-muted-foreground uppercase mb-4 border-b border-border/50 pb-2">Analysis Results</h3>
          <ScanResultCard scan={analyzeMutation.data} isDetailed />
        </div>
      )}
    </div>
  );
}
