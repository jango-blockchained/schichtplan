import { cn } from '@/lib/utils'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { useCalendarContext } from '../../calendar-context'
import CalendarEventEnhanced from '../../calendar-event-enhanced'

export default function CalendarBodyMonth() {
  const { date, events, setDate, setMode, onEventUpdate, onEventDelete } = useCalendarContext()

  // Get the first day of the month
  const monthStart = startOfMonth(date)
  // Get the last day of the month
  const monthEnd = endOfMonth(date)

  // Get the first Monday of the first week (may be in previous month)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  // Get the last Sunday of the last week (may be in next month)
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  // Get all days between start and end
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  })

  const today = new Date()

  // Filter events to only show those within the current month view
  const visibleEvents = events.filter(
    (event) =>
      isWithinInterval(event.start, {
        start: calendarStart,
        end: calendarEnd,
      }) ||
      isWithinInterval(event.end, { start: calendarStart, end: calendarEnd })
  )

  return (
    <div className="flex flex-col flex-grow overflow-hidden">
      <div className="hidden md:grid grid-cols-7 border-border divide-x divide-border">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className="py-1 text-center text-xs font-medium text-muted-foreground border-b border-border"
          >
            {day}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={monthStart.toISOString()}
          className="grid md:grid-cols-7 flex-grow overflow-y-auto relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.2,
            ease: 'easeInOut',
          }}
        >
          {/* Day cells */}
          {calendarDays.map((day) => {
            const isToday = isSameDay(day, today)
            const isCurrentMonth = isSameMonth(day, date)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'relative border-b border-r p-0.5 cursor-pointer min-h-20',
                  !isCurrentMonth && 'bg-muted/50 hidden md:flex'
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  setDate(day)
                  setMode('day')
                }}
              >
                <div
                  className={cn(
                    'text-xs font-medium w-fit p-0.5 flex flex-col items-center justify-center rounded-full aspect-square absolute top-1 left-1',
                    isToday && 'bg-primary text-background'
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>
            )
          })}

          {/* Multi-day events rendered as spanning bars */}
          <div className="absolute inset-0 pointer-events-none">
            {visibleEvents
              .filter((event) => !isSameDay(event.start, event.end)) // Only multi-day events
              .flatMap((event) => {
                // Find start and end day indices
                const startIndex = calendarDays.findIndex((day) => isSameDay(day, event.start))
                const endIndex = calendarDays.findIndex((day) => isSameDay(day, event.end))

                if (startIndex === -1) return []

                const actualEndIndex = endIndex === -1 ? calendarDays.length - 1 : endIndex

                // Calculate which weeks this event spans
                const startWeek = Math.floor(startIndex / 7)
                const endWeek = Math.floor(actualEndIndex / 7)

                // Create a segment for each week the event spans
                const segments = []
                for (let weekRow = startWeek; weekRow <= endWeek; weekRow++) {
                  const weekStart = weekRow * 7
                  const weekEnd = Math.min(weekStart + 6, calendarDays.length - 1)

                  // Calculate segment bounds within this week
                  const segmentStart = weekRow === startWeek ? startIndex : weekStart
                  const segmentEnd = weekRow === endWeek ? actualEndIndex : weekEnd

                  const columnStart = segmentStart % 7
                  const cellsInSegment = (segmentEnd - segmentStart) + 1

                  const cellWidth = 100 / 7
                  const left = (columnStart * cellWidth)
                  const width = (cellsInSegment * cellWidth)
                  const topOffset = 24 // Below day number - reduced

                  // Determine if this segment is the first or last
                  const isFirstSegment = weekRow === startWeek
                  const isLastSegment = weekRow === endWeek

                  segments.push(
                    <div
                      key={`event-${event.id}-week-${weekRow}`}
                      className="absolute"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: `${weekRow * (100 / Math.ceil(calendarDays.length / 7))}%`,
                        height: `${100 / Math.ceil(calendarDays.length / 7)}%`,
                        paddingTop: `${topOffset}px`,
                        paddingLeft: '2px',
                        paddingRight: '2px',
                        pointerEvents: 'auto',
                        zIndex: 10,
                      }}
                    >
                      <CalendarEventEnhanced
                        event={event}
                        month
                        isFirstDay={isFirstSegment}
                        isLastDay={isLastSegment}
                        className="w-full"
                        status={event.metadata?.status}
                        onUpdate={onEventUpdate}
                        onDelete={onEventDelete}
                      />
                    </div>
                  )
                }

                return segments
              })}
          </div>

          {/* Single-day events */}
          {calendarDays.map((day) => {
            // Get single-day events only
            const dayEvents = visibleEvents.filter((event) =>
              isSameDay(event.start, day) && isSameDay(event.end, day)
            )

            if (dayEvents.length === 0) return null

            const cellWidth = 100 / 7
            const dayIndex = calendarDays.findIndex((d) => isSameDay(d, day))
            const weekRow = Math.floor(dayIndex / 7)
            const columnStart = dayIndex % 7

            return (
              <div
                key={`single-${day.toISOString()}`}
                className="absolute flex flex-col gap-0.5"
                style={{
                  left: `${(columnStart * cellWidth) + 2}%`,
                  width: `${cellWidth - 4}%`,
                  top: `${weekRow * (100 / Math.ceil(calendarDays.length / 7)) + 3}%`,
                  height: `${100 / Math.ceil(calendarDays.length / 7) - 3}%`,
                  paddingTop: '20px',
                  paddingLeft: '1px',
                  paddingRight: '1px',
                  overflow: 'hidden',
                  pointerEvents: 'auto',
                  zIndex: 20,
                }}
              >
                {dayEvents.map((event) => (
                  <CalendarEventEnhanced
                    key={event.id}
                    event={event}
                    month
                    isFirstDay={true}
                    isLastDay={true}
                    className="w-full text-xs"
                    status={event.metadata?.status}
                    onUpdate={onEventUpdate}
                    onDelete={onEventDelete}
                  />
                ))}
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
