import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/types"; // Assuming Settings type is in @/types

interface IntegrationsAISectionProps {
  // Use a more specific type if ai_scheduling structure is well-defined
  settings: Settings["ai_scheduling"] | undefined;
  onSettingChange: (
    key: keyof NonNullable<Settings["ai_scheduling"]>,
    value: any,
  ) => void;
  onImmediateUpdate?: () => void; // Optional: if specific fields need immediate persistence on blur
}

const IntegrationsAISection: React.FC<IntegrationsAISectionProps> = ({
  settings,
  onSettingChange,
  onImmediateUpdate,
}) => {
  // Fallback to default values if settings or parts of it are undefined
  const aiEnabled = settings?.enabled ?? false;
  const apiKey = settings?.api_key ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI & Integrations</CardTitle>
        <CardDescription>
          Configure settings for AI-powered features and external integrations.
          API keys are sensitive; ensure they are handled securely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-x-2 p-4 border rounded-md">
          <Label
            htmlFor="ai-schedule-generation-enabled"
            className="flex flex-col space-y-1 cursor-pointer"
          >
            <span>Enable AI Schedule Generation</span>
            <span className="font-normal leading-snug text-muted-foreground">
              Allow the system to use AI for generating schedules.
            </span>
          </Label>
          <Switch
            id="ai-schedule-generation-enabled"
            checked={aiEnabled}
            onCheckedChange={(checked) => onSettingChange("enabled", checked)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-api-key">Gemini API Key</Label>
          <Input
            id="ai-api-key"
            type="password"
            placeholder="Enter your Gemini API Key"
            value={apiKey}
            onChange={(e) => onSettingChange("api_key", e.target.value)}
            onBlur={onImmediateUpdate} // Call immediate update on blur if provided
          />
          <p className="text-sm text-muted-foreground">
            Your API key for accessing Gemini models for schedule generation.
          </p>
        </div>
        {/* Placeholder for other future integrations */}
        {/* 
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-medium mb-2">Other Integrations</h3>
          <p className="text-sm text-muted-foreground">
            Configure other third-party integrations here (e.g., calendar sync, payroll). Example section.
          </p>
        </div>
        */}
      </CardContent>
    </Card>
  );
};

export default IntegrationsAISection;
