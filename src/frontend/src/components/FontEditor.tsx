import React from 'react';
import {
    FormControl,
    FormLabel,
    TextField,
    Select,
    MenuItem,
    Stack,
    Paper,
    SelectChangeEvent
} from '@mui/material';
import { LayoutConfig } from '../types/LayoutConfig';

interface FontEditorProps {
    titleStyle: LayoutConfig['title_style'];
    onChange: (newStyle: LayoutConfig['title_style']) => void;
}

const FONT_OPTIONS = [
    'Helvetica',
    'Arial',
    'Times New Roman',
    'Courier',
    'Verdana',
    'Georgia'
];

const ALIGNMENT_OPTIONS = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' }
];

const FontEditor: React.FC<FontEditorProps> = ({ titleStyle, onChange }) => {
    const handleStyleChange = <K extends keyof LayoutConfig['title_style']>(
        key: K,
        value: LayoutConfig['title_style'][K]
    ) => {
        onChange({ ...titleStyle, [key]: value });
    };

    const handleFontChange = (e: SelectChangeEvent) => {
        handleStyleChange('font', e.target.value);
    };

    const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleStyleChange('size', Number(e.target.value));
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleStyleChange('color', e.target.value);
    };

    const handleAlignmentChange = (e: SelectChangeEvent) => {
        handleStyleChange('alignment', e.target.value);
    };

    return (
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack spacing={2}>
                <FormControl fullWidth>
                    <FormLabel>Font Family</FormLabel>
                    <Select
                        value={titleStyle.font}
                        onChange={handleFontChange}
                        size="small"
                    >
                        {FONT_OPTIONS.map(font => (
                            <MenuItem key={font} value={font}>{font}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Stack direction="row" spacing={2}>
                    <FormControl fullWidth>
                        <FormLabel>Font Size</FormLabel>
                        <TextField
                            type="number"
                            value={titleStyle.size}
                            onChange={handleSizeChange}
                            inputProps={{
                                min: 10,
                                max: 50,
                                'aria-label': 'Font Size'
                            }}
                            size="small"
                        />
                    </FormControl>

                    <FormControl fullWidth>
                        <FormLabel>Font Color</FormLabel>
                        <TextField
                            type="color"
                            value={titleStyle.color}
                            onChange={handleColorChange}
                            inputProps={{
                                'aria-label': 'Font Color'
                            }}
                            size="small"
                            sx={{
                                '& input': {
                                    padding: '8px',
                                    height: '40px'
                                }
                            }}
                        />
                    </FormControl>
                </Stack>

                <FormControl fullWidth>
                    <FormLabel>Text Alignment</FormLabel>
                    <Select
                        value={titleStyle.alignment}
                        onChange={handleAlignmentChange}
                        size="small"
                    >
                        {ALIGNMENT_OPTIONS.map(option => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>
        </Paper>
    );
};

export default FontEditor; 