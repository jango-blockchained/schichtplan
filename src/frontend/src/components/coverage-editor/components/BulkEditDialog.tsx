import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BulkEditDialogProps, BulkEditData } from "../types";
import { DAYS_SHORT } from "../utils/constants";

export const BulkEditDialog: React.FC<BulkEditDialogProps> = ({
  isOpen,
  onClose,
  selectedBlocks,
  coverage,
  onBulkUpdate,
  storeConfig,
}) => {
  const [minEmployees, setMinEmployees] = useState<number | undefined>(undefined);
  const [maxEmployees, setMaxEmployees] = useState<number | undefined>(undefined);
  const [employeeTypes, setEmployeeTypes] = useState<string[]>([]);
  const [requiresKeyholder, setRequiresKeyholder] = useState<boolean | undefined>(undefined);
  const [updateMinEmployees, setUpdateMinEmployees] = useState(false);
  const [updateMaxEmployees, setUpdateMaxEmployees] = useState(false);
  const [updateEmployeeTypes, setUpdateEmployeeTypes] = useState(false);
  const [updateKeyholder, setUpdateKeyholder] = useState(false);

  // Reset form when dialog opens/closes or selection changes
  useEffect(() => {
    if (isOpen && selectedBlocks.length > 0) {
      // Get the first selected block to use as default values
      const firstBlock = selectedBlocks[0];
      const dayData = coverage.find(c => c.dayIndex === firstBlock.dayIndex);
      const slotData = dayData?.timeSlots[firstBlock.slotIndex];

      if (slotData) {
        setMinEmployees(slotData.minEmployees);
        setMaxEmployees(slotData.maxEmployees);
        setEmployeeTypes(slotData.employeeTypes);
        setRequiresKeyholder(slotData.requiresKeyholder);
      }
    } else {
      // Reset to defaults
      setMinEmployees(storeConfig.min_employees_per_shift);
      setMaxEmployees(storeConfig.max_employees_per_shift);
      setEmployeeTypes(storeConfig.employee_types.map(t => t.id));
      setRequiresKeyholder(false);
    }

    // Reset update flags
    setUpdateMinEmployees(false);
    setUpdateMaxEmployees(false);
    setUpdateEmployeeTypes(false);
    setUpdateKeyholder(false);
  }, [isOpen, selectedBlocks, coverage, storeConfig]);

  const handleSave = () => {
    const updates: BulkEditData = {};
    
    if (updateMinEmployees && minEmployees !== undefined) {
      updates.minEmployees = minEmployees;
    }
    if (updateMaxEmployees && maxEmployees !== undefined) {
      updates.maxEmployees = maxEmployees;
    }
    if (updateEmployeeTypes) {
      updates.employeeTypes = employeeTypes;
    }
    if (updateKeyholder && requiresKeyholder !== undefined) {
      updates.requiresKeyholder = requiresKeyholder;
    }

    onBulkUpdate(updates);
    onClose();
  };

  const handleEmployeeTypeToggle = (typeId: string) => {
    setEmployeeTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const getSelectedBlocksText = () => {
    if (selectedBlocks.length === 0) return "No blocks selected";
    if (selectedBlocks.length === 1) return "1 block selected";
    return `${selectedBlocks.length} blocks selected`;
  };

  const getSelectedBlocksList = () => {
    return selectedBlocks.map(block => {
      const dayData = coverage.find(c => c.dayIndex === block.dayIndex);
      const slotData = dayData?.timeSlots[block.slotIndex];
      const dayName = DAYS_SHORT[block.dayIndex];
      
      if (slotData) {
        return `${dayName}: ${slotData.startTime}-${slotData.endTime}`;
      }
      return `${dayName}: Block ${block.slotIndex}`;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Edit Coverage Blocks</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selection Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selected Blocks</Label>
            <div className="p-3 bg-muted/50 rounded-md">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {getSelectedBlocksText()}
              </p>
              <div className="flex flex-wrap gap-1">
                {getSelectedBlocksList().map((blockText, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {blockText}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Employee Count Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="update-min"
                  checked={updateMinEmployees}
                  onCheckedChange={setUpdateMinEmployees}
                />
                <Label htmlFor="update-min" className="text-sm font-medium">
                  Update Minimum Employees
                </Label>
              </div>
              <Input
                type="number"
                min={1}
                value={minEmployees || ""}
                onChange={(e) => setMinEmployees(parseInt(e.target.value) || undefined)}
                disabled={!updateMinEmployees}
                placeholder="Min employees"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="update-max"
                  checked={updateMaxEmployees}
                  onCheckedChange={setUpdateMaxEmployees}
                />
                <Label htmlFor="update-max" className="text-sm font-medium">
                  Update Maximum Employees
                </Label>
              </div>
              <Input
                type="number"
                min={1}
                value={maxEmployees || ""}
                onChange={(e) => setMaxEmployees(parseInt(e.target.value) || undefined)}
                disabled={!updateMaxEmployees}
                placeholder="Max employees"
              />
            </div>
          </div>

          {/* Employee Types */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-types"
                checked={updateEmployeeTypes}
                onCheckedChange={setUpdateEmployeeTypes}
              />
              <Label htmlFor="update-types" className="text-sm font-medium">
                Update Employee Types
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {storeConfig.employee_types.map(type => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type.id}`}
                    checked={employeeTypes.includes(type.id)}
                    onCheckedChange={() => handleEmployeeTypeToggle(type.id)}
                    disabled={!updateEmployeeTypes}
                  />
                  <Label htmlFor={`type-${type.id}`} className="text-sm">
                    {type.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Keyholder Requirement */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-keyholder"
                checked={updateKeyholder}
                onCheckedChange={setUpdateKeyholder}
              />
              <Label htmlFor="update-keyholder" className="text-sm font-medium">
                Update Keyholder Requirement
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires-keyholder"
                checked={requiresKeyholder || false}
                onCheckedChange={setRequiresKeyholder}
                disabled={!updateKeyholder}
              />
              <Label htmlFor="requires-keyholder" className="text-sm">
                Requires Keyholder
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!updateMinEmployees && !updateMaxEmployees && !updateEmployeeTypes && !updateKeyholder}
          >
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 