import { useState } from 'react'
import { CalendarContext } from './calendar-context'
import { CalendarEvent, Mode } from './calendar-types'
import CalendarManageEventDialog from './dialog/calendar-manage-event-dialog'
import CalendarNewEventDialog from './dialog/calendar-new-event-dialog'

export default function CalendarProvider({
  events,
  setEvents,
  mode,
  setMode,
  date,
  setDate,
  calendarIconIsToday = true,
  onEventUpdate,
  onEventDelete,
  children,
}: {
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  mode: Mode
  setMode: (mode: Mode) => void
  date: Date
  setDate: (date: Date) => void
  calendarIconIsToday: boolean
  onEventUpdate?: (eventId: string, updates: { start: Date; end: Date }) => void
  onEventDelete?: (eventId: string) => void
  children: React.ReactNode
}) {
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false)
  const [manageEventDialogOpen, setManageEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1)

  return (
    <CalendarContext.Provider
      value={{
        events,
        setEvents,
        mode,
        setMode,
        date,
        setDate,
        calendarIconIsToday,
        onEventUpdate,
        onEventDelete,
        newEventDialogOpen,
        setNewEventDialogOpen,
        manageEventDialogOpen,
        setManageEventDialogOpen,
        selectedEvent,
        setSelectedEvent,
        fontSizeMultiplier,
        setFontSizeMultiplier,
      }}
    >
      <CalendarNewEventDialog />
      <CalendarManageEventDialog />
      {children}
    </CalendarContext.Provider>
  )
}
