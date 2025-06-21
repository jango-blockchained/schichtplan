import { MEPLayoutCustomizer } from '@/components/MEPLayoutCustomizer';
import { PageHeader } from '@/components/PageHeader';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

export default function PDFLayoutCustomizerPage() {

  const handleSave = async (config: SimplifiedPDFConfig) => {
    try {
      // Save to the MEP settings endpoint
      const response = await fetch('/api/v2/settings/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_layout: config }),
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

  return (
    <div className="h-screen flex flex-col">
      <PageHeader
        title="PDF Layout Customizer"
        description="Design and customize your PDF schedule layouts with live preview and intuitive controls"
        className="flex-shrink-0"
      />
      
      <div className="flex-1 overflow-hidden">
        <MEPLayoutCustomizer
          onSave={handleSave}
          className="h-full"
        />
      </div>
    </div>
  );
}
