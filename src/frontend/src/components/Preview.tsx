import React from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Stack
} from '@mui/material';
import { LayoutConfig } from '../types/LayoutConfig';

interface PreviewProps {
    layoutConfig: LayoutConfig;
}

const Preview: React.FC<PreviewProps> = ({ layoutConfig }) => {
    const { table_style: tableStyle, title_style: titleStyle } = layoutConfig;

    return (
        <Box
            sx={{
                border: `1px solid ${tableStyle.border_color}`,
                borderRadius: 2,
                p: 2,
                backgroundColor: 'white',
                boxShadow: 1
            }}
        >
            <Stack spacing={2}>
                <Typography
                    align={titleStyle.alignment as 'left' | 'center' | 'right'}
                    fontFamily={titleStyle.font}
                    fontSize={`${titleStyle.size}px`}
                    color={titleStyle.color}
                    fontWeight="bold"
                >
                    Schedule Preview
                </Typography>

                <TableContainer component={Paper}>
                    <Table
                        sx={{
                            '& th, & td': {
                                padding: `${tableStyle.cell_padding}px`,
                                backgroundColor: tableStyle.body_background,
                                color: tableStyle.body_text_color,
                                borderColor: tableStyle.border_color,
                            },
                            '& th': {
                                backgroundColor: tableStyle.header_background,
                                color: tableStyle.header_text_color,
                            },
                            '& tr:nth-of-type(even)': {
                                backgroundColor: tableStyle.alternating_row_background,
                            }
                        }}
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell>Employee</TableCell>
                                <TableCell>Mon</TableCell>
                                <TableCell>Tue</TableCell>
                                <TableCell>Wed</TableCell>
                                <TableCell>Thu</TableCell>
                                <TableCell>Fri</TableCell>
                                <TableCell>Sat</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {[1, 2, 3, 4, 5].map((row) => (
                                <TableRow key={row}>
                                    <TableCell>Employee {row}</TableCell>
                                    {[1, 2, 3, 4, 5, 6].map((col) => (
                                        <TableCell key={col}>
                                            {col % 2 === 0 ? 'Früh' : 'Spät'}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Stack>
        </Box>
    );
};

export default Preview; 