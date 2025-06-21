import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Redo2,
    RotateCcw,
    Save,
    Undo2
} from 'lucide-react';
import { useState } from 'react';

// Import our custom components
import { LivePDFPreview } from './LivePDFPreview';
import { MEPFooterSection } from './MEPFooterSection';
import { MEPHeaderSection } from './MEPHeaderSection';
import { MEPStylingSection } from './MEPStylingSection';
import { MEPTableStructureSection } from './MEPTableStructureSection';
import { QuickPresets } from './QuickPresets';

// Import hooks and types
import { usePDFLayoutState } from '@/hooks/usePDFLayoutState';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface MEPLayoutCustomizerProps {
  initialConfig?: Partial<SimplifiedPDFConfig>;
  onSave?: (config: SimplifiedPDFConfig) => Promise<void>;
  className?: string;
}

export function MEPLayoutCustomizer({ 
  initialConfig, 
  onSave, 
  className = '' 
}: MEPLayoutCustomizerProps) {
  const { toast } = useToast();
  const [selectedElement, setSelectedElement] = useState<string | undefined>();
  const [expandedSections, setExpandedSections] = useState({
    presets: true,
    header: true,
    table: false,
    footer: false,
    styling: false,
  });

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
    onSave,
    onConfigChange: (newConfig) => {
      // Optional: Add any real-time validation or side effects
      const errors = validateConfig(newConfig);
      if (errors.length > 0) {
        console.warn('Configuration validation warnings:', errors);
      }
    },
  });

  const handleSave = async () => {
    const errors = validateConfig(config);
    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Konfigurationsfehler',
        description: errors.join(', '),
      });
      return;
    }

    const success = await save();
    if (success) {
      toast({
        title: 'Gespeichert',
        description: 'MEP Layout wurde erfolgreich gespeichert.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Beim Speichern ist ein Fehler aufgetreten.',
      });
    }
  };

  const handleReset = () => {
    reset();
    toast({
      title: 'Zurückgesetzt',
      description: 'MEP Layout wurde auf Standardwerte zurückgesetzt.',
    });
  };

  const handlePresetSelect = (presetId: string) => {
    const success = applyPreset(presetId);
    if (success) {
      toast({
        title: 'Vorlage angewendet',
        description: `MEP Layout wurde auf "${presetId}" geändert.`,
      });
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const validationErrors = validateConfig(config);

  return (
    <div className={`h-screen flex flex-col ${className}`}>
      {/* Header with Actions */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">MEP Layout Anpassen</h1>
          <Badge variant={isDirty ? 'default' : 'secondary'}>
            {isDirty ? 'Nicht gespeichert' : 'Gespeichert'}
          </Badge>
          {lastSaved && (
            <span className="text-sm text-muted-foreground">
              Zuletzt gespeichert: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            title="Rückgängig (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            title="Wiederholen (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            title="Zurücksetzen"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button
            onClick={handleSave}
            disabled={!isDirty}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Speichern
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert className="mx-4 mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Konfigurationswarnungen:</strong> {validationErrors.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Settings Panel */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <h2 className="font-medium">Einstellungen</h2>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Quick Presets */}
                  <Collapsible 
                    open={expandedSections.presets} 
                    onOpenChange={() => toggleSection('presets')}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                        <span className="font-medium">Schnellvorlagen</span>
                        {expandedSections.presets ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <QuickPresets
                        currentPreset={config.preset}
                        onPresetSelect={handlePresetSelect}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  {/* MEP Header */}
                  <Collapsible 
                    open={expandedSections.header} 
                    onOpenChange={() => toggleSection('header')}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                        <span className="font-medium">Kopfbereich</span>
                        {expandedSections.header ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <MEPHeaderSection
                        config={config}
                        onChange={updateConfig}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Table Structure */}
                  <Collapsible 
                    open={expandedSections.table} 
                    onOpenChange={() => toggleSection('table')}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                        <span className="font-medium">Tabellenstruktur</span>
                        {expandedSections.table ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <MEPTableStructureSection
                        config={config}
                        onChange={updateConfig}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  {/* MEP Footer */}
                  <Collapsible 
                    open={expandedSections.footer} 
                    onOpenChange={() => toggleSection('footer')}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                        <span className="font-medium">Fußbereich</span>
                        {expandedSections.footer ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <MEPFooterSection
                        config={config}
                        onChange={updateConfig}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Styling */}
                  <Collapsible 
                    open={expandedSections.styling} 
                    onOpenChange={() => toggleSection('styling')}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                        <span className="font-medium">Styling</span>
                        {expandedSections.styling ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <MEPStylingSection
                        config={config}
                        onChange={updateConfig}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Preview Panel */}
          <ResizablePanel defaultSize={65} minSize={50}>
            <div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <h2 className="font-medium">Live-Vorschau</h2>
              </div>
              
              <div className="flex-1">
                <LivePDFPreview
                  config={config}
                  selectedElement={selectedElement}
                  onElementSelect={setSelectedElement}
                  className="h-full"
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
