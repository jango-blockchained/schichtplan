# SchedulePage Integration Guide

This guide shows how to integrate the modularized components into the main SchedulePage.tsx.

## Overview

The SchedulePage has been modularized into:

### Custom Hooks (State Management)
- `useNavigationState` - Navigation mode, date range, week management
- `useAIGenerationState` - AI-related operations and state
- `useDialogState` - Modal/dialog state centralization
- `useScheduleOperations` - Schedule CRUD operations

### Components (UI Sections)
- `NavigationSection` - Navigation UI
- `VersionManagementSection` - Version table and controls
- `ActionControlsSection` - Action buttons and controls
- `AIFeaturesSection` - AI functionality grouping
- `SettingsSidebar` - Right sidebar with settings
- `ConfirmationDialog` - Enhanced reusable confirmation dialog
- `SimpleModalManager` - Modal centralization (AI preview, confirmations)

### Layout Components
- `SchedulePageLayout` - Main page layout wrapper
- `MainContentArea` - Content area with loading/error states
- `SettingsIntegration` - Settings logic integration

## Basic Integration Example

```tsx
import React from 'react';
import { SchedulePageLayout } from '@/components/Schedule/SchedulePageLayout';
import { SettingsIntegration } from '@/components/Schedule/SettingsIntegration';
import { ScheduleManager } from '@/components/ScheduleManager';

// Import hooks
import { useNavigationState } from '@/hooks/useNavigationState';
import { useAIGenerationState } from '@/hooks/useAIGenerationState';
import { useDialogState } from '@/hooks/useDialogState';
import { useScheduleOperations } from '@/hooks/useScheduleOperations';

export function SchedulePage() {
  // Initialize hooks
  const navigationState = useNavigationState();
  const aiGenerationState = useAIGenerationState();
  const dialogState = useDialogState();
  const scheduleOpsState = useScheduleOperations();

  return (
    <SettingsIntegration>
      {(settingsState) => (
        <SchedulePageLayout
          navigationProps={{
            ...navigationState,
            // Additional navigation props
          }}
          versionManagementProps={{
            // Version management props
            showVersionManagement: !navigationState.useWeekBasedNavigation,
          }}
          actionControlsProps={{
            ...aiGenerationState,
            ...scheduleOpsState,
            isAiEnabled: settingsState.isAiEnabled,
            // Additional action props
          }}
          settingsSidebarProps={{
            // Sidebar props
          }}
          modalManagerProps={{
            ...dialogState,
            // Additional modal props
          }}
          onRefresh={() => {
            // Refresh logic
          }}
          onExport={async (format, filiale) => {
            // Export logic
          }}
        >
          <ScheduleManager
            // ScheduleManager props
            openingDays={settingsState.openingDays}
            viewMode={settingsState.viewMode}
            // ... other props
          />
        </SchedulePageLayout>
      )}
    </SettingsIntegration>
  );
}
```

## Detailed Integration Steps

### 1. Replace State with Hooks

**Before:**
```tsx
const [useWeekBasedNavigation, setUseWeekBasedNavigation] = useState(false);
const [dateRange, setDateRange] = useState<DateRange | undefined>();
const [weekAmount, setWeekAmount] = useState(6);
const [selectedVersion, setSelectedVersion] = useState<number | undefined>();
```

**After:**
```tsx
const {
  useWeekBasedNavigation,
  setUseWeekBasedNavigation,
  dateRange,
  setDateRange,
  weekAmount,
  setWeekAmount,
  selectedVersion,
  setSelectedVersion,
  handleWeekChange,
  handleDurationChange,
} = useNavigationState();
```

### 2. Replace Modal State with Dialog Hook

**Before:**
```tsx
const [isAddScheduleDialogOpen, setIsAddScheduleDialogOpen] = useState(false);
const [isStatisticsModalOpen, setIsStatisticsModalOpen] = useState(false);
const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
```

**After:**
```tsx
const {
  isAddScheduleDialogOpen,
  setIsAddScheduleDialogOpen,
  isStatisticsModalOpen,
  setIsStatisticsModalOpen,
  isDiagnosticsOpen,
  setIsDiagnosticsOpen,
  // ... all other dialog states
} = useDialogState();
```

### 3. Replace AI Logic with AI Hook

**Before:**
```tsx
const [isAiGenerating, setIsAiGenerating] = useState(false);
const [isAiFastGenerating, setIsAiFastGenerating] = useState(false);
// ... complex AI generation handlers
```

**After:**
```tsx
const {
  isAiGenerating,
  isAiFastGenerating,
  isAiDetailedGenerating,
  handleGenerateAiFastSchedule,
  handleGenerateAiDetailedSchedule,
  handleDetailedAiModalConfirm,
  handlePreviewAiData,
} = useAIGenerationState({
  dateRange,
  selectedVersion,
  // ... other dependencies
});
```

### 4. Replace UI Sections with Components

**Before:**
```tsx
{/* Navigation Mode Toggle */}
<div className="mb-4">
  <Card>
    <CardContent className="py-4">
      {/* ... navigation toggle logic */}
    </CardContent>
  </Card>
</div>
```

**After:**
```tsx
<NavigationSection
  useWeekBasedNavigation={navigationState.useWeekBasedNavigation}
  onNavigationModeChange={navigationState.setUseWeekBasedNavigation}
  dateRange={navigationState.dateRange}
  onDateRangeChange={navigationState.setDateRange}
  // ... other props
/>
```

## Benefits of This Architecture

### 1. **Separation of Concerns**
- Each hook handles a specific domain (navigation, AI, dialogs, operations)
- Components focus only on UI rendering
- Business logic is centralized and reusable

### 2. **Type Safety**
- All components have proper TypeScript interfaces
- Hook return types are well-defined
- Props are validated at compile time

### 3. **Testability**
- Hooks can be tested independently
- Components can be tested with mock props
- Business logic is isolated from UI concerns

### 4. **Reusability**
- Hooks can be reused across different pages
- Components can be composed in different layouts
- Settings integration can be shared

### 5. **Maintainability**
- Smaller, focused files are easier to understand
- Changes are localized to specific domains
- Debugging is more straightforward

## Next Steps

1. **Gradually migrate** the existing SchedulePage.tsx to use these components
2. **Test thoroughly** each section as you migrate
3. **Extend hooks** with additional functionality as needed
4. **Add error boundaries** around major sections
5. **Implement performance optimizations** (React.memo, useMemo, useCallback)

## Performance Considerations

- Use `React.memo` for components that receive complex props
- Implement `useMemo` for expensive calculations in hooks
- Use `useCallback` for event handlers passed to child components
- Consider implementing virtualization for large schedule tables

## Error Handling

- Each hook should handle its own errors gracefully
- Use error boundaries around major sections
- Implement retry mechanisms for failed operations
- Provide user-friendly error messages
