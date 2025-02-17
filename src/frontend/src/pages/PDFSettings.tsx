import React, { useEffect, useState } from 'react';
import { PDFLayoutEditor, PDFLayoutConfig } from '@/components/PDFLayoutEditor';
import { PDFLayoutPresets } from '@/components/PDFLayoutPresets';
import { useToast } from '@/components/ui/use-toast';

type ConfigPath =
    ['table', 'style', keyof PDFLayoutConfig['table']['style']] |
    ['table', 'column_widths', keyof PDFLayoutConfig['table']['column_widths']] |
    ['title', keyof PDFLayoutConfig['title']] |
    ['margins', keyof PDFLayoutConfig['margins']] |
    ['page', keyof PDFLayoutConfig['page']];

const defaultConfig: PDFLayoutConfig = {
    margins: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
    },
    table: {
        style: {
            fontSize: 10,
            rowHeight: 8,
            headerBackground: '#f4f4f5',
            alternateRowColors: true,
            alternateRowBackground: '#f8f8f8',
            gridLines: true,
            font: 'Helvetica',
        },
        column_widths: {
            name: 100,
            monday: 60,
            tuesday: 60,
            wednesday: 60,
            thursday: 60,
            friday: 60,
            saturday: 60,
            sunday: 60,
            total: 60,
        },
    },
    title: {
        fontSize: 16,
        alignment: 'center' as const,
        fontStyle: 'bold' as const,
        font: 'Helvetica-Bold',
    },
    page: {
        size: 'A4' as const,
        orientation: 'landscape' as const,
    },
};

export default function PDFSettings() {
    const [config, setConfig] = useState<PDFLayoutConfig>(defaultConfig);
    const [presets, setPresets] = useState<Record<string, PDFLayoutConfig>>({});
    const { toast } = useToast();

    useEffect(() => {
        fetchPresets();
        fetchCurrentConfig();
    }, []);

    const fetchPresets = async () => {
        try {
            const response = await fetch('/api/pdf-settings/presets');
            if (!response.ok) throw new Error('Failed to fetch presets');
            const data = await response.json();
            setPresets(data);
        } catch (error) {
            toast({
                variant: 'destructive',
                description: 'Failed to load layout presets.',
            });
        }
    };

    const fetchCurrentConfig = async () => {
        try {
            const response = await fetch('/api/pdf-settings/layout');
            if (!response.ok) throw new Error('Failed to fetch current config');
            const data = await response.json();
            setConfig(data);
        } catch (error) {
            toast({
                variant: 'destructive',
                description: 'Failed to load current layout configuration.',
            });
        }
    };

    const handleConfigChange = async (path: ConfigPath, value: any) => {
        const newConfig = { ...config };
        let current: any = newConfig;

        // Navigate to the nested property
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }

        // Update the value
        current[path[path.length - 1]] = value;
        setConfig(newConfig);

        try {
            const response = await fetch('/api/pdf-settings/layout', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
            });
            if (!response.ok) throw new Error('Failed to update config');
        } catch (error) {
            toast({
                variant: 'destructive',
                description: 'Failed to save layout changes.',
            });
        }
    };

    const handleSavePreset = async (name: string, presetConfig: PDFLayoutConfig) => {
        try {
            const response = await fetch(`/api/pdf-settings/presets/${name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(presetConfig),
            });
            if (!response.ok) throw new Error('Failed to save preset');
            await fetchPresets();
        } catch (error) {
            throw new Error('Failed to save preset');
        }
    };

    const handleDeletePreset = async (name: string) => {
        try {
            const response = await fetch(`/api/pdf-settings/presets/${name}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete preset');
            await fetchPresets();
        } catch (error) {
            throw new Error('Failed to delete preset');
        }
    };

    const handleApplyPreset = async (name: string) => {
        try {
            const response = await fetch(`/api/pdf-settings/presets/${name}/apply`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to apply preset');
            await fetchCurrentConfig();
        } catch (error) {
            throw new Error('Failed to apply preset');
        }
    };

    return (
        <div className="container mx-auto py-6">
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
                <div className="space-y-4">
                    <PDFLayoutPresets
                        presets={presets}
                        currentConfig={config}
                        onSavePreset={handleSavePreset}
                        onDeletePreset={handleDeletePreset}
                        onApplyPreset={handleApplyPreset}
                    />
                </div>
                <div>
                    <PDFLayoutEditor
                        config={config}
                        onConfigChange={handleConfigChange}
                    />
                </div>
            </div>
        </div>
    );
} 