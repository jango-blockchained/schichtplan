import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorPicker } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface MEPStylingSectionProps {
  config: SimplifiedPDFConfig;
  onChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

export function MEPStylingSection({ config, onChange, className = '' }: MEPStylingSectionProps) {
  const handleFontChange = (family: SimplifiedPDFConfig['styling']['fontFamily']) => {
    onChange({
      styling: {
        ...config.styling,
        fontFamily: family,
      },
    });
  };

  const handleFontSizeChange = (
    sizeType: keyof SimplifiedPDFConfig['styling']['fontSize'],
    size: number
  ) => {
    onChange({
      styling: {
        ...config.styling,
        fontSize: {
          ...config.styling.fontSize,
          [sizeType]: size,
        },
      },
    });
  };

  const handleColorChange = (
    colorType: keyof SimplifiedPDFConfig['styling']['colors'],
    color: string
  ) => {
    onChange({
      styling: {
        ...config.styling,
        colors: {
          ...config.styling.colors,
          [colorType]: color,
        },
      },
    });
  };

  const handleSpacingChange = (
    spacingType: keyof SimplifiedPDFConfig['styling']['spacing'],
    value: number
  ) => {
    onChange({
      styling: {
        ...config.styling,
        spacing: {
          ...config.styling.spacing,
          [spacingType]: value,
        },
      },
    });
  };

  const handleTableStyleChange = (
    styleType: keyof SimplifiedPDFConfig['styling']['tableStyle'],
    value: boolean
  ) => {
    onChange({
      styling: {
        ...config.styling,
        tableStyle: {
          ...config.styling.tableStyle,
          [styleType]: value,
        },
      },
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">MEP Styling</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Font Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Schriftart</h4>
          
          <div className="space-y-2">
            <Label>Schriftfamilie</Label>
            <Select
              value={config.styling.fontFamily}
              onValueChange={handleFontChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Helvetica">Helvetica</SelectItem>
                <SelectItem value="Times-Roman">Times Roman</SelectItem>
                <SelectItem value="Arial">Arial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Haupttitel</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.fontSize.headerTitle}pt
                </Badge>
              </div>
              <Slider
                value={[config.styling.fontSize.headerTitle]}
                onValueChange={([value]) => handleFontSizeChange('headerTitle', value)}
                min={8}
                max={16}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Spaltenüberschriften</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.fontSize.columnHeaders}pt
                </Badge>
              </div>
              <Slider
                value={[config.styling.fontSize.columnHeaders]}
                onValueChange={([value]) => handleFontSizeChange('columnHeaders', value)}
                min={6}
                max={14}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Unterüberschriften</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.fontSize.subHeaders}pt
                </Badge>
              </div>
              <Slider
                value={[config.styling.fontSize.subHeaders]}
                onValueChange={([value]) => handleFontSizeChange('subHeaders', value)}
                min={5}
                max={12}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tabelleninhalt</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.fontSize.tableContent}pt
                </Badge>
              </div>
              <Slider
                value={[config.styling.fontSize.tableContent]}
                onValueChange={([value]) => handleFontSizeChange('tableContent', value)}
                min={4}
                max={10}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fußbereich</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.fontSize.footer}pt
                </Badge>
              </div>
              <Slider
                value={[config.styling.fontSize.footer]}
                onValueChange={([value]) => handleFontSizeChange('footer', value)}
                min={4}
                max={8}
                step={1}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Colors */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Farben</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tabellen-Rahmen</Label>
              <ColorPicker
                color={config.styling.colors.tableBorder}
                onChange={(color) => handleColorChange('tableBorder', color)}
              />
            </div>

            <div className="space-y-2">
              <Label>Kopfzeilen-Hintergrund</Label>
              <ColorPicker
                color={config.styling.colors.headerBackground}
                onChange={(color) => handleColorChange('headerBackground', color)}
              />
            </div>

            <div className="space-y-2">
              <Label>Kopfzeilen-Text</Label>
              <ColorPicker
                color={config.styling.colors.headerText}
                onChange={(color) => handleColorChange('headerText', color)}
              />
            </div>

            <div className="space-y-2">
              <Label>Zellen-Hintergrund</Label>
              <ColorPicker
                color={config.styling.colors.cellBackground}
                onChange={(color) => handleColorChange('cellBackground', color)}
              />
            </div>

            <div className="space-y-2">
              <Label>Zellen-Text</Label>
              <ColorPicker
                color={config.styling.colors.cellText}
                onChange={(color) => handleColorChange('cellText', color)}
              />
            </div>

            <div className="space-y-2">
              <Label>Wechselnde Zeilen</Label>
              <ColorPicker
                color={config.styling.colors.alternateRowBackground}
                onChange={(color) => handleColorChange('alternateRowBackground', color)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Spacing */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Abstände</h4>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Zellen-Polsterung</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.spacing.cellPadding}mm
                </Badge>
              </div>
              <Slider
                value={[config.styling.spacing.cellPadding]}
                onValueChange={([value]) => handleSpacingChange('cellPadding', value)}
                min={1}
                max={8}
                step={0.5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Zeilenhöhe</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.spacing.rowHeight}mm
                </Badge>
              </div>
              <Slider
                value={[config.styling.spacing.rowHeight]}
                onValueChange={([value]) => handleSpacingChange('rowHeight', value)}
                min={8}
                max={25}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Rahmenbreite</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.spacing.borderWidth}pt
                </Badge>
              </div>
              <Slider
                value={[config.styling.spacing.borderWidth]}
                onValueChange={([value]) => handleSpacingChange('borderWidth', value)}
                min={0.1}
                max={2}
                step={0.1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Kopfbereich-Abstand</Label>
                <Badge variant="secondary" className="text-xs">
                  {config.styling.spacing.headerSpacing}mm
                </Badge>
              </div>
              <Slider
                value={[config.styling.spacing.headerSpacing]}
                onValueChange={([value]) => handleSpacingChange('headerSpacing', value)}
                min={2}
                max={15}
                step={1}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Table Style Options */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Tabellen-Optionen</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Rahmen anzeigen</Label>
              <Switch
                checked={config.styling.tableStyle.showBorders}
                onCheckedChange={(checked) => handleTableStyleChange('showBorders', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Wechselnde Zeilenfarben</Label>
              <Switch
                checked={config.styling.tableStyle.alternateRowColors}
                onCheckedChange={(checked) => handleTableStyleChange('alternateRowColors', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Fette Überschriften</Label>
              <Switch
                checked={config.styling.tableStyle.boldHeaders}
                onCheckedChange={(checked) => handleTableStyleChange('boldHeaders', checked)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
