import { useCalendarContext } from '@/components/calendar/calendar-context'
import { CalendarEvent as CalendarEventType } from '@/components/calendar/calendar-types'
import { cn } from '@/lib/utils'
import { format, isSameDay, isSameMonth } from 'date-fns'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'

interface EventPosition {
  left: string
  width: string
  top: string
  height: string
}

// Color scheme mapping - only for indicator bar, not background
const colorStyles: Record<string, string> = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  cyan: 'bg-cyan-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
}

function getColorStyle(color: string) {
  return colorStyles[color] || colorStyles.blue
}

function getOverlappingEvents(
  currentEvent: CalendarEventType,
  events: CalendarEventType[]
): CalendarEventType[] {
  return events.filter((event) => {
    if (event.id === currentEvent.id) return false
    return (
      currentEvent.start < event.end &&
      currentEvent.end > event.start &&
      isSameDay(currentEvent.start, event.start)
    )
  })
}

function calculateEventPosition(
  event: CalendarEventType,
  allEvents: CalendarEventType[]
): EventPosition {
  const overlappingEvents = getOverlappingEvents(event, allEvents)
  const group = [event, ...overlappingEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )
  const position = group.indexOf(event)
  const width = `${100 / (overlappingEvents.length + 1)}%`
  const left = `${(position * 100) / (overlappingEvents.length + 1)}%`

  const startHour = event.start.getHours()
  const startMinutes = event.start.getMinutes()

  let endHour = event.end.getHours()
  let endMinutes = event.end.getMinutes()

  if (!isSameDay(event.start, event.end)) {
    endHour = 23
    endMinutes = 59
  }

  const topPosition = startHour * 128 + (startMinutes / 60) * 128
  const duration = endHour * 60 + endMinutes - (startHour * 60 + startMinutes)
  const height = (duration / 60) * 128

  return {
    left,
    width,
    top: `${topPosition}px`,
    height: `${height}px`,
  }
}

export default function CalendarEvent({
  event,
  month = false,
  className,
  spanColumns = 1,
  isFirstDay: propIsFirstDay = true,
  isLastDay: propIsLastDay = true,
}: {
  event: CalendarEventType
  month?: boolean
  className?: string
  spanColumns?: number
  isFirstDay?: boolean
  isLastDay?: boolean
}) {
  const { events, setSelectedEvent, setManageEventDialogOpen, date } =
    useCalendarContext()
  const positionStyle = month ? {} : calculateEventPosition(event, events)

  // Generate a unique key that includes the current month to prevent animation conflicts
  const isEventInCurrentMonth = isSameMonth(event.start, date)
  const animationKey = `${event.id}-${isEventInCurrentMonth ? 'current' : 'adjacent'
    }`

  // Use provided props
  const isFirstDay = propIsFirstDay
  const isLastDay = propIsLastDay

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          className={cn(
            'flex items-start gap-1.5 cursor-pointer transition-all duration-300 rounded-md min-h-fit',
            'bg-background border border-border hover:border-foreground/50',
            !month && 'absolute z-10 p-2',
            month && 'p-1.5 overflow-visible',
            month && isFirstDay && spanColumns > 1 && 'rounded-l-md',
            month && isLastDay && spanColumns > 1 && 'rounded-r-md col-span-1',
            className
          )}
          style={{
            ...positionStyle,
            ...(month && spanColumns > 1 && isFirstDay && { gridColumn: `span ${spanColumns}` }),
            ...(month && isLastDay && spanColumns > 1 && { justifySelf: 'end' }),
          }}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedEvent(event)
            setManageEventDialogOpen(true)
          }}
          initial={{
            opacity: 0,
            y: -3,
            scale: 0.98,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            scale: 0.98,
            transition: {
              duration: 0.15,
              ease: 'easeOut',
            },
          }}
          transition={{
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1],
            opacity: {
              duration: 0.2,
              ease: 'linear',
            },
            layout: {
              duration: 0.2,
              ease: 'easeOut',
            },
          }}
          layoutId={`event-${animationKey}-${month ? 'month' : 'day'}`}
        >
          {/* Color indicator bar */}
          <div
            className={cn(
              'flex-shrink-0 w-1 rounded-full',
              month ? 'h-full min-h-6' : 'h-full'
            )}
            style={{
              backgroundColor: getColorStyle(event.color),
            }}
          />

          {/* Content */}
          <motion.div
            className="flex-1 min-w-0"
            layout="position"
          >
            {/* Always show title */}
            <p className="text-xs font-medium text-foreground truncate">
              {event.title}
            </p>
            {/* Only show time in day/week view, not month view */}
            {!month && (
              <p className="text-xs text-muted-foreground">
                <span>{format(event.start, 'h:mm a')}</span>
                <span className="mx-1">-</span>
                <span>
                  {format(event.end, 'h:mm a')}
                </span>
              </p>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}
