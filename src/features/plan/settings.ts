const PLAN_LENGTH_KEY = 'dieta.planLengthDays'
const PLAN_START_KEY = 'dieta.planStartDate'
const DEFAULT_PLAN_LENGTH = 6

export function getPlanLengthDays(): number {
  const raw = localStorage.getItem(PLAN_LENGTH_KEY)
  const parsed = raw != null ? Number(raw) : DEFAULT_PLAN_LENGTH
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
    return DEFAULT_PLAN_LENGTH
  }
  return parsed
}

export function setPlanLengthDays(days: number): void {
  if (!Number.isInteger(days) || days < 1 || days > 31) {
    return
  }
  localStorage.setItem(PLAN_LENGTH_KEY, String(days))
}

export function getStoredPlanStartDate(): string | null {
  return localStorage.getItem(PLAN_START_KEY)
}

export function setStoredPlanStartDate(isoDate: string): void {
  localStorage.setItem(PLAN_START_KEY, isoDate)
}

export function todayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function eachDayIso(startIso: string, length: number): string[] {
  return Array.from({ length }, (_, index) => addDaysIso(startIso, index))
}

export function formatPlanDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = date
    .toLocaleDateString('pl-PL', { weekday: 'short' })
    .replace('.', '')
    .toLocaleUpperCase('pl-PL')
  const dayMonth = date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
  return `${weekday} ${dayMonth}`
}

export function formatPlanRangeLabel(startIso: string, length: number): string {
  const endIso = addDaysIso(startIso, length - 1)
  const start = formatShortDate(startIso)
  const end = formatShortDate(endIso)
  return `${start} – ${end} (${length} dni)`
}

function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
  })
}
