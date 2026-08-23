import React from 'react';
import { useRoute, Link } from 'wouter';
import { useGetScan, getGetScanQueryKey } from '@workspace/api-client-react';
import { ScanResultCard } from '@/components/ScanResultCard';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function ScanDetail() {
  const [, params] = useRoute('/scans/:id');
  const id = params?.id ? parseInt(params.id, 10) : null;

  const { data: scan, isLoading, isError } = useGetScan(id as number, { 
    query: { 
      enabled: id !== null && !isNaN(id),
      queryKey: getGetScanQueryKey(id as number)
    } 
  });

  if (!id || isNaN(id)) {
    return <div className="p-8 text-destructive font-mono">Invalid Scan ID</div>;
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !scan) {
    return <div className="p-8 text-destructive font-mono">Failed to load scan details.</div>;
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6">
      <div className="flex items-center gap-4 border-b border-border/50 pb-6">
        <Link href="/scans">
          <Button variant="outline" size="icon" className="shrink-0 bg-transparent border-border/50 hover:bg-muted/50">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground truncate">
              Scan #{scan.id}
            </h1>
            <div className="px-2 py-1 rounded bg-muted/50 border border-border/50 text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Calendar size={12} />
              {formatDate(scan.createdAt)}
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            Trigger: <span className="uppercase font-mono tracking-wider">{scan.triggerType}</span>
          </p>
        </div>
      </div>

      <div className="max-w-5xl">
        <ScanResultCard scan={scan} isDetailed />
      </div>
    </div>
  );
}
