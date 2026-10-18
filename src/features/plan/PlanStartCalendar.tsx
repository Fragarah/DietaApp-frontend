import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { pl } from '../../i18n/pl'
import { fetchMealPlan } from './api'
import { addDaysIso, todayIsoDate } from './settings'

type PlanStartCalendarProps = {
  value: string
  onChange: (isoDate: string) => void
  /** Dni z aktualnie załadowanego zakresu — seed + odświeżenie po assign/delete. */
  knownPlannedDates?: ReadonlySet<string>
}

const WEEKDAYS = ['pon', 'wto', 'śro', 'czw', 'pią', 'sob', 'nie'] as const

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function monthBounds(y: number, m: number): { from: string; to: string } {
  const lastDay = new Date(y, m, 0).getDate()
  return { from: toIso(y, m, 1), to: toIso(y, m, lastDay) }
}

function formatDisplayDate(iso: string): string {
  const { y, m, d } = parseIso(iso)
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function monthTitle(y: number, m: number): string {
  return new Date(y, m - 1, 1).toLocaleDateString('pl-PL', {
    month: 'long',
    year: 'numeric',
  })
}

/** Poniedziałek = 0 … niedziela = 6 */
function mondayBasedWeekday(date: Date): number {
  return (date.getDay() + 6) % 7
}

type Cell = {
  iso: string
  day: number
  inMonth: boolean
}

function buildMonthCells(y: number, m: number): Cell[] {
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()
  const lead = mondayBasedWeekday(first)
  const cells: Cell[] = []

  for (let i = 0; i < lead; i += 1) {
    const date = new Date(y, m - 1, 1 - (lead - i))
    cells.push({
      iso: toIso(date.getFullYear(), date.getMonth() + 1, date.getDate()),
      day: date.getDate(),
      inMonth: false,
    })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: toIso(y, m, day), day, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!
    const next = addDaysIso(last.iso, 1)
    const parsed = parseIso(next)
    cells.push({ iso: next, day: parsed.d, inMonth: false })
  }
  return cells
}

export function PlanStartCalendar({
  value,
  onChange,
  knownPlannedDates,
}: PlanStartCalendarProps) {
  const initial = parseIso(value || todayIsoDate())
  const [open, setOpen] = useState(false)
  const [viewY, setViewY] = useState(initial.y)
  const [viewM, setViewM] = useState(initial.m)
  const [plannedDates, setPlannedDates] = useState<Set<string>>(() => new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  const cells = useMemo(() => buildMonthCells(viewY, viewM), [viewY, viewM])
  const today = todayIsoDate()

  useEffect(() => {
    if (!open) {
      return
    }
    const parsed = parseIso(value || todayIsoDate())
    setViewY(parsed.y)
    setViewM(parsed.m)
  }, [open, value])

  useEffect(() => {
    if (!knownPlannedDates || knownPlannedDates.size === 0) {
      return
    }
    setPlannedDates((current) => {
      const next = new Set(current)
      for (const date of knownPlannedDates) {
        next.add(date)
      }
      return next
    })
  }, [knownPlannedDates])

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    const { from, to } = monthBounds(viewY, viewM)
    void fetchMealPlan(from, to)
      .then((entries) => {
        if (cancelled) {
          return
        }
        setPlannedDates((current) => {
          const next = new Set(current)
          for (const entry of entries) {
            next.add(entry.planDate)
          }
          return next
        })
      })
      .catch(() => {
        // kalendarz działa bez podświetleń, jeśli API padnie
      })
    return () => {
      cancelled = true
    }
  }, [open, viewY, viewM])

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (rootRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function shiftMonth(delta: number) {
    const date = new Date(viewY, viewM - 1 + delta, 1)
    setViewY(date.getFullYear())
    setViewM(date.getMonth() + 1)
  }

  function selectDay(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="plan-start-cal" ref={rootRef}>
      <button
        type="button"
        className="plan-range__calendar"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <svg
          className="plan-range__icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M3 10h18M8 3v4M16 3v4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
        <span>{formatDisplayDate(value || today)}</span>
      </button>

      {open ? (
        <div
          className="plan-start-cal__popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="plan-start-cal__header">
            <span id={titleId} className="plan-start-cal__month">
              {monthTitle(viewY, viewM)}
            </span>
            <div className="plan-start-cal__nav">
              <button
                type="button"
                className="plan-start-cal__nav-btn"
                aria-label={pl.portions.plan.calendarPrevMonth}
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="plan-start-cal__nav-btn"
                aria-label={pl.portions.plan.calendarNextMonth}
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
          </div>

          <div className="plan-start-cal__weekdays" aria-hidden="true">
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="plan-start-cal__grid">
            {cells.map((cell) => {
              const planned = plannedDates.has(cell.iso)
              const selected = cell.iso === value
              const isToday = cell.iso === today
              return (
                <button
                  key={cell.iso}
                  type="button"
                  className={[
                    'plan-start-cal__day',
                    cell.inMonth ? '' : 'plan-start-cal__day--outside',
                    planned ? 'plan-start-cal__day--planned' : '',
                    selected ? 'plan-start-cal__day--selected' : '',
                    isToday ? 'plan-start-cal__day--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => selectDay(cell.iso)}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          <div className="plan-start-cal__footer">
            <button
              type="button"
              className="plan-start-cal__link"
              onClick={() => selectDay(today)}
            >
              {pl.portions.plan.calendarToday}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
