import { AbsenceType, EmployeeType } from "@/types";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import ColorPicker from "./ColorPicker";
import { EnumDataTable } from "./EnumDataTable";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
// Re-export types so other modules can import Editor types from this component file
export type { AbsenceType, EmployeeType };

// Import react-hook-form and Shadcn Form components
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod"; // Resolver for zod
import { useForm } from "react-hook-form";
import { z } from "zod"; // Using zod for schema validation

export type GroupType = EmployeeType | AbsenceType;

// Define Zod schemas for validation
const EmployeeTypeSchemaRaw = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  min_hours: z.number().min(0, "Min hours cannot be negative"),
  max_hours: z.number().min(0, "Max hours cannot be negative"),
  hours_on_absence: z.number().min(0, "Hours on absence cannot be negative"),
  working_days_per_week: z.union([z.literal(5), z.literal(6)], {
    errorMap: () => ({ message: "Working days must be 5 or 6" }),
  }),
  type: z.literal("employee_type" as const),
});

const AbsenceTypeSchemaRaw = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  color: z.string().min(4, "Color is required"),
  type: z.literal("absence_type" as const),
});

const GroupTypeSchema = z
  .discriminatedUnion("type", [EmployeeTypeSchemaRaw, AbsenceTypeSchemaRaw])
  .superRefine((data, ctx) => {
    if (data.type === "employee_type") {
      // data is now inferred as the EmployeeType part of the union
      if (
        typeof data.max_hours === "number" &&
        typeof data.min_hours === "number"
      ) {
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
        id: "",
        name: "",
        min_hours: 0,
        max_hours: 40,
        hours_on_absence: 8.0,
        working_days_per_week: 5,
        type: "employee_type",
      } as Extract<InferredGroupType, { type: "employee_type" }>;
    } else {
      // type === "absence"
      return {
        id: "",
        name: "",
        color: "#FF9800",
        type: "absence_type",
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
      form.reset(
        editingGroup
          ? (editingGroup as InferredGroupType)
          : getTypedDefaultGroup(),
      );
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

    const existingGroupInLocalById = localGroups.find(
      (g) => g.id === groupToSave.id,
    );

    if (
      editingGroup &&
      editingGroup.id !== groupToSave.id &&
      existingGroupInLocalById
    ) {
      form.setError("id", {
        type: "manual",
        message: "This ID is already in use by another group.",
      });
      return;
    } else if (!editingGroup && existingGroupInLocalById) {
      form.setError("id", {
        type: "manual",
        message: "Group ID must be unique.",
      });
      return;
    }

    let updatedGroups: GroupType[];
    // If editing, find by original ID (editingGroup.id) and replace with groupToSave (which might have a new ID)
    if (editingGroup && localGroups.some((g) => g.id === editingGroup.id)) {
      updatedGroups = localGroups.map((g) =>
        g.id === editingGroup.id ? groupToSave : g,
      );
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
      {type === "employee" ? (
        <EnumDataTable
          data={localGroups as EmployeeType[]}
          columns={[
            { id: "id", name: "ID", width: 100 },
            { id: "name", name: "Name", width: 200 },
            { id: "min_hours", name: "Min Hours", width: 120 },
            { id: "max_hours", name: "Max Hours", width: 120 },
            {
              id: "hours_on_absence",
              name: "Hours on Absence",
              width: 150,
              format: (value) => (value !== undefined ? String(value) : "N/A"),
            },
            {
              id: "working_days_per_week",
              name: "Working Days/Week",
              width: 160,
              format: (value) => (value !== undefined ? String(value) : "N/A"),
            },
          ]}
          onAdd={() => handleOpenModal()}
          onEdit={(item) => handleOpenModal(item as GroupType)}
          onDelete={handleDeleteGroup}
          title="Employee Type"
          isLoading={isLoading}
        />
      ) : (
        <EnumDataTable
          data={localGroups as AbsenceType[]}
          columns={[
            { id: "id", name: "ID", width: 100 },
            { id: "name", name: "Name", width: 200 },
            {
              id: "color",
              name: "Color",
              width: 150,
              format: (value) => (
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: value }}
                  />
                  {value}
                </div>
              ),
            },
          ]}
          onAdd={() => handleOpenModal()}
          onEdit={(item) => handleOpenModal(item as GroupType)}
          onDelete={handleDeleteGroup}
          title="Absence Type"
          isLoading={isLoading}
        />
      )}

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        {" "}
        {/* Use handleCloseModal for onOpenChange */}
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
            <form
              onSubmit={form.handleSubmit(handleSaveGroup)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
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

              {form.watch("type") === "employee_type" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={"min_hours"} // Name is string literal
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Hours</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
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
                            <Input
                              type="number"
                              step="0.5"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={"hours_on_absence"} // Name is string literal
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours on Absence</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"working_days_per_week"} // Name is string literal
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Working Days per Week</FormLabel>
                          <Select
                            onValueChange={(value) =>
                              field.onChange(Number(value))
                            }
                            value={String(field.value)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select working days" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="5">5 days</SelectItem>
                              <SelectItem value="6">6 days</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {form.watch("type") === "absence_type" && (
                <FormField
                  control={form.control}
                  name={"color"} // Name is string literal
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <ColorPicker
                          color={(field.value as string) || ""}
                          onChange={field.onChange}
                          label={form.watch("name") || "Selected Color"}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  disabled={isLoading}
                >
                  {" "}
                  {/* Disable if loading */}
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {" "}
                  {/* Disable if loading */}
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingGroup?.id ? (
                    "Save"
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
