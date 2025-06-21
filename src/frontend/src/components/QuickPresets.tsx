import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRESET_TEMPLATES, PresetTemplate } from '@/types/SimplifiedPDFConfig';

interface QuickPresetsProps {
  currentPreset: string;
  onPresetSelect: (presetId: string) => void;
  className?: string;
}

export function QuickPresets({ currentPreset, onPresetSelect, className = '' }: QuickPresetsProps) {
  const handlePresetClick = (preset: PresetTemplate) => {
    onPresetSelect(preset.id);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Quick Presets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {PRESET_TEMPLATES.map((preset) => (
          <Button
            key={preset.id}
            variant={currentPreset === preset.id ? "default" : "outline"}
            className="w-full justify-start text-left h-auto p-3"
            onClick={() => handlePresetClick(preset)}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="text-lg leading-none">{preset.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{preset.name}</span>
                  {currentPreset === preset.id && (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {preset.description}
                </p>
              </div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
