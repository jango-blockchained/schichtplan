import { EnhancedDateRangeSelector } from "@/components/EnhancedDateRangeSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { WeekNavigator } from "@/components/WeekNavigator";
import { WeekVersionDisplay } from "@/components/WeekVersionDisplay";
import { DateRange } from "react-day-picker";

export interface NavigationSectionProps {
  // Navigation mode
  useWeekBasedNavigation: boolean;
  onNavigationModeChange: (isWeekBased: boolean) => void;
  
  // Date range management
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  weekAmount: number;
  onWeekAmountChange: (amount: number) => void;
  
  // Week-based navigation props
  currentWeekInfo?: {
    weekNumber: number;
    year: number;
    startDate: Date;
    endDate: Date;
    identifier: string;
    spansMonths?: boolean;
    months?: string[];
  };
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  isWeekNavigationLoading?: boolean;
  hasWeekVersions?: boolean;
  
  // Week version props
  weekVersionMeta?: {
    version: number;
    is_published: boolean;
    created_at: string;
    notes?: string;
    dateRange?: { start: string; end: string };
    isWeekBased?: boolean;
    status?: string;
    createdAt?: string;
  };
  selectedWeekVersion?: string | number;
  onCreateWeekVersion?: () => void;
  onSelectWeekVersion?: (version: string | number) => void;
  
  // Standard navigation props
  hasVersions?: boolean;
  currentVersion?: number;
  onCreateNewVersion?: () => void;
  onCreateNewVersionWithSpecificDateRange?: (options: { dateRange: DateRange }) => void;
  onWeekChange?: (weekOffset: number) => void;
}

export function NavigationSection({
  // Navigation mode
  useWeekBasedNavigation,
  onNavigationModeChange,
  
  // Date range
  dateRange,
  onDateRangeChange,
  weekAmount,
  onWeekAmountChange,
  
  // Week-based navigation
  currentWeekInfo,
  onNavigatePrevious,
  onNavigateNext,
  isWeekNavigationLoading = false,
  hasWeekVersions = false,
  
  // Week version
  weekVersionMeta,
  selectedWeekVersion,
  onCreateWeekVersion,
  onSelectWeekVersion,
  
  // Standard navigation
  hasVersions = false,
  currentVersion,
  onCreateNewVersion,
  onCreateNewVersionWithSpecificDateRange,
  onWeekChange,
}: NavigationSectionProps) {
  
  return (
    <div className="space-y-4">
      {/* Navigation Mode Toggle */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Navigation Modus</div>
              <div className="text-xs text-muted-foreground">
                {useWeekBasedNavigation 
                  ? 'Wochenbasierte Navigation (Beta) - ISO Kalenderwochen' 
                  : 'Standard Datumsbereich Navigation'}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm">Standard</span>
              <Switch
                checked={useWeekBasedNavigation}
                onCheckedChange={onNavigationModeChange}
              />
              <span className="text-sm">Wochenbasiert</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Selection - Conditional based on navigation mode */}
      {useWeekBasedNavigation ? (
        <div className="space-y-4">
          {/* Week Navigator */}
          {currentWeekInfo && onNavigatePrevious && onNavigateNext && (
            <WeekNavigator
              currentWeekInfo={{
                ...currentWeekInfo,
                spansMonths: currentWeekInfo.spansMonths || false,
                months: currentWeekInfo.months || []
              }}
              onNavigatePrevious={onNavigatePrevious}
              onNavigateNext={onNavigateNext}
              isLoading={isWeekNavigationLoading}
              hasVersion={hasWeekVersions}
            />
          )}
          
          {/* Week Version Display */}
          {currentWeekInfo && weekVersionMeta && (
            <WeekVersionDisplay
              currentWeekInfo={{
                ...currentWeekInfo,
                spansMonths: currentWeekInfo.spansMonths || false,
                months: currentWeekInfo.months || []
              }}
              versionMeta={{
                ...weekVersionMeta,
                dateRange: weekVersionMeta.dateRange || { start: '', end: '' },
                isWeekBased: weekVersionMeta.isWeekBased || true,
                status: (weekVersionMeta.status as "DRAFT" | "PUBLISHED" | "ARCHIVED") || 'DRAFT',
                createdAt: weekVersionMeta.createdAt || weekVersionMeta.created_at
              }}
              selectedVersion={selectedWeekVersion}
              onCreateVersion={onCreateWeekVersion}
              onSelectVersion={onSelectWeekVersion}
            />
          )}
        </div>
      ) : (
        <div>
          {/* Enhanced Date Range Selector for Standard Mode */}
          <EnhancedDateRangeSelector
            dateRange={dateRange}
            scheduleDuration={weekAmount}
            onWeekChange={onWeekChange || (() => {})}
            onDurationChange={onWeekAmountChange}
            hasVersions={hasVersions}
            onCreateNewVersion={onCreateNewVersion || (() => {})}
            onCreateNewVersionWithSpecificDateRange={onCreateNewVersionWithSpecificDateRange || (() => {})}
            currentVersion={currentVersion}
          />
        </div>
      )}
    </div>
  );
}
