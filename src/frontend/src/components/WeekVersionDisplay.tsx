/**
 * WeekVersionDisplay component for the Schichtplan application.
 * 
 * Displays current week, version info, and range details for week-based versions.
 */

import React from 'react';
import { format } from 'date-fns';
import { Calendar, Hash, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WeekInfo, WeekVersionMeta, VersionIdentifier } from '@/types/weekVersion';

interface WeekVersionDisplayProps {
  currentWeekInfo: WeekInfo;
  versionMeta?: WeekVersionMeta;
  selectedVersion?: VersionIdentifier;
  onCreateVersion?: () => void;
  onSelectVersion?: (version: VersionIdentifier) => void;
  showActions?: boolean;
  className?: string;
}

export function WeekVersionDisplay({
  currentWeekInfo,
  versionMeta,
  selectedVersion,
  onCreateVersion,
  onSelectVersion,
  showActions = true,
  className = ""
}: WeekVersionDisplayProps) {
  
  // Format week identifier
  const weekIdentifier = `${currentWeekInfo.year}-W${currentWeekInfo.weekNumber.toString().padStart(2, '0')}`;
  
  // Calculate days in week
  const daysDifference = Math.ceil((currentWeekInfo.endDate.getTime() - currentWeekInfo.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Status badge variant
  const getStatusVariant = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PUBLISHED': return 'default';
      case 'DRAFT': return 'secondary';
      case 'ARCHIVED': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Wochendetails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Week Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">Kalenderwoche</div>
            <div className="font-medium">KW {currentWeekInfo.weekNumber}/{currentWeekInfo.year}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Zeitraum</div>
            <div className="font-medium">
              {format(currentWeekInfo.startDate, 'dd.MM')} - {format(currentWeekInfo.endDate, 'dd.MM.yyyy')}
            </div>
          </div>
        </div>

        {/* Week Identifier */}
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-mono">{weekIdentifier}</span>
          {currentWeekInfo.spansMonths && (
            <Badge variant="outline" className="text-xs">
              Monatsgrenze
            </Badge>
          )}
        </div>

        {/* Version Information */}
        {versionMeta ? (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Version {versionMeta.version}</span>
              </div>
              <Badge variant={getStatusVariant(versionMeta.status)}>
                {versionMeta.status}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">Erstellt</div>
                <div className="font-medium">
                  {format(new Date(versionMeta.createdAt), 'dd.MM.yyyy HH:mm')}
                </div>
              </div>
              {versionMeta.updatedAt && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">Aktualisiert</div>
                  <div className="font-medium">
                    {format(new Date(versionMeta.updatedAt), 'dd.MM.yyyy HH:mm')}
                  </div>
                </div>
              )}
            </div>

            {versionMeta.notes && (
              <div className="space-y-1">
                <div className="text-muted-foreground text-sm">Notizen</div>
                <div className="text-sm p-2 bg-muted/30 rounded-md">
                  {versionMeta.notes}
                </div>
              </div>
            )}
          </div>
        ) : (
          showActions && (
            <div className="space-y-2 border-t pt-4">
              <div className="text-sm text-muted-foreground text-center">
                Keine Version für diese Woche vorhanden
              </div>
              {onCreateVersion && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onCreateVersion}
                  className="w-full"
                >
                  Version erstellen
                </Button>
              )}
            </div>
          )
        )}

        {/* Additional Info */}
        <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{daysDifference} Tage</span>
          </div>
          {currentWeekInfo.spansMonths && (
            <div>Erstreckt sich über: {currentWeekInfo.months.join(', ')}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 