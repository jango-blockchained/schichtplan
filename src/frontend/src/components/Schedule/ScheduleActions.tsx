import React from 'react';
import { Button } from '@/components/ui/button';
import { CalendarPlus, Trash2, AlertCircle, Table2, LayoutGrid, Play, Settings, Plus, Separator } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator as UISeparator } from '@/components/ui/separator';

interface ScheduleActionsProps {
    onAddSchedule: () => void;
    onDeleteSchedule: () => void;
    onGenerateSchedule?: () => void;
    onOpenGenerationSettings?: () => void;
    isLoading?: boolean;
    isGenerating?: boolean;
    canAdd?: boolean;
    canDelete?: boolean;
    canGenerate?: boolean;
    activeView?: 'table' | 'grid';
    onViewChange?: (view: 'table' | 'grid') => void;
}

export function ScheduleActions({
    onAddSchedule,
    onDeleteSchedule,
    onGenerateSchedule,
    onOpenGenerationSettings,
    isLoading = false,
    isGenerating = false,
    canAdd = true,
    canDelete = true,
    canGenerate = true,
    activeView = 'table',
    onViewChange
}: ScheduleActionsProps) {
    return (
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
                {/* Generation Buttons */}
                {canGenerate && onGenerateSchedule && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onGenerateSchedule}
                        disabled={isLoading || isGenerating}
                        title="Dienstplan generieren"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Generieren
                    </Button>
                )}

                {onOpenGenerationSettings && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenGenerationSettings}
                        disabled={isLoading}
                        title="Generierungseinstellungen anpassen"
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Einstellungen
                    </Button>
                )}

                {/* Divider */}
                {(canGenerate || onOpenGenerationSettings) && (
                    <UISeparator orientation="vertical" className="h-8" />
                )}

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
                                    <br /><br />
                                    <span className="font-semibold text-destructive">
                                        Diese Aktion kann nicht rückgängig gemacht werden!
                                    </span>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={onDeleteSchedule}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Endgültig löschen
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

            {/* View Selector */}
            {onViewChange && (
                <Tabs value={activeView} onValueChange={onViewChange as any} className="w-auto">
                    <TabsList className="grid w-[200px] grid-cols-2">
                        <TabsTrigger value="table" className="flex items-center gap-2">
                            <Table2 className="h-4 w-4" />
                            <span>Tabelle</span>
                        </TabsTrigger>
                        <TabsTrigger value="grid" className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            <span>Zeitraster</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            )}
        </div>
    );
} 