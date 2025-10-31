export type CalendarProps = {
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  mode: Mode
  setMode: (mode: Mode) => void
  date: Date
  setDate: (date: Date) => void
  calendarIconIsToday?: boolean
  onEventUpdate?: (eventId: string, updates: { start: Date; end: Date }) => void
  onEventDelete?: (eventId: string) => void
}

export type CalendarContextType = CalendarProps & {
  newEventDialogOpen: boolean
  setNewEventDialogOpen: (open: boolean) => void
  manageEventDialogOpen: boolean
  setManageEventDialogOpen: (open: boolean) => void
  selectedEvent: CalendarEvent | null
  setSelectedEvent: (event: CalendarEvent | null) => void
}
export type CalendarEvent = {
  id: string
  title: string
  color: string
  start: Date
  end: Date
  metadata?: {
    absenceId?: number
    employeeId?: number
    status?: 'approved' | 'requested' | 'declined'
    note?: string
  }
}

export const calendarModes = ['day', 'week', 'month', 'year'] as const
export type Mode = (typeof calendarModes)[number]
