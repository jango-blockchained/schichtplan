import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Settings } from 'lucide-react';
import React, { useState } from 'react';

interface SlidingSidebarProps {
  onCreateNewVersion: () => void;
  onDeleteVersion: () => void;
  isLoadingVersions: boolean;
  onOpenStatistics: () => void;
  onOpenGenerationSettings: () => void;
  className?: string;
}

// Shiny text component based on the effect from reactbits.dev
const ShinyText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("relative inline-block", className)}>
      <span className="relative z-10 bg-gradient-to-r from-gray-400 via-gray-100 to-gray-400 bg-clip-text text-transparent animate-shine bg-[length:200%_100%]">
        {children}
      </span>
    </div>
  );
};

export function SlidingSidebar({
  onCreateNewVersion,
  onDeleteVersion,
  isLoadingVersions,
  onOpenStatistics,
  onOpenGenerationSettings,
  className = "",
}: SlidingSidebarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowCopyright(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Keep copyright visible for 3 seconds after sidebar starts hiding
    setTimeout(() => setShowCopyright(false), 3000);
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-50 transition-transform duration-300 ease-in-out",
          isHovered ? "translate-x-0" : "translate-x-64",
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Sidebar handle */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full">
          <Button
            variant="outline"
            size="sm"
            className="h-12 w-8 rounded-r-none rounded-l-md bg-background/80 backdrop-blur-sm border-r-0 hover:bg-background/90"
          >
            {isHovered ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Sidebar content */}
        <Card className="w-64 bg-background/90 backdrop-blur-sm border-l-0">
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-4">Tools & Settings</div>
            
            {/* Version Control */}
            <div className="space-y-2 mb-6">
              <div className="text-xs font-medium text-muted-foreground mb-2">Versionskontrolle</div>
              <Button
                variant="outline"
                onClick={onCreateNewVersion}
                className="w-full justify-start"
                size="sm"
              >
                Neue Version erstellen
              </Button>
              <Button
                variant="outline"
                onClick={onDeleteVersion}
                className="w-full justify-start"
                disabled={isLoadingVersions}
                size="sm"
              >
                {isLoadingVersions ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : null}
                Version löschen
              </Button>
            </div>

            {/* Analytics & Settings */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">Analyse & Einstellungen</div>
              <Button
                variant="outline"
                onClick={onOpenStatistics}
                className="w-full justify-start"
                size="sm"
              >
                <BarChart3 className="mr-2 h-3 w-3" />
                Statistiken
              </Button>
              <Button
                variant="outline"
                onClick={onOpenGenerationSettings}
                className="w-full justify-start"
                size="sm"
              >
                <Settings className="mr-2 h-3 w-3" />
                Generierung
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Copyright Container */}
      <div
        className={cn(
          "fixed right-4 bottom-4 z-40 transition-all duration-500 ease-in-out",
          showCopyright 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <Card className="bg-background/60 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-3">
            <div className="text-xs text-center space-y-1">
              <ShinyText className="block">
                © 2025 Schichtplan Pro
              </ShinyText>
              <div className="text-muted-foreground/60">
                Developed with ❤️
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
