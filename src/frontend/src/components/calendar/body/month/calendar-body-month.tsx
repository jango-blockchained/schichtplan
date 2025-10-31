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
          {/* Day cells */}
          {calendarDays.map((day) => {
            const isToday = isSameDay(day, today)
            const isCurrentMonth = isSameMonth(day, date)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'relative border-b border-r p-2 cursor-pointer min-h-32',
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
                    'text-sm font-medium w-fit p-1 flex flex-col items-center justify-center rounded-full aspect-square absolute top-2 left-2',
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
              .filter((event) => isSameDay(event.start, event.start)) // Process each event once
              .map((event) => {
                // Find start and end day indices
                const startIndex = calendarDays.findIndex((day) => isSameDay(day, event.start))
                const endIndex = calendarDays.findIndex((day) => isSameDay(day, event.end))

                if (startIndex === -1) return null

                // Calculate position and span
                const cellWidth = 100 / 7
                const weekRow = Math.floor(startIndex / 7)
                const cellsInThisWeek = Math.min(7 - (startIndex % 7), (endIndex - startIndex) + 1)
                const columnStart = startIndex % 7

                // Determine if this is first and last day
                const isFirstDay = true
                const isLastDay = isSameDay(event.end, event.start) ||
                  weekRow !== Math.floor(endIndex / 7) ||
                  endIndex === startIndex

                const left = (columnStart * cellWidth)
                const width = (cellsInThisWeek * cellWidth)
                const topOffset = 56 // Below day number

                return (
                  <div
                    key={`event-${event.id}-${weekRow}`}
                    className="absolute"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top: `${weekRow * (100 / Math.ceil(calendarDays.length / 7))}%`,
                      height: `${100 / Math.ceil(calendarDays.length / 7)}%`,
                      paddingTop: `${topOffset}px`,
                      paddingLeft: '4px',
                      paddingRight: '4px',
                      pointerEvents: 'auto',
                      zIndex: 10,
                    }}
                  >
                    <CalendarEventEnhanced
                      event={event}
                      month
                      isFirstDay={isFirstDay}
                      isLastDay={isLastDay}
                      className="w-full"
                      status={event.metadata?.status}
                      onUpdate={onEventUpdate}
                      onDelete={onEventDelete}
                    />
                  </div>
                )
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
                className="absolute flex flex-col gap-1"
                style={{
                  left: `${(columnStart * cellWidth) + 2}%`,
                  width: `${cellWidth - 4}%`,
                  top: `${weekRow * (100 / Math.ceil(calendarDays.length / 7)) + 5}%`,
                  height: `${100 / Math.ceil(calendarDays.length / 7) - 5}%`,
                  paddingTop: '32px',
                  paddingLeft: '4px',
                  paddingRight: '4px',
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
