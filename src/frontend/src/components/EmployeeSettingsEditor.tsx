import React, { useState, useCallback, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Alert, AlertDescription } from "./ui/alert";
import { Trash2, Plus, Pencil, Loader2 } from "lucide-react";
import ColorPicker from "./ColorPicker";
import { EmployeeType, AbsenceType } from "@/types";
import { useDebouncedCallback } from "use-debounce";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

// Import react-hook-form and Shadcn Form components
import { useForm } from "react-hook-form";
import { z } from "zod"; // Using zod for schema validation
import { zodResolver } from "@hookform/resolvers/zod"; // Resolver for zod
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export type GroupType = EmployeeType | AbsenceType;

// Define Zod schemas for validation
const EmployeeTypeSchemaRaw = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  min_hours: z.number().min(0, "Min hours cannot be negative"),
  max_hours: z.number().min(0, "Max hours cannot be negative"),
  type: z.literal("employee_type" as const),
});

const AbsenceTypeSchemaRaw = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  color: z.string().min(4, "Color is required"), 
  type: z.literal("absence_type" as const),
});

const GroupTypeSchema = z.discriminatedUnion("type", [
  EmployeeTypeSchemaRaw,
  AbsenceTypeSchemaRaw,
]).superRefine((data, ctx) => {
  if (data.type === "employee_type") {
    // data is now inferred as the EmployeeType part of the union
    if (typeof data.max_hours === 'number' && typeof data.min_hours === 'number') {
      if (data.max_hours < data.min_hours) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Max hours cannot be less than min hours",
          path: ["max_hours"], 
        });
      }
    }
  }
});

// Infer type from Zod schema for react-hook-form
type InferredGroupType = z.infer<typeof GroupTypeSchema>;

interface EmployeeSettingsEditorProps {
  type: "employee" | "absence";
  groups: GroupType[]; 
  onChange: (groups: GroupType[]) => void;
  isLoading?: boolean;
}

export default function EmployeeSettingsEditor({
  groups, 
  onChange,
  type,
  isLoading,
}: EmployeeSettingsEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupType | null>(null); 
  const [localGroups, setLocalGroups] = useState<GroupType[]>(groups);

  const getTypedDefaultGroup = useCallback((): InferredGroupType => {
    if (type === "employee") {
      return {
        id: "", name: "", min_hours: 0, max_hours: 40, type: "employee_type",
      } as Extract<InferredGroupType, { type: "employee_type" }>;
    } else { // type === "absence"
      return {
        id: "", name: "", color: "#FF9800", type: "absence_type",
      } as Extract<InferredGroupType, { type: "absence_type" }>;
    }
  }, [type]);

  const form = useForm<InferredGroupType>({
    resolver: zodResolver(GroupTypeSchema),
    defaultValues: getTypedDefaultGroup(),
  });

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  useEffect(() => {
    if (isModalOpen) {
      form.reset(editingGroup ? (editingGroup as InferredGroupType) : getTypedDefaultGroup());
    }
  }, [isModalOpen, editingGroup, form, getTypedDefaultGroup]);

  const debouncedOnChange = useDebouncedCallback(
    (updatedGroups: GroupType[]) => {
      onChange(updatedGroups);
    },
    1000,
  );

  const handleOpenModal = (group?: GroupType) => {
    setEditingGroup(group || null); 
    setIsModalOpen(true); // This will trigger the useEffect to reset the form
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGroup(null); 
    // Form will be reset by useEffect when isModalOpen changes or editingGroup becomes null
    // However, explicitly resetting to default on close might be cleaner if needed.
    form.reset(getTypedDefaultGroup());
    form.clearErrors(); 
  };

  const handleSaveGroup = (formData: InferredGroupType) => {
    const groupToSave = formData as GroupType; // Cast to imported GroupType for external state/prop

    const existingGroupInLocalById = localGroups.find(g => g.id === groupToSave.id);

    if (editingGroup && editingGroup.id !== groupToSave.id && existingGroupInLocalById) {
      form.setError("id", { type: "manual", message: "This ID is already in use by another group." });
      return;
    } else if (!editingGroup && existingGroupInLocalById) {
      form.setError("id", { type: "manual", message: "Group ID must be unique." });
      return;
    }

    let updatedGroups: GroupType[];
    // If editing, find by original ID (editingGroup.id) and replace with groupToSave (which might have a new ID)
    if (editingGroup && localGroups.some(g => g.id === editingGroup.id)) {
      updatedGroups = localGroups.map(g => g.id === editingGroup.id ? groupToSave : g);
    } else {
      // Adding new or handling case where original editingGroup ID wasn't found (should not happen if logic is correct)
      updatedGroups = [...localGroups, groupToSave];
    }
    setLocalGroups(updatedGroups);
    debouncedOnChange(updatedGroups);
    handleCloseModal();
  };

  const handleDeleteGroup = (groupId: string) => {
    const updatedGroups = localGroups.filter((g) => g.id !== groupId);
    setLocalGroups(updatedGroups);
    debouncedOnChange(updatedGroups); // Use debouncedOnChange
  };

  // Remove renderModalContent function as form fields will be rendered directly within the DialogContent

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {type === "employee" ? "Employee Types" : "Absence Types"}
        </h3>
        <Button onClick={() => handleOpenModal()} size="sm" disabled={isLoading}> {/* Disable if loading */}
          {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Add {type === "employee" ? "Employee Type" : "Absence Type"}
        </Button>
      </div>

      <Table>
        <caption className="sr-only">
          {type === "employee" ? "Table of Employee Types" : "Table of Absence Types"}
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            {type === "employee" && (
              <>
                <TableHead>Min Hours</TableHead>
                <TableHead>Max Hours</TableHead>
              </>
            )}
            {type === "absence" && <TableHead>Color</TableHead>}
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {localGroups.map((group) => (
            <TableRow key={group.id}>
              <TableCell>{group.id}</TableCell>
              <TableCell>{group.name}</TableCell>
              {type === "employee" && "min_hours" in group && (
                <>
                  <TableCell>{group.min_hours}</TableCell>
                  <TableCell>{group.max_hours}</TableCell>
                </>
              )}
              {type === "absence" && "color" in group && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.color}
                  </div>
                </TableCell>
              )}
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenModal(group)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}> {/* Use handleCloseModal for onOpenChange */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup?.id ? "Edit" : "Add"}{" "}
              {type === "employee" ? "Employee Type" : "Absence Type"}
            </DialogTitle>
          </DialogHeader>

          {/* Remove manual error display */}
          {/* {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )} */}

          {/* Use react-hook-form's Form component */}
          <Form {...form}>
            {/* Handle form submission with react-hook-form's handleSubmit */}
            <form onSubmit={form.handleSubmit(handleSaveGroup)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("type") === "employee_type" && (
                 <div className="grid grid-cols-2 gap-4">
                   <FormField
                     control={form.control}
                     name={"min_hours"} // Name is string literal
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Min Hours</FormLabel>
                         <FormControl>
                           <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                   <FormField
                     control={form.control}
                     name={"max_hours"} // Name is string literal
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Max Hours</FormLabel>
                         <FormControl>
                           <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </div>
              )}

              {form.watch("type") === "absence_type" && (
                <FormField
                  control={form.control}
                  name={"color"} // Name is string literal
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                         <ColorPicker color={(field.value as string) || ''} onChange={field.onChange} label={form.watch('name') || 'Selected Color'} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isLoading}> {/* Disable if loading */}
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}> {/* Disable if loading */}
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingGroup?.id ? "Save" : "Create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
