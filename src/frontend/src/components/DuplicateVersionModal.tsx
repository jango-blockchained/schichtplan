/**
 * Duplicate Version Modal Component
 * 
 * A modal dialog that allows users to select a target week range
 * when duplicating a schedule version.
 */

import { addWeeks, endOfWeek, format, getWeek, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface DuplicateVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceVersion: number;
  sourceVersionMeta?: {
    version: number;
    status: string;
    date_range_start?: string;
    date_range_end?: string;
    notes?: string;
    created_at?: string;
  };
  onDuplicate: (options: {
    startDate: string;
    endDate: string;
    weekVersion?: string;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

export function DuplicateVersionModal({
  open,
  onOpenChange,
  sourceVersion,
  sourceVersionMeta,
  onDuplicate,
  isLoading = false,
}: DuplicateVersionModalProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeek(new Date(), { locale: de }));
  const [notes, setNotes] = useState<string>("");
  const [weekVersion, setWeekVersion] = useState<string>("1"); // Second versioning parameter

  // Calculate date range for selected week
  const getDateRangeForWeek = (year: number, week: number) => {
    // Create a date in the selected year
    const yearStart = new Date(year, 0, 1);
    // Find the first Monday of the year
    const firstMonday = startOfWeek(yearStart, { weekStartsOn: 1 });
    // Calculate the target week
    const targetWeek = addWeeks(firstMonday, week - 1);
    const startDate = startOfWeek(targetWeek, { weekStartsOn: 1 });
    const endDate = endOfWeek(targetWeek, { weekStartsOn: 1 });
    
    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRangeForWeek(selectedYear, selectedWeek);

  // Generate year options (current year ± 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Generate week options (1-53)
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1);

  const handleDuplicate = () => {
    const formattedStartDate = format(startDate, "yyyy-MM-dd");
    const formattedEndDate = format(endDate, "yyyy-MM-dd");

    onDuplicate({
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      weekVersion: weekVersion,
      notes: notes || `Dupliziert von Version ${sourceVersion} für KW ${selectedWeek}/${selectedYear} v${weekVersion}`,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form state when closing
    setSelectedYear(new Date().getFullYear());
    setSelectedWeek(getWeek(new Date(), { locale: de }));
    setNotes("");
    setWeekVersion("1");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Version {sourceVersion} duplizieren
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie eine neue Version basierend auf Version {sourceVersion}. Wählen Sie den Zielzeitraum, in den die Schichtpläne kopiert werden sollen.
            Die Schichtpläne werden entsprechend der Zeitverschiebung angepasst.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Source Version Info */}
          <div className="rounded-md border p-3 bg-blue-50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Copy className="h-4 w-4 text-blue-600" />
              Quellversion
            </div>
            <div className="text-sm">
              <div className="font-medium">Version {sourceVersion}</div>
              {sourceVersionMeta && (
                <>
                  {sourceVersionMeta.date_range_start && sourceVersionMeta.date_range_end && (
                    <div className="text-muted-foreground mt-1">
                      {format(parseISO(sourceVersionMeta.date_range_start), "dd.MM.yyyy", { locale: de })} -{" "}
                      {format(parseISO(sourceVersionMeta.date_range_end), "dd.MM.yyyy", { locale: de })}
                    </div>
                  )}
                  {sourceVersionMeta.notes && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {sourceVersionMeta.notes}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Year and Week Selection */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Jahr</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger id="year">
                  <SelectValue placeholder="Jahr wählen" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Week Selection */}
            <div className="space-y-2">
              <Label htmlFor="week">Kalenderwoche</Label>
              <Select
                value={selectedWeek.toString()}
                onValueChange={(value) => setSelectedWeek(parseInt(value))}
              >
                <SelectTrigger id="week">
                  <SelectValue placeholder="KW wählen" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {weekOptions.map((week) => (
                    <SelectItem key={week} value={week.toString()}>
                      KW {week.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Week Version Selection */}
            <div className="space-y-2">
              <Label htmlFor="weekVersion">Wochenversion</Label>
              <Select
                value={weekVersion}
                onValueChange={(value) => setWeekVersion(value)}
              >
                <SelectTrigger id="weekVersion">
                  <SelectValue placeholder="v1" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((version) => (
                    <SelectItem key={version} value={version.toString()}>
                      v{version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range Preview */}
          <div className="rounded-md border p-3 bg-green-50 dark:bg-green-950/20">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Calendar className="h-4 w-4 text-green-600" />
              Zielzeitraum
            </div>
            <div className="text-sm">
              <div className="font-medium">
                {format(startDate, "EEEE, dd.MM.yyyy", { locale: de })} bis{" "}
                {format(endDate, "EEEE, dd.MM.yyyy", { locale: de })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                KW {selectedWeek}/{selectedYear} v{weekVersion} ({format(startDate, "dd.MM")} - {format(endDate, "dd.MM")})
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Zusätzliche Notizen für diese Version..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={handleDuplicate}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              "Wird dupliziert..."
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Duplizieren
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
