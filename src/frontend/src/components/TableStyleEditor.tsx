import React from 'react';
import {
    FormControl,
    FormLabel,
    TextField,
    Stack,
    Paper
} from '@mui/material';
import { LayoutConfig } from '../types/LayoutConfig';

interface TableStyleEditorProps {
    tableStyle: LayoutConfig['table_style'];
    onChange: (newStyle: LayoutConfig['table_style']) => void;
}

const TableStyleEditor: React.FC<TableStyleEditorProps> = ({ tableStyle, onChange }) => {
    const handleStyleChange = (key: keyof LayoutConfig['table_style'], value: string | number) => {
        onChange({ ...tableStyle, [key]: value });
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof LayoutConfig['table_style']) => {
        handleStyleChange(key, e.target.value);
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof LayoutConfig['table_style']) => {
        handleStyleChange(key, Number(e.target.value));
    };

    const ColorInput = ({ label, value, onChange, ariaLabel }: {
        label: string;
        value: string;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        ariaLabel: string;
    }) => (
        <FormControl fullWidth>
            <FormLabel>{label}</FormLabel>
            <TextField
                type="color"
                value={value}
                onChange={onChange}
                inputProps={{
                    'aria-label': ariaLabel
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
    );

    const NumberInput = ({ label, value, onChange, min, max, ariaLabel }: {
        label: string;
        value: number;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        min: number;
        max: number;
        ariaLabel: string;
    }) => (
        <FormControl fullWidth>
            <FormLabel>{label}</FormLabel>
            <TextField
                type="number"
                value={value}
                onChange={onChange}
                inputProps={{
                    min,
                    max,
                    'aria-label': ariaLabel
                }}
                size="small"
            />
        </FormControl>
    );

    return (
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack spacing={2}>
                <ColorInput
                    label="Border Color"
                    value={tableStyle.border_color}
                    onChange={(e) => handleColorChange(e, 'border_color')}
                    ariaLabel="Border Color"
                />

                <Stack direction="row" spacing={2}>
                    <NumberInput
                        label="Border Width"
                        value={tableStyle.border_width}
                        onChange={(e) => handleNumberChange(e, 'border_width')}
                        min={0}
                        max={10}
                        ariaLabel="Border Width"
                    />

                    <NumberInput
                        label="Cell Padding"
                        value={tableStyle.cell_padding}
                        onChange={(e) => handleNumberChange(e, 'cell_padding')}
                        min={0}
                        max={20}
                        ariaLabel="Cell Padding"
                    />
                </Stack>

                <Stack direction="row" spacing={2}>
                    <ColorInput
                        label="Header Background"
                        value={tableStyle.header_background}
                        onChange={(e) => handleColorChange(e, 'header_background')}
                        ariaLabel="Header Background Color"
                    />

                    <ColorInput
                        label="Header Text Color"
                        value={tableStyle.header_text_color}
                        onChange={(e) => handleColorChange(e, 'header_text_color')}
                        ariaLabel="Header Text Color"
                    />
                </Stack>

                <Stack direction="row" spacing={2}>
                    <ColorInput
                        label="Body Background"
                        value={tableStyle.body_background}
                        onChange={(e) => handleColorChange(e, 'body_background')}
                        ariaLabel="Body Background Color"
                    />

                    <ColorInput
                        label="Body Text Color"
                        value={tableStyle.body_text_color}
                        onChange={(e) => handleColorChange(e, 'body_text_color')}
                        ariaLabel="Body Text Color"
                    />
                </Stack>

                <ColorInput
                    label="Alternating Row Background"
                    value={tableStyle.alternating_row_background}
                    onChange={(e) => handleColorChange(e, 'alternating_row_background')}
                    ariaLabel="Alternating Row Background Color"
                />
            </Stack>
        </Paper>
    );
};

export default TableStyleEditor; 