import React from "react";

interface TimeGridLegendProps {
  settings: any;
}

export function TimeGridLegend({ settings }: TimeGridLegendProps) {
  if (!settings) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-sm">
        {settings?.shift_types ? (
          // Use colors from settings if available
          settings.shift_types.map((type: any) => (
            <div key={type.id} className="flex items-center gap-1">
              <div
                className="w-5 h-5 rounded-md"
                style={{ backgroundColor: type.color }}
              ></div>
              <span>{type.name}</span>
            </div>
          ))
        ) : (
          // Fallback to hardcoded colors
          <>
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-md bg-blue-500"></div>
              <span>Früh</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-md bg-amber-500"></div>
              <span>Mittel</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-md bg-purple-500"></div>
              <span>Spät</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
