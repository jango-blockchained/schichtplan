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

export function PDFLayoutEditor({ config, onChange }: PDFLayoutEditorProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<'save' | 'preview' | null>(null);

    const handleSave = async () => {
        try {
            setIsLoading('save');
            onChange(config);
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

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
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

    const handleChange = (field: keyof PDFLayoutConfig | [string, string], value: any) => {
        const newConfig = { ...config };

        if (Array.isArray(field)) {
            const [category, key] = field;
            (newConfig as any)[category] = {
                ...(newConfig as any)[category],
                [key]: value
            };
        } else {
            newConfig[field] = value;
        }

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
                                onValueChange={(value) => handleChange('page_size', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAGE_SIZES.map((size) => (
                                        <SelectItem key={size} value={size}>
                                            {size}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Orientation</Label>
                            <Select
                                value={config.orientation}
                                onValueChange={(value) => handleChange('orientation', value)}
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
                    <CardTitle>Margins (mm)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(config.margins).map(([side, value]) => (
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
                        <Label>Font Family</Label>
                        <Select
                            value={config.fonts.family}
                            onValueChange={(value) => handleChange(['fonts', 'family'], value)}
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
                        <Label>Font Size</Label>
                        <Input
                            type="number"
                            value={config.fonts.size}
                            onChange={(e) => handleChange(['fonts', 'size'], Number(e.target.value))}
                            min={8}
                            max={16}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Header Font Size</Label>
                        <Input
                            type="number"
                            value={config.fonts.header_size}
                            onChange={(e) => handleChange(['fonts', 'header_size'], Number(e.target.value))}
                            min={10}
                            max={20}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Header Background Color</Label>
                        <ColorPicker
                            color={config.table_style.header_bg_color}
                            onChange={(color) => handleChange(['table_style', 'header_bg_color'], color)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Border Color</Label>
                        <ColorPicker
                            color={config.table_style.border_color}
                            onChange={(color) => handleChange(['table_style', 'border_color'], color)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Text Color</Label>
                        <ColorPicker
                            color={config.table_style.text_color}
                            onChange={(color) => handleChange(['table_style', 'text_color'], color)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Header Text Color</Label>
                        <ColorPicker
                            color={config.table_style.header_text_color}
                            onChange={(color) => handleChange(['table_style', 'header_text_color'], color)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Content Display</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Show Employee ID</Label>
                        <Switch
                            checked={config.content.show_employee_id}
                            onCheckedChange={(checked) => handleChange(['content', 'show_employee_id'], checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label>Show Position</Label>
                        <Switch
                            checked={config.content.show_position}
                            onCheckedChange={(checked) => handleChange(['content', 'show_position'], checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label>Show Breaks</Label>
                        <Switch
                            checked={config.content.show_breaks}
                            onCheckedChange={(checked) => handleChange(['content', 'show_breaks'], checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label>Show Total Hours</Label>
                        <Switch
                            checked={config.content.show_total_hours}
                            onCheckedChange={(checked) => handleChange(['content', 'show_total_hours'], checked)}
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