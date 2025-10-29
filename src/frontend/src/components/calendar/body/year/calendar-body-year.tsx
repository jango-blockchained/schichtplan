import { cn } from '@/lib/utils'
import {
    eachDayOfInterval,
    eachMonthOfInterval,
    endOfMonth,
    endOfWeek,
    endOfYear,
    format,
    isSameDay,
    isWithinInterval,
    startOfMonth,
    startOfWeek,
    startOfYear,
} from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { useCalendarContext } from '../../calendar-context'

export default function CalendarBodyYear() {
    const { date, events, setDate, setMode } = useCalendarContext()

    const today = new Date()
    const year = date.getFullYear()

    // Get all months in the year
    const yearStart = startOfYear(date)
    const yearEnd = endOfYear(date)
    const months = eachMonthOfInterval({
        start: yearStart,
        end: yearEnd,
    })

    // Filter events to only show those within the current year
    const visibleEvents = events.filter(
        (event) =>
            isWithinInterval(event.start, {
                start: yearStart,
                end: yearEnd,
            }) ||
            isWithinInterval(event.end, { start: yearStart, end: yearEnd })
    )

    return (
        <div className="flex flex-col flex-grow overflow-hidden p-4">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={year}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow overflow-y-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        duration: 0.2,
                        ease: 'easeInOut',
                    }}
                >
                    {months.map((month) => {
                        const monthStart = startOfMonth(month)
                        const monthEnd = endOfMonth(month)

                        // Get calendar grid for month
                        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
                        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

                        const calendarDays = eachDayOfInterval({
                            start: calendarStart,
                            end: calendarEnd,
                        })

                        // Filter events for this month
                        const monthEvents = visibleEvents.filter(
                            (event) =>
                                isWithinInterval(event.start, {
                                    start: calendarStart,
                                    end: calendarEnd,
                                }) ||
                                isWithinInterval(event.end, {
                                    start: calendarStart,
                                    end: calendarEnd,
                                })
                        )

                        return (
                            <motion.div
                                key={monthStart.toISOString()}
                                className="border rounded-lg bg-card overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* Month Header */}
                                <div className="p-3 border-b bg-muted/50">
                                    <h3 className="font-semibold text-sm">
                                        {format(month, 'MMMM')}
                                    </h3>
                                </div>

                                {/* Week Day Headers */}
                                <div className="hidden sm:grid grid-cols-7 border-b divide-x divide-border">
                                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                                        <div
                                            key={day}
                                            className="py-1 text-center text-xs font-medium text-muted-foreground"
                                        >
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar Days Grid */}
                                <div className="grid grid-cols-7 flex-grow">
                                    {calendarDays.map((day) => {
                                        const dayEvents = monthEvents.filter((event) =>
                                            isWithinInterval(day, {
                                                start: event.start,
                                                end: event.end,
                                            })
                                        )
                                        const isToday = isSameDay(day, today)
                                        const isOtherMonth = day.getMonth() !== month.getMonth()

                                        return (
                                            <div
                                                key={day.toISOString()}
                                                className={cn(
                                                    'relative aspect-square border-b border-r p-1 text-xs cursor-pointer hover:bg-muted/50 transition-colors',
                                                    isOtherMonth && 'bg-muted/30',
                                                    isToday && 'bg-primary/10'
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setDate(day)
                                                    setMode('day')
                                                }}
                                            >
                                                {/* Day Number */}
                                                <div
                                                    className={cn(
                                                        'w-4 h-4 flex items-center justify-center rounded-full text-xs font-medium',
                                                        isToday && 'bg-primary text-primary-foreground'
                                                    )}
                                                >
                                                    {format(day, 'd')}
                                                </div>

                                                {/* Event Indicator Dots */}
                                                {dayEvents.length > 0 && (
                                                    <div className="absolute bottom-0.5 left-0.5 right-0.5 flex justify-center gap-0.5 flex-wrap">
                                                        {dayEvents.slice(0, 2).map((event, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="w-1 h-1 rounded-full"
                                                                style={{ backgroundColor: event.color }}
                                                            />
                                                        ))}
                                                        {dayEvents.length > 2 && (
                                                            <div className="text-[8px] text-muted-foreground leading-none">
                                                                +{dayEvents.length - 2}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
