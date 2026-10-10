import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { SupportedLanguage } from '@/i18n/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'compact' | 'full' | 'subtle';
}

export function LanguageSelector({ className, variant = 'compact' }: LanguageSelectorProps) {
  const { language, setLanguage, currentLanguageInfo, languages, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'full' ? (
          <button
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/70 border border-border/50 text-xs font-mono transition-all text-sidebar-foreground",
              className
            )}
            title={t('select_language')}
          >
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-primary shrink-0" />
              <span className="text-muted-foreground">{t('language')}:</span>
              <span className="font-semibold text-foreground">{currentLanguageInfo.nativeName}</span>
            </div>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary uppercase font-bold">
              {currentLanguageInfo.code}
            </span>
          </button>
        ) : variant === 'subtle' ? (
          <button
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-card/60 hover:bg-card border border-border/50 text-foreground transition-colors",
              className
            )}
            title={t('select_language')}
          >
            <Globe size={13} className="text-primary shrink-0" />
            <span className="font-semibold">{currentLanguageInfo.nativeName}</span>
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 px-2.5 font-mono text-xs gap-1.5 border-border/50 bg-card/50 hover:bg-card/80 text-foreground",
              className
            )}
            title={t('select_language')}
          >
            <Globe size={13} className="text-primary shrink-0" />
            <span className="hidden sm:inline font-semibold">{currentLanguageInfo.nativeName}</span>
            <span className="sm:hidden uppercase font-bold text-[10px]">{currentLanguageInfo.code}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-48 bg-card/95 backdrop-blur-md border-border/60 shadow-xl p-1 z-50 font-mono"
      >
        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
          {t('select_language')}
        </div>
        {languages.map((lang) => {
          const isSelected = lang.code === language;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code as SupportedLanguage)}
              className={cn(
                "flex items-center justify-between px-2.5 py-2 text-xs rounded-md cursor-pointer transition-colors",
                isSelected
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-foreground hover:bg-secondary/70 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{lang.flag}</span>
                <span>{lang.nativeName}</span>
                <span className="text-[10px] text-muted-foreground font-normal">({lang.name})</span>
              </div>
              {isSelected && <Check size={14} className="text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export default LanguageSelector;
