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
    page_size: string;
    orientation: string;
    margins: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    table_style: {
        header_bg_color: string;
        border_color: string;
        text_color: string;
        header_text_color: string;
    };
    fonts: {
        family: string;
        size: number;
        header_size: number;
    };
    content: {
        show_employee_id: boolean;
        show_position: boolean;
        show_breaks: boolean;
        show_total_hours: boolean;
    };
}

interface PDFLayoutEditorProps {
    config: PDFLayoutConfig;
    onChange: (config: PDFLayoutConfig) => void;
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

export function PDFLayoutEditor({ config, onChange }: PDFLayoutEditorProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<'save' | 'preview' | null>(null);

    const handleSave = async () => {
        try {
            setIsLoading('save');
            // Save each section of the config separately
            await Promise.all([
                onChange(['margins', 'top'], config.margins.top),
                onChange(['margins', 'right'], config.margins.right),
                onChange(['margins', 'bottom'], config.margins.bottom),
                onChange(['margins', 'left'], config.margins.left),
                onChange(['table', 'style', 'fontSize'], config.table.style.fontSize),
                onChange(['table', 'style', 'rowHeight'], config.table.style.rowHeight),
                onChange(['table', 'style', 'headerBackground'], config.table.style.headerBackground),
                onChange(['table', 'style', 'alternateRowColors'], config.table.style.alternateRowColors),
                onChange(['table', 'style', 'alternateRowBackground'], config.table.style.alternateRowBackground),
                onChange(['table', 'style', 'gridLines'], config.table.style.gridLines),
                onChange(['table', 'style', 'font'], config.table.style.font),
                ...Object.entries(config.table.column_widths).map(([key, value]) =>
                    onChange(['table', 'column_widths', key as keyof PDFLayoutConfig['table']['column_widths']], value)
                ),
                onChange(['title', 'fontSize'], config.title.fontSize),
                onChange(['title', 'alignment'], config.title.alignment),
                onChange(['title', 'fontStyle'], config.title.fontStyle),
                onChange(['title', 'font'], config.title.font),
                onChange(['page', 'size'], config.page_size),
                onChange(['page', 'orientation'], config.orientation),
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

    const handleChange = (path: string[], value: any) => {
        const newConfig = { ...config };
        let current: any = newConfig;

        // Navigate to the nested property
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }

        // Update the value
        current[path[path.length - 1]] = value;
        onChange(newConfig);
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
                                value={config.page_size}
                                onValueChange={(value) => handleChange(['page_size'], value)}
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
                                value={config.orientation}
                                onValueChange={(value) => handleChange(['orientation'], value)}
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
                                    handleChange(['table', 'column_widths', column as keyof PDFLayoutConfig['table']['column_widths']], value)
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
                                    onChange={(e) => handleChange(['margins', side], Number(e.target.value))}
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
                            onValueChange={(value) => handleChange(['table', 'style', 'font'], value)}
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
                            onValueChange={([value]) => handleChange(['table', 'style', 'fontSize'], value)}
                            min={8}
                            max={16}
                            step={1}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Row Height (mm)</Label>
                        <Slider
                            value={[config.table.style.rowHeight]}
                            onValueChange={([value]) => handleChange(['table', 'style', 'rowHeight'], value)}
                            min={5}
                            max={20}
                            step={1}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Header Background Color</Label>
                        <ColorPicker
                            color={config.table.style.headerBackground}
                            onChange={(color) => handleChange(['table', 'style', 'headerBackground'], color)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Alternate Row Colors</Label>
                        <Switch
                            checked={config.table.style.alternateRowColors}
                            onCheckedChange={(checked) =>
                                handleChange(['table', 'style', 'alternateRowColors'], checked)
                            }
                        />
                    </div>
                    {config.table.style.alternateRowColors && (
                        <div className="space-y-2">
                            <Label>Alternate Row Background</Label>
                            <ColorPicker
                                color={config.table.style.alternateRowBackground}
                                onChange={(color) => handleChange(['table', 'style', 'alternateRowBackground'], color)}
                            />
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <Label>Grid Lines</Label>
                        <Switch
                            checked={config.table.style.gridLines}
                            onCheckedChange={(checked) =>
                                handleChange(['table', 'style', 'gridLines'], checked)
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
                            onValueChange={(value) => handleChange(['title', 'font'], value)}
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
                            onValueChange={([value]) => handleChange(['title', 'fontSize'], value)}
                            min={12}
                            max={24}
                            step={1}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Alignment</Label>
                        <Select
                            value={config.title.alignment}
                            onValueChange={(value) => handleChange(['title', 'alignment'], value)}
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
                            onValueChange={(value) => handleChange(['title', 'fontStyle'], value)}
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

            <Card>
                <CardHeader>
                    <CardTitle>Content Display</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Show Employee ID</Label>
                        <Switch
                            checked={config.content.show_employee_id}
                            onCheckedChange={(checked) =>
                                handleChange(['content', 'show_employee_id'], checked)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Show Position</Label>
                        <Switch
                            checked={config.content.show_position}
                            onCheckedChange={(checked) =>
                                handleChange(['content', 'show_position'], checked)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Show Breaks</Label>
                        <Switch
                            checked={config.content.show_breaks}
                            onCheckedChange={(checked) =>
                                handleChange(['content', 'show_breaks'], checked)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Show Total Hours</Label>
                        <Switch
                            checked={config.content.show_total_hours}
                            onCheckedChange={(checked) =>
                                handleChange(['content', 'show_total_hours'], checked)
                            }
                        />
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