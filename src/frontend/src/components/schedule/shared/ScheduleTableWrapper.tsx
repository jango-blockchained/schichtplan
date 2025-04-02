import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ScheduleTableWrapperProps {
  title?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  headerContent?: ReactNode;
  footerContent?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const ScheduleTableWrapper: React.FC<ScheduleTableWrapperProps> = ({
  title = 'Dienstplan',
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'Keine Einträge gefunden',
  headerContent,
  footerContent,
  children,
  className
}) => {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Card Header */}
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{title}</CardTitle>
        {headerContent}
      </CardHeader>
      
      {/* Card Content */}
      <CardContent className={cn(
        "p-0", // Remove default padding for full-width tables
        !isEmpty && !isLoading && "overflow-x-auto" // Enable horizontal scrolling for tables
      )}>
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isEmpty ? (
          <div className="py-12 px-6 text-center">
            <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Keine Daten vorhanden</h3>
            <p className="text-muted-foreground">
              {emptyMessage}
            </p>
          </div>
        ) : (
          children
        )}
      </CardContent>
      
      {/* Optional Footer */}
      {footerContent && (
        <div className="px-6 py-4 bg-muted/10 border-t">
          {footerContent}
        </div>
      )}
    </Card>
  );
}; 