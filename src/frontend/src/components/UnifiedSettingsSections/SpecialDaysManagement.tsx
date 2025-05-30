import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parse, isValid } from "date-fns";
import {
  CalendarPlus,
  Edit,
  Trash,
  Calendar as CalendarIcon,
  Import,
} from "lucide-react";

// Define the SpecialDay type
export interface SpecialDay {
  date: string; // ISO format YYYY-MM-DD
  description: string;
  is_closed: boolean;
  custom_hours?: {
    opening: string; // HH:MM format
    closing: string; // HH:MM format
  };
}

export interface SpecialDaysMap {
  [date: string]: SpecialDay;
}

interface SpecialDaysManagementProps {
  specialDays: SpecialDaysMap;
  onUpdate: (specialDays: SpecialDaysMap) => void;
  onImmediateUpdate: () => void;
}

export const SpecialDaysManagement: React.FC<SpecialDaysManagementProps> = ({
  specialDays,
  onUpdate,
  onImmediateUpdate,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCountry, setSelectedCountry] = useState("DE"); // Default to Germany
  const [editingDay, setEditingDay] = useState<SpecialDay | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [holidaysToImport, setHolidaysToImport] = useState<any[]>([]);

  // States for the add/edit modal
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [description, setDescription] = useState("");
  const [isClosed, setIsClosed] = useState(true);
  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime, setClosingTime] = useState("20:00");

  // Generate array of years for selection (current year +/- 5 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  // List of country options for holiday import
  const countryOptions = [
    { code: "AT", name: "Austria" },
    { code: "BE", name: "Belgium" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "IT", name: "Italy" },
    { code: "NL", name: "Netherlands" },
    { code: "ES", name: "Spain" },
    { code: "CH", name: "Switzerland" },
    { code: "UK", name: "United Kingdom" },
    { code: "US", name: "United States" },
  ];

  // Get sorted special days for display
  const getSortedSpecialDays = () => {
    return Object.entries(specialDays || {})
      .map(([date, details]) => ({ ...details, date }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  // Open modal for adding a new special day
  const handleAddSpecialDay = () => {
    setEditingDay(null);
    setSelectedDate(new Date());
    setDescription("");
    setIsClosed(true);
    setOpeningTime("09:00");
    setClosingTime("20:00");
    setIsModalOpen(true);
  };

  // Open modal for editing an existing special day
  const handleEditSpecialDay = (day: SpecialDay) => {
    setEditingDay(day);
    setSelectedDate(parse(day.date, "yyyy-MM-dd", new Date()));
    setDescription(day.description);
    setIsClosed(day.is_closed);
    if (day.custom_hours) {
      setOpeningTime(day.custom_hours.opening);
      setClosingTime(day.custom_hours.closing);
    } else {
      setOpeningTime("09:00");
      setClosingTime("20:00");
    }
    setIsModalOpen(true);
  };

  // Delete a special day
  const handleDeleteSpecialDay = (date: string) => {
    const updatedSpecialDays = { ...specialDays };
    delete updatedSpecialDays[date];
    onUpdate(updatedSpecialDays);
    onImmediateUpdate();
  };

  // Save changes from the modal
  const handleSaveSpecialDay = () => {
    if (!selectedDate || !isValid(selectedDate)) {
      // Show error - date is required
      return;
    }

    const dateString = format(selectedDate, "yyyy-MM-dd");

    // Create special day object
    const specialDay: Omit<SpecialDay, 'date'> = {
      description,
      is_closed: isClosed,
    };

    // Add custom hours if not closed
    if (!isClosed) {
      specialDay.custom_hours = {
        opening: openingTime,
        closing: closingTime,
      };
    }

    // Update the special days map
    const updatedSpecialDays = {
      ...specialDays,
      [dateString]: specialDay,
    };

    onUpdate(updatedSpecialDays);
    onImmediateUpdate();
    setIsModalOpen(false);
  };

  // Mock function to fetch holidays - will be replaced with actual API call
  const fetchHolidays = async () => {
    setIsLoading(true);

    try {
      // This is a placeholder - in the actual implementation, this would be an API call
      // e.g., const response = await fetch(`/api/holidays/${selectedCountry}/${selectedYear}`);

      // Mock data for demonstration
      const mockHolidays = [
        {
          date: `${selectedYear}-01-01`,
          name: "New Year's Day",
          type: "National",
        },
        { date: `${selectedYear}-05-01`, name: "Labor Day", type: "National" },
        {
          date: `${selectedYear}-10-03`,
          name: "German Unity Day",
          type: "National",
        },
        {
          date: `${selectedYear}-12-25`,
          name: "Christmas Day",
          type: "National",
        },
        {
          date: `${selectedYear}-12-26`,
          name: "Second Christmas Day",
          type: "National",
        },
      ];

      setHolidaysToImport(mockHolidays);
      setIsImportModalOpen(true);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      // Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  // Import selected holidays
  const handleImportHolidays = (selectedHolidays: any[]) => {
    const updatedSpecialDays = { ...specialDays };

    selectedHolidays.forEach((holiday) => {
      updatedSpecialDays[holiday.date] = {
        description: holiday.name,
        is_closed: true,
      };
    });

    onUpdate(updatedSpecialDays);
    onImmediateUpdate();
    setIsImportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Special Days & Holidays</CardTitle>
          <CardDescription>
            Manage special days and holidays when your store has different hours
            or is closed
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
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-x-2">
              <Button
                variant="secondary"
                onClick={() => setIsImportModalOpen(true)}
                disabled={isLoading}
              >
                <Import className="h-4 w-4 mr-2" />
                Import National Holidays
              </Button>
              <Button onClick={handleAddSpecialDay}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Add Special Day
              </Button>
            </div>
          </div>

          {getSortedSpecialDays().length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedSpecialDays().map((day) => (
                  <TableRow key={day.date}>
                    <TableCell>
                      {format(new Date(day.date), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>{day.description}</TableCell>
                    <TableCell>
                      {day.is_closed ? "Closed" : "Custom Hours"}
                    </TableCell>
                    <TableCell>
                      {day.is_closed
                        ? "-"
                        : `${day.custom_hours?.opening || "09:00"} - ${day.custom_hours?.closing || "20:00"}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSpecialDay(day)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSpecialDay(day.date)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No special days or holidays defined yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Special Day Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingDay ? "Edit Special Day" : "Add Special Day"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="special-day-date">Date</Label>
              <div className="border rounded-md p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="mx-auto"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="special-day-description">Description</Label>
              <Input
                id="special-day-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Christmas Day, National Holiday"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="special-day-closed"
                checked={isClosed}
                onCheckedChange={setIsClosed}
              />
              <Label htmlFor="special-day-closed">
                Store is closed on this day
              </Label>
            </div>

            {!isClosed && (
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-medium">Custom Hours</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="special-day-opening">Opening Time</Label>
                    <TimePicker value={openingTime} onChange={setOpeningTime} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="special-day-closing">Closing Time</Label>
                    <TimePicker value={closingTime} onChange={setClosingTime} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSpecialDay}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Holidays Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import National Holidays</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex space-x-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="holiday-country">Country</Label>
                <Select
                  value={selectedCountry}
                  onValueChange={setSelectedCountry}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="holiday-year">Year</Label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-8">
                <Button onClick={fetchHolidays} disabled={isLoading}>
                  {isLoading ? "Loading..." : "Fetch Holidays"}
                </Button>
              </div>
            </div>

            {holidaysToImport.length > 0 ? (
              <div className="space-y-2">
                <Label>Available Holidays</Label>
                <div className="border rounded-md p-2 max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidaysToImport.map((holiday) => (
                        <TableRow key={holiday.date}>
                          <TableCell>
                            <input
                              type="checkbox"
                              defaultChecked
                              id={`holiday-${holiday.date}`}
                              className="rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell>
                            {format(new Date(holiday.date), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell>{holiday.name}</TableCell>
                          <TableCell>{holiday.type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              !isLoading && (
                <div className="text-center py-4 text-muted-foreground">
                  Select a country and year, then click "Fetch Holidays"
                </div>
              )
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleImportHolidays(holidaysToImport)}
              disabled={holidaysToImport.length === 0}
            >
              Import Selected Holidays
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
