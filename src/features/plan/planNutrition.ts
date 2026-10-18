import type { MealResponse } from '../meals/types'
import type { PersonResponse } from '../people/types'
import {
  buildPersonColumn,
  computePortionsForPeople,
  type ProductLookup,
} from '../portions/portionMath'
import { peopleForPlanEntry, type MealPlanEntry } from './types'

export type MacroTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type PersonDayNutrition = {
  personId: number
  personName: string
  totals: MacroTotals
}

export type DayNutritionSummary = {
  planDate: string
  people: PersonDayNutrition[]
}

const EMPTY: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }

function emptyTotals(): MacroTotals {
  return { ...EMPTY }
}

function addTotals(target: MacroTotals, source: MacroTotals): void {
  target.calories += source.calories
  target.protein += source.protein
  target.carbs += source.carbs
  target.fat += source.fat
}

function entryMacrosForPeople(
  entry: MealPlanEntry,
  meal: MealResponse | null,
  people: PersonResponse[],
  productById: ProductLookup,
): Map<number, MacroTotals> {
  const result = new Map<number, MacroTotals>()
  if (!meal || people.length === 0) {
    return result
  }
  const entryPeople = peopleForPlanEntry(entry, people)
  if (entryPeople.length === 0) {
    return result
  }
  const selectedPeopleDailyTotal = entryPeople.reduce(
    (sum, person) => sum + Number(person.dailyKcalLimit),
    0,
  )
  const personColumns = entryPeople.map((person) =>
    buildPersonColumn(person, meal.mealCategory ?? entry.mealCategory),
  )
  const portions = computePortionsForPeople(
    meal,
    personColumns,
    selectedPeopleDailyTotal,
    productById,
  )
  for (const person of personColumns) {
    const portion = portions.get(person.personId)
    if (!portion) {
      continue
    }
    result.set(person.personId, { ...portion.totals })
  }
  return result
}

/** Suma makro z planu: per dzień × osoba (tylko zaznaczone osoby). */
export function buildDailyNutritionSummaries(params: {
  days: string[]
  entries: MealPlanEntry[]
  mealsById: Map<number, MealResponse>
  people: PersonResponse[]
  productById: ProductLookup
}): DayNutritionSummary[] {
  const { days, entries, mealsById, people, productById } = params
  if (people.length === 0) {
    return days.map((planDate) => ({ planDate, people: [] }))
  }

  const byDayPerson = new Map<string, MacroTotals>()

  for (const entry of entries) {
    const meal = mealsById.get(entry.mealId) ?? null
    const macros = entryMacrosForPeople(entry, meal, people, productById)
    for (const [personId, totals] of macros) {
      const key = `${entry.planDate}|${personId}`
      const current = byDayPerson.get(key) ?? emptyTotals()
      addTotals(current, totals)
      byDayPerson.set(key, current)
    }
  }

  return days.map((planDate) => ({
    planDate,
    people: people.map((person) => ({
      personId: person.id,
      personName: person.name,
      totals: byDayPerson.get(`${planDate}|${person.id}`) ?? emptyTotals(),
    })),
  }))
}

const KCAL_PER_G = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const

/** Udział kcal składnika w dziennych kcal (1 g B/W = 4, 1 g T = 9). */
export function macroKcalPercent(
  grams: number,
  kind: keyof typeof KCAL_PER_G,
  dayCalories: number,
): number | null {
  if (!(dayCalories > 0)) {
    return null
  }
  return (grams * KCAL_PER_G[kind]) / dayCalories * 100
}

/** Średnie makro z zakresu planu per osoba (suma / liczba dni). */
export function averageRangeNutrition(
  daily: DayNutritionSummary[],
  people: PersonResponse[],
): PersonDayNutrition[] {
  const dayCount = daily.length
  return people.map((person) => {
    const totals = emptyTotals()
    for (const day of daily) {
      const row = day.people.find((item) => item.personId === person.id)
      if (row) {
        addTotals(totals, row.totals)
      }
    }
    if (dayCount > 0) {
      totals.calories /= dayCount
      totals.protein /= dayCount
      totals.carbs /= dayCount
      totals.fat /= dayCount
    }
    return {
      personId: person.id,
      personName: person.name,
      totals,
    }
  })
}
