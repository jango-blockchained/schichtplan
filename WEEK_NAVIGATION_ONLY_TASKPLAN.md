# Week Navigation Only - Comprehensive Task Plan

## Overview
This plan details the complete removal of the default navigation system and migration to week-based navigation only. The goal is to simplify the navigation experience and eliminate the dual-navigation complexity.

## Known Issues
- Version table uses different version naming convention (legacy numeric vs. week-based identifiers)
- Version selection happens in background and needs to be properly integrated
- WeekVersionMeta vs. VersionMeta data structure differences

## Phase 1: Frontend Navigation System Changes

### 1.1 Remove Default Navigation Toggle
- [x] **Task**: Remove navigation mode toggle from SchedulePage
  - **File**: `/src/frontend/src/pages/SchedulePage.tsx`
  - **Action**: Remove `useWeekBasedNavigation` state and toggle UI
  - **Lines**: ~232, 1530-1550
  - **Details**: Eliminate the switch that allows users to choose between navigation modes

### 1.2 Replace Date Range Selector with Week Navigator
- [x] **Task**: Remove EnhancedDateRangeSelector component usage
  - **File**: `/src/frontend/src/pages/SchedulePage.tsx`
  - **Action**: Remove conditional rendering of EnhancedDateRangeSelector
  - **Lines**: ~1578-1593
  - **Details**: Replace with permanent WeekNavigator component

- [x] **Task**: Update WeekNavigator to be the primary navigation
  - **File**: `/src/frontend/src/components/WeekNavigator.tsx`
  - **Action**: Enhance component to be the main navigation interface
  - **Details**: Add any missing functionality from EnhancedDateRangeSelector

### 1.3 Remove Legacy Version Table
- [x] **Task**: Remove VersionTable component from SchedulePage
  - **File**: `/src/frontend/src/pages/SchedulePage.tsx`
  - **Action**: Remove VersionTable import and usage
  - **Lines**: ~116, 1594-1610
  - **Details**: Version management will be handled by WeekVersionDisplay

- [x] **Task**: Update version management to use WeekVersionDisplay only
  - **File**: `/src/frontend/src/pages/SchedulePage.tsx`
  - **Action**: Ensure WeekVersionDisplay handles all version operations
  - **Details**: Move version creation, selection, and management to week-based system

## Phase 2: Backend API Integration

### 2.1 Update Version Control Logic
- [x] **Task**: Modify useVersionControl hook to use week-based system
  - **File**: `/src/frontend/src/hooks/useVersionControl.tsx`
  - **Action**: Replace with week-based version control or update to use WeekVersionService
  - **Details**: Ensure backward compatibility during transition

- [x] **Task**: Update SchedulePage to use week-based version control exclusively
  - **File**: `/src/frontend/src/pages/SchedulePage.tsx`
  - **Action**: Remove legacy version control hooks and state
  - **Lines**: ~270-290, 330-340
  - **Details**: Use only weekBasedVersionControl

### 2.2 Fix Version Naming and Metadata
- [x] **Task**: Update version metadata handling for week-based versions
  - **File**: `/src/frontend/src/services/api.ts`
  - **Action**: Ensure API calls use week identifiers instead of numeric versions
  - **Details**: Update getVersions, createVersion, and related functions

- [ ] **Task**: Fix backend API endpoints for week version creation
  - **File**: `/src/backend/api/week_navigation.py`
  - **Action**: Fix database session handling in WeekVersionService calls
  - **Lines**: ~58, 131, 154
  - **Details**: API routes return 500 errors due to improper database session handling

- [ ] **Task**: Fix version selection in background
  - **File**: `/src/frontend/src/pages/SchedulePage.tsx`
  - **Action**: Ensure version selection properly updates selectedVersion state
  - **Lines**: ~1565-1575
  - **Details**: Fix version identifier conversion and state synchronization

### 2.3 Update Frontend API Service
- [ ] **Task**: Update API service to use correct week endpoints
  - **File**: `/src/frontend/src/services/api.ts`
  - **Action**: Update `createWeekVersion` to use `/api/weeks/create` endpoint
  - **Details**: Frontend expects different API structure than backend provides

## Phase 3: Settings System Integration

### 3.1 Update Settings to Default to Week Navigation
- [ ] **Task**: Change default week navigation setting
  - **File**: `/src/frontend/src/components/UnifiedSettingsSections/WeekNavigationSection.tsx`
  - **Action**: Update default values to enable week navigation by default
  - **Details**: Ensure new installations use week navigation

- [ ] **Task**: Remove week navigation toggle from settings
  - **File**: `/src/frontend/src/components/UnifiedSettingsSections/WeekNavigationSection.tsx`
  - **Action**: Remove the enable/disable switch since it's now mandatory
  - **Lines**: ~60-75
  - **Details**: Keep configuration options but remove the ability to disable

### 3.2 Update Settings Page Logic
- [ ] **Task**: Update settings page to handle week navigation as default
  - **File**: `/src/frontend/src/pages/UnifiedSettingsPage.tsx`
  - **Action**: Remove conditional week navigation logic
  - **Lines**: ~528-540
  - **Details**: Treat week navigation as the standard mode

## Phase 4: Component Cleanup and Refactoring

### 4.1 Remove Unused Components
- [ ] **Task**: Remove or deprecate EnhancedDateRangeSelector
  - **File**: `/src/frontend/src/components/EnhancedDateRangeSelector.tsx`
  - **Action**: Remove component if no longer used elsewhere
  - **Details**: Check for usage in other pages (CalendarPage, etc.)

- [ ] **Task**: Remove or deprecate DateRangeSelector
  - **File**: `/src/frontend/src/components/DateRangeSelector.tsx`
  - **Action**: Remove component if no longer used elsewhere
  - **Details**: Check for usage in other components

### 4.2 Update ScheduleTable Navigation
- [ ] **Task**: Review ScheduleTable navigation integration
  - **File**: `/src/frontend/src/components/ScheduleTable.tsx`
  - **Action**: Ensure table navigation works with week-based system
  - **Lines**: ~1379-1400, 2065-2080
  - **Details**: Verify day navigation and table pagination works correctly

## Phase 5: Data Migration and Compatibility

### 5.1 Handle Legacy Version Data
- [ ] **Task**: Create migration strategy for existing versions
  - **File**: Backend migration script
  - **Action**: Convert existing VersionMeta entries to week-based format
  - **Details**: Populate week_identifier and is_week_based fields

- [ ] **Task**: Update version queries to handle both formats
  - **File**: `/src/backend/services/week_version_service.py`
  - **Action**: Ensure service can handle legacy and week-based versions
  - **Details**: Provide backward compatibility during transition

### 5.2 Fix Version Identifier Conversion
- [ ] **Task**: Standardize version identifier handling
  - **File**: `/src/frontend/src/pages/SchedulePage.tsx`
  - **Action**: Remove version identifier conversion logic
  - **Lines**: ~1567-1573
  - **Details**: Use consistent week-based identifiers throughout

## Phase 6: Testing and Validation

### 6.1 Component Testing
- [ ] **Task**: Test WeekNavigator as primary navigation
  - **Action**: Verify all navigation functions work correctly
  - **Details**: Test previous/next week, week selection, version creation

- [ ] **Task**: Test WeekVersionDisplay functionality
  - **Action**: Verify version creation, selection, and display
  - **Details**: Test version metadata, notes, and status updates

### 6.2 Integration Testing
- [ ] **Task**: Test schedule data loading with week navigation
  - **Action**: Verify schedules load correctly for selected weeks
  - **Details**: Test with different date ranges and version states

- [ ] **Task**: Test version management operations
  - **Action**: Verify create, publish, archive, and delete operations
  - **Details**: Test with week-based version identifiers

## Phase 7: Documentation and Cleanup

### 7.1 Update Documentation
- [ ] **Task**: Update component documentation
  - **Action**: Remove references to default navigation
  - **Details**: Update README, component comments, and API docs

- [ ] **Task**: Update user documentation
  - **Action**: Create user guide for week-based navigation
  - **Details**: Explain new navigation paradigm and features

### 7.2 Code Cleanup
- [ ] **Task**: Remove unused imports and dependencies
  - **Action**: Clean up imports in SchedulePage and related components
  - **Details**: Remove EnhancedDateRangeSelector, VersionTable imports

- [ ] **Task**: Remove unused state and variables
  - **Action**: Clean up state management in SchedulePage
  - **Details**: Remove useWeekBasedNavigation and related state

## Phase 8: Final Integration

### 8.1 Settings Integration
- [ ] **Task**: Ensure settings properly control week navigation behavior
  - **Action**: Test weekend start, month boundary mode settings
  - **Details**: Verify settings changes reflect in navigation

### 8.2 Backend Integration
- [ ] **Task**: Verify API endpoints work with week navigation only
  - **Action**: Test all schedule and version API calls
  - **Details**: Ensure proper week identifier handling

## Completion Criteria

- [ ] **Navigation**: Only week-based navigation is available
- [ ] **Version Management**: All version operations use week-based identifiers
- [ ] **Settings**: Week navigation settings work correctly
- [ ] **Data Integrity**: Existing data is preserved and accessible
- [ ] **Performance**: Navigation is responsive and efficient
- [ ] **User Experience**: Navigation is intuitive and consistent

## Risk Mitigation

### High Risk Items
- [ ] **Data Loss**: Ensure existing schedule data remains accessible
- [ ] **Version Conflicts**: Handle version identifier conflicts gracefully
- [ ] **Settings Corruption**: Validate settings changes don't break functionality

### Testing Requirements
- [ ] **Backup**: Create database backup before major changes
- [ ] **Rollback Plan**: Prepare rollback procedure if issues arise
- [ ] **User Acceptance**: Test with real user scenarios

## Notes

### Version Identifier Format
- Legacy: Numeric (1, 2, 3, ...)
- Week-based: String format (2024-W15, 2024-W16, ...)

### Database Schema
- `schedule_version_meta` table has both legacy and week-based fields
- `week_identifier` field stores week-based identifiers
- `is_week_based` flag distinguishes version types

### Component Dependencies
- WeekNavigator depends on WeekInfo and WeekVersionMeta types
- WeekVersionDisplay handles version metadata display
- ScheduleTable needs to work with week-based date ranges

This comprehensive plan ensures a smooth transition to week-based navigation only while maintaining data integrity and user experience.
