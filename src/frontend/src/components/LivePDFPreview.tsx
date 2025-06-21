import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { SimplifiedPDFConfig, createConfigHash } from '@/types/SimplifiedPDFConfig';
import {
    AlertCircle,
    Download,
    Eye,
    Grid3X3,
    RefreshCw,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface LivePDFPreviewProps {
  config: SimplifiedPDFConfig;
  className?: string;
  onElementSelect?: (element: string) => void;
  selectedElement?: string;
}

interface PreviewCache {
  [hash: string]: {
    data: string;
    timestamp: number;
  };
}

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const PREVIEW_DEBOUNCE = 500; // 500ms
const MAX_CACHE_SIZE = 20;

export function LivePDFPreview({ 
  config, 
  className = '',
  onElementSelect,
  selectedElement 
}: LivePDFPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(75); // 75% default
  const [showMarginGuides, setShowMarginGuides] = useState(false);
  const [showGridLines, setShowGridLines] = useState(false);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const cacheRef = useRef<PreviewCache>({});
  const abortControllerRef = useRef<AbortController>();

  // Clean expired cache entries
  const cleanCache = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    const keys = Object.keys(cache);
    
    // Remove expired entries
    keys.forEach(key => {
      if (now - cache[key].timestamp > CACHE_EXPIRY) {
        delete cache[key];
      }
    });
    
    // Limit cache size
    const remainingKeys = Object.keys(cache);
    if (remainingKeys.length > MAX_CACHE_SIZE) {
      const sortedKeys = remainingKeys.sort((a, b) => 
        cache[a].timestamp - cache[b].timestamp
      );
      
      sortedKeys.slice(0, remainingKeys.length - MAX_CACHE_SIZE).forEach(key => {
        delete cache[key];
      });
    }
  }, []);

  // Generate preview
  const generatePreview = useCallback(async (configToPreview: SimplifiedPDFConfig) => {
    const configHash = createConfigHash(configToPreview);
    
    // Check cache first
    cleanCache();
    const cached = cacheRef.current[configHash];
    if (cached) {
      setPreviewData(cached.data);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/v2/pdf-settings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToPreview),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Preview generation failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      
      // Cache the result
      cacheRef.current[configHash] = {
        data: imageUrl,
        timestamp: Date.now(),
      };
      
      setPreviewData(imageUrl);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Preview generation error:', error);
        setError(error.message || 'Failed to generate preview');
      }
    } finally {
      setIsLoading(false);
    }
  }, [cleanCache]);

  // Debounced preview update
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      generatePreview(config);
    }, PREVIEW_DEBOUNCE);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [config, generatePreview]);

  // Handle element selection
  const handleElementClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onElementSelect) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Simple element detection based on click position
    // In a real implementation, this would use more sophisticated hit testing
    const relativeX = x / rect.width;
    const relativeY = y / rect.height;
    
    let element = 'content';
    if (relativeY < 0.15) element = 'header';
    else if (relativeY > 0.85) element = 'footer';
    else if (relativeX < 0.1 || relativeX > 0.9) element = 'margin';
    else if (relativeY < 0.25) element = 'title';
    
    onElementSelect(element);
  }, [onElementSelect]);

  // Download preview
  const handleDownload = useCallback(async () => {
    if (!previewData) return;
    
    try {
      const response = await fetch(previewData);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule-preview-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [previewData]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 25, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 25, 25));
  }, []);

  const handleZoomChange = useCallback((value: number[]) => {
    setZoomLevel(value[0]);
  }, []);

  // Refresh preview
  const handleRefresh = useCallback(() => {
    // Clear cache for current config
    const configHash = createConfigHash(config);
    delete cacheRef.current[configHash];
    generatePreview(config);
  }, [config, generatePreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Cleanup blob URLs
      const cache = cacheRef.current;
      Object.values(cache).forEach(cached => {
        if (cached.data.startsWith('blob:')) {
          URL.revokeObjectURL(cached.data);
        }
      });
    };
  }, []);

  const renderPreviewContent = () => {
    if (error) {
      return (
        <Alert className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="ml-2"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    if (isLoading) {
      return (
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-96 w-full" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 21 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
      );
    }

    if (!previewData) {
      return (
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-2" />
            <p>No preview available</p>
            <Button variant="outline" onClick={handleRefresh} className="mt-2">
              Generate Preview
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div 
        className="relative cursor-pointer"
        onClick={handleElementClick}
        style={{ 
          transform: `scale(${zoomLevel / 100})`,
          transformOrigin: 'top left',
          width: `${100 / (zoomLevel / 100)}%`,
        }}
      >
        {/* Margin guides overlay */}
        {showMarginGuides && (
          <div 
            className="absolute inset-0 pointer-events-none border-2 border-dashed border-blue-400 opacity-50"
            style={{
              margin: `${config.pageSetup.margins.top}mm ${config.pageSetup.margins.right}mm ${config.pageSetup.margins.bottom}mm ${config.pageSetup.margins.left}mm`,
            }}
          />
        )}
        
        {/* Grid lines overlay */}
        {showGridLines && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        )}
        
        {/* Selected element highlight */}
        {selectedElement && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-primary rounded opacity-50" />
          </div>
        )}
        
        {/* Preview image */}
        <img 
          src={previewData} 
          alt="PDF Preview" 
          className="w-full h-auto shadow-lg"
          style={{ 
            maxWidth: 'none',
            imageRendering: 'crisp-edges',
          }}
        />
      </div>
    );
  };

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      {/* Preview Controls */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 25}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 min-w-[120px]">
            <Slider
              value={[zoomLevel]}
              onValueChange={handleZoomChange}
              min={25}
              max={200}
              step={25}
              className="flex-1"
            />
            <Badge variant="secondary" className="text-xs">
              {zoomLevel}%
            </Badge>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowMarginGuides(!showMarginGuides)}
            className={showMarginGuides ? 'bg-primary/10' : ''}
            title="Toggle margin guides"
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowGridLines(!showGridLines)}
            className={showGridLines ? 'bg-primary/10' : ''}
            title="Toggle grid lines"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh preview"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleDownload}
            disabled={!previewData || isLoading}
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Content */}
      <CardContent className="flex-1 overflow-auto p-0">
        <div className="min-h-full">
          {renderPreviewContent()}
        </div>
      </CardContent>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            {config.pageSetup.size} {config.pageSetup.orientation}
          </span>
          {selectedElement && (
            <Badge variant="outline">
              Selected: {selectedElement}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {isLoading && (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Generating preview...</span>
            </div>
          )}
          <span>
            Zoom: {zoomLevel}%
          </span>
        </div>
      </div>
    </Card>
  );
}
