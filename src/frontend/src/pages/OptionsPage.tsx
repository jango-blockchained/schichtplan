import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getSettings, updateSettings } from "@/services/api";
import {
  EmployeeSettingsEditor,
  EmployeeType,
  AbsenceType,
} from "@/components/employees";
import {
  ShiftTypesEditor,
  ShiftType as ShiftTypeOption,
} from "@/components/shift-templates";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import type { Settings, AvailabilityTypeSetting, EmployeeTypeSetting, AbsenceTypeSetting, ShiftTypeSetting } from "@/types/index";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

type AvailabilityType = {
  code: string;
  name: string;
  color: string;
  description: string;
  type: "AVL" | "FIX" | "PRF" | "UNV";
  priority?: number;
};

const defaultAvailabilityTypes: AvailabilityType[] = [
  {
    code: "FIX",
    name: "Fixed",
    color: "#3b82f6",
    description: "Fixed schedule",
    type: "FIX",
  },
  {
    code: "AVL",
    name: "Available",
    color: "#22c55e",
    description: "Available for scheduling",
    type: "AVL",
  },
  {
    code: "PRF",
    name: "Preferred",
    color: "#f59e0b",
    description: "Preferred hours",
    type: "PRF",
  },
  {
    code: "UNV",
    name: "Unavailable",
    color: "#ef4444",
    description: "Not available",
    type: "UNV",
  },
];

export default function OptionsPage() {
  const [availabilityTypes, setAvailabilityTypes] = useState<
    AvailabilityType[]
  >(defaultAvailabilityTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AvailabilityType | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  // Initialize availability types from settings
  useEffect(() => {
    if (settings?.availability_types) {
      const types = settings.availability_types.map((type: AvailabilityTypeSetting) => ({
        code: type.id,
        name: type.name,
        description: type.description,
        color: type.color,
        type: type.is_available
          ? type.priority === 1
            ? ("FIX" as const)
            : type.priority === 2
              ? ("AVL" as const)
              : type.priority === 3
                ? ("PRF" as const)
                : ("UNV" as const)
          : ("UNV" as const),
        priority: type.priority
      }));
      setAvailabilityTypes(types);
    }
  }, [settings]);

  // Ensure shift_types exists in settings
  const shiftTypes = settings?.shift_types ?? [
    { id: "EARLY", name: "Frühschicht", color: "#4CAF50", type: "shift" },
    { id: "MIDDLE", name: "Mittelschicht", color: "#2196F3", type: "shift" },
    { id: "LATE", name: "Spätschicht", color: "#9C27B0", type: "shift" },
  ];

  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        description: "Settings updated successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Failed to update settings.",
      });
    },
  });

  const handleOpenModal = (type: AvailabilityType) => {
    setEditingType({ ...type });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
  };

  const handleSaveAvailabilityType = async () => {
    if (!editingType || !settings) return;

    try {
      const updatedTypes = availabilityTypes.map((type) =>
        type.code === editingType.code
          ? { ...type, color: editingType.color }
          : type,
      );
      setAvailabilityTypes(updatedTypes);

      const formattedTypes: AvailabilityTypeSetting[] = updatedTypes.map((type) => ({
        id: type.code,
        name: type.name,
        description: type.description,
        color: type.color,
        priority: 
          type.type === "FIX" ? 1 :
          type.type === "AVL" ? 2 :
          type.type === "PRF" ? 3 : 4,
        is_available: type.type !== "UNV",
        type: "availability"
      }));

      const updatedSettings: Partial<Settings> = {
        availability_types: formattedTypes,
      };
      updateMutation.mutate(updatedSettings);
      handleCloseModal();
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to update color.",
      });
    }
  };

  const handleEmployeeTypesChange = (employeeTypes: EmployeeTypeSetting[]) => {
    if (!settings) return;
    const updatedSettings: Partial<Settings> = {
        employee_types: employeeTypes,
    };
    updateMutation.mutate(updatedSettings);
  };

  const handleAbsenceTypesChange = (absenceTypes: AbsenceTypeSetting[]) => {
    if (!settings) return;
    const updatedSettings: Partial<Settings> = {
        absence_types: absenceTypes,
    };
    updateMutation.mutate(updatedSettings);
  };

  const handleShiftTypesChange = (shiftTypes: ShiftTypeSetting[]) => {
    if (!settings) return;
    const updatedSettings: Partial<Settings> = {
      shift_types: shiftTypes,
    };
    updateMutation.mutate(updatedSettings);
  };

  if (isLoading || !settings) {
    return (
      <div className="container mx-auto py-6 space-y-8">
        <PageHeader title="Options" description="Configure application options" />
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Prepare data for child components
  const employeeTypesForEditor = (settings?.employee_types ?? []).map(et => ({ 
      ...et, 
      min_hours: et.min_hours ?? 0, 
      max_hours: et.max_hours ?? 0, 
      type: 'employee' as const
  }));
  
  const absenceTypesForEditor = (settings?.absence_types ?? []).map(at => ({ 
      ...at, 
      type: 'absence' as const
  }));
  
  const shiftTypesForEditor = settings?.shift_types ?? [];

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader title="Options" description="Configure application options" />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Availability Types</TabsTrigger>
          <TabsTrigger value="employees">Employee & Absence Types</TabsTrigger>
          <TabsTrigger value="shifts">Shift Types</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Availability Types</CardTitle>
              <CardDescription>
                Configure availability status types and their colors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Description
                    </TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availabilityTypes.map((type) => (
                    <TableRow key={type.code}>
                      <TableCell className="font-medium">{type.code}</TableCell>
                      <TableCell>{type.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: type.color }}
                          />
                          {type.color}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {type.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModal(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Color for {editingType?.name}</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <ColorPicker
                        id={`availability-color-${editingType?.code}`}
                        color={editingType?.color ?? "#000000"}
                        onChange={(color) =>
                          setEditingType((prev) =>
                            prev ? { ...prev, color } : null,
                          )
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseModal}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveAvailabilityType}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Employee Types</CardTitle>
              <CardDescription>
                Manage employee types and their working hour limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmployeeSettingsEditor 
                 type="employee"
                 groups={employeeTypesForEditor}
                 onChange={(updatedGroups: EmployeeType[]) => {
                    const updatedEmployeeTypes = updatedGroups
                       .map(({ type, ...rest }) => ({ ...rest } as EmployeeTypeSetting)); 
                    handleEmployeeTypesChange(updatedEmployeeTypes);
                 }}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Absence Types</CardTitle>
              <CardDescription>
                 Manage absence types and their color coding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmployeeSettingsEditor 
                 type="absence"
                 groups={absenceTypesForEditor}
                 onChange={(updatedGroups: AbsenceType[]) => {
                    const updatedAbsenceTypes = updatedGroups
                       .map(({ type, ...rest }) => ({ ...rest } as AbsenceTypeSetting));
                    handleAbsenceTypesChange(updatedAbsenceTypes);
                 }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
           <Card>
             <CardHeader><CardTitle>Shift Types</CardTitle></CardHeader>
             <CardContent>
               <ShiftTypesEditor
                 shifts={shiftTypesForEditor as ShiftTypeSetting[]} 
                 onChange={(updatedShifts: ShiftTypeOption[]) => { 
                    const settingsShifts: ShiftTypeSetting[] = updatedShifts.map(s => ({ 
                       ...s, 
                       type: 'shift' 
                    }));
                    handleShiftTypesChange(settingsShifts);
                 }}
               />
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
