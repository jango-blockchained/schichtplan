import { isWithinInterval } from 'date-fns'
import { useCalendarContext } from '../../calendar-context'
import CalendarEventEnhanced from '../../calendar-event-enhanced'
import CalendarBodyHeader from '../calendar-body-header'
import { hours } from './calendar-body-margin-day-margin'

export default function CalendarBodyDayContent({ date }: { date: Date }) {
  const { events, onEventUpdate, onEventDelete } = useCalendarContext()

  // Show events that span across this day, not just start on this day
  const dayEvents = events.filter((event) =>
    isWithinInterval(date, {
      start: event.start,
      end: event.end,
    })
  )

  return (
    <div className="flex flex-col flex-grow">
      <CalendarBodyHeader date={date} />

      <div className="flex-1 relative overflow-hidden">
        {hours.map((hour) => (
          <div key={hour} className="h-32 border-b border-border/50 group" />
        ))}

        <div className="absolute inset-0 pointer-events-none">
          {dayEvents.map((event) => (
            <div key={event.id} className="absolute inset-0 pointer-events-auto">
              <CalendarEventEnhanced
                event={event}
                day
                status={event.metadata?.status}
                onUpdate={onEventUpdate}
                onDelete={onEventDelete}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
