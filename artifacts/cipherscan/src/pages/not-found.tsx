import React from 'react';
import { ShieldX } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
      <div className="p-4 bg-destructive/10 rounded-2xl border border-destructive/20 text-destructive mb-4">
        <ShieldX size={48} />
      </div>
      <h1 className="text-4xl font-mono font-bold tracking-tight">{t('not_found_title')}</h1>
      <p className="text-muted-foreground max-w-md">
        {t('not_found_desc')}
      </p>
      <Link href="/">
        <Button className="font-mono tracking-widest px-8">
          {t('return_to_command_center')}
        </Button>
      </Link>
    </div>
  );
}

