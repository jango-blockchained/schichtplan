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
import EmployeeSettingsEditor from './EmployeeSettingsEditor';
import { EmployeeType, AbsenceType } from '@/types';
import Preview from './Preview';
import { LayoutConfig } from '../types/LayoutConfig';

type GroupType = EmployeeType | AbsenceType;

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
                min_hours: 35,
                max_hours: 48,
                type: 'employee' as const
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee (10-34h/week)',
                min_hours: 10,
                max_hours: 34,
                type: 'employee' as const
            },
            {
                id: 'GFB',
                name: 'Geringfügig',
                description: 'Mini-job employee (<10h/week)',
                min_hours: 0,
                max_hours: 10,
                type: 'employee' as const
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
                min_hours: 35,
                max_hours: 48,
                type: 'employee' as const
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee (10-34h/week)',
                min_hours: 10,
                max_hours: 34,
                type: 'employee' as const
            },
            {
                id: 'GFB',
                name: 'Geringfügig',
                description: 'Mini-job employee (<10h/week)',
                min_hours: 0,
                max_hours: 10,
                type: 'employee' as const
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
                min_hours: 35,
                max_hours: 48,
                type: 'employee' as const
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee (10-34h/week)',
                min_hours: 10,
                max_hours: 34,
                type: 'employee' as const
            },
            {
                id: 'GFB',
                name: 'Geringfügig',
                description: 'Mini-job employee (<10h/week)',
                min_hours: 0,
                max_hours: 10,
                type: 'employee' as const
            }
        ]
    }
};

const validateEmployeeGroups = (groups: GroupType[]): string[] => {
    const errors: string[] = [];
    const ids = new Set<string>();

    groups.forEach(group => {
        if (ids.has(group.id)) {
            errors.push(`Duplicate ID found: ${group.id}`);
        }
        ids.add(group.id);

        if (!group.name || group.name.trim() === '') {
            errors.push(`Group ${group.id} is missing a name`);
        }

        if (group.type === 'employee') {
            if (group.min_hours < 0) {
                errors.push(`Group ${group.id} has invalid minimum hours`);
            }
            if (group.max_hours <= group.min_hours) {
                errors.push(`Group ${group.id} has invalid maximum hours`);
            }
        }
    });

    return errors;
};

interface LayoutCustomizerProps {
    config: LayoutConfig;
    onSave: (config: LayoutConfig) => void;
    onClose: () => void;
}

interface Presets {
    [key: string]: LayoutConfig;
}

const LayoutCustomizer: React.FC<LayoutCustomizerProps> = ({ config, onSave, onClose }) => {
    const [currentConfig, setCurrentConfig] = useState<LayoutConfig>(config);
    const [selectedPreset, setSelectedPreset] = useState<string>('');
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [presets, setPresets] = useState<Presets>(DEFAULT_PRESETS);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const { toast } = useToast();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // State for managing presets
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Save configurations to local storage
    useEffect(() => {
        localStorage.setItem('lastLayoutConfig', JSON.stringify(currentConfig));
    }, [currentConfig]);

    useEffect(() => {
        localStorage.setItem('layoutPresets', JSON.stringify(presets));
    }, [presets]);

    const showToast = (message: string, variant: 'default' | 'destructive' = 'default') => {
        toast({
            description: message,
            variant
        });
    };

    const handleSavePreset = () => {
        if (!presetName.trim()) {
            showToast('Preset name cannot be empty', 'destructive');
            return;
        }

        const errors = validateEmployeeGroups(currentConfig.employee_groups);
        if (errors.length > 0) {
            showToast(errors.join('\n'), 'destructive');
            setValidationErrors(errors);
            return;
        }

        if (presets[presetName]) {
            showToast('A preset with this name already exists', 'destructive');
            return;
        }

        const updatedPresets = {
            ...presets,
            [presetName]: currentConfig
        };
        setPresets(updatedPresets);
        setIsPresetModalOpen(false);
        setPresetName('');
        showToast('Preset saved successfully');
    };

    const handleLoadPreset = () => {
        if (selectedPreset) {
            setCurrentConfig(presets[selectedPreset]);
            showToast(`Preset "${selectedPreset}" loaded successfully`);
        }
    };

    const handleDeletePreset = () => {
        if (selectedPreset) {
            const { [selectedPreset]: _, ...remainingPresets } = presets;
            setPresets(remainingPresets);
            setSelectedPreset('');
            showToast(`Preset "${selectedPreset}" deleted successfully`);
        }
    };

    const handleEmployeeGroupsChange = (newGroups: GroupType[]) => {
        const errors = validateEmployeeGroups(newGroups);
        if (errors.length > 0) {
            showToast(errors.join('\n'), 'destructive');
            setValidationErrors(errors);
            return;
        }

        setCurrentConfig(prev => ({
            ...prev,
            employee_groups: newGroups
        }));
    };

    return (
        <div className="space-y-4 p-4">
            <div className="flex justify-between items-center">
                <div className="space-x-2">
                    <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select a preset" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.keys(presets).map(preset => (
                                <SelectItem key={preset} value={preset}>
                                    {preset}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleLoadPreset} disabled={!selectedPreset}>
                        Load
                    </Button>
                    <Button onClick={() => setIsPresetModalOpen(true)}>
                        Save As
                    </Button>
                    <Button onClick={handleDeletePreset} disabled={!selectedPreset} variant="destructive">
                        <Trash className="w-4 h-4" />
                    </Button>
                </div>
                <div className="space-x-2">
                    <Button onClick={() => setIsExportModalOpen(true)}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                    <Button onClick={() => setIsImportModalOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Import
                    </Button>
                </div>
            </div>

            <Dialog open={isPresetModalOpen} onOpenChange={setIsPresetModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Preset</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            placeholder="Preset name"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                        />
                        <Button onClick={handleSavePreset}>Save Preset</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                    <TableStyleEditor
                        tableStyle={currentConfig.table_style}
                        onChange={(style) => setCurrentConfig(prev => ({ ...prev, table_style: style }))}
                    />
                    <FontEditor
                        titleStyle={currentConfig.title_style}
                        onChange={(style) => setCurrentConfig(prev => ({ ...prev, title_style: style }))}
                    />
                    <MarginEditor
                        margins={currentConfig.margins}
                        onChange={(margins) => setCurrentConfig(prev => ({ ...prev, margins }))}
                    />
                    <EmployeeSettingsEditor
                        groups={currentConfig.employee_groups}
                        onChange={handleEmployeeGroupsChange}
                        type="employee"
                    />
                </div>
                <div>
                    <Preview layoutConfig={currentConfig} />
                </div>
            </div>
        </div>
    );
};

export default LayoutCustomizer; 