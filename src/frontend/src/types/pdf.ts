export interface PDFLayoutConfig {
    margins: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    table: {
        style: {
            fontSize: number;
            rowHeight: number;
            headerBackground: string;
            alternateRowColors: boolean;
            alternateRowBackground: string;
            gridLines: boolean;
            font: string;
        };
        column_widths: {
            name: number;
            monday: number;
            tuesday: number;
            wednesday: number;
            thursday: number;
            friday: number;
            saturday: number;
            sunday: number;
            total: number;
        };
    };
    title: {
        fontSize: number;
        alignment: 'left' | 'center' | 'right';
        fontStyle: 'normal' | 'bold' | 'italic';
        font: string;
    };
    page: {
        size: 'A4' | 'Letter' | 'Legal';
        orientation: 'portrait' | 'landscape';
    };
}

export type ConfigPath =
    ['margins', keyof PDFLayoutConfig['margins']] |
    ['table', 'style', keyof PDFLayoutConfig['table']['style']] |
    ['table', 'column_widths', keyof PDFLayoutConfig['table']['column_widths']] |
    ['title', keyof PDFLayoutConfig['title']] |
    ['page', keyof PDFLayoutConfig['page']]; 