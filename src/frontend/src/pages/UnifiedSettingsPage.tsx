import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedCallback } from 'use-debounce';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from "@/components/ui/use-toast";
import type { Settings } from '@/types/index';
import { getSettings, updateSettings } from '@/services/api'; // Assuming API functions are here
import { GeneralStoreSetupSection } from '@/components/UnifiedSettingsSections/GeneralStoreSetupSection';
import { DEFAULT_SETTINGS } from "@/hooks/useSettings"; // Assuming default settings are here
import { SchedulingEngineSection } from '@/components/UnifiedSettingsSections/SchedulingEngineSection';
import { EmployeeShiftDefinitionsSection } from '@/components/UnifiedSettingsSections/EmployeeShiftDefinitionsSection';

type SectionId = 
  | 'general_store_setup'
  | 'scheduling_engine'
  | 'employee_shift_definitions'
  | 'availability_configuration'
  | 'appearance_display'
  | 'integrations_ai'
  | 'data_management'
  | 'notifications';

interface Section {
  id: SectionId;
  title: string;
  // component: React.FC<any>; // Will define specific props later
}

const sections: Section[] = [
  { id: 'general_store_setup', title: 'General Store Setup'/*, component: GeneralStoreSetupSection*/ },
  { id: 'scheduling_engine', title: 'Scheduling Engine' /*, component: PlaceholderContent*/ },
  { id: 'employee_shift_definitions', title: 'Employee & Shift Definitions' /*, component: PlaceholderContent*/ },
  { id: 'availability_configuration', title: 'Availability Configuration' /*, component: PlaceholderContent*/ },
  { id: 'appearance_display', title: 'Appearance & Display' /*, component: PlaceholderContent*/ },
  { id: 'integrations_ai', title: 'Integrations & AI' /*, component: PlaceholderContent*/ },
  { id: 'data_management', title: 'Data Management' /*, component: PlaceholderContent*/ },
  { id: 'notifications', title: 'Notifications' /*, component: PlaceholderContent*/ },
];

// Temporary Placeholder for other sections
const PlaceholderContent: React.FC<{ title: string }> = ({ title }) => (
  <div className="p-4">
    <h2 className="text-2xl font-semibold mb-4">{title}</h2>
    <p>Content for {title} will be implemented here.</p>
  </div>
);

export default function UnifiedSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SectionId>(sections[0].id);
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);

  const { data: settingsData, isLoading, error, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    retry: 3,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true, // Keep true, or make it configurable if needed
  } as const);

  useEffect(() => {
    if (settingsData) {
      setLocalSettings(settingsData);
    } else if (!isLoading && !error) {
      // If no settings data and not loading/error, initialize with default
      // This case might occur if the backend returns null/empty for a new setup
      setLocalSettings(DEFAULT_SETTINGS as Settings); 
    }
  }, [settingsData, isLoading, error]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => updateSettings(data),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(["settings"], updatedSettings);
      setLocalSettings(updatedSettings);
      // Removed toast from here to be called in handleImmediateUpdate for more specific feedback
    },
    onError: (error) => {
      const cachedSettings = queryClient.getQueryData<Settings>(["settings"]);
      if (cachedSettings) {
        setLocalSettings(cachedSettings);
      }
      toast({
        title: "Error Updating Settings",
        description: error.message || "Failed to update settings. Changes were reverted.",
        variant: "destructive",
      });
    },
  });

  const debouncedUpdate = useDebouncedCallback(
    (updatedSettings: Settings) => {
      updateMutation.mutate(updatedSettings);
    },
    2000 // 2 seconds debounce time
  );

  const handleSave = (
    category: keyof Settings, // Simplified category to be any key of Settings
    updates: Partial<Settings[typeof category]>
  ) => {
    if (!localSettings) return;

    const currentCategoryState = localSettings[category];
    let newCategoryState;

    if (typeof currentCategoryState === 'object' && currentCategoryState !== null) {
        newCategoryState = { ...currentCategoryState, ...updates };
    } else {
        // If the category is not an object (e.g. a primitive type directy under settings, though unlikely for most of our structure)
        // or if it's null, we just take the updates. This part might need refinement based on Settings structure.
        newCategoryState = updates;
    }

    const updatedSettings: Settings = {
      ...localSettings,
      [category]: newCategoryState,
    };
    
    setLocalSettings(updatedSettings);
    debouncedUpdate(updatedSettings);
  };
  
  const handleImmediateUpdate = () => {
    if (localSettings) {
      debouncedUpdate.cancel(); // Cancel any pending debounced updates
      updateMutation.mutate(localSettings, {
        onSuccess: (updatedData) => {
          queryClient.setQueryData(["settings"], updatedData);
          setLocalSettings(updatedData);
          toast({
            title: "Settings Saved",
            description: "Your settings have been successfully saved to the server.",
          });
        }
      });
    }
  };

  const timeStringToDate = (timeStr: string | null | undefined): Date => {
    if (!timeStr) timeStr = '00:00';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  const dateToTimeString = (date: Date | null | undefined): string => {
    if (!date) return "00:00";
    return format(date, 'HH:mm');
  };

  const handleDiagnosticsChange = (checked: boolean) => {
    if (!localSettings || !localSettings.scheduling) return;
    const updatedSchedSettings = {
      ...localSettings.scheduling,
      enable_diagnostics: checked
    };
    // Directly call handleSave for the 'scheduling' category
    handleSave('scheduling' as any, updatedSchedSettings); // Cast as any for now, or refine handleSave type
    // Potentially call handleImmediateUpdate() if this change should be saved instantly
    // handleImmediateUpdate(); 
  };

  const renderSectionContent = () => {
    const currentSectionMeta = sections.find(sec => sec.id === activeSection);
    if (!currentSectionMeta) {
      return <PlaceholderContent title="Section not found" />;
    }

    if (!localSettings && isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-4 animate-spin" /><span>Loading settings...</span></div>;
    }
  
    if (error || !localSettings) {
      return <Alert variant="destructive"><AlertDescription>Error loading settings. Please try again later or contact support.</AlertDescription></Alert>;
    }

    switch (activeSection) {
      case 'general_store_setup':
        return (
          <GeneralStoreSetupSection 
            localSettings={localSettings} 
            handleSave={handleSave as any} 
            handleImmediateUpdate={handleImmediateUpdate} 
            updateMutationIsPending={updateMutation.isPending}
            timeStringToDate={timeStringToDate}
            dateToTimeString={dateToTimeString}
          />
        );
      case 'scheduling_engine':
        return (
          <SchedulingEngineSection
            localSettings={localSettings}
            handleSave={handleSave as any} 
            handleDiagnosticsChange={handleDiagnosticsChange}
            handleImmediateUpdate={handleImmediateUpdate}
            updateMutationIsPending={updateMutation.isPending}
          />
        );
      case 'employee_shift_definitions':
        return (
          <EmployeeShiftDefinitionsSection
            localSettings={localSettings}
            handleSave={handleSave as any} 
            handleImmediateUpdate={handleImmediateUpdate}
            updateMutationIsPending={updateMutation.isPending}
          />
        );
      // Add cases for other sections here later
      default:
        return <PlaceholderContent title={currentSectionMeta.title} />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Unified Settings"
        description="Manage all application settings and options from one place."
      />
      <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0">
        <nav className="md:w-1/4 lg:w-1/5 space-y-1">
          {sections.map((section) => (
            <Button
              key={section.id}
              variant={activeSection === section.id ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveSection(section.id)}
            >
              {section.title}
            </Button>
          ))}
        </nav>
        <main className="md:w-3/4 lg:w-4/5 bg-card p-6 rounded-lg shadow min-h-[300px]">
          {renderSectionContent()}
        </main>
      </div>
    </div>
  );
} 