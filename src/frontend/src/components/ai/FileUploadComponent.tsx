import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { aiService, type FileUpload } from "@/services/aiService";
import {
  CheckCircle2,
  Eye,
  File,
  FileJson,
  FileSpreadsheet,
  FileText,
  Image,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface FileUploadComponentProps {
  // New canonical props
  onFilesUploaded?: (files: FileUpload[]) => void;
  onFileAnalyzed?: (fileId: string, analysis: Record<string, unknown>) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  className?: string;

  // Backwards-compatible aliases used by older tests/components
  acceptedFileTypes?: string[]; // e.g. ['.pdf', '.txt'] or mime types
  onFileSelected?: (files: File[]) => void; // called on raw selection/drop
  onError?: (error: string) => void;
  multiple?: boolean;
  showProgress?: boolean;
  // older name used in some places
  acceptedTypes?: string[];
}

interface UploadState {
  isUploading: boolean;
  uploadProgress: number;
  files: FileUpload[];
  dragActive: boolean;
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  onFilesUploaded,
  onFileAnalyzed,
  // backward compatibility
  acceptedFileTypes,
  onFileSelected,
  onError,
  multiple = true,
  showProgress = false,
  acceptedTypes,
  maxFiles = 10,
  maxFileSize = 50, // 50MB default
  allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/json",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/gif",
  ],
  className,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    uploadProgress: 0,
    files: [],
    dragActive: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("csv")
    ) {
      return <FileSpreadsheet className="h-4 w-4" />;
    }
    if (type.includes("json")) return <FileJson className="h-4 w-4" />;
    if (type.includes("text") || type.includes("plain"))
      return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    const fileExt = file.name.includes(".")
      ? `.${file.name.split('.').pop()}`.toLowerCase()
      : "";

    const accepted =
      (acceptedFileTypes && acceptedFileTypes.length > 0 && acceptedFileTypes.includes(fileExt)) ||
      (acceptedTypes && acceptedTypes.length > 0 && acceptedTypes.includes(fileExt)) ||
      allowedTypes.includes(file.type);

    if (!accepted) {
      return `Dateityp ${file.type} nicht erlaubt`;
    }
    if (file.size > maxFileSize * 1024 * 1024) {
      return `Datei zu groß (max. ${maxFileSize}MB)`;
    }
    if (uploadState.files.length >= maxFiles) {
      return `Maximale Anzahl von ${maxFiles} Dateien erreicht`;
    }
    return null;
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploadState((prev) => ({
      ...prev,
      isUploading: true,
      uploadProgress: 0,
    }));

    const uploadedFiles: FileUpload[] = [];
    const totalFiles = files.length;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const validationError = validateFile(file);

        if (validationError) {
          toast.error(`${file.name}: ${validationError}`);
          continue;
        }

        try {
          const uploadedFile = await aiService.uploadFile(file);
          uploadedFiles.push(uploadedFile);

          setUploadState((prev) => ({
            ...prev,
            uploadProgress: ((i + 1) / totalFiles) * 100,
            files: [...prev.files, uploadedFile],
          }));

          toast.success(`${file.name} hochgeladen`);

          // Auto-analyze if it's a data file
          if (
            file.type.includes("csv") ||
            file.type.includes("json") ||
            file.type.includes("spreadsheet")
          ) {
            try {
              const analysis = await aiService.analyzeFile(uploadedFile.id);
              if (onFileAnalyzed) {
                onFileAnalyzed(uploadedFile.id, analysis.analysis);
              }
            } catch (error) {
              console.warn("File analysis failed:", error);
            }
            if (onFileSelected) {
              try {
                onFileSelected([file]);
              } catch (e) {
                // ignore
              }
            }
          }
        } catch (error) {
          console.error("Upload failed:", error);
          toast.error(`Upload fehlgeschlagen für ${file.name}`);
        }
      }

      if (onFilesUploaded && uploadedFiles.length > 0) {
        onFilesUploaded(uploadedFiles);
      }
    } finally {
      setUploadState((prev) => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
      }));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    uploadFiles(files);

    // notify raw selection callback
    if (onFileSelected && files.length > 0) {
      try {
        onFileSelected(files);
      } catch {
        // ignore
      }
    }
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setUploadState((prev) => ({ ...prev, dragActive: false }));

      const files = Array.from(event.dataTransfer.files);
      uploadFiles(files);
      if (onFileSelected && files.length > 0) {
        try {
          onFileSelected(files);
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setUploadState((prev) => ({ ...prev, dragActive: true }));
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setUploadState((prev) => ({ ...prev, dragActive: false }));
  }, []);

  const removeFile = (fileId: string) => {
    setUploadState((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== fileId),
    }));
    toast.success("Datei entfernt");
  };

  const analyzeFile = async (fileId: string) => {
    try {
      const analysis = await aiService.analyzeFile(fileId);

      setUploadState((prev) => ({
        ...prev,
        files: prev.files.map((f) =>
          f.id === fileId
            ? { ...f, processed: true, analysis: analysis.analysis }
            : f,
        ),
      }));

      if (onFileAnalyzed) {
        onFileAnalyzed(fileId, analysis.analysis);
      }

      toast.success("Datei analysiert");
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Analyse fehlgeschlagen");
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          uploadState.dragActive && "border-primary bg-primary/5",
          uploadState.isUploading && "pointer-events-none opacity-75",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="p-8 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Dateien hochladen</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Klicken Sie hier oder ziehen Sie Dateien hierher
          </p>
          <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
            <Badge variant="outline">PDF</Badge>
            <Badge variant="outline">Excel</Badge>
            <Badge variant="outline">CSV</Badge>
            <Badge variant="outline">JSON</Badge>
            <Badge variant="outline">Bilder</Badge>
            <Badge variant="outline">Text</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Max. {maxFileSize}MB pro Datei, bis zu {maxFiles} Dateien
          </p>

          {uploadState.isUploading && (
            <div className="mt-4">
              <Progress value={uploadState.uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-1">
                Uploading... {Math.round(uploadState.uploadProgress)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={(acceptedFileTypes && acceptedFileTypes.join(",")) || (acceptedTypes && acceptedTypes.join(",")) || allowedTypes.join(",")}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Uploaded Files List */}
      {uploadState.files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <File className="h-4 w-4" />
              Hochgeladene Dateien ({uploadState.files.length}/{maxFiles})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {uploadState.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                  >
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.type}</span>
                        {file.processed && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              Analysiert
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {file.processed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => analyzeFile(file.id)}
                          className="h-6 w-6 p-0"
                          title="Datei analysieren"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(file.id)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        title="Datei entfernen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FileUploadComponent;
