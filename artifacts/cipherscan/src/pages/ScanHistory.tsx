import React, { useState } from 'react';
import { useListScans } from '@workspace/api-client-react';
import { Shield, Search, Filter, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Link } from 'wouter';
import { formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ListScansVerdict } from '@workspace/api-client-react/src/generated/api.schemas';

export default function ScanHistory() {
  const [filterVerdict, setFilterVerdict] = useState<ListScansVerdict | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data, isLoading } = useListScans({ 
    limit: 100, 
    verdict: filterVerdict ? (filterVerdict as ListScansVerdict) : undefined 
  });

  const filteredItems = (data?.items ?? []).filter((scan) => {
    if (filterVerdict && scan.verdict !== filterVerdict) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesUrl = scan.originalUrl.toLowerCase().includes(q) || scan.finalUrl.toLowerCase().includes(q);
      const matchesCategory = (scan.threatCategory ?? '').toLowerCase().includes(q);
      const matchesVerdict = scan.verdict.toLowerCase().includes(q);
      if (!matchesUrl && !matchesCategory && !matchesVerdict) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col space-y-4 md:space-y-6 overflow-hidden max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight flex items-center gap-2.5 sm:gap-3">
          <Shield className="text-primary shrink-0" size={24} />
          <span>SCAN HISTORY</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Complete log of all inspected URLs and payment strings.</p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur p-3 sm:p-4 flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center justify-between shrink-0">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            placeholder="Search URLs, domains, categories..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-black/20 border-input/50 focus-visible:ring-primary font-mono text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <Filter size={16} className="text-muted-foreground mr-1 shrink-0" />
          <Button 
            variant={filterVerdict === '' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilterVerdict('')}
            className="rounded-full font-mono text-xs tracking-wider border-border/50 shrink-0"
          >
            ALL
          </Button>
          <Button 
            variant={filterVerdict === 'safe' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilterVerdict('safe')}
            className="rounded-full font-mono text-xs tracking-wider border-[#10B981]/20 hover:bg-[#10B981]/10 hover:text-[#10B981] shrink-0"
          >
            SAFE
          </Button>
          <Button 
            variant={filterVerdict === 'suspicious' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilterVerdict('suspicious')}
            className="rounded-full font-mono text-xs tracking-wider border-[#F59E0B]/20 hover:bg-[#F59E0B]/10 hover:text-[#F59E0B] shrink-0"
          >
            SUSPICIOUS
          </Button>
          <Button 
            variant={filterVerdict === 'malicious' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilterVerdict('malicious')}
            className="rounded-full font-mono text-xs tracking-wider border-[#EF4444]/20 hover:bg-[#EF4444]/10 hover:text-[#EF4444] shrink-0"
          >
            MALICIOUS
          </Button>
        </div>
      </Card>

      <Card className="flex-1 border-border/50 bg-card/50 backdrop-blur overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-[80px] sm:w-[100px] font-mono text-xs uppercase tracking-widest">Score</TableHead>
                <TableHead className="w-[120px] sm:w-[140px] font-mono text-xs uppercase tracking-widest">Verdict</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-widest min-w-[200px]">Target URL</TableHead>
                <TableHead className="w-[140px] sm:w-[160px] font-mono text-xs uppercase tracking-widest">Category</TableHead>
                <TableHead className="w-[160px] sm:w-[180px] font-mono text-xs uppercase tracking-widest text-right">Scanned At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground font-mono text-sm">
                    {searchQuery || filterVerdict ? 'No matching scans found for filter.' : 'No scans recorded yet.'}
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
