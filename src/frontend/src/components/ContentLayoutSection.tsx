import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface ContentLayoutSectionProps {
  config: SimplifiedPDFConfig;
  onConfigChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

export function ContentLayoutSection({ config, onConfigChange, className = '' }: ContentLayoutSectionProps) {
  const handleContentToggle = (field: keyof typeof config.contentLayout, value: boolean) => {
    onConfigChange({
      contentLayout: {
        ...config.contentLayout,
        [field]: value,
      },
    });
  };

  const handleHeaderFooterToggle = (field: keyof typeof config.contentLayout.headerFooter, value: boolean) => {
    onConfigChange({
      contentLayout: {
        ...config.contentLayout,
        headerFooter: {
          ...config.contentLayout.headerFooter,
          [field]: value,
        },
      },
    });
  };

  const handleHeaderFooterText = (field: 'headerText' | 'footerText', value: string) => {
    onConfigChange({
      contentLayout: {
        ...config.contentLayout,
        headerFooter: {
          ...config.contentLayout.headerFooter,
          [field]: value,
        },
      },
    });
  };

  const handlePageNumberingToggle = (value: boolean) => {
    onConfigChange({
      contentLayout: {
        ...config.contentLayout,
        pageNumbering: {
          ...config.contentLayout.pageNumbering,
          enabled: value,
        },
      },
    });
  };

  const handlePageNumberingPosition = (position: string) => {
    onConfigChange({
      contentLayout: {
        ...config.contentLayout,
        pageNumbering: {
          ...config.contentLayout.pageNumbering,
          position: position as typeof config.contentLayout.pageNumbering.position,
        },
      },
    });
  };

  const handlePageNumberingFormat = (format: string) => {
    onConfigChange({
      contentLayout: {
        ...config.contentLayout,
        pageNumbering: {
          ...config.contentLayout.pageNumbering,
          format: format as typeof config.contentLayout.pageNumbering.format,
        },
      },
    });
  };

  const handleColumnLayoutChange = (layout: string) => {
    onConfigChange({
      contentLayout: {
        ...config.contentLayout,
        columnLayout: layout as 'single' | 'multi',
      },
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Content Layout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Column Layout */}
        <div className="space-y-2">
          <Label>Column Layout</Label>
          <Select value={config.contentLayout.columnLayout} onValueChange={handleColumnLayoutChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 border border-current" />
                  Single Column
                </div>
              </SelectItem>
              <SelectItem value="multi">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-3 border border-current" />
                    <div className="w-1.5 h-3 border border-current" />
                    <div className="w-1.5 h-3 border border-current" />
                  </div>
                  Multi Column
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Content Visibility */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Content Visibility</Label>
            <Badge variant="secondary" className="text-xs">
              {[
                config.contentLayout.showEmployeeId,
                config.contentLayout.showPosition,
                config.contentLayout.showBreaks,
                config.contentLayout.showTotalHours,
              ].filter(Boolean).length} of 4 enabled
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-employee-id" className="text-sm">
                Employee ID
              </Label>
              <Switch
                id="show-employee-id"
                checked={config.contentLayout.showEmployeeId}
                onCheckedChange={(value) => handleContentToggle('showEmployeeId', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-position" className="text-sm">
                Position/Role
              </Label>
              <Switch
                id="show-position"
                checked={config.contentLayout.showPosition}
                onCheckedChange={(value) => handleContentToggle('showPosition', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-breaks" className="text-sm">
                Break Times
              </Label>
              <Switch
                id="show-breaks"
                checked={config.contentLayout.showBreaks}
                onCheckedChange={(value) => handleContentToggle('showBreaks', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-total-hours" className="text-sm">
                Total Hours
              </Label>
              <Switch
                id="show-total-hours"
                checked={config.contentLayout.showTotalHours}
                onCheckedChange={(value) => handleContentToggle('showTotalHours', value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Header & Footer */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Header & Footer</Label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-header" className="text-sm">
                Show Header
              </Label>
              <Switch
                id="show-header"
                checked={config.contentLayout.headerFooter.showHeader}
                onCheckedChange={(value) => handleHeaderFooterToggle('showHeader', value)}
              />
            </div>

            {config.contentLayout.headerFooter.showHeader && (
              <div className="pl-4 space-y-2">
                <Label htmlFor="header-text" className="text-xs text-muted-foreground">
                  Header Text
                </Label>
                <Input
                  id="header-text"
                  value={config.contentLayout.headerFooter.headerText || ''}
                  onChange={(e) => handleHeaderFooterText('headerText', e.target.value)}
                  placeholder="Enter header text..."
                  className="text-sm"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="show-footer" className="text-sm">
                Show Footer
              </Label>
              <Switch
                id="show-footer"
                checked={config.contentLayout.headerFooter.showFooter}
                onCheckedChange={(value) => handleHeaderFooterToggle('showFooter', value)}
              />
            </div>

            {config.contentLayout.headerFooter.showFooter && (
              <div className="pl-4 space-y-2">
                <Label htmlFor="footer-text" className="text-xs text-muted-foreground">
                  Footer Text
                </Label>
                <Input
                  id="footer-text"
                  value={config.contentLayout.headerFooter.footerText || ''}
                  onChange={(e) => handleHeaderFooterText('footerText', e.target.value)}
                  placeholder="Enter footer text (use {date} for current date)..."
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{date}'} to insert the current date
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Page Numbering */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="page-numbering" className="text-sm font-medium">
              Page Numbering
            </Label>
            <Switch
              id="page-numbering"
              checked={config.contentLayout.pageNumbering.enabled}
              onCheckedChange={handlePageNumberingToggle}
            />
          </div>

          {config.contentLayout.pageNumbering.enabled && (
            <div className="pl-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Position</Label>
                <Select 
                  value={config.contentLayout.pageNumbering.position} 
                  onValueChange={handlePageNumberingPosition}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-center">Top Center</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-center">Bottom Center</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Format</Label>
                <Select 
                  value={config.contentLayout.pageNumbering.format} 
                  onValueChange={handlePageNumberingFormat}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page-of-total">Page 1 of 5</SelectItem>
                    <SelectItem value="page-only">1</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
