import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleDisplay, ScheduleViewType } from './ScheduleDisplay';
import { ScheduleActions } from './ScheduleActions';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Schedule, ScheduleUpdate } from '@/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSchedules, updateSchedule, generateSchedule, getSettings, generateOptimizedDemoData, resetOptimizedDemoDataStatus } from '@/services/api';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from "@/components/ui/button";
import { ScheduleOptimizationControls } from "./ScheduleOptimizationControls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

// Define a simplified schedule response type for the function return
interface SimpleScheduleResponse {
  schedules: Schedule[];
  versions?: number[];
}

export function SchedulePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewType, setViewType] = useState<ScheduleViewType>("table");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isFetching, setIsFetching] = useState(false);
  const [isGeneratingOptimized, setIsGeneratingOptimized] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState({
    progress: 0,
    message: '',
    isComplete: false
  });

  // Add state for visibility settings
  const [showOnlyOpeningDays, setShowOnlyOpeningDays] = useState(true);
  const [showSundays, setShowSundays] = useState(false);
  const [showWeekdays, setShowWeekdays] = useState(true);
  
  // Fetch settings with react-query
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings
  });

  // Fetch schedules
  const {
    data: schedulesData,
    isLoading
  } = useQuery<SimpleScheduleResponse>({
    queryKey: ['schedules', dateRange?.from, dateRange?.to, 'latest'],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        return { schedules: [] };
      }
      
      setIsFetching(true);
      try {
        return await getSchedules(
          dateRange.from.toISOString().split('T')[0],
          dateRange.to.toISOString().split('T')[0]
        );
      } finally {
        setIsFetching(false);
      }
    },
    enabled: !!dateRange?.from && !!dateRange?.to
  });

  const schedules = schedulesData?.schedules || [];
  
  // Fetch employee absences
  const { data: absencesData } = useQuery({
    queryKey: ['employeeAbsences'],
    queryFn: async () => {
      // Mock data for now
      return {};
    },
    enabled: !!dateRange
  });

  const employeeAbsences = absencesData || {};
  
  // Fetch absence types
  const { data: absenceTypes } = useQuery({
    queryKey: ['absenceTypes'],
    queryFn: async () => {
      // Mock data for now
      return [
        { id: 'vacation', name: 'Urlaub', color: '#4CAF50', type: 'absence' as const },
        { id: 'sick', name: 'Krank', color: '#F44336', type: 'absence' as const },
        { id: 'personal', name: 'Persönlich', color: '#2196F3', type: 'absence' as const },
      ];
    }
  });

  // Update schedule mutation
  const updateMutation = useMutation({
    mutationFn: ({ scheduleId, updates }: { scheduleId: number, updates: ScheduleUpdate }) => 
      updateSchedule(scheduleId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: "Erfolg",
        description: "Dienstplan wurde aktualisiert",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: `Dienstplan konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      });
    }
  });

  // Generate schedule mutation
  const generateMutation = useMutation({
    mutationFn: ({ startDate, endDate, createEmptySchedules, version }: { 
      startDate: string, 
      endDate: string, 
      createEmptySchedules: boolean,
      version: number
    }) => generateSchedule(startDate, endDate, createEmptySchedules, version),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: "Erfolg",
        description: `Dienstplan wurde generiert. ${data.schedules?.length || 0} Schichten wurden erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: `Dienstplan konnte nicht generiert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      });
    }
  });

  // Generate optimized demo data mutation
  const generateOptimizedMutation = useMutation({
    mutationFn: () => generateOptimizedDemoData(),
    onSuccess: () => {
      toast({
        title: "Erfolg",
        description: "Optimierter Demo-Dienstplan wird generiert",
      });
      setIsGeneratingOptimized(true);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: `Demo-Dienstplan konnte nicht generiert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      });
    }
  });

  // Reset generation mutation
  const resetGenerationMutation = useMutation({
    mutationFn: () => resetOptimizedDemoDataStatus(),
    onSuccess: () => {
      setIsGeneratingOptimized(false);
      setOptimizationStatus({
        progress: 0,
        message: '',
        isComplete: false
      });
      toast({
        title: "Erfolg",
        description: "Generierungsstatus wurde zurückgesetzt",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: `Status konnte nicht zurückgesetzt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      });
    }
  });

  // Check generation status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/demo/optimized-status');
        const data = await response.json();
        
        if (data.status === 'in_progress') {
          setIsGeneratingOptimized(true);
          setOptimizationStatus({
            progress: data.progress || 0,
            message: data.message || '',
            isComplete: false
          });
        } else if (data.status === 'complete') {
          setIsGeneratingOptimized(false);
          setOptimizationStatus({
            progress: 100,
            message: 'Generierung abgeschlossen',
            isComplete: true
          });
          
          // Refresh schedules
          if (dateRange?.from && dateRange?.to) {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
          }
        } else if (data.status === 'not_started') {
          setIsGeneratingOptimized(false);
          setOptimizationStatus({
            progress: 0,
            message: '',
            isComplete: false
          });
        }
      } catch (error) {
        console.error('Failed to check generation status:', error);
      }
    };

    if (isGeneratingOptimized) {
      const intervalId = setInterval(checkStatus, 2000);
      return () => clearInterval(intervalId);
    } else {
      // Check once when component loads
      checkStatus();
    }
  }, [isGeneratingOptimized, dateRange, queryClient]);

  const handleGenerateSchedule = () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte wählen Sie einen Datumsbereich aus",
      });
      return;
    }

    generateOptimizedMutation.mutate();
  };

  const handleResetOptimizedDemoGeneration = () => {
    resetGenerationMutation.mutate();
  };

  const handleUpdateSchedule = async (scheduleId: number, updates: ScheduleUpdate) => {
    await updateMutation.mutateAsync({ scheduleId, updates });
  };

  const handleDrop = async (scheduleId: number, newEmployeeId: number, newDate: Date, newShiftId: number) => {
    try {
      await updateMutation.mutateAsync({
        scheduleId,
        updates: {
          employee_id: newEmployeeId,
          date: newDate.toISOString().split('T')[0],
          shift_id: newShiftId,
        }
      });
    } catch (error) {
      console.error('Error updating schedule on drop:', error);
    }
  };

  // Filter schedules based on store opening days
  const filteredSchedules = useMemo(() => {
    if (!schedules || !showOnlyOpeningDays || !settings) {
      return schedules;
    }

    return schedules.filter((schedule: Schedule) => {
      if (!schedule.date) return false;
      
      const scheduleDate = new Date(schedule.date);
      const dayIndex = scheduleDate.getDay().toString(); // 0 = Sunday, 6 = Saturday
      
      const isOpeningDay = settings.opening_days?.[dayIndex] || false;
      const isSunday = scheduleDate.getDay() === 0;
      
      // Apply filters
      if (isSunday && !showSundays) return false;
      if (!isSunday && !showWeekdays) return false;
      
      return showOnlyOpeningDays ? isOpeningDay : true;
    });
  }, [schedules, showOnlyOpeningDays, showSundays, showWeekdays, settings]);

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dienstplan</h1>
        
        <div className="flex gap-2">
          <ScheduleOptimizationControls 
            onGenerateSchedule={handleGenerateSchedule}
            isGenerating={isGeneratingOptimized}
            onResetGeneration={handleResetOptimizedDemoGeneration}
            generationProgress={optimizationStatus}
          />
          <DateRangePicker
            dateRange={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      <Card className="p-4">
        <Tabs defaultValue="view-settings" className="w-full">
          <TabsList>
            <TabsTrigger value="view-settings">Ansichtseinstellungen</TabsTrigger>
            <TabsTrigger value="filter-settings">Filtereinstellungen</TabsTrigger>
          </TabsList>
          
          <TabsContent value="view-settings" className="space-y-4 pt-4">
            <ScheduleActions 
              viewType={viewType} 
              onViewTypeChange={setViewType} 
            />
          </TabsContent>
          
          <TabsContent value="filter-settings" className="space-y-4 pt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-only-opening-days"
                  checked={showOnlyOpeningDays}
                  onCheckedChange={setShowOnlyOpeningDays}
                />
                <Label htmlFor="show-only-opening-days">Nur Öffnungstage anzeigen</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-sundays"
                  checked={showSundays}
                  onCheckedChange={setShowSundays}
                  disabled={!showOnlyOpeningDays}
                />
                <Label htmlFor="show-sundays" className={!showOnlyOpeningDays ? "text-muted-foreground" : ""}>
                  Sonntage anzeigen
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-weekdays"
                  checked={showWeekdays}
                  onCheckedChange={setShowWeekdays}
                  disabled={!showOnlyOpeningDays}
                />
                <Label htmlFor="show-weekdays" className={!showOnlyOpeningDays ? "text-muted-foreground" : ""}>
                  Wochentage anzeigen
                </Label>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <div className="relative">
        {isFetching && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        <ScheduleDisplay
          viewType={viewType}
          schedules={filteredSchedules || []}
          dateRange={dateRange}
          onDrop={handleDrop}
          onUpdate={handleUpdateSchedule}
          isLoading={isLoading || isLoadingSettings}
          employeeAbsences={employeeAbsences}
          absenceTypes={absenceTypes}
        />
      </div>
    </div>
  );
} 