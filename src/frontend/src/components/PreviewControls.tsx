import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Download,
    Redo2,
    RotateCcw,
    Save,
    Undo2
} from 'lucide-react';
import React from 'react';

interface PreviewControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  lastSaved?: Date;
  onSave: () => Promise<void>;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownload?: () => void;
  className?: string;
}

export function PreviewControls({
  canUndo,
  canRedo,
  isDirty,
  lastSaved,
  onSave,
  onReset,
  onUndo,
  onRedo,
  onDownload,
  className = '',
}: PreviewControlsProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatLastSaved = (date?: Date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        {/* Primary Actions */}
        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>

          {onDownload && (
            <Button 
              variant="outline" 
              onClick={onDownload}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>

        <Separator />

        {/* History Controls */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
              className="flex-1"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Undo
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
              className="flex-1"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="mr-2 h-4 w-4" />
              Redo
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="w-full text-destructive hover:text-destructive"
            title="Reset to default settings"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Default
          </Button>
        </div>

        <Separator />

        {/* Save Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status:</span>
            <div className="flex items-center gap-2">
              {isDirty ? (
                <>
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  <Badge variant="secondary" className="text-xs">
                    Unsaved Changes
                  </Badge>
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <Badge variant="secondary" className="text-xs">
                    Saved
                  </Badge>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last saved:</span>
            <span className="text-xs text-muted-foreground">
              {formatLastSaved(lastSaved)}
            </span>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium mb-2">Keyboard Shortcuts:</div>
            <div className="flex justify-between">
              <span>Save</span>
              <span className="font-mono">Ctrl+S</span>
            </div>
            <div className="flex justify-between">
              <span>Undo</span>
              <span className="font-mono">Ctrl+Z</span>
            </div>
            <div className="flex justify-between">
              <span>Redo</span>
              <span className="font-mono">Ctrl+Y</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
