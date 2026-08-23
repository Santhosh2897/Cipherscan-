import React from 'react';
import { ShieldX } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
      <div className="p-4 bg-destructive/10 rounded-2xl border border-destructive/20 text-destructive mb-4">
        <ShieldX size={48} />
      </div>
      <h1 className="text-4xl font-mono font-bold tracking-tight">404 - SECTOR UNKNOWN</h1>
      <p className="text-muted-foreground max-w-md">
        The requested intelligence coordinate could not be located. It may have been classified or removed from the databanks.
      </p>
      <Link href="/">
        <Button className="font-mono tracking-widest px-8">
          RETURN TO COMMAND CENTER
        </Button>
      </Link>
    </div>
  );
}
