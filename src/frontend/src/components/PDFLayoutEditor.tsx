import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ColorPicker } from '@/components/ui/color-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

export interface PDFLayoutConfig {
    margins: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    table: {
        style: {
            fontSize: number;
            rowHeight: number;
            headerBackground: string;
            alternateRowColors: boolean;
            alternateRowBackground: string;
            gridLines: boolean;
            font: string;
        };
        column_widths: {
            name: number;
            monday: number;
            tuesday: number;
            wednesday: number;
            thursday: number;
            friday: number;
            saturday: number;
            sunday: number;
            total: number;
        };
    };
    title: {
        fontSize: number;
        alignment: 'left' | 'center' | 'right';
        fontStyle: 'normal' | 'bold' | 'italic';
        font: string;
    };
    page: {
        size: 'A4' | 'Letter' | 'Legal';
        orientation: 'portrait' | 'landscape';
    };
}

interface PDFLayoutEditorProps {
    config: PDFLayoutConfig;
    onConfigChange: (path: ConfigPath, value: any) => void;
}

const AVAILABLE_FONTS = ['Helvetica', 'Helvetica-Bold', 'Times-Roman', 'Times-Bold'];
const PAGE_SIZES = ['A4', 'Letter', 'Legal'];
const ALIGNMENTS = ['left', 'center', 'right'];
const VALIGNMENTS = ['top', 'middle', 'bottom'];

type ConfigPath =
    ['table', 'style', keyof PDFLayoutConfig['table']['style']] |
    ['table', 'column_widths', keyof PDFLayoutConfig['table']['column_widths']] |
    ['title', keyof PDFLayoutConfig['title']] |
    ['margins', keyof PDFLayoutConfig['margins']] |
    ['page', keyof PDFLayoutConfig['page']];

export function PDFLayoutEditor({ config, onConfigChange }: PDFLayoutEditorProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<'save' | 'preview' | null>(null);

    const handleSave = async () => {
        try {
            setIsLoading('save');
            // Save each section of the config separately
            await Promise.all([
                onConfigChange(['margins', 'top'], config.margins.top),
                onConfigChange(['margins', 'right'], config.margins.right),
                onConfigChange(['margins', 'bottom'], config.margins.bottom),
                onConfigChange(['margins', 'left'], config.margins.left),
                onConfigChange(['table', 'style', 'fontSize'], config.table.style.fontSize),
                onConfigChange(['table', 'style', 'rowHeight'], config.table.style.rowHeight),
                onConfigChange(['table', 'style', 'headerBackground'], config.table.style.headerBackground),
                onConfigChange(['table', 'style', 'alternateRowColors'], config.table.style.alternateRowColors),
                onConfigChange(['table', 'style', 'alternateRowBackground'], config.table.style.alternateRowBackground),
                onConfigChange(['table', 'style', 'gridLines'], config.table.style.gridLines),
                onConfigChange(['table', 'style', 'font'], config.table.style.font),
                ...Object.entries(config.table.column_widths).map(([key, value]) =>
                    onConfigChange(['table', 'column_widths', key as keyof PDFLayoutConfig['table']['column_widths']], value)
                ),
                onConfigChange(['title', 'fontSize'], config.title.fontSize),
                onConfigChange(['title', 'alignment'], config.title.alignment),
                onConfigChange(['title', 'fontStyle'], config.title.fontStyle),
                onConfigChange(['title', 'font'], config.title.font),
                onConfigChange(['page', 'size'], config.page.size),
                onConfigChange(['page', 'orientation'], config.page.orientation),
            ]);
            toast({
                description: 'Layout settings saved successfully.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                description: 'Failed to save layout settings.',
            });
        } finally {
            setIsLoading(null);
        }
    };

    const handlePreview = async () => {
        try {
            setIsLoading('preview');
            const response = await fetch('/api/pdf-settings/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            if (!response.ok) {
                throw new Error('Failed to generate preview');
            }

            // Get the PDF blob and create a URL for it
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            // Open the PDF in a new tab
            window.open(url, '_blank');

            // Clean up the URL object
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({
                variant: 'destructive',
                description: 'Failed to generate preview.',
            });
        } finally {
            setIsLoading(null);
        }
    };

    const updateConfig = (path: ConfigPath, value: any) => {
        onConfigChange(path, value);
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Page Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Page Size</Label>
                            <Select
                                value={config.page.size}
                                onValueChange={(value) => updateConfig(['page', 'size'], value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A4">A4</SelectItem>
                                    <SelectItem value="Letter">Letter</SelectItem>
                                    <SelectItem value="Legal">Legal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Orientation</Label>
                            <Select
                                value={config.page.orientation}
                                onValueChange={(value) => updateConfig(['page', 'orientation'], value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="portrait">Portrait</SelectItem>
                                    <SelectItem value="landscape">Landscape</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Column Widths</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {Object.entries(config.table.column_widths).map(([column, width]) => (
                        <div key={column} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="capitalize">
                                    {column === 'name' ? 'Employee Name' : column}
                                </Label>
                                <span className="text-sm text-muted-foreground">{width}px</span>
                            </div>
                            <Slider
                                value={[width]}
                                onValueChange={([value]) =>
                                    updateConfig(['table', 'column_widths', column as keyof PDFLayoutConfig['table']['column_widths']], value)
                                }
                                min={40}
                                max={200}
                                step={10}
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Margins (mm)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        {(Object.entries(config.margins) as [keyof PDFLayoutConfig['margins'], number][]).map(([side, value]) => (
                            <div key={side} className="space-y-2">
                                <Label className="capitalize">{side}</Label>
                                <Input
                                    type="number"
                                    value={value}
                                    onChange={(e) => updateConfig(['margins', side], Number(e.target.value))}
                                    min={0}
                                    max={50}
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Table Style</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Font</Label>
                        <Select
                            value={config.table.style.font}
                            onValueChange={(value) => updateConfig(['table', 'style', 'font'], value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {AVAILABLE_FONTS.map((font) => (
                                    <SelectItem key={font} value={font}>
                                        {font}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Font Size (pt)</Label>
                        <Slider
                            value={[config.table.style.fontSize]}
                            onValueChange={([value]) => updateConfig(['table', 'style', 'fontSize'], value)}
                            min={8}
                            max={16}
                            step={1}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Row Height (mm)</Label>
                        <Slider
                            value={[config.table.style.rowHeight]}
                            onValueChange={([value]) => updateConfig(['table', 'style', 'rowHeight'], value)}
                            min={5}
                            max={20}
                            step={1}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Header Background Color</Label>
                        <ColorPicker
                            color={config.table.style.headerBackground}
                            onChange={(color) => updateConfig(['table', 'style', 'headerBackground'], color)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Alternate Row Colors</Label>
                        <Switch
                            checked={config.table.style.alternateRowColors}
                            onCheckedChange={(checked) =>
                                updateConfig(['table', 'style', 'alternateRowColors'], checked)
                            }
                        />
                    </div>
                    {config.table.style.alternateRowColors && (
                        <div className="space-y-2">
                            <Label>Alternate Row Background</Label>
                            <ColorPicker
                                color={config.table.style.alternateRowBackground}
                                onChange={(color) => updateConfig(['table', 'style', 'alternateRowBackground'], color)}
                            />
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <Label>Grid Lines</Label>
                        <Switch
                            checked={config.table.style.gridLines}
                            onCheckedChange={(checked) =>
                                updateConfig(['table', 'style', 'gridLines'], checked)
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Title Style</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Font</Label>
                        <Select
                            value={config.title.font}
                            onValueChange={(value) => updateConfig(['title', 'font'], value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {AVAILABLE_FONTS.map((font) => (
                                    <SelectItem key={font} value={font}>
                                        {font}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Font Size (pt)</Label>
                        <Slider
                            value={[config.title.fontSize]}
                            onValueChange={([value]) => updateConfig(['title', 'fontSize'], value)}
                            min={12}
                            max={24}
                            step={1}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Alignment</Label>
                        <Select
                            value={config.title.alignment}
                            onValueChange={(value) => updateConfig(['title', 'alignment'], value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Font Style</Label>
                        <Select
                            value={config.title.fontStyle}
                            onValueChange={(value) => updateConfig(['title', 'fontStyle'], value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="bold">Bold</SelectItem>
                                <SelectItem value="italic">Italic</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={handlePreview} disabled={!!isLoading}>
                    {isLoading === 'preview' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Preview
                </Button>
                <Button onClick={handleSave} disabled={!!isLoading}>
                    {isLoading === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                </Button>
            </div>
        </div>
    );
} 