import { VersionTable } from "@/components/Schedule/VersionTable";
import { VersionMeta } from "@/services/api";

export interface VersionManagementSectionProps {
  // Version data
  versions: VersionMeta[];
  selectedVersion: number | undefined;
  
  // Visibility control
  showVersionTable: boolean; // Only show when not using week-based navigation
  
  // Version actions
  onSelectVersion: (version: number) => void;
  onPublishVersion: (version: number) => void;
  onArchiveVersion: (version: number) => void;
  onDeleteVersion: (version: number) => void;
  onDuplicateVersion: (version: number) => void;
  onCreateNewVersion: () => void;
}

export function VersionManagementSection({
  versions,
  selectedVersion,
  showVersionTable,
  onSelectVersion,
  onPublishVersion,
  onArchiveVersion,
  onDeleteVersion,
  onDuplicateVersion,
  onCreateNewVersion,
}: VersionManagementSectionProps) {
  
  // Only render if version table should be shown (not in week-based mode)
  if (!showVersionTable) {
    return null;
  }
  
  return (
    <div className="mb-4">
      <VersionTable
        versions={versions}
        selectedVersion={selectedVersion}
        onSelectVersion={onSelectVersion}
        onPublishVersion={onPublishVersion}
        onArchiveVersion={onArchiveVersion}
        onDeleteVersion={onDeleteVersion}
        onDuplicateVersion={onDuplicateVersion}
        onCreateNewVersion={onCreateNewVersion}
      />
    </div>
  );
}
