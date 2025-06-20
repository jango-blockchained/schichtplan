# SchedulePage Modularization Task Plan

## Overview

The SchedulePage.tsx file is currently **1838 lines** and handles too many responsibilities. This document outlines a comprehensive plan to modularize it into smaller, maintainable components with clear separation of concerns.

## Current Analysis

- **File Size**: 1838 lines (target: ~300-500 lines for main page)
- **Components Already Extracted**: Some modularization already exists (GenerationOverlay, ScheduleControls, etc.)
- **Main Issues**:
  - Too many state variables (25+ useState calls)
  - Complex event handlers mixed with component logic
  - Multiple unrelated functionalities in one file
  - Render logic spans 500+ lines

## Progress Summary

### ✅ Completed Phases

**Phase 1: State Management Extraction** - **COMPLETED**
- ✅ useNavigationState hook (navigation mode, date range, week amount, selected version)
- ✅ useAIGenerationState hook (all AI-related state and operations)
- ✅ useDialogState hook (centralized dialog/modal state management)
- ✅ useScheduleOperations hook (schedule CRUD operations and utilities)

**Phase 2: Component Extraction** - **COMPLETED**
- ✅ NavigationSection component (navigation UI)
- ✅ VersionManagementSection component (version table and controls)
- ✅ ActionControlsSection component (all action buttons and controls)
- ✅ AIFeaturesSection component (AI-related functionality grouping)
- ✅ SettingsSidebar component (right sidebar with settings and statistics)

**Phase 3: Modal Components Consolidation** - **IN PROGRESS**
- ✅ SimpleModalManager component (AI Data Preview and Confirmation dialogs)
- ⏳ Enhanced ConfirmationDialog component (pending)

### 📊 Impact So Far
- **File Reduction**: Main SchedulePage.tsx can now be reduced by ~60% once refactored to use the new components
- **State Reduction**: 25+ useState calls can be reduced to 4-5 custom hooks
- **Component Modularity**: 5 new focused components created
- **Reusability**: Components can be reused across the application

### 🎯 Next Steps
Continue with remaining Phase 3 tasks and move to Phase 4 (Layout Optimization).

### Phase 1: State Management Extraction

**Goal**: Reduce SchedulePage state complexity by 70%

#### Task 1.1: Create Navigation State Hook

- [x] **File**: `src/frontend/src/hooks/useNavigationState.ts`
- [ ] **Purpose**: Manage navigation mode and date range state
- [ ] **State to Extract**:
  - `useWeekBasedNavigation`
  - `dateRange`
  - `weekAmount`
  - `selectedVersion`
- [ ] **Functions to Extract**:
  - `handleWeekChange`
  - `handleDurationChange`
  - Date range synchronization logic

#### Task 1.2: Create AI Generation State Hook

- [x] **File**: `src/frontend/src/hooks/useAIGenerationState.ts`
- [ ] **Purpose**: Manage all AI-related state and operations
- [ ] **State to Extract**:
  - `isAiGenerating`
  - `isAiFastGenerating`
  - `isAiDetailedGenerating`
  - `isDetailedAiModalOpen`
  - `isAiDataPreviewOpen`
  - `aiPreviewData`
- [ ] **Functions to Extract**:
  - `handleGenerateAiFastSchedule`
  - `handleGenerateAiDetailedSchedule`
  - `handleDetailedAiModalConfirm`
  - `handlePreviewAiData`

#### Task 1.3: Create Dialog Management Hook

- [x] **File**: `src/frontend/src/hooks/useDialogState.ts`
- [ ] **Purpose**: Centralize all dialog/modal state management
- [ ] **State to Extract**:
  - `isGenerationSettingsOpen`
  - `isAddScheduleDialogOpen`
  - `isStatisticsModalOpen`
  - `isDiagnosticsOpen`
  - `isAddAvailabilityShiftsDialogOpen`
  - `confirmDeleteMessage`
- [ ] **Benefits**: Single source of truth for all modals

#### Task 1.4: Create Schedule Operations Hook

- [x] **File**: `src/frontend/src/hooks/useScheduleOperations.ts`
- [ ] **Purpose**: Handle all schedule CRUD operations
- [ ] **Functions to Extract**:
  - `handleCreateSchedule`
  - `handleDeleteSchedule`
  - `handleUpdateSchedule`
  - `handleFixDisplay`
- [ ] **Benefits**: Reusable across components

### Phase 2: Component Extraction

**Goal**: Split render logic into focused components

#### Task 2.1: Navigation Section Component

- [x] **File**: `src/frontend/src/components/Schedule/NavigationSection.tsx`
- [ ] **Purpose**: Handle all navigation-related UI
- [ ] **Includes**:
  - Navigation mode toggle card
  - Week navigator (week-based mode)
  - Enhanced date range selector (standard mode)
  - Week version display
- [ ] **Props Interface**:

  ```typescript
  interface NavigationSectionProps {
    useWeekBasedNavigation: boolean;
    onNavigationModeChange: (isWeekBased: boolean) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (range: DateRange | undefined) => void;
    weekAmount: number;
    onWeekAmountChange: (amount: number) => void;
    // ... other navigation props
  }
  ```

#### Task 2.2: Version Management Section Component

- [x] **File**: `src/frontend/src/components/Schedule/VersionManagementSection.tsx`
- [ ] **Purpose**: Handle version table and controls
- [ ] **Includes**:
  - Version table (when not in week mode)
  - Version control sidebar
  - Version-related actions
- [ ] **Conditional Rendering**: Only shows when not using week-based navigation

#### Task 2.3: Action Controls Section Component

- [x] **File**: `src/frontend/src/components/Schedule/ActionControlsSection.tsx`
- [ ] **Purpose**: Centralize all action buttons and controls
- [ ] **Includes**:
  - ScheduleActions component
  - ActionDock component
  - Quick action buttons
- [ ] **Benefits**: Single location for all schedule actions

#### Task 2.4: AI Features Section Component

- [ ] **File**: `src/frontend/src/components/Schedule/AIFeaturesSection.tsx`
- [ ] **Purpose**: Group all AI-related functionality
- [ ] **Includes**:
  - AI generation controls
  - AI data preview
  - AI import/export features
- [ ] **Conditional**: Only renders if AI is enabled

#### Task 2.5: Settings and Statistics Sidebar

- [x] **File**: `src/frontend/src/components/Schedule/SettingsSidebar.tsx`
- [x] **Purpose**: Right sidebar with settings and statistics
- [x] **Includes**:
  - Version control buttons
  - Statistics button
  - Settings button
- [x] **Responsive**: Hidden on smaller screens

### Phase 3: Modal Components Consolidation

**Goal**: Organize all modals in a centralized way

#### Task 3.1: Create Modal Manager Component

- [x] **File**: `src/frontend/src/components/Schedule/SimpleModalManager.tsx`
- [x] **Purpose**: Centralize modal rendering and state (simplified version)
- [x] **Includes**:
  - AI Data Preview Dialog
  - Confirmation Dialog
- [x] **Benefits**:
  - Cleaner main component
  - Better modal state management
  - Easier testing
- [x] **Note**: Created simplified version focusing on most commonly used modals

#### Task 3.2: Enhance Confirmation Dialog Component

- [x] **File**: `src/frontend/src/components/Schedule/ConfirmationDialog.tsx`
- [x] **Purpose**: Reusable confirmation dialog
- [x] **Features**:
  - Customizable title and message
  - Support for detail lists
  - Configurable action buttons
  - TypeScript-safe callback handling
  - Loading state support
  - Variant support (default/destructive)

### Phase 4: Layout and Structure Optimization

**Goal**: Improve overall component structure and layout

#### Task 4.1: Create Main Layout Component

- [x] **File**: `src/frontend/src/components/Schedule/SchedulePageLayout.tsx`
- [x] **Purpose**: Define the overall page layout structure
- [x] **Structure**:
  - NavigationSection
  - VersionManagementSection (conditional)
  - ActionControlsSection
  - MainContentArea with ScheduleManager
  - SettingsSidebar
  - SimpleModalManager
- [x] **Features**: Responsive grid layout, prop forwarding, conditional sections

#### Task 4.2: Create Content Area Component

- [x] **File**: `src/frontend/src/components/Schedule/MainContentArea.tsx`
- [x] **Purpose**: Handle the main schedule display area
- [x] **Includes**:
  - Loading states with skeletons
  - Error boundaries with retry functionality
  - Clean content wrapper
- [x] **Responsive**: Adapts to different screen sizes

#### Task 4.3: Extract Settings Integration Component

- [x] **File**: `src/frontend/src/components/Schedule/SettingsIntegration.tsx`
- [x] **Purpose**: Handle all settings-related logic
- [x] **Includes**:
  - Settings queries with React Query
  - Settings state management
  - Settings synchronization
  - Derived settings (opening days, AI enabled, diagnostics)
- [x] **Benefits**: Cleaner separation of settings logic, render props pattern for flexibility

### Phase 5: Event Handlers and Business Logic

**Goal**: Organize event handlers and business logic

#### Task 5.1: Create Event Handlers Service

- [x] **File**: `src/frontend/src/services/scheduleEventHandlers.ts`
- [x] **Purpose**: Centralize complex event handling logic
- [x] **Functions**:
  - `handleScheduleExport`
  - `handleScheduleImport`
  - `handleBulkOperations`
  - `handleDataValidation`
- [x] **Features**:
  - Type-safe event handling
  - Comprehensive error handling
  - Integration with React Query
  - Toast notification management
  - Date range validation
  - Export functionality (standard/MEP/HTML)

#### Task 5.2: Create Business Logic Service

- [ ] **File**: `src/frontend/src/services/scheduleBusinessLogic.ts`
- [ ] **Purpose**: Extract complex business logic
- [ ] **Functions**:
  - Date range validation
  - Version compatibility checks
  - Schedule conflict resolution
  - Data transformation utilities

#### Task 5.3: Create Error Handling Service

- [ ] **File**: `src/frontend/src/services/scheduleErrorHandling.ts`
- [ ] **Purpose**: Centralized error handling and logging
- [ ] **Features**:
  - Standardized error messages
  - Error categorization
  - User-friendly error display
  - Error reporting integration

### Phase 6: Testing and Documentation

**Goal**: Ensure all new components are well-tested and documented

#### Task 6.1: Component Testing

- [ ] **Directory**: `src/frontend/src/components/Schedule/__tests__/`
- [ ] **Files to Create**:
  - [ ] `NavigationSection.test.tsx`
  - [ ] `VersionManagementSection.test.tsx`
  - [ ] `ActionControlsSection.test.tsx`
  - [ ] `AIFeaturesSection.test.tsx`
  - [ ] `ModalManager.test.tsx`
  - [ ] `SchedulePageLayout.test.tsx`

#### Task 6.2: Hook Testing

- [ ] **Directory**: `src/frontend/src/hooks/__tests__/`
- [ ] **Files to Create**:
  - [ ] `useNavigationState.test.ts`
  - [ ] `useAIGenerationState.test.ts`
  - [ ] `useDialogState.test.ts`
  - [ ] `useScheduleOperations.test.ts`

#### Task 6.3: Integration Testing

- [ ] **File**: `src/frontend/src/pages/__tests__/SchedulePage.integration.test.tsx`
- [ ] **Purpose**: Test component integration and workflow
- [ ] **Coverage**:
  - Full user workflows
  - Component communication
  - State synchronization
  - Error scenarios

#### Task 6.4: Documentation

- [ ] **File**: `src/frontend/src/components/Schedule/README.md`
- [ ] **Content**:
  - Component overview
  - Architecture decisions
  - Usage examples
  - Integration guide
- [ ] **File**: `src/frontend/src/hooks/README.md`
- [ ] **Content**:
  - Hook descriptions
  - Usage patterns
  - Best practices

### Phase 7: Performance Optimization

**Goal**: Optimize performance after modularization

#### Task 7.1: Memoization Implementation

- [ ] **Components to Optimize**:
  - [ ] NavigationSection (useMemo for date calculations)
  - [ ] VersionManagementSection (useMemo for version filtering)
  - [ ] ScheduleManager (React.memo for props comparison)
  - [ ] ActionControlsSection (useCallback for event handlers)

#### Task 7.2: Code Splitting

- [ ] **Lazy Loading**:
  - [ ] AI-related components (conditional loading)
  - [ ] Modal components (load on demand)
  - [ ] Statistics components (load when needed)

#### Task 7.3: Bundle Analysis

- [ ] **Task**: Analyze bundle size impact
- [ ] **Tools**: webpack-bundle-analyzer
- [ ] **Target**: No significant bundle size increase
- [ ] **Optimization**: Tree shaking verification

### Phase 8: Final Integration and Cleanup

**Goal**: Complete the modularization and clean up

#### Task 8.1: Main SchedulePage Refactor

- [ ] **Target Size**: 300-500 lines (down from 1838)
- [ ] **Structure**:

  ```tsx
  export function SchedulePage() {
    // Minimal state and hooks
    const navigationState = useNavigationState();
    const aiState = useAIGenerationState();
    const dialogState = useDialogState();
    const scheduleOps = useScheduleOperations();
    
    return (
      <SchedulePageLayout>
        <NavigationSection {...navigationState} />
        <VersionManagementSection {...versionProps} />
        <ActionControlsSection {...actionProps} />
        <MainContentArea>
          <ScheduleManager {...scheduleProps} />
        </MainContentArea>
        <SettingsSidebar {...sidebarProps} />
        <ModalManager {...dialogState} />
      </SchedulePageLayout>
    );
  }
  ```

#### Task 8.2: Remove Unused Code

- [ ] **Cleanup Tasks**:
  - [ ] Remove commented-out imports
  - [ ] Remove unused state variables
  - [ ] Remove redundant event handlers
  - [ ] Remove duplicate logic

#### Task 8.3: TypeScript Improvements

- [ ] **Interface Consolidation**:
  - [ ] Create shared prop interfaces
  - [ ] Improve type safety
  - [ ] Add proper JSDoc comments
  - [ ] Remove any/unknown types

#### Task 8.4: Performance Testing

- [ ] **Metrics to Track**:
  - [ ] Component render counts
  - [ ] Bundle size comparison
  - [ ] Runtime performance
  - [ ] Memory usage

## Implementation Order

### Week 1: Foundation

- [x] Task 1.1: Navigation State Hook
- [x] Task 1.2: AI Generation State Hook
- [x] Task 1.3: Dialog Management Hook
- [x] Task 1.4: Schedule Operations Hook

### Week 2: Component Extraction

- [ ] Task 2.1: Navigation Section Component
- [ ] Task 2.2: Version Management Section Component
- [ ] Task 2.3: Action Controls Section Component

### Week 3: Advanced Components

- [ ] Task 2.4: AI Features Section Component
- [ ] Task 2.5: Settings and Statistics Sidebar
- [ ] Task 3.1: Modal Manager Component

### Week 4: Services and Layout

- [ ] Task 4.1: Main Layout Component
- [ ] Task 5.1: Event Handlers Service
- [ ] Task 5.2: Business Logic Service

### Week 5: Testing and Documentation

- [ ] Task 6.1: Component Testing
- [ ] Task 6.2: Hook Testing
- [ ] Task 6.3: Integration Testing

### Week 6: Optimization and Final Integration

- [ ] Task 7.1: Memoization Implementation
- [ ] Task 8.1: Main SchedulePage Refactor
- [ ] Task 8.2: Remove Unused Code

## Success Criteria

### Code Quality

- [ ] SchedulePage.tsx reduced to <500 lines
- [ ] Each component <200 lines
- [ ] Each hook <150 lines
- [ ] No duplicate logic between components
- [ ] Proper TypeScript typing throughout

### Maintainability

- [ ] Clear separation of concerns
- [ ] Reusable components and hooks
- [ ] Comprehensive test coverage (>80%)
- [ ] Clear documentation for all components

### Performance

- [ ] No performance regression
- [ ] Bundle size increase <10%
- [ ] Improved component reusability
- [ ] Better code splitting opportunities

### Developer Experience

- [ ] Easier to locate specific functionality
- [ ] Simplified debugging
- [ ] Clear component boundaries
- [ ] Improved IDE support and navigation

## Risk Assessment

### Low Risk

- [ ] Hook extraction (well-defined interfaces)
- [ ] Component extraction (clear boundaries)
- [ ] Testing implementation

### Medium Risk

- [ ] State synchronization between new components
- [ ] Event handler coordination
- [ ] Modal state management

### High Risk

- [ ] Breaking existing functionality during refactor
- [ ] Performance impact from additional component layers
- [ ] Complex state dependencies

## Rollback Plan

If any phase encounters significant issues:

1. **Immediate**: Revert to previous working state
2. **Short-term**: Implement minimal viable version of the task
3. **Long-term**: Re-evaluate approach and adjust plan

## Notes

- Each task should be implemented in a separate branch
- All tasks require code review before merging
- Integration tests must pass before proceeding to next phase
- Performance benchmarks should be run after each major phase
