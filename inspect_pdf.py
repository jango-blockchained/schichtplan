#!/usr/bin/env python3
"""
Inspect PDF content to verify calendar structure.
"""
from pathlib import Path
from PyPDF2 import PdfReader

def inspect_pdf(pdf_path):
    """Inspect PDF structure."""
    reader = PdfReader(pdf_path)
    
    print(f"PDF: {pdf_path.name}")
    print(f"Pages: {len(reader.pages)}")
    print(f"Metadata: {reader.metadata}")
    print("\n" + "="*60)
    
    for i, page in enumerate(reader.pages):
        print(f"\nPage {i+1}:")
        print(f"  Size: {page.mediabox.width} x {page.mediabox.height}")
        
        # Try to extract some text
        text = page.extract_text()
        lines = [line for line in text.split('\n') if line.strip()][:20]
        print(f"  First 20 text lines:")
        for line in lines:
            print(f"    {line}")

if __name__ == "__main__":
    # Check calendar PDF
    calendar_pdf = Path("/tmp/yearly_calendar.pdf")
    if calendar_pdf.exists():
        inspect_pdf(calendar_pdf)
    
    print("\n" + "="*60 + "\n")
    
    # Check overview PDF for comparison
    overview_pdf = Path("/tmp/yearly_overview.pdf")
    if overview_pdf.exists():
        inspect_pdf(overview_pdf)
