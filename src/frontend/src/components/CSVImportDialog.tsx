import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/ui";
import { AlertCircle, CheckCircle, FileText, Upload } from "lucide-react";
import React, { useState } from "react";

interface DataType {
  id: string;
  name: string;
  description: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface PreviewData {
  headers: string[];
  sample_rows: Record<string, string>[];
  row_count: number;
  validation: ValidationResult;
}

interface ImportResult {
  success: boolean;
  imported_count?: number;
  errors?: string[];
  error?: string;
}

interface CSVImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
}

const CSVImportDialog: React.FC<CSVImportDialogProps> = ({
  open,
  onClose,
  onImportComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [inputMethod, setInputMethod] = useState<"file" | "text">("file");
  const [selectedDataType, setSelectedDataType] = useState<string>("");
  const [dataTypes, setDataTypes] = useState<DataType[]>([]);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"select" | "preview" | "result">("select");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  React.useEffect(() => {
    if (open) {
      loadDataTypes();
    }
  }, [open]);

  const loadDataTypes = async (): Promise<void> => {
    try {
      const response = await fetch("/api/csv-import/data-types");
      const data = await response.json();
      setDataTypes(data.data_types || []);
    } catch (error) {
      console.error("Error loading data types:", error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewData(null);
    }
  };

  const handlePreview = async (): Promise<void> => {
    if (!selectedDataType) return;
    if (inputMethod === "file" && !selectedFile) return;
    if (inputMethod === "text" && !csvText.trim()) return;

    setIsLoading(true);
    try {
      let response;

      if (inputMethod === "file" && selectedFile) {
        // File upload
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("data_type", selectedDataType);

        response = await fetch("/api/csv-import/preview", {
          method: "POST",
          body: formData,
        });
      } else {
        // Text input
        response = await fetch("/api/csv-import/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            csv_text: csvText,
            data_type: selectedDataType,
          }),
        });
      }

      const data = await response.json();
      if (response.ok) {
        setPreviewData(data);
        setStep("preview");
      } else {
        setImportResult({
          success: false,
          error: data.error || "Failed to preview CSV",
        });
        setStep("result");
      }
    } catch (error) {
      console.error("Error previewing CSV:", error);
      setImportResult({
        success: false,
        error: "Failed to preview CSV",
      });
      setStep("result");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (): Promise<void> => {
    if (!selectedDataType) return;
    if (inputMethod === "file" && !selectedFile) return;
    if (inputMethod === "text" && !csvText.trim()) return;

    setIsLoading(true);
    try {
      let response;

      if (inputMethod === "file" && selectedFile) {
        // File upload
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("data_type", selectedDataType);

        response = await fetch("/api/csv-import/import", {
          method: "POST",
          body: formData,
        });
      } else {
        // Text input
        response = await fetch("/api/csv-import/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            csv_text: csvText,
            data_type: selectedDataType,
          }),
        });
      }

      const data = await response.json();
      setImportResult(data);
      setStep("result");
    } catch (error) {
      console.error("Error importing CSV:", error);
      setImportResult({
        success: false,
        error: "Failed to import CSV",
      });
      setStep("result");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (importResult?.success) {
      onImportComplete(importResult);
    }
    setSelectedFile(null);
    setCsvText("");
    setInputMethod("file");
    setSelectedDataType("");
    setPreviewData(null);
    setImportResult(null);
    setStep("select");
    onClose();
  };

  const renderStepSelect = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="dataType">Data Type</Label>
        <Select value={selectedDataType} onValueChange={setSelectedDataType}>
          <SelectTrigger>
            <SelectValue placeholder="Select data type to import" />
          </SelectTrigger>
          <SelectContent>
            {dataTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name} - {type.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Input Method</Label>
          <div className="flex items-center space-x-2">
            <span
              className={`text-sm ${inputMethod === "file" ? "font-medium" : "text-gray-500"}`}
            >
              File Upload
            </span>
            <Switch
              checked={inputMethod === "text"}
              onCheckedChange={(checked) => {
                setInputMethod(checked ? "text" : "file");
                // Clear the other input when switching
                if (checked) {
                  setSelectedFile(null);
                } else {
                  setCsvText("");
                }
              }}
            />
            <span
              className={`text-sm ${inputMethod === "text" ? "font-medium" : "text-gray-500"}`}
            >
              Text Input
            </span>
          </div>
        </div>

        {inputMethod === "file" ? (
          <div className="space-y-2">
            <Label htmlFor="file">CSV File</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <div className="mb-2">
                {selectedFile ? (
                  <div className="flex items-center justify-center space-x-2">
                    <FileText size={16} />
                    <span className="text-sm font-medium">
                      {selectedFile.name}
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-600">
                    Drop CSV file here or click to select
                  </p>
                )}
              </div>
              <Input
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("file")?.click()}
              >
                Select File
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="csvText">CSV Data</Label>
            <Textarea
              id="csvText"
              placeholder="Paste your CSV data here..."
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              Paste CSV data with headers in the first row
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStepPreview = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Preview</h3>
        <Badge variant="secondary">{previewData?.row_count} rows</Badge>
      </div>

      {previewData?.validation && !previewData.validation.valid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="text-red-500" size={16} />
            <span className="text-red-700 font-medium">Validation Errors</span>
          </div>
          <ul className="text-sm text-red-600 space-y-1">
            {previewData.validation.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {previewData?.validation?.warnings &&
        previewData.validation.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="text-yellow-500" size={16} />
              <span className="text-yellow-700 font-medium">Warnings</span>
            </div>
            <ul className="text-sm text-yellow-600 space-y-1">
              {previewData.validation.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

      {previewData?.sample_rows && previewData.sample_rows.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {previewData.headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.sample_rows.map((row, index) => (
                <TableRow key={index}>
                  {previewData.headers.map((header) => (
                    <TableCell key={header}>{row[header] || "-"}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  const renderStepResult = () => (
    <div className="space-y-4 text-center">
      {importResult?.success ? (
        <div className="space-y-2">
          <CheckCircle className="mx-auto text-green-500" size={48} />
          <h3 className="text-lg font-medium text-green-700">
            Import Successful
          </h3>
          <p className="text-gray-600">
            Successfully imported {importResult.imported_count} records.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AlertCircle className="mx-auto text-red-500" size={48} />
          <h3 className="text-lg font-medium text-red-700">Import Failed</h3>
          <p className="text-gray-600">
            {importResult?.error || "An error occurred during import."}
          </p>
        </div>
      )}

      {importResult?.errors && importResult.errors.length > 0 && (
        <div className="text-left bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-700 mb-2">Errors:</h4>
          <ul className="text-sm text-red-600 space-y-1 max-h-40 overflow-y-auto">
            {importResult.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CSV Import</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {step === "select" && renderStepSelect()}
          {step === "preview" && renderStepPreview()}
          {step === "result" && renderStepResult()}
        </div>

        <DialogFooter>
          {step === "select" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={
                  !selectedDataType ||
                  isLoading ||
                  (inputMethod === "file" && !selectedFile) ||
                  (inputMethod === "text" && !csvText.trim())
                }
              >
                {isLoading ? "Loading..." : "Preview"}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!previewData?.validation?.valid || isLoading}
              >
                {isLoading ? "Importing..." : "Import"}
              </Button>
            </>
          )}
          {step === "result" && <Button onClick={handleClose}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVImportDialog;
