import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings2, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ExportDialog } from "./ExportDialog";

interface ScheduleControlsProps {
  onRefresh: () => void;
  onExport: (format: 'standard' | 'mep' | 'mep-html', filiale?: string) => Promise<void>;
  isExporting?: boolean;
}

const ScheduleControls: React.FC<ScheduleControlsProps> = ({
  onRefresh,
  onExport,
  isExporting = false,
}) => {
  const navigate = useNavigate();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Navigate to layout customizer page instead of using a dialog
  const handleOpenLayoutCustomizer = () => {
    navigate("/layout");
  };

  const handleExportClick = () => {
    setIsExportDialogOpen(true);
  };

  const handleExportFromDialog = async (format: 'standard' | 'mep' | 'mep-html', filiale?: string) => {
    await onExport(format, filiale);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
        <Button variant="outline" size="sm" onClick={handleOpenLayoutCustomizer}>
          <Settings2 className="h-4 w-4 mr-2" />
          Layout
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportClick}
          disabled={isExporting}
        >
          <FileDown className="h-4 w-4 mr-2" />
          Exportieren
        </Button>
      </div>

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={handleExportFromDialog}
        isExporting={isExporting}
      />
    </>
  );
};

export default ScheduleControls;
