import { PageHeader } from '@/components/PageHeader';
import { PDFLayoutCustomizer } from '@/components/PDFLayoutCustomizer';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

export default function PDFLayoutCustomizerPage() {

  const handleSave = async (config: SimplifiedPDFConfig) => {
    try {
      // Convert simplified config to the format expected by the existing API
      const apiConfig = convertToAPIFormat(config);
      
      const response = await fetch('/api/v2/pdf-settings/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }

      return Promise.resolve();
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  };

  const handleDownload = async (config: SimplifiedPDFConfig) => {
    try {
      // Convert simplified config to the format expected by the existing API
      const apiConfig = convertToAPIFormat(config);
      
      const response = await fetch('/api/v2/pdf-settings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate PDF: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule-layout-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return Promise.resolve();
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  };

  // Convert simplified config to existing API format
  const convertToAPIFormat = (config: SimplifiedPDFConfig) => {
    return {
      page_size: config.pageSetup.size,
      orientation: config.pageSetup.orientation,
      margins: {
        top: config.pageSetup.margins.top,
        right: config.pageSetup.margins.right,
        bottom: config.pageSetup.margins.bottom,
        left: config.pageSetup.margins.left,
      },
      table_style: {
        header_bg_color: config.styling.colors.headerBackground,
        border_color: config.styling.colors.border,
        text_color: config.styling.colors.text,
        header_text_color: config.styling.colors.headerText,
      },
      fonts: {
        family: config.styling.fontFamily,
        size: config.styling.fontSize.base,
        header_size: config.styling.fontSize.header,
      },
      content: {
        show_employee_id: config.contentLayout.showEmployeeId,
        show_position: config.contentLayout.showPosition,
        show_breaks: config.contentLayout.showBreaks,
        show_total_hours: config.contentLayout.showTotalHours,
      },
    };
  };

  return (
    <div className="h-screen flex flex-col">
      <PageHeader
        title="PDF Layout Customizer"
        description="Design and customize your PDF schedule layouts with live preview and intuitive controls"
        className="flex-shrink-0"
      />
      
      <div className="flex-1 overflow-hidden">
        <PDFLayoutCustomizer
          onSave={handleSave}
          onDownload={handleDownload}
          className="h-full"
        />
      </div>
    </div>
  );
}
