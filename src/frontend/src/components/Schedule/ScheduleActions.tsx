import React from 'react';
import { Button } from '@/components/ui/button';
import { CalendarPlus, Trash2, AlertCircle } from 'lucide-react';
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
    isLoading?: boolean;
    canAdd?: boolean;
    canDelete?: boolean;
}

export function ScheduleActions({
    onAddSchedule,
    onDeleteSchedule,
    isLoading = false,
    canAdd = true,
    canDelete = true
}: ScheduleActionsProps) {
    return (
        <div className="flex items-center gap-2">
            {canAdd && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddSchedule}
                    disabled={isLoading}
                    title="Neuen Schichtplan hinzufügen"
                >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Eintrag hinzufügen
                </Button>
            )}

            {canDelete && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            title="Aktuellen Schichtplan löschen"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Alle löschen
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Schichtplan löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Diese Aktion löscht den aktuellen Schichtplan und alle darin enthaltenen Schichten.
                                Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={onDeleteSchedule}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Löschen
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
} 