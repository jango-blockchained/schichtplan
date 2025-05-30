import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import LayoutCustomizer from "@/components/LayoutCustomizer";
import { LayoutConfig, Presets } from "@/types/LayoutConfig";
import { PageHeader } from "@/components/PageHeader";

const DEFAULT_PRESETS: Presets = {
  Classic: {
    column_widths: [40, 20, 25, 30, 30, 30, 30, 30, 30, 30, 25, 25],
    table_style: {
      border_color: "#000000",
      border_width: 1.5,
      cell_padding: 5,
      header_background: "#F5F5F5",
      header_text_color: "#000000",
      body_background: "#FFFFFF",
      body_text_color: "#000000",
      alternating_row_background: "#FFFFFF",
    },
    title_style: {
      font: "Helvetica-Bold",
      size: 11,
      color: "#000000",
      alignment: "left",
    },
    margins: {
      top: 30,
      right: 20,
      bottom: 40,
      left: 20,
    },
  },
};

export default function LayoutCustomizerPage() {
  const { toast } = useToast();

  const handleSave = async (config: LayoutConfig) => {
    try {
      const response = await fetch("/api/v2/pdf-settings/layout", { // Corrected endpoint
        method: "PUT", // Corrected method
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to save layout configuration");
      }

      toast({
        title: "Success",
        description: "Layout configuration saved successfully",
      });
    } catch (error) {
      console.error("Error saving layout:", error);
      toast({
        title: "Error",
        description: "Failed to save layout configuration",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="PDF Layout Customizer"
        description="Customize the appearance of your schedule PDFs"
      />

      <Card>
        <CardHeader>
          <CardTitle>Layout Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <LayoutCustomizer
            config={DEFAULT_PRESETS.Classic}
            onSave={handleSave}
            onClose={() => {}}
          />
        </CardContent>
      </Card>
    </div>
  );
}
