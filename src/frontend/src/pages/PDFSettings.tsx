import React, { useEffect, useState } from "react";
import { PDFLayoutEditor } from "@/components/PDFLayoutEditor";
import { PDFLayoutPresets } from "@/components/PDFLayoutPresets";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/PageHeader"; // Added PageHeader import

export interface PDFLayoutConfig {
  page_size: string;
  orientation: string;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  table_style: {
    header_bg_color: string;
    border_color: string;
    text_color: string;
    header_text_color: string;
  };
  fonts: {
    family: string;
    size: number;
    header_size: number;
  };
  content: {
    show_employee_id: boolean;
    show_position: boolean;
    show_breaks: boolean;
    show_total_hours: boolean;
  };
}

const defaultConfig: PDFLayoutConfig = {
  page_size: "A4",
  orientation: "landscape",
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
  table_style: {
    header_bg_color: "#f4f4f5",
    border_color: "#e2e2e2",
    text_color: "#000000",
    header_text_color: "#000000",
  },
  fonts: {
    family: "Helvetica",
    size: 10,
    header_size: 12,
  },
  content: {
    show_employee_id: true,
    show_position: true,
    show_breaks: true,
    show_total_hours: true,
  },
};

export default function PDFSettings() {
  const [config, setConfig] = useState<PDFLayoutConfig>(defaultConfig);
  const [presets, setPresets] = useState<Record<string, PDFLayoutConfig>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchPresets();
    fetchCurrentConfig();
  }, []);

  const fetchPresets = async () => {
    try {
      const response = await fetch("/api/v2/pdf-settings/presets");
      if (!response.ok) throw new Error("Failed to fetch presets");
      const data = await response.json();
      setPresets(data);
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to load layout presets.",
      });
    }
  };

  const fetchCurrentConfig = async () => {
    try {
      const response = await fetch("/api/v2/pdf-settings/layout");
      if (!response.ok) throw new Error("Failed to fetch current config");
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to load current layout configuration.",
      });
    }
  };

  const handleConfigChange = async (newConfig: PDFLayoutConfig) => {
    try {
      const response = await fetch("/api/v2/pdf-settings/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (!response.ok) throw new Error("Failed to update config");
      setConfig(newConfig);
      toast({
        description: "Layout settings saved successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to save layout changes.",
      });
    }
  };

  const handleSavePreset = async (
    name: string,
    presetConfig: PDFLayoutConfig,
  ) => {
    try {
      const response = await fetch(`/api/v2/pdf-settings/presets/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(presetConfig),
      });
      if (!response.ok) throw new Error("Failed to save preset");
      await fetchPresets();
      toast({
        description: `Preset "${name}" saved successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to save preset.",
      });
    }
  };

  const handleDeletePreset = async (name: string) => {
    try {
      const response = await fetch(`/api/v2/pdf-settings/presets/${name}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete preset");
      await fetchPresets();
      toast({
        description: `Preset "${name}" deleted successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to delete preset.",
      });
    }
  };

  const handleApplyPreset = async (name: string) => {
    try {
      const response = await fetch(`/api/v2/pdf-settings/presets/${name}/apply`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to apply preset");
      await fetchCurrentConfig();
      toast({
        description: `Preset "${name}" applied successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to apply preset.",
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      {/* Added PageHeader */}
      <PageHeader 
        title="PDF Layout Settings"
        description="Customize the layout and appearance of generated PDF schedules. Manage presets for quick configurations."
        className="mb-6"
      />
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        <div className="space-y-4">
          <PDFLayoutPresets
            presets={presets}
            currentConfig={config}
            onSavePreset={handleSavePreset}
            onDeletePreset={handleDeletePreset}
            onApplyPreset={handleApplyPreset}
          />
        </div>
        <div>
          <PDFLayoutEditor config={config} onChange={handleConfigChange} />
        </div>
      </div>
    </div>
  );
}
