import { addDays, startOfWeek } from 'date-fns'
import { useCalendarContext } from '../../calendar-context'
import CalendarBodyWeekDayContent from './calendar-body-week-day-content'

export default function CalendarBodyWeek() {
  const { date } = useCalendarContext()

  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="flex divide-x flex-grow overflow-hidden">
      <div className="flex flex-col flex-grow divide-y overflow-hidden">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="relative flex flex-1 divide-x flex-col md:flex-row">
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className="flex flex-1 divide-x md:divide-x-0"
              >
                <CalendarBodyWeekDayContent date={day} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
