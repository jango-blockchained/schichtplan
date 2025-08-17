/**
 * WeekNavigator component for the Schichtplan application.
 * 
 * Provides core week navigation UI with month boundary indicators,
 * week display, and navigation controls.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getWeekSegments, WeekSegmentsResponse } from '@/services/api';
import { WeekInfo } from '@/types/weekVersion';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Split } from 'lucide-react';
import { WeekNavigationSettingsOverlay } from './WeekNavigationSettingsOverlay';

interface WeekNavigatorProps {
  currentWeekInfo: WeekInfo;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  isLoading?: boolean;
  hasVersion?: boolean;
  showMonthBoundaryIndicator?: boolean;
  className?: string;
  weekNavigationSettings?: {
    weekendStart?: number; // 0 = Sunday, 1 = Monday  
    monthBoundaryMode?: string; // 'keep_intact' or 'split_by_month'
  };
  currentSegment?: number;
  onSegmentChange?: (segmentNumber: number) => void;
}

export function WeekNavigator({
  currentWeekInfo,
  onNavigatePrevious,
  onNavigateNext,
  isLoading = false,
  hasVersion = false,
  showMonthBoundaryIndicator = true,
  className = "",
  weekNavigationSettings,
  currentSegment = 1,
  onSegmentChange
}: WeekNavigatorProps) {
  // Fetch week segments when in split mode
  const { data: segmentsData } = useQuery<WeekSegmentsResponse>({
    queryKey: ['week-segments', `${currentWeekInfo.year}-W${String(currentWeekInfo.weekNumber).padStart(2, '0')}`],
    queryFn: () => getWeekSegments(`${currentWeekInfo.year}-W${String(currentWeekInfo.weekNumber).padStart(2, '0')}`),
    enabled: weekNavigationSettings?.monthBoundaryMode === 'split_by_month' && currentWeekInfo.spansMonths,
    staleTime: 5 * 60 * 1000,
  });

  const isSplitMode = weekNavigationSettings?.monthBoundaryMode === 'split_by_month' &&
    currentWeekInfo.spansMonths &&
    segmentsData?.isSplit;

  const currentSegmentData = isSplitMode && segmentsData?.segments
    ? segmentsData.segments.find(s => s.segment_number === currentSegment)
    : null;

  // Format week display
  const formatWeekDisplay = () => {
    if (isSplitMode && currentSegmentData) {
      return `KW ${currentWeekInfo.weekNumber}/${currentWeekInfo.year} (Teil ${currentSegment})`;
    }
    return `KW ${currentWeekInfo.weekNumber}/${currentWeekInfo.year}`;
  };

  // Format date range display
  const formatDateRange = () => {
    if (isSplitMode && currentSegmentData) {
      const startDate = new Date(currentSegmentData.start_date);
      const endDate = new Date(currentSegmentData.end_date);
      return `${format(startDate, 'dd.MM.')} - ${format(endDate, 'dd.MM.yyyy')}`;
    }
    return `${format(currentWeekInfo.startDate, 'dd.MM.')} - ${format(currentWeekInfo.endDate, 'dd.MM.yyyy')}`;
  };

  // Handle segment navigation
  const handleNavigatePrevious = () => {
    if (isSplitMode && currentSegment > 1) {
      onSegmentChange?.(currentSegment - 1);
    } else {
      onNavigatePrevious();
    }
  };

  const handleNavigateNext = () => {
    if (isSplitMode && segmentsData && currentSegment < segmentsData.segments.length) {
      onSegmentChange?.(currentSegment + 1);
    } else {
      onNavigateNext();
    }
  };

  // Check if navigation should be disabled
  const navigationDisabled = isLoading; // Week navigation is always enabled now

  return (
    <Card className={`mb-4 ${className}`}>
      <CardHeader className="py-4 border-b">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5" />
            <span>Wochennavigation</span>
            {hasVersion && (
              <Badge variant="outline" className="text-xs">
                Version vorhanden
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <WeekNavigationSettingsOverlay triggerClassName="h-8" />

            {showMonthBoundaryIndicator && currentWeekInfo.spansMonths && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-amber-600">
                      {isSplitMode ? <Split className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      <span className="text-sm">
                        {isSplitMode ? 'Geteilte Woche' : 'Monatsgrenze'}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Diese Woche erstreckt sich über {currentWeekInfo.months.join(' und ')}</p>
                    {isSplitMode ? (
                      <div>
                        <p className="text-xs mt-1">Modus: An Monatsgrenze geteilt</p>
                        {segmentsData && (
                          <p className="text-xs mt-1">
                            Zeigt Teil {currentSegment} von {segmentsData.segments.length}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs mt-1">Modus: Woche beibehalten</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigatePrevious}
            disabled={navigationDisabled}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {isSplitMode && currentSegment > 1 ? 'Vorheriger Teil' : 'Vorherige Woche'}
          </Button>

          <div className="text-center">
            <div className="text-lg font-semibold">
              {formatWeekDisplay()}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDateRange()}
            </div>
            {currentWeekInfo.spansMonths && (
              <div className="text-xs text-amber-600 mt-1">
                {isSplitMode && currentSegmentData
                  ? `${currentSegmentData.month} ${currentSegmentData.year}`
                  : currentWeekInfo.months.join(' / ')}
              </div>
            )}
            {isSplitMode && segmentsData && (
              <div className="flex gap-1 mt-2 justify-center">
                {segmentsData.segments.map((segment) => (
                  <Button
                    key={segment.segment_id}
                    variant={segment.segment_number === currentSegment ? "default" : "outline"}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onSegmentChange?.(segment.segment_number)}
                  >
                    Teil {segment.segment_number}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigateNext}
            disabled={navigationDisabled}
            className="flex items-center gap-2"
          >
            {isSplitMode && segmentsData && currentSegment < segmentsData.segments.length ? 'Nächster Teil' : 'Nächste Woche'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}