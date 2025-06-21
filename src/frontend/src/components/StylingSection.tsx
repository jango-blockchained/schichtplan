import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ColorPicker } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';
import { ChevronDown, Layout, Palette, Type } from 'lucide-react';
import { useState } from 'react';

interface StylingSectionProps {
  config: SimplifiedPDFConfig;
  onConfigChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

export function StylingSection({ config, onConfigChange, className = '' }: StylingSectionProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleFontFamilyChange = (fontFamily: string) => {
    onConfigChange({
      styling: {
        ...config.styling,
        fontFamily: fontFamily as typeof config.styling.fontFamily,
      },
    });
  };

  const handleFontSizeChange = (type: keyof typeof config.styling.fontSize, value: number[]) => {
    onConfigChange({
      styling: {
        ...config.styling,
        fontSize: {
          ...config.styling.fontSize,
          [type]: value[0],
        },
      },
    });
  };

  const handleColorChange = (type: keyof typeof config.styling.colors, color: string) => {
    onConfigChange({
      styling: {
        ...config.styling,
        colors: {
          ...config.styling.colors,
          [type]: color,
        },
      },
    });
  };

  const handleSpacingChange = (type: keyof typeof config.styling.spacing, value: number[]) => {
    onConfigChange({
      styling: {
        ...config.styling,
        spacing: {
          ...config.styling.spacing,
          [type]: value[0],
        },
      },
    });
  };

  const handleTableStyleToggle = (field: keyof typeof config.styling.tableStyle, value: boolean) => {
    onConfigChange({
      styling: {
        ...config.styling,
        tableStyle: {
          ...config.styling.tableStyle,
          [field]: value,
        },
      },
    });
  };

  const handleHeaderStyleChange = (style: string) => {
    onConfigChange({
      styling: {
        ...config.styling,
        tableStyle: {
          ...config.styling.tableStyle,
          headerStyle: style as 'bold' | 'normal',
        },
      },
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Styling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Typography */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            <Label className="text-sm font-medium">Typography</Label>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select value={config.styling.fontFamily} onValueChange={handleFontFamilyChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Helvetica">Helvetica (Sans-serif)</SelectItem>
                  <SelectItem value="Times-Roman">Times Roman (Serif)</SelectItem>
                  <SelectItem value="Arial">Arial (Sans-serif)</SelectItem>
                  <SelectItem value="Courier">Courier (Monospace)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Base Font Size</Label>
                  <Badge variant="secondary" className="text-xs">
                    {config.styling.fontSize.base}pt
                  </Badge>
                </div>
                <Slider
                  value={[config.styling.fontSize.base]}
                  onValueChange={(value) => handleFontSizeChange('base', value)}
                  min={6}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Header Font Size</Label>
                  <Badge variant="secondary" className="text-xs">
                    {config.styling.fontSize.header}pt
                  </Badge>
                </div>
                <Slider
                  value={[config.styling.fontSize.header]}
                  onValueChange={(value) => handleFontSizeChange('header', value)}
                  min={8}
                  max={24}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Title Font Size</Label>
                  <Badge variant="secondary" className="text-xs">
                    {config.styling.fontSize.title}pt
                  </Badge>
                </div>
                <Slider
                  value={[config.styling.fontSize.title]}
                  onValueChange={(value) => handleFontSizeChange('title', value)}
                  min={12}
                  max={36}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Colors */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Colors</Label>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Primary Color</Label>
              <ColorPicker
                color={config.styling.colors.primary}
                onChange={(color) => handleColorChange('primary', color)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Secondary Color</Label>
              <ColorPicker
                color={config.styling.colors.secondary}
                onChange={(color) => handleColorChange('secondary', color)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Text Color</Label>
              <ColorPicker
                color={config.styling.colors.text}
                onChange={(color) => handleColorChange('text', color)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Border Color</Label>
              <ColorPicker
                color={config.styling.colors.border}
                onChange={(color) => handleColorChange('border', color)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Header Background</Label>
              <ColorPicker
                color={config.styling.colors.headerBackground}
                onChange={(color) => handleColorChange('headerBackground', color)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Header Text</Label>
              <ColorPicker
                color={config.styling.colors.headerText}
                onChange={(color) => handleColorChange('headerText', color)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Table Style */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            <Label className="text-sm font-medium">Table Style</Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="alternate-rows" className="text-sm">
                Alternate Row Colors
              </Label>
              <Switch
                id="alternate-rows"
                checked={config.styling.tableStyle.alternateRows}
                onCheckedChange={(value) => handleTableStyleToggle('alternateRows', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="grid-lines" className="text-sm">
                Grid Lines
              </Label>
              <Switch
                id="grid-lines"
                checked={config.styling.tableStyle.gridLines}
                onCheckedChange={(value) => handleTableStyleToggle('gridLines', value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Header Style</Label>
              <Select value={config.styling.tableStyle.headerStyle} onValueChange={handleHeaderStyleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              Advanced Settings
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <Separator />
            
            {/* Spacing Controls */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Spacing</Label>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Cell Padding</Label>
                    <Badge variant="secondary" className="text-xs">
                      {config.styling.spacing.cellPadding}px
                    </Badge>
                  </div>
                  <Slider
                    value={[config.styling.spacing.cellPadding]}
                    onValueChange={(value) => handleSpacingChange('cellPadding', value)}
                    min={2}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Row Height</Label>
                    <Badge variant="secondary" className="text-xs">
                      {config.styling.spacing.rowHeight}px
                    </Badge>
                  </div>
                  <Slider
                    value={[config.styling.spacing.rowHeight]}
                    onValueChange={(value) => handleSpacingChange('rowHeight', value)}
                    min={16}
                    max={40}
                    step={2}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Border Width</Label>
                    <Badge variant="secondary" className="text-xs">
                      {config.styling.spacing.borderWidth}px
                    </Badge>
                  </div>
                  <Slider
                    value={[config.styling.spacing.borderWidth]}
                    onValueChange={(value) => handleSpacingChange('borderWidth', value)}
                    min={0}
                    max={5}
                    step={0.5}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Additional Advanced Colors */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Additional Colors</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Background Color</Label>
                  <ColorPicker
                    color={config.styling.colors.background}
                    onChange={(color) => handleColorChange('background', color)}
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
