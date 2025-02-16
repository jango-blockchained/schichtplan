import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Typography,
    Modal,
    TextField,
    Select,
    MenuItem,
    SelectChangeEvent,
    IconButton,
    Tooltip,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Download as DownloadIcon,
    Upload as UploadIcon,
    CopyAll as CopyIcon
} from '@mui/icons-material';
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
            alignment: "center"
        },
        margins: {
            top: 20,
            right: 10,
            bottom: 20,
            left: 10
        },
        employee_groups: [
            {
                id: 'VL',
                name: 'Vollzeit',
                description: 'Full-time employee',
                minHours: 40,
                maxHours: 40,
                isFullTime: true
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee',
                minHours: 10,
                maxHours: 30,
                isFullTime: false
            },
            {
                id: 'GFB',
                name: 'Geringfügig Beschäftigt',
                description: 'Mini-job employee',
                minHours: 0,
                maxHours: 40,
                isFullTime: false
            },
            {
                id: 'TL',
                name: 'Team Leader',
                description: 'Team leader (full-time)',
                minHours: 40,
                maxHours: 40,
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
            alignment: "center"
        },
        margins: {
            top: 25,
            right: 15,
            bottom: 25,
            left: 15
        },
        employee_groups: [
            {
                id: 'VL',
                name: 'Vollzeit',
                description: 'Full-time employee',
                minHours: 40,
                maxHours: 40,
                isFullTime: true
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee',
                minHours: 10,
                maxHours: 30,
                isFullTime: false
            },
            {
                id: 'GFB',
                name: 'Geringfügig Beschäftigt',
                description: 'Mini-job employee',
                minHours: 0,
                maxHours: 40,
                isFullTime: false
            },
            {
                id: 'TL',
                name: 'Team Leader',
                description: 'Team leader (full-time)',
                minHours: 40,
                maxHours: 40,
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
            alignment: "center"
        },
        margins: {
            top: 15,
            right: 8,
            bottom: 15,
            left: 8
        },
        employee_groups: [
            {
                id: 'VL',
                name: 'Vollzeit',
                description: 'Full-time employee',
                minHours: 40,
                maxHours: 40,
                isFullTime: true
            },
            {
                id: 'TZ',
                name: 'Teilzeit',
                description: 'Part-time employee',
                minHours: 10,
                maxHours: 30,
                isFullTime: false
            },
            {
                id: 'GFB',
                name: 'Geringfügig Beschäftigt',
                description: 'Mini-job employee',
                minHours: 0,
                maxHours: 40,
                isFullTime: false
            },
            {
                id: 'TL',
                name: 'Team Leader',
                description: 'Team leader (full-time)',
                minHours: 40,
                maxHours: 40,
                isFullTime: true
            }
        ]
    }
};

const LayoutCustomizer: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // State for managing presets
    const [presets, setPresets] = useState<Record<string, LayoutConfig>>(() => {
        const storedPresets = localStorage.getItem('layoutPresets');
        return storedPresets ? JSON.parse(storedPresets) : DEFAULT_PRESETS;
    });

    const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(() => {
        const storedConfig = localStorage.getItem('lastLayoutConfig');
        return storedConfig ? JSON.parse(storedConfig) : DEFAULT_PRESETS['Classic'];
    });

    // Modal and toast states
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [toast, setToast] = useState<{
        open: boolean,
        message: string,
        severity: 'success' | 'error' | 'warning'
    }>({ open: false, message: '', severity: 'success' });

    const [newPresetName, setNewPresetName] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('');

    // Save configurations to local storage
    useEffect(() => {
        localStorage.setItem('lastLayoutConfig', JSON.stringify(layoutConfig));
    }, [layoutConfig]);

    useEffect(() => {
        localStorage.setItem('layoutPresets', JSON.stringify(presets));
    }, [presets]);

    const showToast = (message: string, severity: 'success' | 'error' | 'warning' = 'success') => {
        setToast({ open: true, message, severity });
    };

    const handleCloseToast = () => {
        setToast(prev => ({ ...prev, open: false }));
    };

    const handleSavePreset = () => {
        if (!newPresetName.trim()) {
            showToast('Preset name cannot be empty', 'error');
            return;
        }

        if (presets[newPresetName]) {
            showToast('A preset with this name already exists', 'warning');
            return;
        }

        setPresets(prev => ({
            ...prev,
            [newPresetName]: layoutConfig
        }));
        setIsPresetModalOpen(false);
        setNewPresetName('');
        showToast(`Preset "${newPresetName}" saved successfully`);
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
                showToast('Please select both start and end dates', 'error');
                return;
            }

            // TODO: Implement actual export logic
            showToast('PDF exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            showToast('Failed to export PDF', 'error');
        }
    };

    const handleEmployeeGroupsChange = (newGroups: EmployeeGroup[]) => {
        setLayoutConfig(prev => ({
            ...prev,
            employee_groups: newGroups
        }));
    };

    return (
        <Box sx={{ p: 3, maxWidth: 800, margin: 'auto' }}>
            <Typography variant="h4" gutterBottom>
                PDF Layout Customizer
            </Typography>

            <Stack spacing={3}>
                <DateRangeSelector
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                />

                <TableStyleEditor
                    tableStyle={layoutConfig.table_style}
                    onChange={(newStyle) => setLayoutConfig(prev => ({ ...prev, table_style: newStyle }))}
                />

                <FontEditor
                    titleStyle={layoutConfig.title_style}
                    onChange={(newStyle) => setLayoutConfig(prev => ({ ...prev, title_style: newStyle }))}
                />

                <MarginEditor
                    margins={layoutConfig.margins}
                    onChange={(newMargins) => setLayoutConfig(prev => ({ ...prev, margins: newMargins }))}
                />

                <EmployeeSettingsEditor
                    groups={layoutConfig.employee_groups}
                    onChange={handleEmployeeGroupsChange}
                />

                <Preview layoutConfig={layoutConfig} />

                <Stack direction="row" spacing={2}>
                    <Button
                        variant="outlined"
                        onClick={() => setIsPresetModalOpen(true)}
                        startIcon={<CopyIcon />}
                    >
                        Save Preset
                    </Button>

                    <Select
                        value={selectedPreset}
                        onChange={(e: SelectChangeEvent) => setSelectedPreset(e.target.value)}
                        displayEmpty
                        fullWidth
                    >
                        <MenuItem value="" disabled>Load Preset</MenuItem>
                        {Object.keys(presets).map(presetName => (
                            <MenuItem key={presetName} value={presetName}>
                                {presetName}
                            </MenuItem>
                        ))}
                    </Select>

                    <Button
                        variant="contained"
                        onClick={handleLoadPreset}
                        disabled={!selectedPreset}
                    >
                        Load Preset
                    </Button>
                </Stack>

                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleExport}
                    disabled={!startDate || !endDate}
                >
                    Export to PDF
                </Button>
            </Stack>

            {/* Preset Management Modal */}
            <Dialog
                open={isPresetModalOpen}
                onClose={() => setIsPresetModalOpen(false)}
            >
                <DialogTitle>Save Preset</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Preset Name"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsPresetModalOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleSavePreset}
                        disabled={!newPresetName.trim()}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Toast Notification */}
            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={handleCloseToast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={handleCloseToast}
                    severity={toast.severity}
                    sx={{ width: '100%' }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default LayoutCustomizer; 