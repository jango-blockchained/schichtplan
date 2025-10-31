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
import CalendarEvent from '../../calendar-event'

export default function CalendarBodyMonth() {
  const { date, events, setDate, setMode } = useCalendarContext()

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
            className="py-2 text-center text-sm font-medium text-muted-foreground border-b border-border"
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
          {calendarDays.map((day) => {
            const isToday = isSameDay(day, today)
            const isCurrentMonth = isSameMonth(day, date)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'relative flex flex-col border-b border-r p-2 aspect-square cursor-pointer',
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
                    'text-sm font-medium w-fit p-1 flex flex-col items-center justify-center rounded-full aspect-square',
                    isToday && 'bg-primary text-background'
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>
            )
          })}

          {/* Render events on top of the grid */}
          <AnimatePresence mode="wait">
            <div className="absolute inset-0 pointer-events-none">
              {visibleEvents
                .filter((event) => isSameDay(event.start, event.start))  // Only first day of each event
                .map((event) => {
                  // Find the starting day index
                  const startDayIndex = calendarDays.findIndex((day) => isSameDay(day, event.start))
                  if (startDayIndex === -1) return null

                  // Calculate how many days this event spans
                  const eventDuration = Math.ceil(
                    (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60 * 24)
                  ) + 1

                  // Calculate how many columns to span (remaining in week + weeks after)
                  const weekStartIndex = Math.floor(startDayIndex / 7) * 7
                  const daysToEndOfWeek = 7 - (startDayIndex - weekStartIndex)
                  const spanColumns = Math.min(eventDuration, daysToEndOfWeek)

                  // Calculate row and column position
                  const rowIndex = Math.floor(startDayIndex / 7)
                  const columnIndex = startDayIndex % 7

                  // Calculate pixel position based on grid layout
                  const cellWidth = 100 / 7  // 7 columns
                  const cellHeight = 100 / Math.ceil(calendarDays.length / 7)  // rows
                  const left = (columnIndex * cellWidth)
                  const top = (rowIndex * cellHeight) + 16  // 16px offset for day number
                  const width = (spanColumns * cellWidth)

                  return (
                    <div
                      key={`event-${event.id}`}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        top: `${top}px`,
                        width: `${width}%`,
                        pointerEvents: 'auto',
                        zIndex: 10,
                      }}
                    >
                      <CalendarEvent
                        event={event}
                        className="w-full"
                        month
                        spanColumns={spanColumns}
                        isFirstDay={true}
                        isLastDay={spanColumns === eventDuration}
                      />
                    </div>
                  )
                })}
            </div>
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
