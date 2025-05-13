# Unified Settings Implementation Plan

## Task ID: TASK-20240710-UnifiedSettings-Implementation-Plan
## Status: pending
## Priority: high
## Dependencies: TASK-20240710-Settings-Refactor

## Description
This document outlines the detailed implementation plan for refactoring the General Store Setup and Scheduling Engine sections, as well as adding the new Special Days management feature to the settings pages.

## Implementation Plan

### Phase 1: Component Structure Refactoring

#### Step 1: GeneralStoreSetupSection Refactoring
```typescript
// Revised structure for GeneralStoreSetupSection.tsx
const GeneralStoreSetupSection = ({ settings, onInputChange, onOpeningDaysChange, onSpecialDaysChange, onImmediateUpdate }) => {
  return (
    <div className="space-y-6">
      {/* Store Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
          <CardDescription>Basic information about your store</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Store name, address, contact */}
          {/* ... */}
        </CardContent>
      </Card>

      {/* Store Hours & Opening Days Card */}
      <Card>
        <CardHeader>
          <CardTitle>Store Hours & Opening Days</CardTitle>
          <CardDescription>When your store is open for business</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Time-only pickers for opening/closing */}
            <div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Opening Time</Label>
                  {/* Time only picker */}
                </div>
                <div className="space-y-2">
                  <Label>Closing Time</Label>
                  {/* Time only picker */}
                </div>
              </div>
            </div>
            
            {/* Opening days (moved from bottom to here) */}
            <div>
              <Label>Opening Days</Label>
              <div className="grid grid-cols-7 gap-2 mt-2">
                {/* Opening days toggles */}
              </div>
            </div>
          </div>

          {/* Keyholder settings */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            {/* Keyholder fields */}
          </div>
        </CardContent>
      </Card>

      {/* Special Days & Holidays Card (New) */}
      <SpecialDaysManagement
        specialDays={settings?.special_days || {}}
        onUpdate={onSpecialDaysChange}
        onImmediateUpdate={onImmediateUpdate}
      />
    </div>
  );
};
```

#### Step 2: SchedulingEngineSection Refactoring
- Update card structure to match other sections
- Maintain all existing functionality

#### Step 3: Special Days Management Component
```typescript
// New component: SpecialDaysManagement.tsx
const SpecialDaysManagement = ({ specialDays, onUpdate, onImmediateUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingDay, setEditingDay] = useState(null);
  // Other state and handlers

  return (
    <Card>
      <CardHeader>
        <CardTitle>Special Days & Holidays</CardTitle>
        <CardDescription>
          Manage special days and holidays when your store has different hours or is closed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between mb-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="year-select">Year:</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              {/* Year options */}
            </Select>
          </div>
          <div className="space-x-2">
            <Button onClick={() => fetchHolidays(selectedYear)}>
              Import National Holidays
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>
              Add Special Day
            </Button>
          </div>
        </div>

        {/* Special days table */}
        <Table>
          <TableHeader>
            {/* Headers */}
          </TableHeader>
          <TableBody>
            {/* Special days */}
          </TableBody>
        </Table>
      </CardContent>
      
      {/* Add/Edit Day Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          {/* Form fields for special day */}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
```

### Phase 2: API and Service Implementation

#### Step 1: Backend Model Extensions
Extend the Settings model and API to support special days management.

#### Step 2: Holiday Fetching Service
```typescript
// services/holidayService.ts
export const fetchNationalHolidays = async (country: string, year: number) => {
  const response = await api.get(`/api/holidays/${country}/${year}`);
  return response.data;
};

// API implementation (backend)
const fetchHolidaysFromExternalApi = async (country, year) => {
  // Use an external API like https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}
  // or similar service
};
```

#### Step 3: Special Days Integration
- Update the schedule generation logic to check for special days
- Add handlers in UnifiedSettingsPage for special days management

### Phase 3: Testing and Refinement

#### Step 1: Testing
- Test UI components with different data scenarios
- Verify special days are respected in schedule generation
- Test holiday import functionality

#### Step 2: Refinement
- Add loading states
- Implement error handling
- Polish UI interactions

## Technical Considerations

### API Endpoints
- `GET /api/holidays/{country}/{year}` 
- `GET /api/settings/special-days`
- `POST /api/settings/special-days`
- `DELETE /api/settings/special-days/{date}`

### Data Models
```typescript
// Special day type
interface SpecialDay {
  date: string; // ISO format
  description: string;
  is_closed: boolean;
  custom_hours?: {
    opening: string; // HH:MM format
    closing: string; // HH:MM format
  };
}

// Settings model extension
interface Settings {
  // existing fields...
  special_days: {
    [date: string]: SpecialDay;
  };
}
```

### UI Components Needed
1. Time-only picker component
2. Calendar/date selection component
3. Special day modal form
4. Holiday import dialog

## Acceptance Criteria
1. General Store Setup and Scheduling Engine sections use consistent card-based layout
2. Time fields show only time, not date
3. Store hours and opening days are grouped together logically
4. Special days can be added, edited, and deleted
5. National holidays can be imported for selected year and country
6. Special days are respected during schedule generation