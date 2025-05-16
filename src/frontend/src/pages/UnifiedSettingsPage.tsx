import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebouncedCallback } from "use-debounce";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/PageHeader";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import type { Settings } from "@/types/index";
import { getSettings, updateSettings } from "@/services/api"; // Assuming API functions are here
import { GeneralStoreSetupSection } from "@/components/UnifiedSettingsSections/GeneralStoreSetupSection";
import { DEFAULT_SETTINGS } from "@/hooks/useSettings"; // Assuming default settings are here
import { SchedulingEngineSection } from "@/components/UnifiedSettingsSections/SchedulingEngineSection";
import { EmployeeShiftDefinitionsSection } from "@/components/UnifiedSettingsSections/EmployeeShiftDefinitionsSection";
import { AvailabilityConfigurationSection } from "@/components/UnifiedSettingsSections/AvailabilityConfigurationSection";
import AppearanceDisplaySection from "@/components/UnifiedSettingsSections/AppearanceDisplaySection";
import IntegrationsAISection from "@/components/UnifiedSettingsSections/IntegrationsAISection";
import DataManagementSection from "@/components/UnifiedSettingsSections/DataManagementSection";
import NotificationsSection from "@/components/UnifiedSettingsSections/NotificationsSection";

type SectionId =
  | "general_store_setup"
  | "scheduling_engine"
  | "employee_shift_definitions"
  | "availability_configuration"
  | "appearance_display"
  | "integrations_ai"
  | "data_management"
  | "notifications";

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
    id: "notifications",
    title: "Notifications" /*, component: PlaceholderContent*/,
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

  // Initialize with the new nested Settings structure
  const [localSettings, setLocalSettings] = useState<Settings>({
    id: 0, // ID remains top-level
    general: {
      store_name: "Store",
      store_address: "",
      // store_contact: "", // Removed, use phone/email
      store_phone: null,
      store_email: null,
      timezone: "Europe/Berlin",
      language: "de",
      date_format: "DD.MM.YYYY",
      time_format: "24h",
      store_opening: "09:00",
      store_closing: "20:00",
      keyholder_before_minutes: 30,
      keyholder_after_minutes: 30,
      opening_days: { // Default to all closed
        "0": false, "1": false, "2": false, "3": false, "4": false, "5": false, "6": false
      },
      special_hours: {}, // Assuming this structure, confirm if used
      special_days: {},
    },
    scheduling: {
      scheduling_resource_type: "shifts",
      default_shift_duration: 8,
      min_break_duration: 30,
      max_daily_hours: 10,
      max_weekly_hours: 40,
      min_rest_between_shifts: 11,
      scheduling_period_weeks: 1,
      auto_schedule_preferences: true,
      enable_diagnostics: false,
      scheduling_algorithm: "standard",
      max_generation_attempts: 100,
      generation_requirements: {
        enforce_minimum_coverage: true,
        enforce_contracted_hours: true,
        enforce_keyholder_coverage: true,
        enforce_rest_periods: true,
        enforce_early_late_rules: true,
        enforce_employee_group_rules: true,
        enforce_break_rules: true,
        enforce_max_hours: true,
        enforce_consecutive_days: true,
        enforce_weekend_distribution: true,
        enforce_shift_distribution: true,
        enforce_availability: true,
        enforce_qualifications: true,
        enforce_opening_hours: true,
      },
    },
    display: {
      theme: "light",
      primary_color: "#000000",
      secondary_color: "#000000",
      accent_color: "#000000",
      background_color: "#ffffff",
      surface_color: "#ffffff",
      text_color: "#000000",
      dark_theme: {
        primary_color: "#ffffff",
        secondary_color: "#ffffff",
        accent_color: "#ffffff",
        background_color: "#000000",
        surface_color: "#000000",
        text_color: "#ffffff",
      },
      show_sunday: false,
      show_weekdays: true,
      start_of_week: 1, // Monday
      email_notifications: false,
      schedule_published: false,
      shift_changes: false,
      time_off_requests: false,
    },
    pdf_layout: {
      page_size: "A4",
      orientation: "portrait",
      margins: { top: 1, right: 1, bottom: 1, left: 1 }, // Assuming cm or similar unit
      table_style: {
        header_bg_color: "#F0F0F0",
        border_color: "#CCCCCC",
        text_color: "#333333",
        header_text_color: "#000000",
      },
      fonts: {
        family: "Arial",
        size: 10,
        header_size: 12,
      },
      content: {
        show_employee_id: false,
        show_position: true,
        show_breaks: true,
        show_total_hours: true,
      },
    },
    employee_groups: {
      employee_types: [],
      shift_types: [],
      absence_types: [],
    },
    availability_types: {
      types: [],
    },
    actions: {
      demo_data: {
        selected_module: "",
        last_execution: null,
      },
    },
    ai_scheduling: {
      enabled: false,
      api_key: null,
    },
  });

  const { data: settingsData, isLoading: isLoadingSettings, error: settingsError } = useQuery<Settings, Error>(
    ["settings"],
    getSettings,
    {
      onSuccess: (data) => {
        // Deep merge with DEFAULT_SETTINGS to ensure all keys are present
        // This is a simple merge, for more complex scenarios, a deep merge utility might be needed
        const mergedSettings = { 
            ...DEFAULT_SETTINGS, 
            ...data, 
            // Ensure nested objects are also merged, example for general and scheduling
            general: { ...DEFAULT_SETTINGS.general, ...(data.general || {}) },
            scheduling: { ...DEFAULT_SETTINGS.scheduling, ...(data.scheduling || {}), 
                generation_requirements: { 
                    ...(DEFAULT_SETTINGS.scheduling?.generation_requirements || {}), 
                    ...(data.scheduling?.generation_requirements || {}) 
                }
            },
            display: { ...DEFAULT_SETTINGS.display, ...(data.display || {}),
                dark_theme: { 
                    ...(DEFAULT_SETTINGS.display?.dark_theme || {}), 
                    ...(data.display?.dark_theme || {}) 
                }
            },
            pdf_layout: { ...DEFAULT_SETTINGS.pdf_layout, ...(data.pdf_layout || {}),
                margins: { ...(DEFAULT_SETTINGS.pdf_layout?.margins || {}), ...(data.pdf_layout?.margins || {}) },
                table_style: { ...(DEFAULT_SETTINGS.pdf_layout?.table_style || {}), ...(data.pdf_layout?.table_style || {}) },
                fonts: { ...(DEFAULT_SETTINGS.pdf_layout?.fonts || {}), ...(data.pdf_layout?.fonts || {}) },
                content: { ...(DEFAULT_SETTINGS.pdf_layout?.content || {}), ...(data.pdf_layout?.content || {}) },
            },
            employee_groups: { ...DEFAULT_SETTINGS.employee_groups, ...(data.employee_groups || {}),
                employee_types: [ ...(DEFAULT_SETTINGS.employee_groups?.employee_types || []), ...(data.employee_groups?.employee_types || []) ],
                shift_types: [ ...(DEFAULT_SETTINGS.employee_groups?.shift_types || []), ...(data.employee_groups?.shift_types || []) ],
                absence_types: [ ...(DEFAULT_SETTINGS.employee_groups?.absence_types || []), ...(data.employee_groups?.absence_types || []) ],
            },
            availability_types: { ...DEFAULT_SETTINGS.availability_types, ...(data.availability_types || {}),
                types: [ ...(DEFAULT_SETTINGS.availability_types?.types || []), ...(data.availability_types?.types || []) ],
            },
            actions: { ...DEFAULT_SETTINGS.actions, ...(data.actions || {}),
                demo_data: { ...(DEFAULT_SETTINGS.actions?.demo_data || {}), ...(data.actions?.demo_data || {}) },
            },
            ai_scheduling: { ...DEFAULT_SETTINGS.ai_scheduling, ...(data.ai_scheduling || {}) },
        };
        setLocalSettings(mergedSettings);
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  const mutation = useMutation<Settings, Error, Settings>(updateSettings, {
    onSuccess: (data) => {
      queryClient.invalidateQueries(["settings"]);
      // setLocalSettings(data); // Optimistic update can be tricky with debouncing, rely on refetch for now
      toast({
        title: "Settings Saved",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error) => {
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
    category: keyof Settings, // Simplified category to be any key of Settings
    updates: Partial<Settings[typeof category]>,
  ) => {
    // localSettings is always defined now, no need for null check
    const currentCategoryState = localSettings[category];
    let newCategoryState;

    if (
      typeof currentCategoryState === "object" &&
      currentCategoryState !== null
    ) {
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
    debouncedUpdateSettings(updatedSettings);
  };

  const handleSettingChange = (
    category: keyof Settings,
    key: string,
    value: any,
    isNumeric: boolean = false,
  ) => {
    // localSettings is always defined now, no need for null check
    const parsedValue = isNumeric ? parseFloat(value) : value;
    const currentCategoryState = localSettings[category] || {};

    handleSave(category, {
      ...currentCategoryState,
      [key]: parsedValue,
    });
  };

  const handleImmediateUpdate = () => {
    // localSettings is always defined now, no need for null check
    debouncedUpdateSettings.cancel(); // Cancel any pending debounced updates
    mutation.mutate(localSettings, {
      onSuccess: (updatedData) => {
        queryClient.setQueryData(["settings"], updatedData);
        setLocalSettings(updatedData);
        toast({
          title: "Settings Saved",
          description:
            "Your settings have been successfully saved to the server.",
        });
      },
    });
  };

  const timeStringToDate = (timeStr: string | null | undefined): Date => {
    if (!timeStr) timeStr = "00:00";
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  const dateToTimeString = (date: Date | null | undefined): string => {
    if (!date) return "00:00";
    return format(date, "HH:mm");
  };

  const handleDiagnosticsChange = (checked: boolean) => {
    // localSettings is always defined now, no need for null check
    const scheduling = localSettings.scheduling || {};

    const updatedSchedSettings = {
      ...scheduling,
      enable_diagnostics: checked,
    };
    // Directly call handleSave for the 'scheduling' category
    handleSave("scheduling" as any, updatedSchedSettings); // Cast as any for now, or refine handleSave type
    // Potentially call handleImmediateUpdate() if this change should be saved instantly
    // handleImmediateUpdate();
  };

  const handleDisplaySettingChange = (
    key: keyof Settings["display"],
    value: any,
  ) => {
    // localSettings is always defined now, no need for null check
    const updatedDisplaySettings = {
      ...(localSettings.display || DEFAULT_SETTINGS.display),
      [key]: value,
    };

    // Update local state and debounce the save for general persistence
    handleSave("display", updatedDisplaySettings);

    // For display changes, especially theme, an immediate effect and save is often desired.
    // We can call handleImmediateUpdate here if all display changes should be instant.
    // Alternatively, make it conditional based on the 'key' if only some are instant.
    // For simplicity now, let's make all display changes attempt an immediate save.
    handleImmediateUpdate();
  };

  // Handler for AI Scheduling settings changes
  const handleAiSchedulingChange = (
    key: keyof NonNullable<Settings["ai_scheduling"]>, // 'enabled' | 'api_key'
    value: any,
  ) => {
    // localSettings is always defined now, no need for null check
    const updatedAiSettings = {
      ...(localSettings.ai_scheduling || DEFAULT_SETTINGS.ai_scheduling),
      [key]: value,
    };
    handleSave("ai_scheduling", updatedAiSettings);
    // API key changes might benefit from immediate update on blur, which is handled by passing handleImmediateUpdate
    // The switch for 'enabled' will also trigger handleSave, and if an immediate save is desired for that too,
    // handleImmediateUpdate() could be called here unconditionally or passed to the component to decide.
    // For now, pass handleImmediateUpdate for the onBlur of the API key input.
  };

  const renderSectionContent = () => {
    const currentSectionMeta = sections.find((sec) => sec.id === activeSection);
    if (!currentSectionMeta) {
      return <PlaceholderContent title="Section not found" />;
    }

    // Only show loading indicator if explicitly loading from API and we have no settings data yet
    if (isLoadingSettings && !settingsData) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-4 animate-spin" />
          <span>Loading settings...</span>
        </div>
      );
    }

    // Explicit error check
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

    // localSettings is always defined now due to useState initialization

    // If we've reached this point, localSettings should be a valid Settings object.
    switch (activeSection) {
      case "general_store_setup":
        return (
          <GeneralStoreSetupSection
            settings={localSettings.general || {}}
            onInputChange={(key, value, isNumeric) =>
              handleSettingChange("general", key, value, isNumeric)
            }
            onOpeningDaysChange={(dayIndex, checked) => {
              const currentOpeningDays =
                localSettings.general?.opening_days ||
                DEFAULT_SETTINGS.general.opening_days;
              const updatedOpeningDays = {
                ...currentOpeningDays,
                [dayIndex.toString()]: checked,
              };
              handleSave("general", { opening_days: updatedOpeningDays });
            }}
            onSpecialDaysChange={(specialDays) => {
              handleSave("general", { special_days: specialDays });
            }}
            timeStringToDate={timeStringToDate}
            dateToTimeString={dateToTimeString}
            onImmediateUpdate={handleImmediateUpdate}
          />
        );
      case "scheduling_engine":
        return (
          <SchedulingEngineSection
            settings={localSettings.scheduling || {}}
            onInputChange={(key, value, isNumeric) =>
              handleSettingChange("scheduling", key, value, isNumeric)
            }
            onDiagnosticsChange={(checked) => {
              const scheduling = localSettings.scheduling || {};
              const updatedSchedSettings = {
                ...scheduling,
                enable_diagnostics: checked,
              };
              handleSave("scheduling", updatedSchedSettings);
            }}
            onGenerationSettingsUpdate={(genUpdates) => {
              const scheduling = localSettings.scheduling || {};
              const currentGenReqs =
                scheduling.generation_requirements ||
                DEFAULT_SETTINGS.scheduling.generation_requirements;
              const updatedGenReqs = { ...currentGenReqs, ...genUpdates };
              handleSave("scheduling", {
                ...scheduling,
                generation_requirements: updatedGenReqs,
              });
            }}
            onImmediateUpdate={handleImmediateUpdate}
          />
        );
      case "employee_shift_definitions":
        return (
          <EmployeeShiftDefinitionsSection
            settings={localSettings.employee_groups || {}}
            onUpdate={(category, updates) => handleSave(category, updates)}
            onImmediateUpdate={handleImmediateUpdate}
          />
        );
      case "availability_configuration":
        return (
          <AvailabilityConfigurationSection
            settings={localSettings.availability_types || { types: [] }}
            onUpdate={(updatedTypes) =>
              handleSave("availability_types", { types: updatedTypes })
            }
            onImmediateUpdate={handleImmediateUpdate}
          />
        );
      case "appearance_display":
        return (
          <AppearanceDisplaySection
            settings={localSettings.display || {}}
            onDisplaySettingChange={handleDisplaySettingChange}
          />
        );
      case "integrations_ai":
        return (
          <IntegrationsAISection
            settings={
              localSettings.ai_scheduling || { enabled: false, api_key: "" }
            }
            onSettingChange={handleAiSchedulingChange}
            onImmediateUpdate={handleImmediateUpdate}
          />
        );
      case "data_management":
        // DataManagementSection doesn't seem to directly use nested settings
        return <DataManagementSection />;
      case "notifications":
        return (
          <NotificationsSection
            settings={localSettings.display || {}}
            onDisplaySettingChange={handleDisplaySettingChange}
          />
        );
      default:
        return <PlaceholderContent title={currentSectionMeta.title} />;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <PageHeader className="mb-6">
        <PageHeaderHeading>Application Settings</PageHeaderHeading>
        <PageHeaderDescription>
          Manage and customize various aspects of the application.
          {mutation.isLoading && (
            <span className="ml-2 text-sm text-muted-foreground flex items-center">
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Saving...
            </span>
          )}
        </PageHeaderDescription>
      </PageHeader>
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
        <main className="md:w-3/4 lg:w-4/5 bg-card p-6 rounded-lg shadow min-h-[300px]">
          {renderSectionContent()}
        </main>
      </div>
    </div>
  );
}
