import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import {
    Eye,
    EyeOff,
    Info,
    Lightbulb,
    Menu,
    Settings
} from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { usePDFLayoutState } from '@/hooks/usePDFLayoutState';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';
import { ContentLayoutSection } from './ContentLayoutSection';
import { LivePDFPreview } from './LivePDFPreview';
import { PageSetupSection } from './PageSetupSection';
import { PreviewControls } from './PreviewControls';
import { QuickPresets } from './QuickPresets';
import { StylingSection } from './StylingSection';

interface PDFLayoutCustomizerProps {
  initialConfig?: Partial<SimplifiedPDFConfig>;
  onSave?: (config: SimplifiedPDFConfig) => Promise<void>;
  onDownload?: (config: SimplifiedPDFConfig) => Promise<void>;
  className?: string;
}

export function PDFLayoutCustomizer({
  initialConfig,
  onSave,
  onDownload,
  className = '',
}: PDFLayoutCustomizerProps) {
  const [selectedElement, setSelectedElement] = useState<string | undefined>();
  const [settingsVisible, setSettingsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();

  const {
    config,
    canUndo,
    canRedo,
    isDirty,
    lastSaved,
    updateConfig,
    applyPreset,
    undo,
    redo,
    reset,
    save,
    validateConfig,
  } = usePDFLayoutState({
    initialConfig,
    autoSave: true,
    autoSaveKey: 'pdf-layout-customizer',
    onSave,
  });

  // Check if we're on mobile
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleConfigChange = useCallback((updates: Partial<SimplifiedPDFConfig>) => {
    const errors = validateConfig(updates);
    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: errors.join(', '),
      });
      return;
    }
    
    updateConfig(updates);
  }, [updateConfig, validateConfig, toast]);

  const handlePresetSelect = useCallback((presetId: string) => {
    const success = applyPreset(presetId);
    if (success) {
      toast({
        title: 'Preset Applied',
        description: `Successfully applied ${presetId} preset.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to apply preset.',
      });
    }
  }, [applyPreset, toast]);

  const handleSave = useCallback(async () => {
    try {
      await save();
      toast({
        title: 'Settings Saved',
        description: 'Your PDF layout settings have been saved successfully.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Failed to save settings. Please try again.',
      });
    }
  }, [save, toast]);

  const handleDownload = useCallback(async () => {
    if (onDownload) {
      try {
        await onDownload(config);
        toast({
          title: 'Download Started',
          description: 'Your PDF is being generated and will download shortly.',
        });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Download Failed',
          description: 'Failed to generate PDF. Please try again.',
        });
      }
    }
  }, [onDownload, config, toast]);

  const handleReset = useCallback(() => {
    reset();
    toast({
      title: 'Settings Reset',
      description: 'All settings have been reset to default values.',
    });
  }, [reset, toast]);

  const renderSettingsPanel = () => (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h2 className="text-lg font-semibold">PDF Layout Settings</h2>
          </div>
          {!isMobile && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSettingsVisible(false)}
              title="Hide settings panel"
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Configuration Status */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Current preset: {config.preset}</span>
            <Badge variant={isDirty ? 'secondary' : 'default'}>
              {isDirty ? 'Modified' : 'Saved'}
            </Badge>
          </AlertDescription>
        </Alert>

        {/* Quick Tip */}
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Tip:</strong> Click on elements in the preview to select and modify them. 
            Use presets as starting points and customize to your needs.
          </AlertDescription>
        </Alert>

        {/* Settings Sections */}
        <div className="space-y-4">
          <QuickPresets
            currentPreset={config.preset}
            onPresetSelect={handlePresetSelect}
          />

          <PageSetupSection
            config={config}
            onConfigChange={handleConfigChange}
          />

          <ContentLayoutSection
            config={config}
            onConfigChange={handleConfigChange}
          />

          <StylingSection
            config={config}
            onConfigChange={handleConfigChange}
          />

          <PreviewControls
            canUndo={canUndo}
            canRedo={canRedo}
            isDirty={isDirty}
            lastSaved={lastSaved}
            onSave={handleSave}
            onReset={handleReset}
            onUndo={undo}
            onRedo={redo}
            onDownload={onDownload ? handleDownload : undefined}
          />
        </div>
      </div>
    </ScrollArea>
  );

  const renderPreviewPanel = () => (
    <div className="h-full flex flex-col">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Live Preview</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {!settingsVisible && !isMobile && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSettingsVisible(true)}
              title="Show settings panel"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[400px] p-0">
                {renderSettingsPanel()}
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1">
        <LivePDFPreview
          config={config}
          onElementSelect={setSelectedElement}
          selectedElement={selectedElement}
          className="h-full"
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className={`h-full ${className}`}>
        {renderPreviewPanel()}
      </div>
    );
  }

  return (
    <div className={`h-full ${className}`}>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {settingsVisible && (
          <>
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              {renderSettingsPanel()}
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}
        <ResizablePanel defaultSize={settingsVisible ? 65 : 100}>
          {renderPreviewPanel()}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
