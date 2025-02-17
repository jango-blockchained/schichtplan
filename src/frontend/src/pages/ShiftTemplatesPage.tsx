import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { ShiftTemplate, ShiftType } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface ShiftTemplatesPageProps { }

const ShiftTemplatesPage: React.FC<ShiftTemplatesPageProps> = () => {
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchTemplates();
        fetchShiftTypes();
    }, []);

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/shift-templates');
            const data = await response.json();
            setTemplates(data);
            setLoading(false);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error loading templates"
            });
        }
    };

    const fetchShiftTypes = async () => {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            setShiftTypes(data.shift_types.shift_types || []);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error loading shift types"
            });
        }
    };

    const handleAddTemplate = () => {
        setEditingTemplate(null);
        setEditDialogOpen(true);
    };

    const handleEditTemplate = (template: ShiftTemplate) => {
        setEditingTemplate(template);
        setEditDialogOpen(true);
    };

    const handleDeleteTemplate = async (templateId: string) => {
        try {
            const response = await fetch(`/api/shift-templates/${templateId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchTemplates();
                toast({
                    title: "Success",
                    description: "Template deleted successfully"
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error deleting template"
            });
        }
    };

    const handleSaveTemplate = async (formData: any) => {
        try {
            const method = editingTemplate ? 'PUT' : 'POST';
            const url = editingTemplate
                ? `/api/shift-templates/${editingTemplate.id}`
                : '/api/shift-templates';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                fetchTemplates();
                setEditDialogOpen(false);
                toast({
                    title: "Success",
                    description: `Template ${editingTemplate ? 'updated' : 'created'} successfully`
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error saving template"
            });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Shift Templates</h1>
                <Button onClick={handleAddTemplate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Template
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => {
                    const shiftType = shiftTypes.find((type) => type.id === template.shift_type_id);
                    return (
                        <Card key={template.id}>
                            <CardContent className="pt-6">
                                <h3 className="text-lg font-semibold mb-2">{template.name}</h3>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Type: {shiftType?.name || 'Unknown'}
                                </p>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Time: {template.start_time} - {template.end_time}
                                </p>
                                <Badge variant="secondary">
                                    Break: {template.break_duration} min
                                </Badge>
                            </CardContent>
                            <CardFooter className="flex justify-end space-x-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditTemplate(template)}>
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Edit Template' : 'Add Template'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        handleSaveTemplate({
                            name: formData.get('name'),
                            shift_type_id: formData.get('shift_type_id'),
                            start_time: formData.get('start_time'),
                            end_time: formData.get('end_time'),
                            break_duration: parseInt(formData.get('break_duration') as string, 10),
                        });
                    }}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label htmlFor="name" className="text-sm font-medium">Name</label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editingTemplate?.name || ''}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="shift_type_id" className="text-sm font-medium">Shift Type</label>
                                <Select name="shift_type_id" defaultValue={editingTemplate?.shift_type_id || ''} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {shiftTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="start_time" className="text-sm font-medium">Start Time</label>
                                <Input
                                    id="start_time"
                                    name="start_time"
                                    type="time"
                                    defaultValue={editingTemplate?.start_time || ''}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="end_time" className="text-sm font-medium">End Time</label>
                                <Input
                                    id="end_time"
                                    name="end_time"
                                    type="time"
                                    defaultValue={editingTemplate?.end_time || ''}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="break_duration" className="text-sm font-medium">Break Duration (minutes)</label>
                                <Input
                                    id="break_duration"
                                    name="break_duration"
                                    type="number"
                                    defaultValue={editingTemplate?.break_duration || 0}
                                    required
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingTemplate ? 'Save Changes' : 'Create Template'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ShiftTemplatesPage; 