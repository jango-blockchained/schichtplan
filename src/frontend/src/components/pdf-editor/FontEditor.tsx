import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";

interface FontStyle {
    font: string;
    size: number;
    color: string;
    alignment: 'left' | 'center' | 'right';
}

interface FontEditorProps {
    titleStyle: FontStyle;
    onChange: (style: FontStyle) => void;
}

const FONT_OPTIONS = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
];

const ALIGNMENT_OPTIONS = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
];

const FontEditor: React.FC<FontEditorProps> = ({ titleStyle, onChange }) => {
    const handleChange = (field: keyof FontStyle, value: string | number) => {
        onChange({
            ...titleStyle,
            [field]: value,
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Font Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Font Family</Label>
                    <Select
                        value={titleStyle.font}
                        onValueChange={(value) => handleChange('font', value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select font" />
                        </SelectTrigger>
                        <SelectContent>
                            {FONT_OPTIONS.map((font) => (
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
                        value={titleStyle.size}
                        onChange={(e) => handleChange('size', parseInt(e.target.value, 10))}
                        min={8}
                        max={72}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Text Color</Label>
                    <ColorPicker
                        color={titleStyle.color}
                        onChange={(color: string) => handleChange('color', color)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Alignment</Label>
                    <Select
                        value={titleStyle.alignment}
                        onValueChange={(value) => handleChange('alignment', value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select alignment" />
                        </SelectTrigger>
                        <SelectContent>
                            {ALIGNMENT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
};

export default FontEditor; 