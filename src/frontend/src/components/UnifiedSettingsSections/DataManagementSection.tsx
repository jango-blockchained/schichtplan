import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input"; // For file input in restore
import { Label } from "@/components/ui/label"; // For table selection
import { Checkbox } from "@/components/ui/checkbox"; // For table selection
import { Loader2 } from "lucide-react";
import {
  generateDemoData,
  generateOptimizedDemoData,
  backupDatabase,
  restoreDatabase,
  wipeTables,
  fetchTables, // Corrected import name
} from "@/services/api"; // Using actual API imports

const DataManagementSection: React.FC = () => {
  const { toast } = useToast();
  const [selectedDemoModule, setSelectedDemoModule] = useState<string>("all");
  const [numEmployees, setNumEmployees] = useState<number | string>(30); // Added state for numEmployees
  const [selectedTablesToWipe, setSelectedTablesToWipe] = useState<string[]>(
    [],
  );
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingTables, setIsFetchingTables] = useState(false); // For loading state of tables
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadTables = async () => {
      setIsFetchingTables(true);
      try {
        const tables = await fetchTables(); // Calling the imported function
        setAvailableTables(tables);
      } catch (error) {
        toast({
          title: "Error fetching tables",
          description:
            error instanceof Error
              ? error.message
              : "Could not load table list.",
          variant: "destructive",
        });
        setAvailableTables([]);
      }
      setIsFetchingTables(false);
    };
    loadTables(); // Calling the local function
  }, [toast]);

  const handleAction = async (
    action: () => Promise<any>,
    successMessage: string,
    errorMessagePrefix: string,
  ) => {
    setIsProcessing(true);
    try {
      await action();
      toast({ title: "Success", description: successMessage });
    } catch (err) {
      toast({
        title: "Error",
        description: `${errorMessagePrefix}: ${err instanceof Error ? err.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const handleGenerateDemoData = () => {
    if (!selectedDemoModule) {
      toast({
        title: "No module selected",
        description: "Please select a module to generate demo data.",
        variant: "destructive", // Corrected variant
      });
      return;
    }
    const employeeCount =
      typeof numEmployees === "string"
        ? parseInt(numEmployees, 10)
        : numEmployees;
    if (isNaN(employeeCount) || employeeCount <= 0) {
      toast({
        title: "Invalid employee count",
        description: "Please enter a valid number of employees greater than 0.",
        variant: "warning",
      });
      return;
    }
    handleAction(
      () => generateDemoData(selectedDemoModule, employeeCount),
      "Demo data generated successfully.",
      "Failed to generate demo data",
    );
  };

  const handleGenerateOptimizedDemoData = () => {
    const employeeCount =
      typeof numEmployees === "string"
        ? parseInt(numEmployees, 10)
        : numEmployees;
    if (isNaN(employeeCount) || employeeCount <= 0) {
      toast({
        title: "Invalid employee count",
        description: "Please enter a valid number of employees greater than 0.",
        variant: "warning",
      });
      return;
    }
    handleAction(
      () => generateOptimizedDemoData(employeeCount),
      "Optimized demo data generated successfully.",
      "Failed to generate optimized demo data",
    );
  };

  const handleBackup = async () => {
    setIsProcessing(true);
    try {
      const blob = await backupDatabase();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Database backup downloaded successfully.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: `Failed to backup database: ${err instanceof Error ? err.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const handleRestoreChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleAction(
      () => restoreDatabase(file),
      "Database restored successfully.",
      "Failed to restore database",
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleWipeConfirm = async () => {
    if (selectedTablesToWipe.length === 0) {
      toast({
        title: "No tables selected",
        description: "Please select at least one table to wipe.",
        variant: "default", // Changed from "warning"
      });
      return;
    }
    // Close dialog logic will be handled by AlertDialog's onOpenChange or by controlling its open prop
    await handleAction(
      () => wipeTables(selectedTablesToWipe),
      "Selected tables wiped successfully.",
      "Failed to wipe tables",
    );
    setSelectedTablesToWipe([]);
  };

  const toggleTableSelection = (table: string) => {
    setSelectedTablesToWipe((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table],
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Demo Data Generation</CardTitle>
          <CardDescription>
            Generate sample data for testing and development.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Label htmlFor="demo-data-module" className="min-w-max">
              Select Module:
            </Label>
            <Select
              value={selectedDemoModule}
              onValueChange={setSelectedDemoModule}
              disabled={isProcessing}
            >
              <SelectTrigger id="demo-data-module" className="w-[200px]">
                <SelectValue placeholder="Choose module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="employees">Employees</SelectItem>
                <SelectItem value="shifts">Shifts</SelectItem>
                <SelectItem value="coverage">Coverage</SelectItem>
                <SelectItem value="availability">Availability</SelectItem>
                <SelectItem value="all">All Modules</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="num-employees">Number of Employees</Label>
            <Input
              id="num-employees"
              type="number"
              value={numEmployees}
              onChange={(e) =>
                setNumEmployees(
                  e.target.value === "" ? "" : parseInt(e.target.value, 10),
                )
              }
              placeholder="e.g., 30"
              className="w-[180px]"
              min="1"
            />
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={handleGenerateDemoData}
              disabled={isProcessing || !selectedDemoModule}
            >
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Generate Data
            </Button>
            <Button
              onClick={handleGenerateOptimizedDemoData}
              variant="outline"
              disabled={isProcessing}
            >
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Generate Optimized
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Management</CardTitle>
          <CardDescription>Manage your application's database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBackup} disabled={isProcessing}>
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Backup Database
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreChange}
              ref={fileInputRef}
              style={{ display: "none" }}
              id="restore-file-input"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Restore Database
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isProcessing || isFetchingTables}
                >
                  {isProcessing && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}{" "}
                  Wipe Tables
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the selected tables. Select tables to wipe:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="max-h-60 overflow-y-auto space-y-2 my-4 p-2 border rounded-md">
                  {isFetchingTables && (
                    <div className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading tables...
                    </div>
                  )}
                  {!isFetchingTables && availableTables.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No tables available or failed to load.
                    </p>
                  )}
                  {!isFetchingTables &&
                    availableTables.length > 0 &&
                    availableTables.map((table) => (
                      <div key={table} className="flex items-center space-x-2">
                        <Checkbox
                          id={`wipe-${table}`}
                          checked={selectedTablesToWipe.includes(table)}
                          onCheckedChange={() => toggleTableSelection(table)}
                          disabled={isProcessing}
                        />
                        <Label
                          htmlFor={`wipe-${table}`}
                          className="font-normal capitalize cursor-pointer"
                        >
                          {table.replace(/_/g, " ")}
                        </Label>
                      </div>
                    ))}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isProcessing}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleWipeConfirm}
                    disabled={
                      isProcessing ||
                      selectedTablesToWipe.length === 0 ||
                      isFetchingTables
                    }
                    className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive"
                  >
                    {isProcessing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}{" "}
                    Wipe Selected Tables
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataManagementSection;
