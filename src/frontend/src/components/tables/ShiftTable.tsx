import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shift } from "@/types";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface ShiftTableProps {
  shifts: Shift[];
  shiftTypes?: { id: string; name: string; color?: string }[];
  loading?: boolean;
  error?: string | null;
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
  onDuplicate?: (shift: Shift) => void;
  onSelectionChange?: (shifts: Shift[]) => void;
  className?: string;
}

export const ShiftTable = ({
  shifts,
  shiftTypes = [],
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onDuplicate,
  className,
}: ShiftTableProps) => {
  const formatTime = (time: string | undefined) => {
    return time || "-"; // Assuming time is already in HH:MM format
  };

  const getShiftTypeName = (typeId: string | undefined) => {
    if (!typeId) return "-";
    return shiftTypes.find((t) => t.id === typeId)?.name || typeId;
  };

  const getDayNames = () => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
        Error: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-4 text-center text-muted-foreground">
        Loading shifts...
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Keine Schichten konfiguriert
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${className || ""}`}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Zeit</TableHead>
            <TableHead>Dauer</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Aktive Tage</TableHead>
            <TableHead>Pause</TableHead>
            <TableHead className="w-10 text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift) => (
            <TableRow key={shift.id}>
              <TableCell className="font-medium">
                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
              </TableCell>
              <TableCell>{shift.duration_hours}h</TableCell>
              <TableCell>
                <Badge variant="outline">{getShiftTypeName(shift.shift_type_id)}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {shift.active_days && shift.active_days.length > 0 ? (
                    shift.active_days.map((day) => (
                      <Badge key={day} variant="secondary" className="text-xs">
                        {getDayNames()[day]}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={shift.requires_break ? "default" : "secondary"}>
                  {shift.requires_break ? "Ja" : "Nein"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(shift)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Bearbeiten
                    </DropdownMenuItem>
                    {onDuplicate && (
                      <DropdownMenuItem onClick={() => onDuplicate(shift)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplizieren
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => onDelete(shift)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
