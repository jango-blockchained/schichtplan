import React from 'react';
import { Box, Button, Popover } from '@mui/material';
import { SketchPicker, ColorResult } from 'react-color';

interface ColorPickerProps {
    defaultValue?: string;
    onChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ defaultValue = '#1976D2', onChange }) => {
    const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
    const [color, setColor] = React.useState(defaultValue);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleChange = (color: ColorResult) => {
        setColor(color.hex);
        onChange(color.hex);
    };

    const open = Boolean(anchorEl);

    return (
        <Box>
            <Button
                onClick={handleClick}
                sx={{
                    width: 100,
                    height: 36,
                    backgroundColor: color,
                    '&:hover': {
                        backgroundColor: color,
                        opacity: 0.9,
                    },
                }}
            />
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <SketchPicker
                    color={color}
                    onChange={handleChange}
                />
            </Popover>
        </Box>
    );
}; 