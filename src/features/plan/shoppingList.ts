import type { PersonResponse } from '../people/types'
import {
  buildPersonColumn,
  computePortionsForPeople,
  type ProductLookup,
} from '../portions/portionMath'
import {
  getDefaultPortion,
  isCountableUnit,
  type ProductResponse,
} from '../products/types'
import type { MealResponse } from '../meals/types'
import { peopleForPlanEntry, type MealPlanEntry } from './types'

export type ShoppingListItem = {
  productId: number
  productName: string
  categoryName: string
  grams: number
  pieces: number | null
  pieceUnit: string | null
}

/** Kolejność kategorii na liście zakupów (UI + PDF). */
const SHOPPING_CATEGORY_ORDER = [
  'owoce',
  'warzywa',
  'inne',
  'mięso',
  'nabiał',
  'zboż',
] as const

export function compareShoppingCategories(a: string, b: string): number {
  const rankA = shoppingCategoryRank(a)
  const rankB = shoppingCategoryRank(b)
  if (rankA !== rankB) {
    return rankA - rankB
  }
  return a.localeCompare(b, 'pl')
}

function shoppingCategoryRank(name: string): number {
  const normalized = name.trim().toLocaleLowerCase('pl-PL')
  const index = SHOPPING_CATEGORY_ORDER.findIndex((prefix) =>
    normalized.startsWith(prefix) || normalized.includes(prefix),
  )
  return index === -1 ? SHOPPING_CATEGORY_ORDER.length : index
}

/**
 * Suma składników z planu w zakresie.
 * Wspólny wpis (personId null) → porcje wszystkich zaznaczonych osób.
 * Wpis per osoba → tylko ta osoba (jeśli jest w zaznaczeniu).
 * Posiłek na wielu dniach jest doliczany wielokrotnie (raz na dzień w planie).
 */
export function buildShoppingList(params: {
  entries: MealPlanEntry[]
  mealsById: Map<number, MealResponse>
  people: PersonResponse[]
  productById: ProductLookup
}): ShoppingListItem[] {
  const { entries, mealsById, people, productById } = params
  if (entries.length === 0 || people.length === 0) {
    return []
  }

  const byProduct = new Map<
    number,
    {
      productName: string
      categoryName: string
      grams: number
      pieces: number | null
      pieceUnit: string | null
    }
  >()

  function addLine(params: {
    productId: number
    productName: string
    quantityGrams: number
    quantityBase: number
    baseUnit: string
  }) {
    const product = productById.get(params.productId)
    const { pieces, pieceUnit } = resolvePieces(params, product)
    const current = byProduct.get(params.productId)
    if (current) {
      current.grams += params.quantityGrams
      if (current.pieces != null && pieces != null) {
        current.pieces += pieces
      }
      return
    }
    byProduct.set(params.productId, {
      productName: params.productName,
      categoryName: product?.categoryName ?? '',
      grams: params.quantityGrams,
      pieces,
      pieceUnit,
    })
  }

  for (const entry of entries) {
    const meal = mealsById.get(entry.mealId)
    if (!meal) {
      continue
    }
    const entryPeople = peopleForPlanEntry(entry, people)
    if (entryPeople.length === 0) {
      continue
    }
    const selectedPeopleDailyTotal = entryPeople.reduce(
      (sum, person) => sum + Number(person.dailyKcalLimit),
      0,
    )
    const personColumns = entryPeople.map((person) =>
      buildPersonColumn(person, meal.mealCategory),
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
      for (const line of portion.lines) {
        addLine({
          productId: line.productId,
          productName: line.productName,
          quantityGrams: line.quantityGrams,
          quantityBase: line.quantityBase,
          baseUnit: line.baseUnit,
        })
      }
    }
  }

  return [...byProduct.entries()]
    .map(([productId, item]) => ({
      productId,
      productName: item.productName,
      categoryName: item.categoryName,
      grams: item.grams,
      pieces: item.pieces,
      pieceUnit: item.pieceUnit,
    }))
    .sort((a, b) => {
      const byCategory = compareShoppingCategories(a.categoryName, b.categoryName)
      if (byCategory !== 0) {
        return byCategory
      }
      return a.productName.localeCompare(b.productName, 'pl')
    })
}

function resolvePieces(
  params: {
    quantityGrams: number
    quantityBase: number
    baseUnit: string
  },
  product: ProductResponse | undefined,
): { pieces: number | null; pieceUnit: string | null } {
  const defaultPortion = product ? getDefaultPortion(product) : null
  const countable =
    isCountableUnit(params.baseUnit) ||
    Boolean(
      defaultPortion &&
        isCountableUnit(defaultPortion.unitName) &&
        defaultPortion.gramWeight > 0,
    )
  if (!countable) {
    return { pieces: null, pieceUnit: null }
  }
  const pieceUnit = isCountableUnit(params.baseUnit)
    ? params.baseUnit
    : (defaultPortion?.unitName ?? null)
  const pieces = isCountableUnit(params.baseUnit)
    ? params.quantityBase
    : defaultPortion && defaultPortion.gramWeight > 0
      ? params.quantityGrams / defaultPortion.gramWeight
      : null
  return { pieces, pieceUnit }
}
