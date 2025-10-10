import HolidayManagement from "@/components/HolidayManagement";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import AppearanceDisplaySection from "@/components/UnifiedSettingsSections/AppearanceDisplaySection";
import { AvailabilityConfigurationSection } from "@/components/UnifiedSettingsSections/AvailabilityConfigurationSection";
import DataManagementSection from "@/components/UnifiedSettingsSections/DataManagementSection";
import { EmployeeShiftDefinitionsSection } from "@/components/UnifiedSettingsSections/EmployeeShiftDefinitionsSection";
import { GeneralStoreSetupSection } from "@/components/UnifiedSettingsSections/GeneralStoreSetupSection";
import IntegrationsAISection from "@/components/UnifiedSettingsSections/IntegrationsAISection";
import { SchedulingEngineSection } from "@/components/UnifiedSettingsSections/SchedulingEngineSection";
import WeekNavigationSection from "@/components/UnifiedSettingsSections/WeekNavigationSection";
import { DEFAULT_SETTINGS } from "@/hooks/useSettings"; // Assuming default settings are here
import { useWebSocketEvents } from "@/hooks/useWebSocketEvents";
import { getSettings, updateSettings } from "@/services/api"; // Assuming API functions are here
import type { Settings } from "@/types/index";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
// import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

type SectionId =
  | "general_store_setup"
  | "scheduling_engine"
  | "employee_shift_definitions"
  | "availability_configuration"
  | "week_navigation"
  | "appearance_display"
  | "integrations_ai"
  | "data_management"
  | "holiday_management"
  ;

interface Section {
  id: SectionId;
  title: string;
  // component: React.FC<any>; // Will define specific props later
}

const sections: Section[] = [
  {
    id: "general_store_setup",
    title: "General Store Setup" /*, component: GeneralStoreSetupSection*/,
  },
  {
    id: "scheduling_engine",
    title: "Scheduling Engine" /*, component: PlaceholderContent*/,
  },
  {
    id: "employee_shift_definitions",
    title: "Employee & Shift Definitions" /*, component: PlaceholderContent*/,
  },
  {
    id: "availability_configuration",
    title: "Availability Configuration" /*, component: PlaceholderContent*/,
  },
  {
    id: "week_navigation",
    title: "Week Navigation" /*, component: PlaceholderContent*/,
  },
  {
    id: "appearance_display",
    title: "Appearance & Display" /*, component: PlaceholderContent*/,
  },
  {
    id: "integrations_ai",
    title: "Integrations & AI" /*, component: PlaceholderContent*/,
  },
  {
    id: "data_management",
    title: "Data Management" /*, component: PlaceholderContent*/,
  },
  {
    id: "holiday_management",
    title: "Holiday Management" /*, component: HolidayManagement*/,
  },

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
  const [activeSection, setActiveSection] = useState<SectionId>(
    "general_store_setup",
  );

  // Add WebSocket event handlers for real-time updates
  useWebSocketEvents([
    {
      eventType: 'settings_updated',
      handler: () => {
        // Invalidate settings-related queries
        queryClient.invalidateQueries({ queryKey: ['settings'] });

        // Show notification
        toast({
          title: "Settings Updated",
          description: "Settings have been updated by another user.",
        });
      }
    },
    {
      eventType: 'shift_template_updated',
      handler: () => {
        // Invalidate shift templates when they are updated
        queryClient.invalidateQueries({ queryKey: ['shifts'] });
      }
    }
  ]);

  const { data: localSettings, isLoading: isLoadingSettings, error: settingsError } = useQuery<Settings, Error, Settings>({
    queryKey: ["settings"],
    queryFn: getSettings,
    select: (fetchedData: Settings): Settings => {
      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...fetchedData,
        general: {
          ...DEFAULT_SETTINGS.general,
          ...(fetchedData.general || {}),
          opening_days: {
            ...DEFAULT_SETTINGS.general.opening_days,
            ...(fetchedData.general?.opening_days || {})
          }
        },
        scheduling: {
          ...DEFAULT_SETTINGS.scheduling,
          ...(fetchedData.scheduling || {}),
          generation_requirements: {
            ...(DEFAULT_SETTINGS.scheduling?.generation_requirements || {}),
            ...(fetchedData.scheduling?.generation_requirements || {})
          }
        },
        display: {
          ...DEFAULT_SETTINGS.display,
          ...(fetchedData.display || {}),
          dark_theme: {
            ...(DEFAULT_SETTINGS.display?.dark_theme || {}),
            ...(fetchedData.display?.dark_theme || {})
          }
        },
        pdf_layout: {
          ...DEFAULT_SETTINGS.pdf_layout,
          ...(fetchedData.pdf_layout || {}),
          margins: { ...(DEFAULT_SETTINGS.pdf_layout?.margins || {}), ...(fetchedData.pdf_layout?.margins || {}) },
          table_style: { ...(DEFAULT_SETTINGS.pdf_layout?.table_style || {}), ...(fetchedData.pdf_layout?.table_style || {}) },
          fonts: { ...(DEFAULT_SETTINGS.pdf_layout?.fonts || {}), ...(fetchedData.pdf_layout?.fonts || {}) },
          content: { ...(DEFAULT_SETTINGS.pdf_layout?.content || {}), ...(fetchedData.pdf_layout?.content || {}) },
        },
        employee_groups: {
          ...DEFAULT_SETTINGS.employee_groups, // Start with all defaults for employee_groups
          ...(fetchedData.employee_groups || {}), // Spread fetched top-level employee_group props if any

          // For each type array, decide whether to use fetched or default
          employee_types: (
            (fetchedData.employee_groups?.employee_types && fetchedData.employee_groups.employee_types.length > 0)
              ? fetchedData.employee_groups.employee_types
              : DEFAULT_SETTINGS.employee_groups?.employee_types || []
          ).map(et => ({ ...et, type: "employee_type" as const })),

          shift_types: (
            (fetchedData.employee_groups?.shift_types && fetchedData.employee_groups.shift_types.length > 0)
              ? fetchedData.employee_groups.shift_types
              : DEFAULT_SETTINGS.employee_groups?.shift_types || []
          ).map(st => ({
            ...st,
            type: "shift_type" as const,
            autoAssignOnly: st.autoAssignOnly !== undefined ? st.autoAssignOnly : false // Ensure boolean
          })),

          absence_types: (
            (fetchedData.employee_groups?.absence_types && fetchedData.employee_groups.absence_types.length > 0)
              ? fetchedData.employee_groups.absence_types
              : DEFAULT_SETTINGS.employee_groups?.absence_types || []
          ).map(at => ({ ...at, type: "absence_type" as const })),
        },
        availability_types: {
          ...DEFAULT_SETTINGS.availability_types, // Base defaults for availability_types structure
          ...(fetchedData.availability_types || {}), // Overwrite with fetched availability_types structure if it exists
          types: (
            fetchedData.availability_types?.types && fetchedData.availability_types.types.length > 0
              ? fetchedData.availability_types.types // Use fetched if present and not empty
              : DEFAULT_SETTINGS.availability_types?.types || [] // Otherwise, use default types or an empty array
          ).map(avail => {
            const defaultAvail = DEFAULT_SETTINGS.availability_types?.types?.find(dt => dt.id === avail.id);
            return {
              ...(defaultAvail || {}), // Spread default for this specific ID first
              ...avail, // Then spread fetched, overwriting defaults if fields exist in fetched
              type: avail.type || defaultAvail?.type || 'availability_type' as const, // Ensure type
              // Ensure color has a fallback if missing from both fetched and default for this ID
              color: avail.color || defaultAvail?.color || '#808080', // Fallback to gray
              // Ensure is_available has a fallback
              is_available: avail.is_available !== undefined
                ? avail.is_available
                : (defaultAvail?.is_available !== undefined
                  ? defaultAvail.is_available
                  : true // Default to true if completely missing
                ),
              // Ensure priority has a fallback
              priority: avail.priority !== undefined
                ? avail.priority
                : (defaultAvail?.priority !== undefined
                  ? defaultAvail.priority
                  : 0 // Default to 0 if completely missing
                )
            };
          })
        },
        actions: {
          ...(DEFAULT_SETTINGS.actions || {}),
          ...(fetchedData.actions || {}),
          demo_data: {
            ...(DEFAULT_SETTINGS.actions?.demo_data || {}),
            ...(fetchedData.actions?.demo_data || {})
          }
        },
        ai_scheduling: {
          ...(DEFAULT_SETTINGS.ai_scheduling || {}),
          ...(fetchedData.ai_scheduling || {})
        }
      };
      return mergedSettings as Settings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // State to manage local edits before debounced save
  const [editableSettings, setEditableSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (localSettings) {
      setEditableSettings(localSettings);
    }
  }, [localSettings]);

  const mutation: UseMutationResult<Settings, Error, Settings, unknown> = useMutation<Settings, Error, Settings>({
    mutationFn: updateSettings,
    onSuccess: () => {
      // Don't invalidate queries here to avoid conflicts with manual updates
      // queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Settings Saved",
        description: "Your changes have been saved successfully.",
        variant: "default",
      });
      // Optionally, update editableSettings directly from server response
      // setEditableSettings(data); 
    },
    onError: (error: Error) => {
      toast({
        title: "Error Saving Settings",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const debouncedUpdateSettings = useDebouncedCallback((settingsToSave: Settings) => {
    mutation.mutate(settingsToSave);
  }, 2000);

  const handleSave = (
    category: keyof Settings,
    updates: Partial<Settings[typeof category]>,
  ) => {
    setEditableSettings(prevSettings => {
      const currentCategoryState = prevSettings[category];
      let newCategoryState;

      if (
        typeof currentCategoryState === "object" &&
        currentCategoryState !== null &&
        typeof updates === 'object' && // Ensure updates is also an object
        updates !== null
      ) {
        newCategoryState = { ...currentCategoryState, ...updates };
      } else {
        // If currentCategoryState is not an object, or updates is not, directly assign updates.
        // This path might need careful consideration based on how non-object categories are handled.
        newCategoryState = updates;
      }

      const updatedSettings: Settings = {
        ...prevSettings,
        [category]: newCategoryState,
      };
      debouncedUpdateSettings(updatedSettings);
      return updatedSettings;
    });
  };

  const handleSettingChange = (
    category: keyof Settings,
    key: string,
    value: string | number | boolean | Record<string, unknown> | null,
    isNumeric: boolean = false,
  ) => {
    const parsedValue = isNumeric ? parseFloat(String(value)) : value;

    setEditableSettings(prevSettings => {
      const currentCategoryState = prevSettings[category] || {};
      const newCategoryState = {
        ...(typeof currentCategoryState === 'object' && currentCategoryState !== null ? currentCategoryState : {}),
        [key]: parsedValue,
      };
      const updatedSettings = {
        ...prevSettings,
        [category]: newCategoryState,
      };
      debouncedUpdateSettings(updatedSettings);
      return updatedSettings;
    });
  };

  const handleImmediateUpdate = () => {
    debouncedUpdateSettings.cancel();
    mutation.mutate(editableSettings, { // Use editableSettings
      onSuccess: (updatedData) => {
        queryClient.setQueryData(["settings"], updatedData);
        setEditableSettings(updatedData); // Update editable state
        toast({
          title: "Settings Saved",
          description:
            "Your settings have been successfully saved to the server.",
        });
      },
    });
  };

  // Removed unused time and diagnostics helpers after UI refactor

  const handleDisplaySettingChange = (
    key: keyof Settings["display"],
    value: string | number | boolean | Record<string, unknown> | null,
  ) => {
    const updatedDisplaySettings = {
      ...(editableSettings.display || DEFAULT_SETTINGS.display),
      [key]: value,
    };
    const updatedSettings = {
      ...editableSettings,
      display: updatedDisplaySettings,
    };
    setEditableSettings(updatedSettings);

    // Cancel any pending debounced updates and immediately save
    debouncedUpdateSettings.cancel();
    mutation.mutate(updatedSettings, {
      onSuccess: (updatedData) => {
        queryClient.setQueryData(["settings"], updatedData);
        setEditableSettings(updatedData);
        toast({
          title: "Settings Saved",
          description: "Display settings have been saved successfully.",
        });
      },
    });
  };

  const handleAiSchedulingChange = (
    key: keyof NonNullable<Settings["ai_scheduling"]>,
    value: string | number | boolean | Record<string, unknown> | null,
  ) => {
    const updatedAiSettings = {
      ...(editableSettings.ai_scheduling || DEFAULT_SETTINGS.ai_scheduling),
      [key]: value,
    };
    const updatedSettings = {
      ...editableSettings,
      ai_scheduling: updatedAiSettings,
    };
    setEditableSettings(updatedSettings);

    // Cancel any pending debounced updates and immediately save
    debouncedUpdateSettings.cancel();
    mutation.mutate(updatedSettings, {
      onSuccess: (updatedData) => {
        queryClient.setQueryData(["settings"], updatedData);
        setEditableSettings(updatedData);
        toast({
          title: "Settings Saved",
          description: "AI scheduling settings have been saved successfully.",
        });
      },
    });
  };

  const handleWeekNavigationChange = (
    key: keyof NonNullable<Settings["week_navigation"]>,
    value: boolean | string,
  ) => {
    const updatedWeekNavSettings = {
      ...(editableSettings.week_navigation || DEFAULT_SETTINGS.week_navigation),
      [key]: value,
    };
    const updatedSettings = {
      ...editableSettings,
      week_navigation: updatedWeekNavSettings,
    };
    setEditableSettings(updatedSettings);

    // Cancel any pending debounced updates and immediately save
    debouncedUpdateSettings.cancel();
    mutation.mutate(updatedSettings, {
      onSuccess: (updatedData) => {
        queryClient.setQueryData(["settings"], updatedData);
        setEditableSettings(updatedData);
        toast({
          title: "Settings Saved",
          description: "Week navigation settings have been saved successfully.",
        });
      },
    });
  };

  const renderSectionContent = () => {
    const currentSectionMeta = sections.find((sec) => sec.id === activeSection);
    if (!currentSectionMeta) {
      return <PlaceholderContent title="Section not found" />;
    }

    if (isLoadingSettings && !localSettings) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-4 animate-spin" />
          <span>Loading settings...</span>
        </div>
      );
    }

    if (settingsError) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            Error loading settings:{" "}
            {settingsError.message || "An unknown error occurred"}. Please try again
            later or contact support.
          </AlertDescription>
        </Alert>
      );
    }

    switch (activeSection) {
      case "general_store_setup":
        return (
          <GeneralStoreSetupSection
            settings={editableSettings.general}
            onInputChange={(key, value, isNumeric) =>
              handleSettingChange("general", key, value, isNumeric)
            }
            onOpeningDaysChange={(dayIndex, checked) => {
              const days = editableSettings.general?.opening_days || {};
              const dayName = [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
              ][dayIndex];
              handleSettingChange("general", "opening_days", {
                ...days,
                [dayName]: checked,
              });
            }}
          />
        );
      case "scheduling_engine":
        return (
          <SchedulingEngineSection
            settings={editableSettings.scheduling || DEFAULT_SETTINGS.scheduling}
            onInputChange={(key, value, isNumeric) =>
              handleSettingChange("scheduling", key, value, isNumeric)
            }
            onDiagnosticsChange={(checked) => {
              const scheduling = editableSettings.scheduling || DEFAULT_SETTINGS.scheduling;
              const updatedSchedSettings = {
                ...scheduling,
                enable_diagnostics: checked,
              };
              handleSave("scheduling", updatedSchedSettings);
            }}
            onGenerationSettingsUpdate={(genUpdates) => {
              const scheduling = editableSettings.scheduling || DEFAULT_SETTINGS.scheduling;
              const currentGenReqsFull: NonNullable<typeof DEFAULT_SETTINGS.scheduling>["generation_requirements"] =
                (scheduling.generation_requirements || DEFAULT_SETTINGS.scheduling.generation_requirements)!;
              const updatedGenReqs: NonNullable<typeof DEFAULT_SETTINGS.scheduling>["generation_requirements"] = {
                ...currentGenReqsFull,
                ...genUpdates,
              } as NonNullable<typeof DEFAULT_SETTINGS.scheduling>["generation_requirements"];
              handleSave("scheduling", {
                ...scheduling,
                generation_requirements: updatedGenReqs,
              });
            }}
          />
        );
      case "employee_shift_definitions":
        return (
          <EmployeeShiftDefinitionsSection
            settings={editableSettings.employee_groups}
            onUpdate={handleSave}
            onImmediateUpdate={handleImmediateUpdate}
            isLoading={mutation.isPending} // Corrected: use isPending for mutation
          />
        );
      case "availability_configuration":
        return (
          <AvailabilityConfigurationSection
            settings={editableSettings.availability_types || { types: [] }}
            onUpdate={(updatedTypes) =>
              handleSave("availability_types", { types: updatedTypes })
            }
            onImmediateUpdate={handleImmediateUpdate}
            isLoading={isLoadingSettings || mutation.isPending} // Corrected: use isPending for mutation
          />
        );
      case "week_navigation":
        return (
          <WeekNavigationSection
            settings={editableSettings.week_navigation || {
              week_weekend_start: "MONDAY",
              week_month_boundary_mode: "keep_intact",
            }}
            onChange={handleWeekNavigationChange}
            onImmediateUpdate={handleImmediateUpdate}
          />
        );
      case "appearance_display":
        return (
          <AppearanceDisplaySection
            settings={editableSettings.display}
            onDisplaySettingChange={handleDisplaySettingChange}
            onImmediateUpdate={handleImmediateUpdate}
            isLoading={mutation.isPending}
          />
        );
      case "integrations_ai":
        return (
          <IntegrationsAISection
            settings={editableSettings.ai_scheduling}
            onAiSchedulingChange={handleAiSchedulingChange}
            onImmediateUpdate={handleImmediateUpdate}
          />
        );
      case "data_management":
        return (
          <DataManagementSection />
        );
      case "holiday_management":
        return <HolidayManagement />;

      default:
        return <PlaceholderContent title={currentSectionMeta.title} />;
    }
  };

  // Main layout wrapper
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <PageHeader
        className="mb-6"
        title="Application Settings"
        description="Manage your application settings across various modules. Select a category from the sidebar to view and edit specific settings. All changes are auto-saved with a short delay."
        actions={
          mutation.isPending ? (
            <span className="ml-2 text-sm text-muted-foreground flex items-center">
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : null
        }
      />
      <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0">
        <nav className="md:w-1/4 lg:w-1/5 space-y-1">
          {sections.map((section) => (
            <Button
              key={section.id}
              variant={activeSection === section.id ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveSection(section.id)}
            >
              {section.title}
            </Button>
          ))}
        </nav>
        <main className="md:w-3/4 lg:w-4/5">
          <div className="bg-card p-6 rounded-lg border min-h-[300px]">
            {renderSectionContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
