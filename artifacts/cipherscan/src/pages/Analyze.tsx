import React, { useState, useRef, useEffect } from 'react';
import { useAnalyzeUrl, ScanResult } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Loader2, 
  ScanLine, 
  ShieldCheck, 
  QrCode, 
  UploadCloud, 
  Copy, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Shield, 
  Cpu, 
  FileCheck,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScanResultCard } from '@/components/ScanResultCard';
import { useLanguage } from '@/context/LanguageContext';
import jsQR from 'jsqr';

interface DecodedQrInfo {
  payload: string;
  location?: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
  };
  width: number;
  height: number;
}

export default function Analyze() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  
  // URL Input mode state
  const [url, setUrl] = useState(() => sessionStorage.getItem('cipherscan_last_url') || '');
  const [activeTab, setActiveTab] = useState<'url' | 'qr'>('url');
  
  // QR Upload mode state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [qrImageSrc, setQrImageSrc] = useState<string | null>(null);
  const [decodedQr, setDecodedQr] = useState<DecodedQrInfo | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Result state
  const [lastResult, setLastResult] = useState<ScanResult | null>(() => {
    const cached = sessionStorage.getItem('cipherscan_last_result');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    return null;
  });
  
  const analyzeMutation = useAnalyzeUrl();

  const executeAnalysis = (targetUrl: string, triggerType: 'manual' | 'camera') => {
    if (!targetUrl.trim()) return;

    analyzeMutation.mutate(
      {
        data: {
          targetUrl: targetUrl.trim(),
          triggerType,
        }
      },
      {
        onSuccess: (data: ScanResult) => {
          setLastResult(data);
          try {
            sessionStorage.setItem('cipherscan_last_result', JSON.stringify(data));
            sessionStorage.setItem('cipherscan_last_url', data.originalUrl);
          } catch {}
          // Invalidate scan history and stats queries to immediately refresh dashboard counts
          queryClient.invalidateQueries({ queryKey: ['scans'] });
          queryClient.invalidateQueries({ queryKey: ['stats'] });
        }
      }
    );
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    executeAnalysis(url, 'manual');
  };

  // Process uploaded QR image from device
  const processQrImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setQrError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    setIsDecoding(true);
    setQrError(null);
    setDecodedQr(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setQrImageSrc(dataUrl);

      const img = new Image();
      img.onload = async () => {
        try {
          const offscreenCanvas = document.createElement('canvas');
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          offscreenCanvas.width = width;
          offscreenCanvas.height = height;
          const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
          
          if (!ctx) {
            setIsDecoding(false);
            setQrError('Failed to initialize canvas decoder.');
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          let foundData: string | null = null;
          let location: DecodedQrInfo['location'] = undefined;

          // 1. Try native browser BarcodeDetector API if supported
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
              const barcodes = await detector.detect(offscreenCanvas);
              if (barcodes && barcodes.length > 0) {
                foundData = barcodes[0].rawValue;
                if (barcodes[0].cornerPoints && barcodes[0].cornerPoints.length >= 4) {
                  location = {
                    topLeftCorner: barcodes[0].cornerPoints[0],
                    topRightCorner: barcodes[0].cornerPoints[1],
                    bottomRightCorner: barcodes[0].cornerPoints[2],
                    bottomLeftCorner: barcodes[0].cornerPoints[3],
                  };
                }
              }
            } catch {
              // fallback to jsQR
            }
          }

          // 2. Robust fallback via jsQR
          if (!foundData) {
            const imageData = ctx.getImageData(0, 0, width, height);
            const qrCode = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
            if (qrCode && qrCode.data) {
              foundData = qrCode.data;
              location = qrCode.location;
            }
          }

          setIsDecoding(false);

          if (foundData) {
            setDecodedQr({
              payload: foundData,
              location,
              width,
              height,
            });
          } else {
            setQrError(t('no_qr_detected'));
          }
        } catch (err: any) {
          setIsDecoding(false);
          setQrError(`Decoding error: ${err?.message || 'Unable to parse QR pattern'}`);
        }
      };

      img.onerror = () => {
        setIsDecoding(false);
        setQrError('Failed to load image from device.');
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  };

  // Render optical bounding box on preview canvas
  useEffect(() => {
    if (!qrImageSrc || !decodedQr || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = decodedQr.width;
      canvas.height = decodedQr.height;
      ctx.drawImage(img, 0, 0, decodedQr.width, decodedQr.height);

      if (decodedQr.location) {
        const loc = decodedQr.location;

        // Glowing cyan optical reticle
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 16;

        ctx.beginPath();
        ctx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y);
        ctx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y);
        ctx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y);
        ctx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y);
        ctx.closePath();
        ctx.stroke();

        // Corner indicator targets
        [loc.topLeftCorner, loc.topRightCorner, loc.bottomRightCorner, loc.bottomLeftCorner].forEach((pt) => {
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    };
    img.src = qrImageSrc;
  }, [qrImageSrc, decodedQr]);

  const handleCopyPayload = () => {
    if (!decodedQr?.payload) return;
    navigator.clipboard.writeText(decodedQr.payload);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleResetQr = () => {
    setQrImageSrc(null);
    setDecodedQr(null);
    setQrError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeResult = analyzeMutation.data || lastResult;

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 md:space-y-8 flex flex-col items-center max-w-5xl mx-auto w-full">
      {/* Hero Header */}
      <div className="w-full text-center space-y-3 pt-2 md:pt-8">
        <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-primary/10 border border-primary/20 mb-2 shadow-lg shadow-primary/10">
          <ScanLine size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold font-mono tracking-tight text-foreground">
          {t('deep_scan_title')}
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl mx-auto px-2">
          {t('deep_scan_subtitle')}
        </p>
      </div>

      {/* Mode Tabs */}
      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setActiveTab(val as 'url' | 'qr')}
        className="w-full flex flex-col items-center"
      >
        <TabsList className="bg-card/70 border border-border/60 p-1 rounded-xl mb-4 font-mono text-xs">
          <TabsTrigger value="url" className="gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Search size={14} />
            <span>{t('tab_url_input')}</span>
          </TabsTrigger>
          <TabsTrigger value="qr" className="gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <QrCode size={14} />
            <span>{t('tab_qr_upload')}</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MANUAL URL INPUT */}
        <TabsContent value="url" className="w-full">
          <Card className="w-full border-primary/20 bg-card/50 backdrop-blur shadow-2xl shadow-primary/5">
            <CardContent className="p-2 sm:p-3">
              <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative flex items-center bg-black/20 rounded-md overflow-hidden border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                  <div className="pl-3.5 sm:pl-4 text-muted-foreground flex items-center justify-center">
                    <Search size={18} className="text-muted-foreground/70" />
                  </div>
                  <input 
                    type="text" 
                    className="flex-1 bg-transparent border-none px-3 py-3 sm:px-4 sm:py-4 focus:outline-none font-mono text-xs sm:text-sm placeholder:text-muted-foreground/50 w-full"
                    placeholder={t('url_placeholder')}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={analyzeMutation.isPending || !url}
                  className="h-auto py-3 sm:py-0 px-6 font-mono font-bold tracking-wider"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('analyzing_button')}
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      {t('scan_button')}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: QR IMAGE UPLOAD & CLOUD DETONATION (Matches Fig. 4.4) */}
        <TabsContent value="qr" className="w-full">
          <Card className="w-full border-cyan-500/30 bg-card/50 backdrop-blur shadow-2xl shadow-cyan-500/5">
            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processQrImageFile(file);
                }}
              />

              {/* State 1: Dropzone (No image uploaded yet) */}
              {!qrImageSrc && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processQrImageFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
                    isDragOver 
                      ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-500/10' 
                      : 'border-border/60 hover:border-cyan-500/50 hover:bg-muted/10'
                  }`}
                >
                  <div className="p-4 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <UploadCloud size={36} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono text-sm sm:text-base font-semibold text-foreground">
                      {t('drag_drop_qr')}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {t('qr_upload_subtitle')}
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="font-mono text-xs gap-2 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 mt-2"
                  >
                    <Smartphone size={14} />
                    {t('browse_gallery')}
                  </Button>
                </div>
              )}

              {/* State 2: Decoding Spinner */}
              {isDecoding && (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <Loader2 size={36} className="text-cyan-400 animate-spin" />
                  <p className="font-mono text-cyan-300 text-sm tracking-wider animate-pulse">
                    {t('decoding_qr')}
                  </p>
                </div>
              )}

              {/* State 3: QR Decoding Error */}
              {qrError && !isDecoding && (
                <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-red-400">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-xs sm:text-sm font-mono">{qrError}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetQr}
                    className="font-mono text-xs border-red-500/40 text-red-300 hover:bg-red-950/50"
                  >
                    <RefreshCw size={12} className="mr-1.5" />
                    {t('upload_another_qr')}
                  </Button>
                </div>
              )}

              {/* State 4: QR Detected Successfully (Exact match to Fig. 4.4) */}
              {decodedQr && !isDecoding && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Left Column: Uploaded Image with Optical Cyan Reticle */}
                  <div className="lg:col-span-5 flex flex-col items-center">
                    <div className="relative rounded-2xl overflow-hidden border border-cyan-500/40 bg-black/40 shadow-xl shadow-cyan-500/10 p-2 max-w-[320px] w-full">
                      <canvas 
                        ref={canvasRef} 
                        className="w-full h-auto rounded-xl object-contain aspect-square bg-black/60"
                      />
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-mono text-[10px] uppercase backdrop-blur">
                          {t('qr_matrix_detected')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Forensic Pre-Execution Card */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="p-4 sm:p-5 rounded-2xl bg-card/80 border border-border/60 shadow-lg space-y-3 font-mono">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground">
                          {t('decoded_payload')}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          QR Matrix 2D
                        </Badge>
                      </div>

                      {/* Decoded URL / Payload text */}
                      <div className="p-3 rounded-lg bg-black/30 border border-border/40 flex items-center justify-between gap-2 overflow-hidden">
                        <span className="text-xs text-foreground font-mono truncate select-all">
                          {decodedQr.payload}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyPayload}
                          className="shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground"
                          title={t('copy_payload')}
                        >
                          {hasCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </Button>
                      </div>

                      <div className="text-[11px] text-muted-foreground space-y-1">
                        <p><span className="text-cyan-400">Status:</span> Dispatched to Cloud Detonation Engine (Safe Pre-Execution)</p>
                        <p><span className="text-muted-foreground/80">Trigger:</span> Camera / Gallery Matrix Decoder</p>
                      </div>

                      {/* Action CTA */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                        <Button
                          type="button"
                          onClick={() => executeAnalysis(decodedQr.payload, 'camera')}
                          disabled={analyzeMutation.isPending}
                          className="flex-1 font-mono font-bold tracking-wider bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20"
                        >
                          {analyzeMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t('analyzing_button')}
                            </>
                          ) : (
                            <>
                              <Shield className="mr-2 h-4 w-4" />
                              {t('analyze_in_sandbox')}
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleResetQr}
                          className="font-mono text-xs border-border/60 hover:bg-muted/20"
                        >
                          {t('upload_another_qr')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Zero-Trust Feature Pills (as seen in Fig 4.4) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="p-2.5 rounded-xl bg-emerald-950/10 border border-emerald-500/20 flex items-center justify-center gap-2 text-emerald-400 text-xs font-mono">
                  <ShieldCheck size={14} />
                  <span>{t('zero_local_risk')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-cyan-950/10 border border-cyan-500/20 flex items-center justify-center gap-2 text-cyan-400 text-xs font-mono">
                  <Cpu size={14} />
                  <span>{t('memory_safe_sandbox')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-950/10 border border-purple-500/20 flex items-center justify-center gap-2 text-purple-400 text-xs font-mono">
                  <FileCheck size={14} />
                  <span>{t('dossier_ready')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Analysis in Progress Loading State */}
      {analyzeMutation.isPending && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-ping"></div>
            <div className="absolute inset-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin"></div>
            <ShieldCheck size={32} className="text-primary animate-pulse" />
          </div>
          <p className="font-mono text-primary text-sm tracking-widest uppercase animate-pulse">
            {t('running_diagnostics')}
          </p>
        </div>
      )}

      {/* Comprehensive Analysis Verdict Card */}
      {activeResult && !analyzeMutation.isPending && (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h3 className="text-sm font-mono tracking-widest text-muted-foreground uppercase mb-4 border-b border-border/50 pb-2">
            {t('analysis_results')}
          </h3>
          <ScanResultCard scan={activeResult} isDetailed />
        </div>
      )}
    </div>
  );
}
