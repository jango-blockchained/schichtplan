import { useBulkAvailabilityOptimized } from "@/hooks/useBulkAvailabilityOptimized";
import { ReactNode } from "react";
import { AvailabilityContext } from "./availabilityContext";

interface AvailabilityProviderProps {
  children: ReactNode;
  dateRange: { from: Date; to: Date } | undefined;
  enabled?: boolean;
}

export function AvailabilityProvider({
  children,
  dateRange,
  enabled = true,
}: AvailabilityProviderProps) {
  const bulkAvailability = useBulkAvailabilityOptimized({ dateRange, enabled });

  return (
    <AvailabilityContext.Provider value={bulkAvailability}>
      {children}
    </AvailabilityContext.Provider>
  );
}
