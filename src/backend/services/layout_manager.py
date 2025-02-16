from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import TableStyle
from typing import Dict, Any, Optional, List, Tuple

class LayoutManager:
    def __init__(self):
        # Default layout configuration
        self._config = {
            'table': {
                'column_widths': [1.5*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch],
                'style': [
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('GRID', (0,0), (-1,-1), 1, colors.black),
                    ('BACKGROUND', (0,0), (-1,0), colors.grey),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0,0), (-1,0), 12),
                    ('LEADING', (0,0), (-1,-1), 14),
                    ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
                    ('FONTSIZE', (0,1), (-1,-1), 10),
                ]
            },
            'title': {
                'font': 'Helvetica-Bold',
                'size': 16,
                'color': colors.black,
                'alignment': 1  # Center
            },
            'margins': {
                'right': 30,
                'left': 30,
                'top': 30,
                'bottom': 30
            }
        }

    def set_column_widths(self, widths: List[float]):
        """Set custom column widths for the table"""
        self._config['table']['column_widths'] = widths

    def set_table_style(self, style: List[Tuple]):
        """Set custom table style"""
        self._config['table']['style'] = style

    def set_title_style(self, font: Optional[str] = None, size: Optional[int] = None, 
                        color: Optional[Any] = None, alignment: Optional[int] = None):
        """Customize title style"""
        if font is not None:
            self._config['title']['font'] = font
        if size is not None:
            self._config['title']['size'] = size
        if color is not None:
            self._config['title']['color'] = color
        if alignment is not None:
            self._config['title']['alignment'] = alignment

    def set_margins(self, right: Optional[int] = None, left: Optional[int] = None, 
                    top: Optional[int] = None, bottom: Optional[int] = None):
        """Set custom page margins"""
        if right is not None:
            self._config['margins']['right'] = right
        if left is not None:
            self._config['margins']['left'] = left
        if top is not None:
            self._config['margins']['top'] = top
        if bottom is not None:
            self._config['margins']['bottom'] = bottom

    def get_column_widths(self) -> List[float]:
        """Get current column widths"""
        return self._config['table']['column_widths']

    def get_table_style(self) -> List[Tuple]:
        """Get current table style"""
        return self._config['table']['style']

    def get_title_style(self) -> Dict[str, Any]:
        """Get current title style"""
        return self._config['title']

    def get_margins(self) -> Dict[str, int]:
        """Get current page margins"""
        return self._config['margins']

    def create_table_style(self) -> TableStyle:
        """Create a TableStyle instance from the current configuration"""
        return TableStyle(self._config['table']['style']) 