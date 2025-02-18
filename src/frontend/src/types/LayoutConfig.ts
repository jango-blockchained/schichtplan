import { EmployeeGroup } from '../components/EmployeeSettingsEditor';

export interface LayoutConfig {
    column_widths: number[];
    table_style: {
        border_color: string;
        border_width: number;
        cell_padding: number;
        header_background: string;
        header_text_color: string;
        body_background: string;
        body_text_color: string;
        alternating_row_background: string;
    };
    title_style: {
        font: string;
        size: number;
        color: string;
        alignment: 'left' | 'center' | 'right';
    };
    margins: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    employee_groups: EmployeeGroup[];
} 