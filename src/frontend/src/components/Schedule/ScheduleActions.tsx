import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { CalendarPlus, Trash2, AlertCircle, Play, Settings, Plus, Wrench, Clock, Loader2, Sparkles } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';


interface ScheduleActionsProps {
    onAddSchedule: () => void;
    onDeleteSchedule: () => void;
    onGenerateStandardSchedule: () => void;
    onGenerateAiSchedule: () => void;
    onOpenGenerationSettings: () => void;
    onFixDisplay: () => void;
    onFixTimeData: () => void;
    isLoading: boolean;
    isGenerating: boolean;
    canAdd: boolean;
    canDelete: boolean;
    canGenerate: boolean;
    canFix: boolean;

}

export function ScheduleActions({
    onAddSchedule,
    onDeleteSchedule,
    onGenerateStandardSchedule,
    onGenerateAiSchedule,
    onOpenGenerationSettings,
    onFixDisplay,
    onFixTimeData,
    isLoading,
    isGenerating,
    canAdd,
    canDelete,
    canGenerate,
    canFix
}: ScheduleActionsProps) {
    const [isFixingDisplay, setIsFixingDisplay] = useState(false);
    const [isFixingTimeData, setIsFixingTimeData] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Handle fixing display with loading state
    const handleFixDisplay = async () => {
        setIsFixingDisplay(true);
        try {
            await onFixDisplay();
        } finally {
            // Set timeout to show the loading state for at least a bit
            setTimeout(() => setIsFixingDisplay(false), 500);
        }
    };
    
    // Handle fixing time data with loading state
    const handleFixTimeData = async () => {
        setIsFixingTimeData(true);
        try {
            await onFixTimeData();
        } finally {
            // Set timeout to show the loading state for at least a bit
            setTimeout(() => setIsFixingTimeData(false), 500);
        }
    };
    
    // Handle delete with loading state
    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onDeleteSchedule();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex space-x-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-1" disabled={isLoading || !canAdd}>
                        <Plus className="h-4 w-4" />
                        <span>Hinzufügen</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={onAddSchedule}>
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        <span>Neue Schicht</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-1" disabled={isLoading || !canGenerate || isGenerating}>
                        <Play className="h-4 w-4" />
                        <span>Generieren</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={onGenerateStandardSchedule} disabled={isGenerating}>
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Play className="h-4 w-4 mr-2" />
                        )}
                        <span>Standard-Generierung</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onGenerateAiSchedule} disabled={isGenerating}>
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        <span>KI-Generierung</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onOpenGenerationSettings}>
                        <Settings className="h-4 w-4 mr-2" />
                        <span>Generierungseinstellungen</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-1" disabled={isLoading || !canFix}>
                        <Wrench className="h-4 w-4" />
                        <span>Reparieren</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleFixDisplay} disabled={isFixingDisplay || isLoading}>
                        {isFixingDisplay ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <AlertCircle className="h-4 w-4 mr-2" />
                        )}
                        <span>Display Probleme beheben</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleFixTimeData} disabled={isFixingTimeData || isLoading}>
                        {isFixingTimeData ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Clock className="h-4 w-4 mr-2" />
                        )}
                        <span>Schichtzeiten reparieren</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-1" disabled={isLoading || !canDelete || isDeleting}>
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                        <span>Löschen</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Schichtplan löschen</AlertDialogTitle>
                        <AlertDialogDescription>
                            Möchten Sie wirklich alle Schichtpläne der aktuellen Version löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


        </div>
    );
} 