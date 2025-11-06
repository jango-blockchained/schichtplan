# Testing Guide for New Features

This guide describes how to test the newly implemented features for employee availability hover modal and split week functionality.

## Feature 1: Employee Availability Hover Modal

### Description
When hovering over an employee name in the schedule table, a modal appears showing the employee's availability in a simplified format.

### Testing Steps

1. **Start the Application**
   ```bash
   ./start.sh
   ```

2. **Navigate to Schedule Page**
   - Open your browser to `http://localhost:5173`
   - Navigate to the "Dienstplan" (Schedule) page

3. **Test Hover Functionality**
   - Locate the employee names in the leftmost column of the schedule table
   - Hover your mouse over an employee's name
   - A modal should appear after ~300ms showing:
     - Employee name
     - Date range context
     - Availability by day of week (Monday-Sunday)
     - Time ranges for each available period (e.g., "08:00 - 16:00")
     - Badges indicating availability type (FIXED, PREFERRED, AVAILABLE, UNAVAILABLE)

4. **Verify Data Display**
   - Check that availabilities are grouped by day
   - Verify time ranges are formatted correctly
   - Ensure badges show correct availability types
   - Confirm loading state appears while data is fetching

5. **Test Edge Cases**
   - Hover over employee with no defined availabilities (should show "Keine spezifischen Verfügbarkeiten definiert")
   - Test with employees having multiple time ranges on same day
   - Test with different availability types

### Expected Behavior
- Hover card appears on the right side of the employee name
- Information is displayed in a clean, organized format
- No performance issues or lag when hovering
- Hover card closes when mouse moves away

## Feature 2: Split Week on Month End

### Description
When enabled, weeks that span across month boundaries are automatically split into separate segments, one for each month.

### Testing Steps

1. **Enable Split Week Feature**
   - Navigate to Settings → Week Navigation
   - Find "Week Month Boundary Mode" setting
   - Change from "keep_intact" to "split_by_month"
   - Save settings

2. **Navigate to a Week Spanning Months**
   - Go to Schedule page
   - Use week navigation to find a week that spans two months
   - Examples: Week ending on first few days of a month typically spans months

3. **Verify Split Week Indicator**
   - Look for split week indicator in week navigator header
   - Should show "Geteilte Woche" (Split Week) with a Split icon
   - Tooltip should indicate: "Modus: An Monatsgrenze geteilt"

4. **Test Segment Navigation**
   - Verify segment buttons appear below the week display
   - Should show "Teil 1" and "Teil 2" buttons
   - Click on each segment button
   - Date range should update to show only that segment's dates
   - Schedule table should display only schedules for that segment

5. **Test Navigation Between Segments**
   - Click "Vorheriger Teil" (Previous Part) button
   - Should navigate to previous segment (if available)
   - Click "Nächster Teil" (Next Part) button
   - Should navigate to next segment (if available)
   - When on last segment, "Nächster Teil" should navigate to next week

6. **Verify Version Handling**
   - Check that version creation works for split weeks
   - Verify schedules are correctly associated with their segments
   - Confirm published schedules respect segment boundaries

7. **Test Month Boundary Display**
   - Verify correct month name displayed for each segment
   - Check date ranges are accurate
   - Ensure visual indicators clearly show which month segment is active

### Expected Behavior
- Week is split at month boundary (last day of month)
- Each segment shows correct date range
- Segment navigation is smooth and intuitive
- Schedules respect segment boundaries
- All features (generation, export, etc.) work with split weeks

## Common Issues and Troubleshooting

### Issue: Hover modal doesn't appear
**Solution:**
- Check if employee has availability data defined
- Verify browser console for API errors
- Ensure backend availability endpoints are accessible

### Issue: Split week mode not activating
**Solution:**
- Verify settings were saved successfully
- Check that week actually spans months (check dates)
- Confirm backend has `week_month_boundary_mode` set to "split_by_month"
- Check browser console for segment fetch errors

### Issue: Availability shows "Keine Verfügbarkeiten"
**Solution:**
- This is expected if employee has no defined availabilities
- Add availability data via Enhanced Availability Modal
- Use "Hinzufügen" → "Verfügbarkeit (Fest)" or "Verfügbarkeit (Bevorzugt)"

## API Endpoints Used

### Employee Availability
- `GET /api/v2/availability/employee/{employee_id}` - Get employee availabilities

### Week Segments
- `GET /api/weeks/{week_identifier}/segments` - Get week segments
- Returns split information if week spans months and split mode enabled

## Database Schema

### EmployeeAvailability Table
- `employee_id` - Foreign key to employee
- `day_of_week` - Day index (0=Monday, 6=Sunday)
- `hour` - Hour of day (0-23)
- `is_available` - Boolean availability flag
- `availability_type` - FIXED, PREFERRED, AVAILABLE, UNAVAILABLE

### Settings Table
- `week_month_boundary_mode` - "keep_intact" or "split_by_month"
- `week_weekend_start` - "MONDAY" or "SUNDAY"

## Screenshots to Capture

1. Employee name hover showing availability modal
2. Split week indicator in week navigator
3. Segment navigation buttons
4. Schedule table with split week (Teil 1)
5. Schedule table with split week (Teil 2)
6. Settings page showing week navigation options

## Performance Considerations

- Availability data is cached with React Query (5 minute stale time)
- Segment data is cached per week identifier
- Hover modal has 300ms delay to prevent accidental triggers
- Date range updates trigger schedule refetch (expected behavior)
