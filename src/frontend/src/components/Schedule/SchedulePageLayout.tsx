import { PageHeader } from '@/components/PageHeader';
import React from 'react';
import { ActionControlsSection } from './ActionControlsSection';
import { MainContentArea } from './MainContentArea';
import { NavigationSection } from './NavigationSection';
import ScheduleControls from './ScheduleControls';
import { SettingsSidebar } from './SettingsSidebar';
import { SimpleModalManager } from './SimpleModalManager';
import { VersionManagementSection } from './VersionManagementSection';

interface SchedulePageLayoutProps {
  // Navigation props
  navigationProps: React.ComponentProps<typeof NavigationSection>;
  
  // Version management props
  versionManagementProps: React.ComponentProps<typeof VersionManagementSection>;
  
  // Action controls props
  actionControlsProps: React.ComponentProps<typeof ActionControlsSection>;
  
  // Settings sidebar props
  settingsSidebarProps: React.ComponentProps<typeof SettingsSidebar>;
  
  // Modal manager props
  modalManagerProps: React.ComponentProps<typeof SimpleModalManager>;
  
  // Main content area
  children: React.ReactNode;
  isContentLoading?: boolean;
  contentError?: Error | null;
  onContentRetry?: () => void;
  
  // Page header props
  onRefresh?: () => void;
  onExport?: (format: 'standard' | 'mep' | 'mep-html', filiale?: string) => Promise<void>;
  isExporting?: boolean;
  
  // Layout options
  showVersionManagement?: boolean;
  className?: string;
}

export function SchedulePageLayout({
  navigationProps,
  versionManagementProps,
  actionControlsProps,
  settingsSidebarProps,
  modalManagerProps,
  children,
  isContentLoading = false,
  contentError = null,
  onContentRetry,
  onRefresh,
  onExport,
  isExporting = false,
  showVersionManagement = true,
  className = "container mx-auto py-4 space-y-4",
}: SchedulePageLayoutProps) {
  return (
    <div className={className}>
      {/* Page Header */}
      <PageHeader title="Dienstplan" className="mb-4">
        <ScheduleControls
          onRefresh={onRefresh}
          onExport={onExport}
          isExporting={isExporting}
        />
      </PageHeader>

      {/* Navigation Section */}
      <NavigationSection {...navigationProps} />

      {/* Version Management Section - Conditional */}
      {showVersionManagement && (
        <VersionManagementSection {...versionManagementProps} />
      )}

      {/* Action Controls Section */}
      <ActionControlsSection {...actionControlsProps} />

      {/* Main Content Area with Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <MainContentArea
            isLoading={isContentLoading}
            error={contentError}
            onRetry={onContentRetry}
          >
            {children}
          </MainContentArea>
        </div>

        {/* Settings Sidebar */}
        <div className="lg:col-span-1">
          <SettingsSidebar {...settingsSidebarProps} />
        </div>
      </div>

      {/* Modal Manager */}
      <SimpleModalManager {...modalManagerProps} />
    </div>
  );
}
