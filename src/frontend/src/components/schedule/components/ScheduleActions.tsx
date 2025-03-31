import React from 'react';
import { Button } from '@/components/ui/button';
import { CalendarPlus, Trash2, AlertCircle, Table2, LayoutGrid, Calendar, User, Clock, LineChart } from 'lucide-react';
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
import { ScheduleViewType } from '@/components/schedule/core/ScheduleDisplay';

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
    activeView = 'table',
    onViewChange
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
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isLoading}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Schicht löschen
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Schicht löschen</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Möchten Sie diese Schicht wirklich löschen? Dies kann nicht rückgängig gemacht werden.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={onDeleteSchedule}>Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
            
            {/* View Selector */}
            {onViewChange && (
                <Tabs value={activeView} onValueChange={onViewChange as any} className="w-auto">
                    <TabsList>
                        <TabsTrigger value="table" className="flex items-center gap-1">
                            <Table2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Tabelle</span>
                        </TabsTrigger>
                        <TabsTrigger value="grid" className="flex items-center gap-1">
                            <LayoutGrid className="h-4 w-4" />
                            <span className="hidden sm:inline">Zeitraster</span>
                        </TabsTrigger>
                        <TabsTrigger value="coverage" className="flex items-center gap-1">
                            <LineChart className="h-4 w-4" />
                            <span className="hidden sm:inline">Abdeckung</span>
                        </TabsTrigger>
                        <TabsTrigger value="monthly" className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span className="hidden sm:inline">Monat</span>
                        </TabsTrigger>
                        <TabsTrigger value="daily" className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span className="hidden sm:inline">Tag</span>
                        </TabsTrigger>
                        <TabsTrigger value="employee" className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span className="hidden sm:inline">Mitarbeiter</span>
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span className="hidden sm:inline">Kalender</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            )}
        </div>
    );
} 