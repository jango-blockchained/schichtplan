import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface TimeGridEmptyProps {
  isLoading: boolean;
  hasDateRange: boolean;
  hasOpeningDays: boolean;
}

export function TimeGridEmpty({ isLoading, hasDateRange, hasOpeningDays }: TimeGridEmptyProps) {
  if (isLoading) {
    return <Skeleton className="w-full h-[600px]" />;
  }

  if (!hasDateRange) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Bitte wählen Sie einen Zeitraum aus
      </div>
    );
  }

  if (!hasOpeningDays) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Keine Öffnungstage im ausgewählten Zeitraum gefunden
        </AlertDescription>
      </Alert>
    );
  }

  return null;
} 