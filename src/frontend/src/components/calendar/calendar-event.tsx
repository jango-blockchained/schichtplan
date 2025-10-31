import { useCalendarContext } from '@/components/calendar/calendar-context'
import { CalendarEvent as CalendarEventType } from '@/components/calendar/calendar-types'
import { cn } from '@/lib/utils'
import { format, isSameDay, isSameMonth } from 'date-fns'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Edit2, Trash2 } from 'lucide-react'
import { useState } from 'react'

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
  isFirstDay = true,
  isLastDay = true,
}: {
  event: CalendarEventType
  month?: boolean
  className?: string
  isFirstDay?: boolean
  isLastDay?: boolean
}) {
  const { events, setSelectedEvent, setManageEventDialogOpen, date, setEvents } =
    useCalendarContext()
  const [showActions, setShowActions] = useState(false)
  const positionStyle = month ? {} : calculateEventPosition(event, events)

  // Generate a unique key that includes the current month to prevent animation conflicts
  const isEventInCurrentMonth = isSameMonth(event.start, date)
  const animationKey = `${event.id}-${isEventInCurrentMonth ? 'current' : 'adjacent'
    }`

  // Calculate duration for month view
  const duration = event.end.getHours() * 60 + event.end.getMinutes() -
    (event.start.getHours() * 60 + event.start.getMinutes())
  const durationHours = Math.floor(duration / 60)
  const durationMinutes = duration % 60

  // Format duration string
  const durationStr = durationHours > 0
    ? `${durationHours}h${durationMinutes > 0 ? ` ${durationMinutes}m` : ''}`
    : `${durationMinutes}m`

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEvents(events.filter(ev => ev.id !== event.id))
  }

  // For multi-day events, only show time on first and last day
  const showTimeInfo = !month || isFirstDay || isLastDay

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          className={cn(
            'flex items-center gap-1.5 cursor-pointer transition-all duration-300 rounded-md min-h-fit group',
            'bg-background border border-border hover:border-foreground/50 hover:shadow-md',
            !month && 'absolute z-10 p-2',
            month && 'p-1 overflow-visible w-full text-xs',
            month && isFirstDay && 'rounded-l-md',
            month && isLastDay && 'rounded-r-md',
            className
          )}
          style={{
            ...positionStyle,
          }}
          onMouseEnter={() => month && setShowActions(true)}
          onMouseLeave={() => month && setShowActions(false)}
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
          {/* Color indicator bar - rounded on first/last day, full height */}
          <div
            className={cn(
              'flex-shrink-0 w-1 rounded-full',
              month ? 'h-full min-h-6' : 'h-full'
            )}
            style={{
              backgroundColor: getColorStyle(event.color),
            }}
          />

          {/* Content Container */}
          <motion.div
            className="flex-1 min-w-0 flex items-center gap-1"
            layout="position"
          >
            {/* Title - always show and highlight */}
            <p className="text-xs font-semibold text-foreground truncate leading-tight">
              {event.title}
            </p>

            {month ? (
              <>
                {/* Time info for month view - compact single line */}
                {showTimeInfo && (
                  <>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                    </span>

                    {/* Duration badge for month view */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ({durationStr})
                    </span>
                  </>
                )}
              </>
            ) : (
              /* Time display for day/week view */
              <p className="text-xs text-muted-foreground">
                <span>{format(event.start, 'h:mm a')}</span>
                <span className="mx-1">-</span>
                <span>
                  {format(event.end, 'h:mm a')}
                </span>
              </p>
            )}
          </motion.div>

          {/* Action buttons - only visible on hover in month view */}
          {month && (
            <AnimatePresence>
              {showActions && (
                <motion.div
                  className="flex items-center gap-1 flex-shrink-0 ml-auto"
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedEvent(event)
                      setManageEventDialogOpen(true)
                    }}
                    className="p-1 hover:bg-muted rounded-sm transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-1 hover:bg-destructive/10 rounded-sm transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}
