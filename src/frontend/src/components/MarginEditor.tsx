import React from 'react';
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LayoutConfig } from '../types/LayoutConfig';

interface MarginEditorProps {
    margins: LayoutConfig['margins'];
    onChange: (newMargins: LayoutConfig['margins']) => void;
}

const MarginEditor: React.FC<MarginEditorProps> = ({ margins, onChange }) => {
    const handleMarginChange = (key: keyof LayoutConfig['margins'], value: number) => {
        onChange({ ...margins, [key]: value });
    };

    return (
        <Card className="p-4 border">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="top-margin">Top Margin (mm)</Label>
                        <Input
                            id="top-margin"
                            type="number"
                            value={margins.top}
                            onChange={(e) => handleMarginChange('top', Number(e.target.value))}
                            min={0}
                            max={50}
                            aria-label="Top Margin"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="right-margin">Right Margin (mm)</Label>
                        <Input
                            id="right-margin"
                            type="number"
                            value={margins.right}
                            onChange={(e) => handleMarginChange('right', Number(e.target.value))}
                            min={0}
                            max={50}
                            aria-label="Right Margin"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="bottom-margin">Bottom Margin (mm)</Label>
                        <Input
                            id="bottom-margin"
                            type="number"
                            value={margins.bottom}
                            onChange={(e) => handleMarginChange('bottom', Number(e.target.value))}
                            min={0}
                            max={50}
                            aria-label="Bottom Margin"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="left-margin">Left Margin (mm)</Label>
                        <Input
                            id="left-margin"
                            type="number"
                            value={margins.left}
                            onChange={(e) => handleMarginChange('left', Number(e.target.value))}
                            min={0}
                            max={50}
                            aria-label="Left Margin"
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default MarginEditor; 