import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wrench } from "lucide-react";

interface ScheduleFixActionsProps {
  onFixDisplay: () => Promise<void>;
  onFixTimeData: () => Promise<void>;
  isLoading: boolean;
  canFix: boolean;
}

export function ScheduleFixActions({
  onFixDisplay,
  onFixTimeData,
  isLoading,
  canFix,
}: ScheduleFixActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-1"
          disabled={isLoading || !canFix}
        >
          <Wrench className="h-4 w-4" />
          <span>Reparieren</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onFixDisplay()} disabled={isLoading}>
          <span>Anzeigeprobleme beheben</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onFixTimeData()} disabled={isLoading}>
          <span>Zeitdaten reparieren</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
