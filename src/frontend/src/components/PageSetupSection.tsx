import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface PageSetupSectionProps {
  config: SimplifiedPDFConfig;
  onConfigChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

export function PageSetupSection({ config, onConfigChange, className = '' }: PageSetupSectionProps) {
  const handlePageSizeChange = (size: string) => {
    onConfigChange({
      pageSetup: {
        ...config.pageSetup,
        size: size as 'A4' | 'Letter' | 'Legal',
      },
    });
  };

  const handleOrientationChange = (orientation: string) => {
    onConfigChange({
      pageSetup: {
        ...config.pageSetup,
        orientation: orientation as 'portrait' | 'landscape',
      },
    });
  };

  const handleMarginChange = (side: keyof typeof config.pageSetup.margins, value: number[]) => {
    onConfigChange({
      pageSetup: {
        ...config.pageSetup,
        margins: {
          ...config.pageSetup.margins,
          [side]: value[0],
        },
      },
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Page Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Page Size */}
        <div className="space-y-2">
          <Label>Page Size</Label>
          <Select value={config.pageSetup.size} onValueChange={handlePageSizeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
              <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
              <SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orientation */}
        <div className="space-y-2">
          <Label>Orientation</Label>
          <Select value={config.pageSetup.orientation} onValueChange={handleOrientationChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-4 border border-current" />
                  Portrait
                </div>
              </SelectItem>
              <SelectItem value="landscape">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 border border-current" />
                  Landscape
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Margins */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Margins</Label>
            <Badge variant="secondary" className="text-xs">
              mm
            </Badge>
          </div>
          
          {/* Visual margin editor */}
          <div className="relative">
            <div className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg relative overflow-hidden">
              {/* Page representation */}
              <div 
                className="absolute bg-primary/10 border border-primary/20 rounded"
                style={{
                  top: `${(config.pageSetup.margins.top / 50) * 100}%`,
                  right: `${(config.pageSetup.margins.right / 50) * 100}%`,
                  bottom: `${(config.pageSetup.margins.bottom / 50) * 100}%`,
                  left: `${(config.pageSetup.margins.left / 50) * 100}%`,
                }}
              >
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  Content Area
                </div>
              </div>
              
              {/* Margin labels */}
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground">
                {config.pageSetup.margins.top}mm
              </div>
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground">
                {config.pageSetup.margins.bottom}mm
              </div>
              <div className="absolute left-1 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs text-muted-foreground">
                {config.pageSetup.margins.left}mm
              </div>
              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 rotate-90 text-xs text-muted-foreground">
                {config.pageSetup.margins.right}mm
              </div>
            </div>
          </div>

          {/* Margin sliders */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Top</Label>
              <Slider
                value={[config.pageSetup.margins.top]}
                onValueChange={(value) => handleMarginChange('top', value)}
                min={0}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0mm</span>
                <span>{config.pageSetup.margins.top}mm</span>
                <span>50mm</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Bottom</Label>
              <Slider
                value={[config.pageSetup.margins.bottom]}
                onValueChange={(value) => handleMarginChange('bottom', value)}
                min={0}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0mm</span>
                <span>{config.pageSetup.margins.bottom}mm</span>
                <span>50mm</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Left</Label>
              <Slider
                value={[config.pageSetup.margins.left]}
                onValueChange={(value) => handleMarginChange('left', value)}
                min={0}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0mm</span>
                <span>{config.pageSetup.margins.left}mm</span>
                <span>50mm</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Right</Label>
              <Slider
                value={[config.pageSetup.margins.right]}
                onValueChange={(value) => handleMarginChange('right', value)}
                min={0}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0mm</span>
                <span>{config.pageSetup.margins.right}mm</span>
                <span>50mm</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
