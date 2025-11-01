import { isWithinInterval } from 'date-fns'
import { useCalendarContext } from '../../calendar-context'
import CalendarEventEnhanced from '../../calendar-event-enhanced'
import CalendarBodyHeader from '../calendar-body-header'

export default function CalendarBodyWeekDayContent({ date }: { date: Date }) {
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

            <div className="flex-1 relative overflow-hidden bg-background">
                {/* Event list for week view - simplified, no hour blocks */}
                <div className="flex flex-col gap-1 p-2 overflow-y-auto h-full">
                    {dayEvents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No events</p>
                    ) : (
                        dayEvents.map((event) => (
                            <CalendarEventEnhanced
                                key={event.id}
                                event={event}
                                week
                                status={event.metadata?.status}
                                onUpdate={onEventUpdate}
                                onDelete={onEventDelete}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
