import React from 'react';
import { Button } from '@/components/ui/button';
import { CalendarPlus, Trash2, AlertCircle, Table2, LayoutGrid, Play, Settings, Plus, Separator, Wrench } from 'lucide-react';
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
    onFixDisplay?: () => void;
    isLoading?: boolean;
    isGenerating?: boolean;
    canAdd?: boolean;
    canDelete?: boolean;
    canGenerate?: boolean;
    canFix?: boolean;
    activeView?: 'table' | 'grid';
    onViewChange?: (view: 'table' | 'grid') => void;
}

export function ScheduleActions({
    onAddSchedule,
    onDeleteSchedule,
    onGenerateSchedule,
    onOpenGenerationSettings,
    onFixDisplay,
    isLoading = false,
    isGenerating = false,
    canAdd = true,
    canDelete = true,
    canGenerate = true,
    canFix = true,
    activeView = 'table',
    onViewChange
}: ScheduleActionsProps) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Add Schedule Button */}
            <Button
                onClick={onAddSchedule}
                variant="outline"
                className="flex items-center gap-2"
                disabled={!canAdd || isLoading}
            >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Hinzufügen</span>
            </Button>

            {/* Delete Schedule Button */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        disabled={!canDelete || isLoading}
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Löschen</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Dienstplan löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Möchten Sie wirklich alle Dienstpläne für diesen Zeitraum löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={onDeleteSchedule}>Löschen</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <UISeparator orientation="vertical" className="h-8" />

            {/* Fix Display Button */}
            {onFixDisplay && (
                <Button
                    onClick={onFixDisplay}
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={!canFix || isLoading}
                >
                    <Wrench className="h-4 w-4" />
                    <span className="hidden sm:inline">Fix Display</span>
                </Button>
            )}

            {/* Generate Schedule Button */}
            {onGenerateSchedule && (
                <Button
                    onClick={onGenerateSchedule}
                    variant="default"
                    className="flex items-center gap-2"
                    disabled={!canGenerate || isGenerating || isLoading}
                >
                    <Play className="h-4 w-4" />
                    <span>{isGenerating ? "Generieren..." : "Generieren"}</span>
                </Button>
            )}

            {/* Generation Settings Button */}
            {onOpenGenerationSettings && (
                <Button
                    onClick={onOpenGenerationSettings}
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={isLoading}
                >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Einstellungen</span>
                </Button>
            )}

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