import { useState } from "react";
import { PDFLayoutConfig, ConfigPath } from "@/types/pdf";

const defaultConfig: PDFLayoutConfig = {
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
  table: {
    style: {
      fontSize: 10,
      rowHeight: 20,
      headerBackground: "#f0f0f0",
      alternateRowColors: true,
      alternateRowBackground: "#f9f9f9",
      gridLines: true,
      font: "Helvetica",
    },
    column_widths: {
      name: 150,
      monday: 100,
      tuesday: 100,
      wednesday: 100,
      thursday: 100,
      friday: 100,
      saturday: 100,
      sunday: 100,
      total: 100,
    },
  },
  title: {
    fontSize: 16,
    alignment: "center",
    fontStyle: "bold",
    font: "Helvetica",
  },
  page: {
    size: "Letter",
    orientation: "landscape",
  },
};

export function usePDFConfig() {
  const [config, setConfig] = useState<PDFLayoutConfig>(defaultConfig);

  const updateConfig = (path: ConfigPath, value: any) => {
    setConfig((prev: PDFLayoutConfig) => {
      if (
        path[0] === "table" &&
        (path[1] === "style" || path[1] === "column_widths")
      ) {
        return {
          ...prev,
          table: {
            ...prev.table,
            [path[1]]: {
              ...prev.table[path[1]],
              [path[2]]: value,
            },
          },
        };
      }
      return {
        ...prev,
        [path[0]]: {
          ...prev[path[0]],
          [path[1]]: value,
        },
      };
    });
  };

  return {
    config,
    updateConfig,
  };
}
