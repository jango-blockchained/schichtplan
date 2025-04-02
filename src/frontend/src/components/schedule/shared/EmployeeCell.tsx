import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { User, Shield, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface EmployeeCellProps {
  firstName?: string;
  lastName?: string;
  id?: number;
  role?: string;
  isKeyHolder?: boolean;
  availabilityType?: string;
  availabilityColor?: string;
  absence?: {
    type: string;
    name: string;
    color: string;
  } | null;
  showAbsence?: boolean;
  className?: string;
}

export const EmployeeCell: React.FC<EmployeeCellProps> = ({
  firstName,
  lastName,
  id,
  role,
  isKeyHolder = false,
  availabilityType,
  availabilityColor,
  absence,
  showAbsence = true,
  className
}) => {
  // Format employee initials
  const getInitials = (): string => {
    if (!firstName && !lastName) return id ? `#${id}` : '??';
    
    const firstInitial = firstName ? firstName.charAt(0) : '';
    const lastInitial = lastName ? lastName.charAt(0) : '';
    
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };
  
  // Generate employee full name
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || `Mitarbeiter #${id}`;
  
  // Determine if we should show availability indicator
  const showAvailability = !!availabilityType && !absence;
  
  return (
    <div className={cn(
      "flex items-center space-x-3",
      className
    )}>
      {/* Employee avatar with availability color coding */}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white",
          absence && "border-2 border-red-300"
        )}
        style={{ 
          backgroundColor: showAvailability 
            ? availabilityColor 
            : absence 
              ? `${absence.color}40` 
              : "#64748b" 
        }}
      >
        {getInitials()}
      </div>
      
      <div className="flex flex-col min-w-0">
        <div className="flex items-center">
          <span className="font-medium truncate">{fullName}</span>
          
          {isKeyHolder && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Shield className="h-3.5 w-3.5 ml-1.5 text-primary" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Schlüsselträger</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <div className="flex items-center mt-0.5">
          {role && (
            <span className="text-xs text-muted-foreground truncate">
              {role}
            </span>
          )}
          
          {showAbsence && absence && (
            <Badge 
              variant="outline" 
              className="ml-1 text-xs"
              style={{
                backgroundColor: `${absence.color}20`,
                color: absence.color,
                borderColor: absence.color
              }}
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              {absence.name}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}; 