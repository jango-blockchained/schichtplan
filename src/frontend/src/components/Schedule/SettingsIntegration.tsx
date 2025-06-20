import { useToast } from '@/components/ui/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';

// Placeholder types - replace with actual types from your codebase
interface Settings {
  general?: {
    opening_days?: Record<string, boolean>;
  };
  ai_scheduling?: {
    enabled?: boolean;
  };
  scheduling?: {
    enable_diagnostics?: boolean;
  };
  display?: {
    view_mode?: string;
  };
}

// Placeholder API functions - replace with actual API calls
const getSettings = async (): Promise<Settings> => {
  // Implementation needed
  return {};
};

const updateSettings = async (settings: Partial<Settings>): Promise<Settings> => {
  // Implementation needed
  return settings as Settings;
};

interface SettingsIntegrationProps {
  children: (settingsState: SettingsState) => React.ReactNode;
}

interface SettingsState {
  // Settings data
  settings: Settings | undefined;
  isLoading: boolean;
  error: Error | null;
  
  // Settings operations
  updateSettings: (newSettings: Partial<Settings>) => Promise<Settings>;
  refetchSettings: () => void;
  
  // Derived settings
  openingDays: number[];
  isAiEnabled: boolean;
  enableDiagnostics: boolean;
  viewMode: string;
}

export function SettingsIntegration({ children }: SettingsIntegrationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Settings query
  const settingsQuery = useQuery<Settings, Error>({
    queryKey: ["settings"] as const,
    queryFn: getSettings,
    retry: 3,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      toast({
        title: "Einstellungen gespeichert",
        description: "Die Einstellungen wurden erfolgreich aktualisiert.",
      });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Speichern",
        description: `Einstellungen konnten nicht gespeichert werden: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Extract opening days from settings
  const openingDays = React.useMemo(() => {
    if (!settingsQuery.data?.general?.opening_days) {
      return [];
    }
    
    return Object.entries(settingsQuery.data.general.opening_days)
      .filter(([, isOpen]) => isOpen) // Filter for days that are open
      .map(([dayName]) => {
        const lowerDayName = dayName.toLowerCase();
        switch (lowerDayName) {
          case 'monday': return 0; // Monday=0
          case 'tuesday': return 1;
          case 'wednesday': return 2;
          case 'thursday': return 3;
          case 'friday': return 4;
          case 'saturday': return 5;
          case 'sunday': return 6; // Sunday=6
          default: return -1; // Should not happen with valid data
        }
      })
      .filter(dayIndex => dayIndex !== -1) // Remove any invalid entries
      .sort((a, b) => a - b);
  }, [settingsQuery.data]);

  // Derived settings
  const isAiEnabled = settingsQuery.data?.ai_scheduling?.enabled ?? false;
  const enableDiagnostics = settingsQuery.data?.scheduling?.enable_diagnostics ?? false;
  const viewMode = settingsQuery.data?.display?.view_mode ?? 'weekly';

  // Settings state object
  const settingsState: SettingsState = {
    // Settings data
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    
    // Settings operations
    updateSettings: updateSettingsMutation.mutateAsync,
    refetchSettings: settingsQuery.refetch,
    
    // Derived settings
    openingDays,
    isAiEnabled,
    enableDiagnostics,
    viewMode,
  };

  return <>{children(settingsState)}</>;
}
