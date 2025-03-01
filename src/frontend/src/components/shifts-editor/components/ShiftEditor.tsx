import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Settings } from '@/types';
import { Shift } from '@/services/api';
import { ShiftCoverageView } from './ShiftCoverageView';
import { ShiftForm } from './ShiftForm';
import { ShiftEditorProps } from '../types';

export const ShiftEditor: React.FC<ShiftEditorProps> = ({
    shifts,
    settings,
    onAddShift,
    onUpdateShift,
    onDeleteShift,
    onEmployeeCountChange
}) => {
    const [activeTab, setActiveTab] = useState<string>('coverage');

    return (
        <div className="space-y-6">
            <Tabs defaultValue="coverage" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="coverage">Coverage View</TabsTrigger>
                    <TabsTrigger value="list">Shift List</TabsTrigger>
                </TabsList>

                <TabsContent value="coverage">
                    <Card>
                        <CardHeader>
                            <CardTitle>Shift Coverage</CardTitle>
                            <CardDescription>
                                Visualize how shifts cover your store hours
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ShiftCoverageView
                                settings={settings}
                                shifts={shifts}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="list">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle>Shift List</CardTitle>
                                <CardDescription>
                                    Manage your shifts
                                </CardDescription>
                            </div>
                            {onAddShift && (
                                <Button onClick={onAddShift} size="sm">
                                    <Plus className="mr-2 h-4 w-4" /> Add Shift
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {shifts.map(shift => (
                                    <ShiftForm
                                        key={shift.id}
                                        settings={settings}
                                        shift={shift}
                                        onSave={(data) => onUpdateShift && onUpdateShift({
                                            ...shift,
                                            ...data,
                                            duration_hours: calculateDuration(data.start_time, data.end_time)
                                        })}
                                        onDelete={onDeleteShift ? () => onDeleteShift(shift.id) : undefined}
                                    />
                                ))}
                                {shifts.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No shifts defined. Click "Add Shift" to create one.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

// Helper function to calculate duration in hours
const calculateDuration = (start_time: string, end_time: string): number => {
    const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const startMinutes = timeToMinutes(start_time);
    const endMinutes = timeToMinutes(end_time);
    let duration = endMinutes - startMinutes;
    if (duration < 0) duration += 24 * 60; // Handle overnight shifts
    return duration / 60;
}; 