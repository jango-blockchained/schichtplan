import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface SettingsSidebarProps {
  // Version Control
  onCreateNewVersion: () => void;
  onDeleteVersion: () => void;
  isLoadingVersions: boolean;
  
  // Statistics
  onOpenStatistics: () => void;
  
  // Settings
  onOpenGenerationSettings: () => void;
  
  // Responsive visibility control
  className?: string;
}

export function SettingsSidebar({
  onCreateNewVersion,
  onDeleteVersion,
  isLoadingVersions,
  onOpenStatistics,
  onOpenGenerationSettings,
  className = "hidden lg:block",
}: SettingsSidebarProps) {
  return (
    <div className={className}>
      <div className="sticky top-4 space-y-4">
        {/* Version Control */}
        <Card>
          <CardContent>
            <div className="text-sm font-medium mb-2">Versionskontrolle</div>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={onCreateNewVersion}
                className="w-full"
              >
                Neue Version erstellen
              </Button>
              <Button
                variant="outline"
                onClick={onDeleteVersion}
                className="w-full"
                disabled={isLoadingVersions}
              >
                {isLoadingVersions ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Version löschen"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardContent>
            <div className="text-sm font-medium mb-2">Statistiken</div>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={onOpenStatistics}
                className="w-full"
              >
                Übersicht anzeigen
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardContent>
            <div className="text-sm font-medium mb-2">Einstellungen</div>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={onOpenGenerationSettings}
                className="w-full"
              >
                Generierungseinstellungen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
