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
import type { MealPlanEntry } from './types'

export type ShoppingListItem = {
  productId: number
  productName: string
  categoryName: string
  grams: number
  pieces: number | null
  pieceUnit: string | null
}

/**
 * Suma składników z planu w zakresie: każdy slot × porcje zaznaczonych osób.
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

  const selectedPeopleDailyTotal = people.reduce(
    (sum, person) => sum + Number(person.dailyKcalLimit),
    0,
  )

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
    const personColumns = people.map((person) =>
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
      const byCategory = a.categoryName.localeCompare(b.categoryName, 'pl')
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
