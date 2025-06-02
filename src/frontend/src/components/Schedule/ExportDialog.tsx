import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Building, FileText, Loader2, Printer } from "lucide-react";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'standard' | 'mep' | 'mep-html', filiale?: string) => Promise<void>;
  isExporting?: boolean;
}

export function ExportDialog({ 
  isOpen, 
  onClose, 
  onExport, 
  isExporting = false 
}: ExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<'standard' | 'mep' | 'mep-html'>('mep-html');
  const [filiale, setFiliale] = useState('');

  const handleExport = async () => {
    try {
      await onExport(exportFormat, (exportFormat === 'mep' || exportFormat === 'mep-html') ? filiale : undefined);
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Schichtplan exportieren
          </DialogTitle>
          <DialogDescription>
            Wählen Sie das gewünschte Export-Format für Ihren Schichtplan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export-Format</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as 'standard' | 'mep' | 'mep-html')}
              className="space-y-3"
            >
              <div className="space-y-3">
                <Card className={`cursor-pointer transition-colors ${
                  exportFormat === 'standard' ? 'ring-2 ring-primary' : ''
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="standard" id="standard" />
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <CardTitle className="text-sm">Standard PDF</CardTitle>
                      </div>
                    </div>
                    <CardDescription className="text-xs ml-6">
                      Einfaches tabellarisches Format für den internen Gebrauch
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className={`cursor-pointer transition-colors ${
                  exportFormat === 'mep-html' ? 'ring-2 ring-primary' : ''
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="mep-html" id="mep-html" />
                      <div className="flex items-center gap-2">
                        <Printer className="h-4 w-4" />
                        <CardTitle className="text-sm">MEP Format (HTML)</CardTitle>
                      </div>
                    </div>
                    <CardDescription className="text-xs ml-6">
                      Präzises MEP-Format zum Drucken/Speichern als PDF im Browser
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className={`cursor-pointer transition-colors ${
                  exportFormat === 'mep' ? 'ring-2 ring-primary' : ''
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="mep" id="mep" />
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        <CardTitle className="text-sm">MEP Format (PDF)</CardTitle>
                      </div>
                    </div>
                    <CardDescription className="text-xs ml-6">
                      Automatisch generierte PDF-Datei im MEP-Format
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </RadioGroup>
          </div>

          {(exportFormat === 'mep' || exportFormat === 'mep-html') && (
            <div className="space-y-2">
              <Label htmlFor="filiale" className="text-sm font-medium">
                Filiale / Geschäft
              </Label>
              <Input
                id="filiale"
                value={filiale}
                onChange={(e) => setFiliale(e.target.value)}
                placeholder="z.B. Hauptfiliale München"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Name der Filiale oder des Geschäfts für die MEP-Kopfzeile
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isExporting}>
            Abbrechen
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportiere...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Exportieren
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 