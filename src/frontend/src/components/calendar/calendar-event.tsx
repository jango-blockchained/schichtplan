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

// Color scheme mapping for dynamic styling
const colorStyles: Record<string, { bg: string; border: string; text: string }> = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500',
    text: 'text-red-700 dark:text-red-400',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500',
    text: 'text-green-700 dark:text-green-400',
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500',
    text: 'text-purple-700 dark:text-purple-400',
  },
  pink: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500',
    text: 'text-pink-700 dark:text-pink-400',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500',
    text: 'text-indigo-700 dark:text-indigo-400',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500',
    text: 'text-cyan-700 dark:text-cyan-400',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500',
    text: 'text-orange-700 dark:text-orange-400',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
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
  currentDay,
}: {
  event: CalendarEventType
  month?: boolean
  className?: string
  currentDay?: Date
}) {
  const { events, setSelectedEvent, setManageEventDialogOpen, date } =
    useCalendarContext()
  const positionStyle = month ? {} : calculateEventPosition(event, events)
  const colorStyle = getColorStyle(event.color)

  // Generate a unique key that includes the current month to prevent animation conflicts
  const isEventInCurrentMonth = isSameMonth(event.start, date)
  const animationKey = `${event.id}-${isEventInCurrentMonth ? 'current' : 'adjacent'
    }`

  // Determine if this is the first or last day of a multi-day vacation
  const isFirstDay = !currentDay || isSameDay(event.start, currentDay)
  const isLastDay = !currentDay || isSameDay(event.end, currentDay)
  const isMultiDay = !isSameDay(event.start, event.end)

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          className={cn(
            'px-3 py-1.5 cursor-pointer transition-all duration-300 border rounded-md',
            colorStyle.bg,
            colorStyle.border,
            'hover:opacity-75',
            !month && 'absolute z-10',
            month && 'truncate',
            month && isMultiDay && [
              isFirstDay ? 'rounded-l-md' : 'rounded-none',
              isLastDay ? 'rounded-r-md' : 'rounded-none',
            ],
            month && !isMultiDay && 'rounded-md',
            className
          )}
          style={positionStyle}
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
          <motion.div
            className={cn(
              'flex flex-col w-full',
              colorStyle.text,
              month && 'flex-row items-center justify-between'
            )}
            layout="position"
          >
            {/* Show title only on first day for multi-day events in month view */}
            {month && isMultiDay ? (
              isFirstDay ? (
                <p className={cn('font-semibold truncate text-xs sm:text-sm')}>
                  {event.title}
                </p>
              ) : (
                <div className="w-full" aria-hidden="true" role="presentation" />
              )
            ) : (
              <p className={cn('font-semibold text-xs sm:text-sm')}>
                {event.title}
              </p>
            )}
            {/* Only show time in day/week view, not month view */}
            {!month && (
              <p className={cn('text-sm')}>
                <span>{format(event.start, 'h:mm a')}</span>
                <span className={cn('mx-1')}>-</span>
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
