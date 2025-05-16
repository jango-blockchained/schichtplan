import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateEmployeeRequest, UpdateEmployeeRequest } from "@/types";

interface EmployeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  onAddEmployee: (data: CreateEmployeeRequest) => Promise<void>;
  onUpdateEmployee: (id: number, data: UpdateEmployeeRequest) => Promise<void>;
  employee?: {
    id: number;
    employee_id: string;
    first_name: string;
    last_name: string;
    employee_group: string;
    contracted_hours: number;
    is_keyholder: boolean;
    is_active: boolean;
    birthday: string | null;
    email: string | null;
    phone: string | null;
  };
}

export function EmployeeModal({
  open,
  onOpenChange,
  isLoading,
  onAddEmployee,
  onUpdateEmployee,
  employee,
}: EmployeeModalProps) {
  const [formData, setFormData] = useState<CreateEmployeeRequest>({
    first_name: employee?.first_name || "",
    last_name: employee?.last_name || "",
    employee_group: employee?.employee_group || "VZ",
    contracted_hours: employee?.contracted_hours || 40,
    is_keyholder: employee?.is_keyholder || false,
    is_active: employee?.is_active || true,
    birthday: employee?.birthday || null,
    email: employee?.email || null,
    phone: employee?.phone || null,
  });

  const handleSubmit = async () => {
    try {
      if (employee) {
        await onUpdateEmployee(employee.id, formData);
      } else {
        await onAddEmployee(formData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting employee:", error);
    }
  };

  const getHoursRange = (group: string) => {
    switch (group) {
      case "VZ":
        return [35, 40];
      case "TZ":
        return [10, 34];
      case "GFB":
        return [0, 20];
      case "TL":
        return [35, 40];
      default:
        return [0, 40];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {employee ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Birthday</Label>
              <Input
                type="date"
                value={formData.birthday || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    birthday: e.target.value || null,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    email: e.target.value || null,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={formData.phone || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phone: e.target.value || null,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Employee Group</Label>
              <Select
                value={formData.employee_group}
                onValueChange={(value) =>
                  setFormData({ ...formData, employee_group: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VZ">Vollzeit</SelectItem>
                  <SelectItem value="TZ">Teilzeit</SelectItem>
                  <SelectItem value="GFB">Geringfügig</SelectItem>
                  <SelectItem value="TL">Teamleiter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hours</Label>
              <Input
                type="number"
                min={getHoursRange(formData.employee_group)[0]}
                max={getHoursRange(formData.employee_group)[1]}
                value={formData.contracted_hours}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contracted_hours: Number(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_keyholder"
                  checked={formData.is_keyholder}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, is_keyholder: checked })
                  }
                />
                <Label htmlFor="is_keyholder">Keyholder</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {employee ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
