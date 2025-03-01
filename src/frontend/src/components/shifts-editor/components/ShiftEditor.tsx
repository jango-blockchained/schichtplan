import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Shift, Settings } from '@/types';
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
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Shift Management</h2>
                <Button onClick={onAddShift}>
                    <Plus className="mr-2 h-4 w-4" /> Add Shift
                </Button>
            </div>

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
                        <CardHeader>
                            <CardTitle>Shift List</CardTitle>
                            <CardDescription>
                                Manage your shifts
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {shifts.map(shift => (
                                    <ShiftForm
                                        key={shift.id}
                                        shift={shift}
                                        onSave={onUpdateShift}
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