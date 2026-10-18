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

/** Suma makro z całego zakresu planu per osoba. */
export function sumRangeNutrition(
  daily: DayNutritionSummary[],
  people: PersonResponse[],
): PersonDayNutrition[] {
  return people.map((person) => {
    const totals = emptyTotals()
    for (const day of daily) {
      const row = day.people.find((item) => item.personId === person.id)
      if (row) {
        addTotals(totals, row.totals)
      }
    }
    return {
      personId: person.id,
      personName: person.name,
      totals,
    }
  })
}
