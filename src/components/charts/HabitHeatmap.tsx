import { useMemo } from 'react'
import { format, eachDayOfInterval, subDays } from 'date-fns'
import type { HabitLog } from '@/types'

interface Props {
  logs: HabitLog[]
  color?: string
  days?: number
}

export default function HabitHeatmap({ logs, color = '#84cc16', days = 91 }: Props) {
  const cells = useMemo(() => {
    const end = new Date()
    const start = subDays(end, days - 1)
    const logSet = new Set(logs.map((l) => l.completed_at.slice(0, 10)))
    return eachDayOfInterval({ start, end }).map((d) => {
      const str = format(d, 'yyyy-MM-dd')
      return { date: str, done: logSet.has(str), day: d.getDay() }
    })
  }, [logs, days])

  // Group into weeks
  const weeks: typeof cells[] = []
  let week: typeof cells = []
  // Pad first week
  const firstDay = cells[0]?.day ?? 0
  for (let i = 0; i < firstDay; i++) week.push({ date: '', done: false, day: i })
  for (const cell of cells) {
    week.push(cell)
    if (cell.day === 6) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) weeks.push(week)

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px] min-w-fit">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {w.map((cell, ci) => (
              <div
                key={ci}
                title={cell.date ? `${cell.date}: ${cell.done ? '✓' : '✗'}` : ''}
                className="w-[11px] h-[11px] rounded-[2px] transition-all"
                style={{
                  backgroundColor: !cell.date
                    ? 'transparent'
                    : cell.done
                    ? color
                    : '#1a1a24',
                  boxShadow: cell.done ? `0 0 4px ${color}60` : undefined,
                  border: cell.date && !cell.done ? '1px solid #2a2a3a' : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
