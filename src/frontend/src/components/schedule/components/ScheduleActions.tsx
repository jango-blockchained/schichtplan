import React from "react";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus,
  Trash2,
  AlertCircle,
  Table2,
  LayoutGrid,
  Calendar,
  User,
  Clock,
  LineChart,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduleViewType } from "@/components/schedule/core/ScheduleDisplay";

interface ScheduleActionsProps {
  onAddSchedule: () => void;
  onDeleteSchedule: () => void;
  isLoading?: boolean;
  canAdd?: boolean;
  canDelete?: boolean;
  activeView?: ScheduleViewType;
  onViewChange?: (view: ScheduleViewType) => void;
}

export function ScheduleActions({
  onAddSchedule,
  onDeleteSchedule,
  isLoading = false,
  canAdd = true,
  canDelete = true,
  activeView = "table",
  onViewChange,
}: ScheduleActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        {canAdd && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSchedule}
            disabled={isLoading}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            Schicht hinzufügen
          </Button>
        )}

        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Schicht löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Schicht löschen</AlertDialogTitle>
                <AlertDialogDescription>
                  Möchten Sie diese Schicht wirklich löschen? Dies kann nicht
                  rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={onDeleteSchedule}>
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* View Selector Dropdown */}
      {onViewChange && (
        <Select value={activeView} onValueChange={onViewChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ansicht wählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="table">
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                <span>Tabelle</span>
              </div>
            </SelectItem>
            <SelectItem value="grid">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span>Zeitraster</span>
              </div>
            </SelectItem>
            <SelectItem value="coverage">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4" />
                <span>Abdeckung</span>
              </div>
            </SelectItem>
            <SelectItem value="monthly">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Monat</span>
              </div>
            </SelectItem>
            <SelectItem value="daily">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Tag</span>
              </div>
            </SelectItem>
            <SelectItem value="employee">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Mitarbeiter</span>
              </div>
            </SelectItem>
            <SelectItem value="calendar">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Kalender</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
