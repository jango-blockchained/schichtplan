import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings } from "@/services/api";
import { Settings } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = React.useState("general");

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Settings) => updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Settings updated",
        description: "Your settings have been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = (newSettings: Settings) => {
    updateMutation.mutate(newSettings);
  };

  if (isLoading || !settings) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <div className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input
                    type="text"
                    id="storeName"
                    value={settings.store_name}
                    onChange={(e) =>
                      handleSave({ ...settings, store_name: e.target.value })
                    }
                  />
                </div>

                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="storeAddress">Store Address</Label>
                  <Input
                    type="text"
                    id="storeAddress"
                    value={settings.store_address}
                    onChange={(e) =>
                      handleSave({ ...settings, store_address: e.target.value })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scheduling">
              <div className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="minEmployees">Minimum Employees per Shift</Label>
                  <Input
                    type="number"
                    id="minEmployees"
                    value={settings.min_employees_per_shift}
                    onChange={(e) =>
                      handleSave({
                        ...settings,
                        min_employees_per_shift: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="maxEmployees">Maximum Employees per Shift</Label>
                  <Input
                    type="number"
                    id="maxEmployees"
                    value={settings.max_employees_per_shift}
                    onChange={(e) =>
                      handleSave({
                        ...settings,
                        max_employees_per_shift: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="minKeyholders">
                    Minimum Keyholders per Shift
                  </Label>
                  <Input
                    type="number"
                    id="minKeyholders"
                    value={settings.min_keyholders_per_shift}
                    onChange={(e) =>
                      handleSave({
                        ...settings,
                        min_keyholders_per_shift: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}