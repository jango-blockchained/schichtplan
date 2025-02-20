import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { AbsenceType } from '@/types';

interface Absence {
    id: number;
    employee_id: number;
    absence_type_id: string;
    start_date: string;
    end_date: string;
    note?: string;
}

interface AbsenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeId: number;
    absenceTypes: AbsenceType[];
}

export default function AbsenceModal({ isOpen, onClose, employeeId, absenceTypes }: AbsenceModalProps) {
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [newAbsence, setNewAbsence] = useState<Omit<Absence, 'id'>>({
        employee_id: employeeId,
        absence_type_id: '',
        start_date: '',
        end_date: '',
        note: ''
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadAbsences();
        }
    }, [isOpen, employeeId]);

    const loadAbsences = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/employees/${employeeId}/absences`);
            if (!response.ok) throw new Error('Failed to load absences');
            const data = await response.json();
            setAbsences(data);
        } catch (error) {
            console.error('Error loading absences:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddAbsence = async () => {
        try {
            const response = await fetch(`/api/employees/${employeeId}/absences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newAbsence),
            });

            if (!response.ok) throw new Error('Failed to add absence');

            const addedAbsence = await response.json();
            setAbsences([...absences, addedAbsence]);

            // Reset form
            setNewAbsence({
                employee_id: employeeId,
                absence_type_id: '',
                start_date: '',
                end_date: '',
                note: ''
            });
        } catch (error) {
            console.error('Error adding absence:', error);
        }
    };

    const handleDeleteAbsence = async (absenceId: number) => {
        try {
            const response = await fetch(`/api/employees/${employeeId}/absences/${absenceId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete absence');

            setAbsences(absences.filter(absence => absence.id !== absenceId));
        } catch (error) {
            console.error('Error deleting absence:', error);
        }
    };

    const getAbsenceTypeName = (typeId: string) => {
        return absenceTypes.find(type => type.id === typeId)?.name || typeId;
    };

    const getAbsenceTypeColor = (typeId: string) => {
        return absenceTypes.find(type => type.id === typeId)?.color || '#808080';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Manage Absences</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Add new absence form */}
                    <div className="grid grid-cols-5 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={newAbsence.absence_type_id}
                                onValueChange={(value) => setNewAbsence({
                                    ...newAbsence,
                                    absence_type_id: value
                                })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {absenceTypes.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            <div className="flex items-center space-x-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: type.color }}
                                                />
                                                <span>{type.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                                type="date"
                                value={newAbsence.start_date}
                                onChange={(e) => setNewAbsence({
                                    ...newAbsence,
                                    start_date: e.target.value
                                })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input
                                type="date"
                                value={newAbsence.end_date}
                                onChange={(e) => setNewAbsence({
                                    ...newAbsence,
                                    end_date: e.target.value
                                })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Note</Label>
                            <Input
                                type="text"
                                value={newAbsence.note || ''}
                                onChange={(e) => setNewAbsence({
                                    ...newAbsence,
                                    note: e.target.value
                                })}
                                placeholder="Optional note"
                            />
                        </div>

                        <Button
                            onClick={handleAddAbsence}
                            disabled={!newAbsence.absence_type_id || !newAbsence.start_date || !newAbsence.end_date}
                        >
                            Add Absence
                        </Button>
                    </div>

                    {/* Absences table */}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead>Note</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {absences.map((absence) => (
                                <TableRow key={absence.id}>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: getAbsenceTypeColor(absence.absence_type_id) }}
                                            />
                                            <span>{getAbsenceTypeName(absence.absence_type_id)}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {format(parseISO(absence.start_date), 'P', { locale: de })}
                                    </TableCell>
                                    <TableCell>
                                        {format(parseISO(absence.end_date), 'P', { locale: de })}
                                    </TableCell>
                                    <TableCell>{absence.note}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteAbsence(absence.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
} 