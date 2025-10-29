import { Button } from '@/components/ui/button'
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendarContext } from '../../calendar-context'

export default function CalendarHeaderDateChevrons() {
  const { mode, date, setDate } = useCalendarContext()

  function handleDateBackward() {
    switch (mode) {
      case 'month':
        setDate(subMonths(date, 1))
        break
      case 'week':
        setDate(subWeeks(date, 1))
        break
      case 'day':
        setDate(subDays(date, 1))
        break
      case 'year':
        setDate(subYears(date, 1))
        break
    }
  }

  function handleDateForward() {
    switch (mode) {
      case 'month':
        setDate(addMonths(date, 1))
        break
      case 'week':
        setDate(addWeeks(date, 1))
        break
      case 'day':
        setDate(addDays(date, 1))
        break
      case 'year':
        setDate(addYears(date, 1))
        break
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="h-7 w-7 p-1"
        onClick={handleDateBackward}
      >
        <ChevronLeft className="min-w-5 min-h-5" />
      </Button>

      <span className="min-w-[140px] text-center font-medium">
        {mode === 'year' ? format(date, 'yyyy') : format(date, 'MMMM d, yyyy')}
      </span>

      <Button
        variant="outline"
        className="h-7 w-7 p-1"
        onClick={handleDateForward}
      >
        <ChevronRight className="min-w-5 min-h-5" />
      </Button>
    </div>
  )
}
