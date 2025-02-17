import React from 'react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutConfig } from '../types/LayoutConfig';

interface PreviewProps {
    layoutConfig: LayoutConfig;
}

const Preview: React.FC<PreviewProps> = ({ layoutConfig }) => {
    const { table_style: tableStyle, title_style: titleStyle } = layoutConfig;

    return (
        <Card className="p-4 bg-white shadow-sm">
            <div
                style={{
                    border: `${tableStyle.border_width}px solid ${tableStyle.border_color}`,
                    padding: `${tableStyle.cell_padding}px`,
                }}
                className="rounded-lg"
            >
                <Table>
                    <TableHeader>
                        <TableRow style={{ backgroundColor: tableStyle.header_background }}>
                            <TableCell
                                className="font-medium"
                                style={{ color: tableStyle.header_text_color }}
                            >
                                Name
                            </TableCell>
                            <TableCell
                                className="font-medium"
                                style={{ color: tableStyle.header_text_color }}
                            >
                                Position
                            </TableCell>
                            <TableCell
                                className="font-medium"
                                style={{ color: tableStyle.header_text_color }}
                            >
                                Hours
                            </TableCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow style={{ backgroundColor: tableStyle.body_background }}>
                            <TableCell style={{ color: tableStyle.body_text_color }}>
                                John Doe
                            </TableCell>
                            <TableCell style={{ color: tableStyle.body_text_color }}>
                                Manager
                            </TableCell>
                            <TableCell style={{ color: tableStyle.body_text_color }}>
                                40
                            </TableCell>
                        </TableRow>
                        <TableRow style={{ backgroundColor: tableStyle.alternating_row_background }}>
                            <TableCell style={{ color: tableStyle.body_text_color }}>
                                Jane Smith
                            </TableCell>
                            <TableCell style={{ color: tableStyle.body_text_color }}>
                                Developer
                            </TableCell>
                            <TableCell style={{ color: tableStyle.body_text_color }}>
                                35
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
};

export default Preview; 