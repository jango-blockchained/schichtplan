import { useCalendarContext } from '@/components/calendar/calendar-context'
import { CalendarEvent as CalendarEventType } from '@/components/calendar/calendar-types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { addDays, differenceInDays, format, isSameDay, isSameMonth } from 'date-fns'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Check, Clock, Edit2, GripVertical, Trash2, X as XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface EventPosition {
    left: string
    width: string
    top: string
    height: string
}

interface CalendarEventEnhancedProps {
    event: CalendarEventType
    month?: boolean
    week?: boolean
    day?: boolean
    year?: boolean
    className?: string
    isFirstDay?: boolean
    isLastDay?: boolean
    onUpdate?: (eventId: string, updates: { start: Date; end: Date }) => void
    onDelete?: (eventId: string) => void
    status?: 'approved' | 'requested' | 'declined'
}

// Color scheme mapping - for left indicator bar only
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

// Status icon and badge styling
const statusConfig = {
    approved: {
        icon: Check,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        label: 'Approved',
    },
    requested: {
        icon: Clock,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        label: 'Pending',
    },
    declined: {
        icon: XIcon,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        label: 'Declined',
    },
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

Yearly.()

export default function CalendarEventEnhanced({
    event,
    month = false,
    week = false,
    day = false,
    year = false,
    className,
    isFirstDay = true,
    isLastDay = true,
    onUpdate,
    onDelete,
    status = 'requested',
}: CalendarEventEnhancedProps) {
    const { events, setSelectedEvent, setManageEventDialogOpen, date, setEvents } =
        useCalendarContext()
    const [showActions, setShowActions] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null)
    const eventRef = useRef<HTMLDivElement>(null)
    const positionStyle = month || week ? {} : calculateEventPosition(event, events)

    // Generate unique animation key
    const isEventInCurrentMonth = isSameMonth(event.start, date)
    const animationKey = `${event.id}-${isEventInCurrentMonth ? 'current' : 'adjacent'}`

    // Calculate duration
    const durationDays = differenceInDays(event.end, event.start) + 1
    const durationHours = Math.floor(
        (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60)
    )
    const durationMinutes = Math.floor(
        ((event.end.getTime() - event.start.getTime()) / (1000 * 60)) % 60
    )

    // Format duration string
    const durationStr =
        durationDays > 1
            ? `${durationDays}d`
            : durationHours > 0
                ? `${durationHours}h${durationMinutes > 0 ? ` ${durationMinutes}m` : ''}`
                : `${durationMinutes}m`

    const StatusIcon = statusConfig[status].icon

    // Drag handlers
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (!month && !year) return // Only enable drag in month and year view
            if (isResizing) return

            e.stopPropagation()
            setIsDragging(true)
        },
        [month, year, isResizing]
    )

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging || !eventRef.current) return

            // Calculate how many days to shift based on mouse movement
            const parentElement = eventRef.current.parentElement
            if (!parentElement) return

            const parentRect = parentElement.getBoundingClientRect()
            const dayWidth = parentRect.width / 7 // Assuming 7 days per week
            const mouseX = e.clientX - parentRect.left
            const newDayIndex = Math.floor(mouseX / dayWidth)

            // Calculate day offset from original position
            const originalDayIndex = Math.floor((eventRef.current.getBoundingClientRect().left - parentRect.left) / dayWidth)
            const daysDiff = newDayIndex - originalDayIndex

            if (daysDiff !== 0) {
                // Update event dates
                const newStart = addDays(event.start, daysDiff)
                const newEnd = addDays(event.end, daysDiff)

                if (onUpdate) {
                    onUpdate(event.id, { start: newStart, end: newEnd })
                }
            }
        },
        [isDragging, event, onUpdate]
    )

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        setIsResizing(null)
    }, [])

    useEffect(() => {
        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

    // Resize handlers
    const handleResizeStart = useCallback(
        (e: React.MouseEvent, side: 'left' | 'right') => {
            if (!month && !year) return
            e.stopPropagation()
            setIsResizing(side)
        },
        [month, year]
    )

    const handleResizeMove = useCallback(
        (e: MouseEvent) => {
            if (!isResizing || !eventRef.current) return

            const parentElement = eventRef.current.parentElement
            if (!parentElement) return

            const parentRect = parentElement.getBoundingClientRect()
            const dayWidth = parentRect.width / 7
            const mouseX = e.clientX - parentRect.left
            const dayIndex = Math.floor(mouseX / dayWidth)

            if (isResizing === 'left') {
                // Resize start date
                const currentStartIndex = Math.floor(
                    (event.start.getTime() - parentRect.left) / dayWidth
                )
                const daysDiff = dayIndex - currentStartIndex

                if (daysDiff !== 0) {
                    const newStart = addDays(event.start, daysDiff)
                    if (newStart < event.end && onUpdate) {
                        onUpdate(event.id, { start: newStart, end: event.end })
                    }
                }
            } else if (isResizing === 'right') {
                // Resize end date
                const currentEndIndex = Math.floor(
                    (event.end.getTime() - parentRect.left) / dayWidth
                )
                const daysDiff = dayIndex - currentEndIndex

                if (daysDiff !== 0) {
                    const newEnd = addDays(event.end, daysDiff)
                    if (newEnd > event.start && onUpdate) {
                        onUpdate(event.id, { start: event.start, end: newEnd })
                    }
                }
            }
        },
        [isResizing, event, onUpdate]
    )

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove)
            document.addEventListener('mouseup', handleMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleResizeMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isResizing, handleResizeMove, handleMouseUp])

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (onDelete) {
            onDelete(event.id)
        } else {
            setEvents(events.filter((ev) => ev.id !== event.id))
        }
    }

    const handleClick = (e: React.MouseEvent) => {
        if (isDragging || isResizing) return
        e.stopPropagation()
        setSelectedEvent(event)
        setManageEventDialogOpen(true)
    }

    // Show time info for first and last day in multi-day events
    const showTimeInfo = !month || isFirstDay || isLastDay

    return (
        <MotionConfig reducedMotion="user">
            <AnimatePresence mode="wait">
                <motion.div
                    ref={eventRef}
                    className={cn(
                        'flex items-center gap-2 transition-all duration-200 rounded-md group relative',
                        'bg-muted/30 border border-border hover:border-foreground/30 hover:shadow-sm',
                        isDragging && 'opacity-60 shadow-lg cursor-grabbing',
                        !isDragging && (month || year) && 'cursor-grab',
                        !month && !day && !week && !year && 'absolute z-10 p-2',
                        month && 'p-1.5 overflow-visible w-full text-xs min-h-[28px]',
                        week && 'p-2 text-sm',
                        year && 'p-1 text-xs',
                        month && isFirstDay && 'rounded-l-md',
                        month && isLastDay && 'rounded-r-md',
                        className
                    )}
                    style={{
                        ...positionStyle,
                    }}
                    onMouseEnter={() => setShowActions(true)}
                    onMouseLeave={() => setShowActions(false)}
                    onMouseDown={handleMouseDown}
                    onClick={handleClick}
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
                    layoutId={`event-${animationKey}-${month ? 'month' : week ? 'week' : day ? 'day' : 'year'}`}
                >
                    {/* Resize handle - left */}
                    {(month || year) && isFirstDay && showActions && (
                        <motion.div
                            className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/20 hover:bg-primary/40 cursor-ew-resize z-20 rounded-l-md"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onMouseDown={(e) => handleResizeStart(e, 'left')}
                        />
                    )}

                    {/* Drag handle icon - only in month/year view */}
                    {(month || year) && showActions && (
                        <motion.div
                            className="flex-shrink-0 text-muted-foreground/50"
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -4 }}
                        >
                            <GripVertical className="w-3 h-3" />
                        </motion.div>
                    )}

                    {/* Color indicator bar - rounded, full height */}
                    <div
                        className={cn(
                            'flex-shrink-0 w-1 rounded-full',
                            month || year ? 'h-full min-h-5' : 'h-full',
                            getColorStyle(event.color)
                        )}
                    />

                    {/* Content Container */}
                    <motion.div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden" layout="position">
                        {/* Title - always show and highlight */}
                        <p className="text-xs font-semibold text-foreground truncate leading-tight">
                            {event.title}
                        </p>

                        {month || year ? (
                            <>
                                {/* Time info for month/year view - compact */}
                                {showTimeInfo && !year && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                        {format(event.start, 'HH:mm')}
                                    </span>
                                )}
                            </>
                        ) : (
                            /* Time display for day/week view */
                            <p className="text-xs text-muted-foreground flex-shrink-0">
                                <span>{format(event.start, 'h:mm a')}</span>
                                <span className="mx-1">-</span>
                                <span>{format(event.end, 'h:mm a')}</span>
                            </p>
                        )}
                    </motion.div>

                    {/* Status indicator and duration badge */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Duration badge */}
                        {(month || week) && (
                            <Badge
                                variant="secondary"
                                className="text-xs px-1.5 py-0 h-4 bg-background/50 text-muted-foreground"
                            >
                                {durationStr}
                            </Badge>
                        )}

                        {/* Status icon */}
                        <div
                            className={cn(
                                'rounded-full p-0.5 flex items-center justify-center',
                                statusConfig[status].bgColor
                            )}
                            title={statusConfig[status].label}
                        >
                            <StatusIcon className={cn('w-3 h-3', statusConfig[status].color)} />
                        </div>
                    </div>

                    {/* Action buttons - only visible on hover */}
                    {(month || year) && (
                        <AnimatePresence>
                            {showActions && (
                                <motion.div
                                    className="flex items-center gap-1 flex-shrink-0 ml-1"
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

                    {/* Resize handle - right */}
                    {(month || year) && isLastDay && showActions && (
                        <motion.div
                            className="absolute right-0 top-0 bottom-0 w-1.5 bg-primary/20 hover:bg-primary/40 cursor-ew-resize z-20 rounded-r-md"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onMouseDown={(e) => handleResizeStart(e, 'right')}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </MotionConfig>
    )
}
