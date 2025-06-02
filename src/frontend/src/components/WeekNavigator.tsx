/**
 * WeekNavigator component for the Schichtplan application.
 * 
 * Provides core week navigation UI with month boundary indicators,
 * week display, and navigation controls.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import { format, getMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WeekInfo } from '@/types/weekVersion';

interface WeekNavigatorProps {
  currentWeekInfo: WeekInfo;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onNavigateToWeek?: (weekIdentifier: string) => void;
  isLoading?: boolean;
  hasVersion?: boolean;
  showMonthBoundaryIndicator?: boolean;
  className?: string;
}

export function WeekNavigator({
  currentWeekInfo,
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToWeek,
  isLoading = false,
  hasVersion = false,
  showMonthBoundaryIndicator = true,
  className = ""
}: WeekNavigatorProps) {
  
  // Format week display
  const formatWeekDisplay = () => {
    return `KW ${currentWeekInfo.weekNumber}/${currentWeekInfo.year}`;
  };

  // Format date range display
  const formatDateRange = () => {
    return `${format(currentWeekInfo.startDate, 'dd.MM.')} - ${format(currentWeekInfo.endDate, 'dd.MM.yyyy')}`;
  };

  // Check if navigation should be disabled
  const navigationDisabled = isLoading;

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
          
          {showMonthBoundaryIndicator && currentWeekInfo.spansMonths && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Monatsgrenze</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Diese Woche erstreckt sich über {currentWeekInfo.months.join(' und ')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigatePrevious}
            disabled={navigationDisabled}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Vorherige Woche
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
                {currentWeekInfo.months.join(' / ')}
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateNext}
            disabled={navigationDisabled}
            className="flex items-center gap-2"
          >
            Nächste Woche
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}