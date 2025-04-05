import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PDFLayoutConfig } from "@/types";

interface PDFLayoutPresetsProps {
  presets: Record<string, PDFLayoutConfig>;
  currentConfig: PDFLayoutConfig;
  onSavePreset: (name: string, config: PDFLayoutConfig) => Promise<void>;
  onDeletePreset: (name: string) => Promise<void>;
  onApplyPreset: (name: string) => Promise<void>;
}

export function PDFLayoutPresets({
  presets,
  currentConfig,
  onSavePreset,
  onDeletePreset,
  onApplyPreset,
}: PDFLayoutPresetsProps) {
  const [newPresetName, setNewPresetName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      toast({
        variant: "destructive",
        description: "Please enter a preset name.",
      });
      return;
    }

    if (presets[newPresetName]) {
      toast({
        variant: "destructive",
        description: "A preset with this name already exists.",
      });
      return;
    }

    try {
      setIsLoading("save");
      await onSavePreset(newPresetName, currentConfig);
      setNewPresetName("");
      setIsDialogOpen(false);
      toast({
        description: `Preset "${newPresetName}" saved successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to save preset.",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleDeletePreset = async (name: string) => {
    if (["Classic", "Modern", "Compact"].includes(name)) {
      toast({
        variant: "destructive",
        description: "Cannot delete default presets.",
      });
      return;
    }

    try {
      setIsLoading(name);
      await onDeletePreset(name);
      toast({
        description: `Preset "${name}" deleted successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to delete preset.",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleApplyPreset = async (name: string) => {
    try {
      setIsLoading(name);
      await onApplyPreset(name);
      toast({
        description: `Preset "${name}" applied successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to apply preset.",
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Layout Presets</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save New Preset</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Preset Name</Label>
                <Input
                  id="name"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Enter preset name..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSavePreset}
                disabled={isLoading === "save"}
              >
                {isLoading === "save" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Preset
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(presets).map(([name]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-sm font-medium">{name}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyPreset(name)}
                  disabled={!!isLoading}
                >
                  {isLoading === name ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Apply
                </Button>
                {!["Classic", "Modern", "Compact"].includes(name) && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeletePreset(name)}
                    disabled={!!isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
