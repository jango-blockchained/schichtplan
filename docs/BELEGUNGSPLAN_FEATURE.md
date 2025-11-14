# Belegungsplan (Staffing Plan) Feature

## Overview

This feature adds a comprehensive staffing plan (Belegungsplan) with heatmap visualizations to track employee presence, vacation, and absence statistics.

## New Components

### Backend

#### StaffingService (`src/backend/services/staffing_service.py`)
Service class that calculates staffing statistics:
- `get_daily_statistics(start_date, end_date)` - Returns daily counts of present, vacation, and absent employees
- `get_heatmap_data(start_date, end_date, metric)` - Returns data formatted for heatmap visualization
- `get_employee_absence_details(target_date)` - Returns detailed employee lists by status for a specific date

#### Staffing Plan Routes (`src/backend/routes/staffing_plan.py`)
New API endpoints:
- `GET /api/v2/staffing-plan/statistics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- `GET /api/v2/staffing-plan/heatmap?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&metric=<metric>`
- `GET /api/v2/staffing-plan/details/<date>`

### Frontend

#### StaffingHeatmap Component (`src/frontend/src/components/StaffingHeatmap.tsx`)
Reusable heatmap component with:
- Week-based calendar grid layout
- Color-coded cells (green → yellow → red)
- Interactive tooltips with daily details
- Metric selector for different views
- Calendar week (KW) column

#### StaffingPlanPage (`src/frontend/src/pages/StaffingPlanPage.tsx`)
New page accessible at `/staffing-plan`:
- Multiple view modes (month, quarter, year)
- Navigation controls for date range
- Summary statistics cards
- Interactive heatmap visualization
- Detailed daily statistics table

#### Enhanced VacationPlanningPage
Added collapsible heatmap section showing vacation density.

## Usage

### Backend API Examples

```bash
# Get statistics for January 2025
curl "http://localhost:5000/api/v2/staffing-plan/statistics?start_date=2025-01-01&end_date=2025-01-31"

# Get heatmap data for vacation metric
curl "http://localhost:5000/api/v2/staffing-plan/heatmap?start_date=2025-01-01&end_date=2025-01-31&metric=on_vacation"

# Get detailed breakdown for specific date
curl "http://localhost:5000/api/v2/staffing-plan/details/2025-01-15"
```

### Frontend Usage

1. Navigate to "Belegungsplan" in the sidebar
2. Select view mode (month/quarter/year)
3. Navigate through dates using arrow buttons
4. View summary statistics cards
5. Interact with heatmap (hover for details)
6. Review detailed table with daily breakdown

### Vacation Planning Heatmap

1. Navigate to "Urlaubsplanung" page
2. Expand "Urlaubsheatmap" collapsible section
3. View vacation density across time periods

## Data Flow

```
Employee + Absence Data (Database)
    ↓
StaffingService (calculates statistics)
    ↓
Staffing Plan Routes (API endpoints)
    ↓
Frontend API Client (staffing.ts)
    ↓
StaffingPlanPage / VacationPlanningPage
    ↓
StaffingHeatmap Component (visualization)
```

## Features

- **Multiple Metrics**: View total absent, on vacation, other absences, or present employees
- **Flexible Date Ranges**: Month, quarter, or year views
- **Visual Feedback**: Color-coded heatmap with intensity scale
- **Detailed Tooltips**: Hover to see exact numbers per day
- **Responsive Design**: Works on desktop and tablet devices
- **Consistent Styling**: Follows project's design system

## Technical Details

### Color Scale

The heatmap uses a 5-level color scale based on normalized values:
- 0-20%: Green (low absence/high presence)
- 21-40%: Light green
- 41-60%: Yellow (medium)
- 61-80%: Orange
- 81-100%: Red (high absence/low presence)

### Performance

- Backend queries are optimized with proper joins and filters
- Only approved absences are counted
- Frontend uses React Query for caching and automatic refetching

### Type Safety

All API responses and component props are fully typed with TypeScript interfaces defined in `src/frontend/src/services/api/staffing.ts`.

## Testing

Backend service tested with:
```python
from src.backend.services.staffing_service import StaffingService
service = StaffingService()
stats = service.get_daily_statistics(start_date, end_date)
```

Frontend components tested through manual verification and integration with existing test infrastructure.
