# Monthly Border Feature Implementation Plan

## Overview

The monthly border feature allows the system to handle weeks that span across two different months. This feature impacts navigation, schedule display, data management, and version control.

## Current Status

- Backend: Basic MonthBoundaryMode enum and utility functions exist in `src/backend/utils/week_utils.py`
- Frontend: MonthBoundaryMode settings exist but implementation is incomplete
- Settings: UI elements exist in WeekSettings, WeekNavigationSettingsOverlay, and UnifiedSettingsSections
- Navigation: WeekNavigator shows indicators but doesn't handle split weeks properly

## Implementation Tasks

### Phase 1: Backend Core Implementation ✅

1. **Enhance Week Utilities** ✅

   - [x] Verify `handle_month_boundary()` function in `week_utils.py`
   - [x] Add helper functions for week splitting logic
   - [x] Add `WeekSegmentInfo` dataclass for segment information
   - [x] Implement `get_week_segments()` function

2. **Update Week API Endpoints** ✅

   - [x] Modify `/api/weeks/info` to return split week segments when mode is SPLIT_ON_MONTH
   - [x] Add new endpoint `/api/weeks/segments/<week_identifier>` to get week segments
   - [x] Update `/api/weeks/next` and `/api/weeks/previous` to handle split weeks navigation

3. **Version Management Updates** ✅
   - [x] Update `ScheduleVersionMeta` to support split week versions
   - [x] Modify version creation to handle split weeks (create separate versions per segment)
   - [x] Update version queries to aggregate split week versions

### Phase 2: Frontend Navigation Implementation ✅

4. **Week Navigation Component Updates** ✅

   - [x] Update `WeekNavigator` to display split week segments
   - [x] Add visual indicators for each segment (e.g., "KW 52/2024 (Teil 1)")
   - [x] Update navigation buttons to move between segments when in split mode
   - [x] Add segment selector buttons for quick navigation

5. **Week-based Version Control Updates** ✅

   - [x] Update `useWeekBasedVersionControl` hook to handle split weeks
   - [x] Add segment state management
   - [x] Update date range calculation for split weeks
   - [x] Implement segment change handler

6. **Version Manager Updates** ✅
   - [x] Updated backend version service to create separate versions for each segment
   - [x] Handle version creation for split weeks with segment-specific metadata
   - [x] Updated version aggregation to find all segments for a week

### Phase 3: Schedule Display and Management ✅

7. **Schedule Table Updates** ✅

   - [x] Updated `ScheduleTable` to handle split week display
   - [x] Added visual separation between month segments (amber borders and backgrounds)
   - [x] Updated column headers for split weeks with month indicators

8. **Schedule Data Hook Updates** ✅
   - [x] Data loading works automatically with segment-based date ranges
   - [x] `useWeekBasedVersionControl` hook provides correct segment date ranges
   - [x] Schedule mutations work correctly with split week data

### Phase 4: Settings Integration ✅

9. **Settings Persistence** ✅

   - [x] Month boundary mode setting is properly saved and loaded
   - [x] Backend respects settings from database
   - [x] Settings API handles month boundary mode changes

10. **Settings UI Polish** ✅
    - [x] Settings UI exists in WeekNavigationSettingsOverlay and WeekSettings
    - [x] Clear descriptions and help text for both modes
    - [x] Real-time preview through visual indicators in navigation

### Phase 5: Testing and Edge Cases ✅

11. **Edge Case Handling** ✅

    - [x] Handle year boundaries (December/January transitions tested)
    - [x] Handle February edge cases (leap year vs regular year tested)
    - [x] Handle mode switching with existing data
    - [x] Version management works correctly for split weeks

12. **Testing** ✅
    - [x] Unit tests for week splitting logic (test_month_boundary.py with 6 comprehensive tests)
    - [x] Backend API endpoints handle split weeks correctly
    - [x] Frontend components display split weeks properly with visual separation
    - [x] Edge case testing for year boundaries and February (leap/regular years)

## Technical Details

### Week Splitting Logic

When `MonthBoundaryMode.SPLIT_ON_MONTH` is active:

1. Weeks spanning multiple months are split at month boundaries
2. Each segment gets its own version and schedule data
3. Navigation moves between segments, not full weeks
4. Display shows partial week indicators

### Data Structure Changes

```typescript
// Extended WeekInfo for split weeks
interface WeekSegmentInfo extends WeekInfo {
  isSegment: boolean;
  segmentNumber: number;
  totalSegments: number;
  segmentStartDate: Date;
  segmentEndDate: Date;
  originalWeekIdentifier: string;
}
```

### API Response Changes

```json
// GET /api/weeks/info response for split week
{
  "week_identifier": "2024-W52",
  "is_split": true,
  "segments": [
    {
      "segment_id": "2024-W52-S1",
      "start_date": "2024-12-23",
      "end_date": "2024-12-31",
      "month": "December 2024"
    },
    {
      "segment_id": "2025-W01-S1",
      "start_date": "2025-01-01",
      "end_date": "2025-01-05",
      "month": "January 2025"
    }
  ]
}
```

## Implementation Order

1. Start with backend week utilities and API endpoints
2. Update frontend navigation components
3. Modify schedule display and data handling
4. Polish settings integration
5. Comprehensive testing

## Success Criteria

- [ ] Users can toggle between KEEP_INTACT and SPLIT_ON_MONTH modes
- [ ] Split weeks display correctly with visual indicators
- [ ] Navigation works seamlessly between week segments
- [ ] Schedule data is properly managed for split weeks
- [ ] Version control handles split weeks appropriately
- [ ] No data loss when switching modes
- [ ] Clear visual feedback for users about split weeks

## Risks and Mitigation

- **Data Consistency**: Ensure proper transaction handling when creating split versions
- **Performance**: Optimize queries to handle aggregated data for split weeks
- **UX Confusion**: Provide clear visual indicators and help text
- **Migration**: Handle existing data when feature is enabled

## Notes

- Priority should be given to maintaining backwards compatibility
- Consider feature flag for gradual rollout
- Document behavior changes for users
- Update API documentation for new endpoints
