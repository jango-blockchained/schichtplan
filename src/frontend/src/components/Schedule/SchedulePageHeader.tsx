import { PageHeader } from "@/components/PageHeader";
import ScheduleControls from "@/components/Schedule/ScheduleControls";

interface SchedulePageHeaderProps {
  onRefresh: () => void;
  onExport: (format: 'standard' | 'mep' | 'mep-html', filiale?: string) => void | Promise<void>;
  isExporting?: boolean;
}

export function SchedulePageHeader({
  onRefresh,
  onExport,
  isExporting = false,
}: SchedulePageHeaderProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Schichtplanung"
        description="Verwalte und plane Mitarbeiterschichten"
      >
        <ScheduleControls
          onRefresh={onRefresh}
          onExport={onExport}
          isExporting={isExporting}
        />
      </PageHeader>
    </div>
  );
}
