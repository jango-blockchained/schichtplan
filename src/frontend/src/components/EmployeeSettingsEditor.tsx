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
import { Trash2, Plus, Pencil } from "lucide-react";
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

export type { EmployeeType, AbsenceType };
export type GroupType = EmployeeType | AbsenceType;

// Define Zod schemas for validation
const EmployeeTypeSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  min_hours: z.number().min(0, "Min hours cannot be negative"),
  max_hours: z
    .number()
    .min(0, "Max hours cannot be negative")
    .refine((max, data) => max >= data.min_hours, {
      message: "Max hours cannot be less than min hours",
      path: ["max_hours"], // Associate error with max_hours field
    }),
  type: z.literal("employee_type"), // Ensure type is correct
});

const AbsenceTypeSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  color: z.string().min(4, "Color is required"), // Basic color validation (e.g., #000)
  type: z.literal("absence_type"), // Ensure type is correct
});

// Union type for validation schema based on editor type
const GroupTypeSchema = z.discriminatedUnion("type", [
  EmployeeTypeSchema,
  AbsenceTypeSchema,
]);

interface EmployeeSettingsEditorProps {
  type: "employee" | "absence";
  groups: GroupType[];
  onChange: (groups: GroupType[]) => void;
}

export default function EmployeeSettingsEditor({
  groups,
  onChange,
  type,
}: EmployeeSettingsEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupType | null>(null);
  // Remove manual error state
  // const [error, setError] = useState<string | null>(null);
  const [localGroups, setLocalGroups] = useState<GroupType[]>(groups);

  // Initialize react-hook-form
  const form = useForm<GroupType>({
    // Use resolver to integrate Zod with react-hook-form
    resolver: zodResolver(GroupTypeSchema),
    // Set default values when editingGroup changes
    values: editingGroup || undefined, // Use values for controlled form
  });

  // Watch for changes in groups prop and update localGroups
  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  // Debounced update function (keep for now, might refactor later)
  const debouncedOnChange = useDebouncedCallback(
    (updatedGroups: GroupType[]) => {
      onChange(updatedGroups);
    },
    1000, // 1 second delay
  );

  function getDefaultGroup(): GroupType {
    switch (type) {
      case "employee":
        return {
          id: "",
          name: "",
          min_hours: 0,
          max_hours: 40,
          type: "employee_type",
        } as EmployeeType;
      case "absence":
        return {
          id: "",
          name: "",
          color: "#FF9800",
          type: "absence_type",
        } as AbsenceType;
    }
  }

  const handleOpenModal = (group?: GroupType) => {
    const groupToEdit = group ? { ...group } : getDefaultGroup();
    setEditingGroup(groupToEdit);
    // Reset the form with the values of the group being edited or default values
    form.reset(groupToEdit);
    setIsModalOpen(true);
    // Remove manual error state setting
    // setError(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGroup(null);
    // Reset form and clear errors on close
    form.reset();
    // Remove manual error state clearing
    // setError(null);
  };

  // Update handleSaveGroup to use react-hook-form's handleSubmit
  const handleSaveGroup = (formData: GroupType) => {
    // react-hook-form has already validated the data based on the schema
    // Check for unique ID manually as it depends on existing groups
    const existingIndex = localGroups.findIndex(
      (g) => g.id === formData.id,
    );

    // If editing an existing group, allow saving with the same ID
    if (editingGroup && editingGroup.id !== formData.id && existingIndex >= 0) {
       // Check if the new ID conflicts with another *existing* group
       // If editingGroup is null (adding), any ID conflict is an error
       form.setError("id", { type: "manual", message: "Group ID must be unique" });
       return;
    } else if (!editingGroup && existingIndex >= 0) {
        // If adding a new group and ID conflicts with an existing group
        form.setError("id", { type: "manual", message: "Group ID must be unique" });
        return;
    }

    let updatedGroups: GroupType[];

    if (existingIndex >= 0 && editingGroup?.id === formData.id) {
      // Update existing group
      updatedGroups = [...localGroups];
      updatedGroups[existingIndex] = formData; // Use validated form data
    } else {
      // Add new group
      updatedGroups = [...localGroups, formData]; // Use validated form data
    }

    setLocalGroups(updatedGroups);
    debouncedOnChange(updatedGroups); // Use debouncedOnChange
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
        <Button onClick={() => handleOpenModal()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
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
                {/* ID Field */}
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Name Field */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Conditional Fields for Employee Type */}
              {type === "employee" && (
                 <div className="grid grid-cols-2 gap-4">
                   {/* Min Hours Field */}
                   <FormField
                     control={form.control}
                     name="min_hours"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Min Hours</FormLabel>
                         <FormControl>
                           <Input
                             type="number"
                             {...field}
                             onChange={(e) => field.onChange(Number(e.target.value))}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />

                   {/* Max Hours Field */}
                   <FormField
                     control={form.control}
                     name="max_hours"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Max Hours</FormLabel>
                         <FormControl>
                           <Input
                             type="number"
                             {...field}
                             onChange={(e) => field.onChange(Number(e.target.value))}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </div>
              )}

              {/* Conditional Field for Absence Type */}
              {type === "absence" && (
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                         {/* ColorPicker needs to be integrated with react-hook-form manually if it's not a standard input */}
                         {/* For now, using a basic Input for demonstration */} {/* TODO: Integrate ColorPicker properly */}
                         <Input {...field} value={field.value || ''} onChange={field.onChange} />
                         {/* <ColorPicker value={field.value} onChange={field.onChange} label={form.watch('name') || field.value} /> */}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Dialog Footer Buttons within the form */} {/* Moved footer inside form */}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingGroup?.id ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
