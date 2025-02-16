import React from 'react';
import {
    Box,
    FormControl,
    FormLabel,
    TextField,
    Stack,
    Paper
} from '@mui/material';
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
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                    <FormControl fullWidth>
                        <FormLabel>Top Margin (mm)</FormLabel>
                        <TextField
                            type="number"
                            value={margins.top}
                            onChange={(e) => handleMarginChange('top', Number(e.target.value))}
                            inputProps={{
                                min: 0,
                                max: 50,
                                'aria-label': 'Top Margin'
                            }}
                            size="small"
                        />
                    </FormControl>

                    <FormControl fullWidth>
                        <FormLabel>Right Margin (mm)</FormLabel>
                        <TextField
                            type="number"
                            value={margins.right}
                            onChange={(e) => handleMarginChange('right', Number(e.target.value))}
                            inputProps={{
                                min: 0,
                                max: 50,
                                'aria-label': 'Right Margin'
                            }}
                            size="small"
                        />
                    </FormControl>
                </Stack>

                <Stack direction="row" spacing={2}>
                    <FormControl fullWidth>
                        <FormLabel>Bottom Margin (mm)</FormLabel>
                        <TextField
                            type="number"
                            value={margins.bottom}
                            onChange={(e) => handleMarginChange('bottom', Number(e.target.value))}
                            inputProps={{
                                min: 0,
                                max: 50,
                                'aria-label': 'Bottom Margin'
                            }}
                            size="small"
                        />
                    </FormControl>

                    <FormControl fullWidth>
                        <FormLabel>Left Margin (mm)</FormLabel>
                        <TextField
                            type="number"
                            value={margins.left}
                            onChange={(e) => handleMarginChange('left', Number(e.target.value))}
                            inputProps={{
                                min: 0,
                                max: 50,
                                'aria-label': 'Left Margin'
                            }}
                            size="small"
                        />
                    </FormControl>
                </Stack>
            </Stack>
        </Paper>
    );
};

export default MarginEditor; 