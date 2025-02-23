import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Trash, Download, Upload, Copy } from "lucide-react";
import DateRangeSelector from './DateRangeSelector';
import TableStyleEditor from './TableStyleEditor';
import FontEditor from './FontEditor';
import MarginEditor from './MarginEditor';
import EmployeeSettingsEditor, { EmployeeGroup } from './EmployeeSettingsEditor';
import Preview from './Preview';
import { LayoutConfig } from '../types/LayoutConfig';

// Predefined presets
const DEFAULT_PRESETS = {
    'Classic': {
        column_widths: [100, 80, 80, 80, 80, 80, 80],
        table_style: {
            border_color: "#000000",
            border_width: 1,
            cell_padding: 5,
            header_background: "#CCCCCC",
            header_text_color: "#000000",
            body_background: "#FFFFFF",
            body_text_color: "#333333",
            alternating_row_background: "#F0F0F0"
        },
        title_style: {
            font: "Helvetica",
            size: 24,
            color: "#000000",
            alignment: "center" as 'center'
        },
        margins: {
            top: 20,
            right: 10,
            bottom: 20,
            left: 10
        },
        employee_groups: [
            {
                id: 'VZ',
                name: 'Vollzeit',
                description: 'Full-time employee (35-48h/week)',
                minHours: 35,
                maxHours: 48,
                isFullTime: true
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee (10-35h/week)',
                minHours: 10,
                maxHours: 35,
                isFullTime: false
            },
            {
                id: 'GFB',
                name: 'Geringfügig Beschäftigt',
                description: `Mini-job employee (max 556 EUR/month, ~${Math.floor((556 / 12.41) / 4.33)}h/week)`,
                minHours: 0,
                maxHours: Math.floor((556 / 12.41) / 4.33),
                isFullTime: false
            },
            {
                id: 'TL',
                name: 'Team Leader',
                description: 'Team leader (35-48h/week)',
                minHours: 35,
                maxHours: 48,
                isFullTime: true
            }
        ]
    },
    'Modern': {
        column_widths: [120, 90, 90, 90, 90, 90, 90],
        table_style: {
            border_color: "#666666",
            border_width: 1,
            cell_padding: 7,
            header_background: "#3182CE",
            header_text_color: "#FFFFFF",
            body_background: "#F7FAFC",
            body_text_color: "#2D3748",
            alternating_row_background: "#EDF2F7"
        },
        title_style: {
            font: "Arial",
            size: 28,
            color: "#2C5282",
            alignment: "center" as 'center'
        },
        margins: {
            top: 25,
            right: 15,
            bottom: 25,
            left: 15
        },
        employee_groups: [
            {
                id: 'VZ',
                name: 'Vollzeit',
                description: 'Full-time employee (35-48h/week)',
                minHours: 35,
                maxHours: 48,
                isFullTime: true
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee (10-35h/week)',
                minHours: 10,
                maxHours: 35,
                isFullTime: false
            },
            {
                id: 'GFB',
                name: 'Geringfügig Beschäftigt',
                description: `Mini-job employee (max 556 EUR/month, ~${Math.floor((556 / 12.41) / 4.33)}h/week)`,
                minHours: 0,
                maxHours: Math.floor((556 / 12.41) / 4.33),
                isFullTime: false
            },
            {
                id: 'TL',
                name: 'Team Leader',
                description: 'Team leader (35-48h/week)',
                minHours: 35,
                maxHours: 48,
                isFullTime: true
            }
        ]
    },
    'Compact': {
        column_widths: [80, 70, 70, 70, 70, 70, 70],
        table_style: {
            border_color: "#888888",
            border_width: 0.5,
            cell_padding: 3,
            header_background: "#E2E8F0",
            header_text_color: "#000000",
            body_background: "#FFFFFF",
            body_text_color: "#4A5568",
            alternating_row_background: "#F7FAFC"
        },
        title_style: {
            font: "Verdana",
            size: 20,
            color: "#000000",
            alignment: "center" as 'center'
        },
        margins: {
            top: 15,
            right: 8,
            bottom: 15,
            left: 8
        },
        employee_groups: [
            {
                id: 'VZ',
                name: 'Vollzeit',
                description: 'Full-time employee (35-48h/week)',
                minHours: 35,
                maxHours: 48,
                isFullTime: true
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee (10-35h/week)',
                minHours: 10,
                maxHours: 35,
                isFullTime: false
            },
            {
                id: 'GFB',
                name: 'Geringfügig Beschäftigt',
                description: `Mini-job employee (max 556 EUR/month, ~${Math.floor((556 / 12.41) / 4.33)}h/week)`,
                minHours: 0,
                maxHours: Math.floor((556 / 12.41) / 4.33),
                isFullTime: false
            },
            {
                id: 'TL',
                name: 'Team Leader',
                description: 'Team leader (35-48h/week)',
                minHours: 35,
                maxHours: 48,
                isFullTime: true
            }
        ]
    }
};

// Add validation function for employee groups
const validateEmployeeGroups = (groups: EmployeeGroup[]): string | null => {
    for (const group of groups) {
        if (group.minHours < 0 || group.maxHours > 48) {
            return `${group.name}: Hours must be between 0 and 48 (German labor law maximum)`;
        }

        if (group.minHours > group.maxHours) {
            return `${group.name}: Minimum hours cannot be greater than maximum hours`;
        }

        switch (group.id) {
            case 'VZ':
            case 'TL':
                if (group.minHours < 35) {
                    return `${group.name}: Full-time employees must work at least 35 hours per week`;
                }
                if (group.maxHours !== 48) {
                    return `${group.name}: Full-time employees are limited to 48 hours per week`;
                }
                break;
            case 'TZ':
                if (group.maxHours > 35) {
                    return `${group.name}: Part-time employees cannot exceed 35 hours per week`;
                }
                break;
            case 'GFB':
                const maxGfbHours = Math.floor((556 / 12.41) / 4.33);
                if (group.maxHours > maxGfbHours) {
                    return `${group.name}: Mini-job employees cannot exceed ${maxGfbHours} hours per week (556 EUR limit)`;
                }
                break;
        }
    }
    return null;
};

const LayoutCustomizer: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>([]);
    const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(() => {
        const storedConfig = localStorage.getItem('lastLayoutConfig');
        return storedConfig ? JSON.parse(storedConfig) : DEFAULT_PRESETS['Classic'];
    });

    // State for managing presets
    const [presets, setPresets] = useState<Record<string, LayoutConfig>>(() => {
        const storedPresets = localStorage.getItem('layoutPresets');
        return storedPresets ? JSON.parse(storedPresets) : DEFAULT_PRESETS;
    });

    // Modal and toast states
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const { toast } = useToast();

    const [newPresetName, setNewPresetName] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('');

    // Save configurations to local storage
    useEffect(() => {
        localStorage.setItem('lastLayoutConfig', JSON.stringify(layoutConfig));
    }, [layoutConfig]);

    useEffect(() => {
        localStorage.setItem('layoutPresets', JSON.stringify(presets));
    }, [presets]);

    const showToast = (message: string, variant: 'default' | 'destructive' = 'default') => {
        toast({
            description: message,
            variant: variant,
        });
    };

    const handleCloseToast = () => {
        // Implementation needed
    };

    const handleSavePreset = () => {
        if (!newPresetName.trim()) {
            showToast('Preset name cannot be empty', 'destructive');
            return;
        }

        const error = validateEmployeeGroups(layoutConfig.employee_groups);
        if (error) {
            showToast(error, 'destructive');
            return;
        }

        if (presets[newPresetName]) {
            showToast('A preset with this name already exists', 'destructive');
            return;
        }

        const updatedPresets = {
            ...presets,
            [newPresetName]: layoutConfig
        };
        setPresets(updatedPresets);
        setIsPresetModalOpen(false);
        setNewPresetName('');
        showToast('Preset saved successfully');
    };

    const handleLoadPreset = () => {
        if (selectedPreset) {
            setLayoutConfig(presets[selectedPreset]);
            showToast(`Preset "${selectedPreset}" loaded successfully`);
        }
    };

    const handleExport = async () => {
        // Placeholder for export functionality
        try {
            // Validate dates
            if (!startDate || !endDate) {
                showToast('Please select both start and end dates', 'destructive');
                return;
            }

            // TODO: Implement actual export logic
            showToast('PDF exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            showToast('Failed to export PDF', 'destructive');
        }
    };

    const handleEmployeeGroupsChange = (newGroups: EmployeeGroup[]) => {
        const error = validateEmployeeGroups(newGroups);
        if (error) {
            showToast(error, 'destructive');
            return;
        }

        setEmployeeGroups(newGroups);
        setLayoutConfig(prev => ({
            ...prev,
            employee_groups: newGroups
        }));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="space-x-2">
                    <Input
                        placeholder="Preset name"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                    />
                    <Button onClick={handleSavePreset}>Save Preset</Button>
                </div>
                <div className="space-x-2">
                    <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                        <SelectTrigger>
                            <SelectValue placeholder="Load preset" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.keys(presets).map((preset) => (
                                <SelectItem key={preset} value={preset}>
                                    {preset}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleLoadPreset}>Load</Button>
                </div>
                <div className="space-x-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={handleExport}>
                                    <Download className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Export configuration</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <Upload className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Import configuration</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy configuration</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                    <TableStyleEditor
                        tableStyle={layoutConfig.table_style}
                        onChange={(style) => setLayoutConfig(prev => ({ ...prev, table_style: style }))}
                    />
                    <FontEditor
                        titleStyle={layoutConfig.title_style}
                        onChange={(style) => setLayoutConfig(prev => ({ ...prev, title_style: style }))}
                    />
                    <MarginEditor
                        margins={layoutConfig.margins}
                        onChange={(margins) => setLayoutConfig(prev => ({ ...prev, margins }))}
                    />
                    <EmployeeSettingsEditor
                        groups={employeeGroups}
                        onChange={handleEmployeeGroupsChange}
                    />
                </div>
                <div>
                    <Preview layoutConfig={layoutConfig} />
                </div>
            </div>

            {/* Preset Management Modal */}
            <Dialog open={isPresetModalOpen} onOpenChange={setIsPresetModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Preset</DialogTitle>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="submit" onClick={handleSavePreset}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LayoutCustomizer; 