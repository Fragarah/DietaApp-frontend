import type { MealCategory, MealIngredientResponse, MealResponse, MealType } from '../meals/types'
import type { PersonMealTarget, PersonResponse } from '../people/types'
import {
  getDefaultPortion,
  isCountableUnit,
  type ProductResponse,
} from '../products/types'

export type PersonColumn = {
  id: string
  personId: number
  label: string
  dailyKcalLimit: number
  /** Resolved meal-slot target in kcal (for składnikowy). */
  targetKcal: string
}

export type PortionLine = {
  mealIngredientId: number
  productId: number
  productName: string
  baseUnit: string
  /** Wartość w jednostce wyświetlanej (g / ml / sztuka). */
  quantityBase: number
  /** Masa w gramach (do sumy masy porcji). */
  quantityGrams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type PersonPortionView = {
  appliedScale: number
  /** Share of the pot for WHOLE (0–1), otherwise null. */
  sharePercent: number | null
  lines: PortionLine[]
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

export type ProductLookup = Map<number, ProductResponse>

type PieceMeta = {
  pieces: number
  gramWeight: number
  unitName: string
}

function toNumber(value: string): number {
  const normalized = value.replace(',', '.').trim()
  return Number(normalized)
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function resolveMealTargetKcal(
  person: PersonResponse,
  mealCategory: MealCategory,
): number | null {
  const target = person.mealTargets.find((item) => item.mealCategory === mealCategory)
  if (!target) {
    return null
  }

  const daily = Number(person.dailyKcalLimit)
  if (Number.isNaN(daily) || daily <= 0) {
    return null
  }

  if (target.mode === 'FIXED') {
    return toKcal(target.unit, target.value, daily)
  }

  const min = toKcal(target.unit, target.minValue, daily)
  const max = toKcal(target.unit, target.maxValue, daily)
  if (min == null || max == null) {
    return null
  }
  return round((min + max) / 2)
}

function toKcal(
  unit: PersonMealTarget['unit'],
  amount: number | null | undefined,
  dailyKcalLimit: number,
): number | null {
  if (amount == null || Number.isNaN(amount) || amount <= 0) {
    return null
  }
  if (unit === 'KCAL') {
    return round(amount)
  }
  return round((dailyKcalLimit * amount) / 100)
}

export function buildPersonColumn(
  person: PersonResponse,
  mealCategory: MealCategory | null,
): PersonColumn {
  const resolved =
    mealCategory != null ? resolveMealTargetKcal(person, mealCategory) : null
  return {
    id: String(person.id),
    personId: person.id,
    label: person.name,
    dailyKcalLimit: Number(person.dailyKcalLimit),
    targetKcal: resolved != null ? String(resolved) : '',
  }
}

/**
 * Składnikowy: skala = cel kcal posiłku / kcal przepisu.
 * Całościowy: udział = (limit osoby / suma limitów) / liczba dni batcha.
 */
export function resolveScale(
  mealType: MealType,
  recipeCalories: number,
  person: PersonColumn,
  selectedPeopleDailyTotal: number,
  plannedDays: number,
): number | null {
  if (mealType === 'WHOLE') {
    if (person.dailyKcalLimit <= 0 || selectedPeopleDailyTotal <= 0 || plannedDays < 1) {
      return null
    }
    return person.dailyKcalLimit / selectedPeopleDailyTotal / plannedDays
  }

  const target = toNumber(person.targetKcal)
  if (Number.isNaN(target) || target <= 0 || recipeCalories <= 0) {
    return null
  }
  return target / recipeCalories
}

/** Ile sztuk z y przypada osobie o udziale share (0–1); szukamy najbliższego S/y. */
export function allocateWholePieces(totalPieces: number, share: number): number {
  if (totalPieces <= 0) {
    return 0
  }
  let best = 0
  let bestDiff = Number.POSITIVE_INFINITY
  for (let s = 0; s <= totalPieces; s++) {
    const diff = Math.abs(s / totalPieces - share)
    if (diff < bestDiff - 1e-12) {
      bestDiff = diff
      best = s
    }
  }
  return best
}

export function resolvePieceMeta(
  product: ProductResponse | undefined,
  quantityBaseGrams: number,
): PieceMeta | null {
  if (!product || !(quantityBaseGrams > 0)) {
    return null
  }
  const portion = getDefaultPortion(product)
  if (!portion || !isCountableUnit(portion.unitName) || !(portion.gramWeight > 0)) {
    return null
  }
  const pieces = Math.round(quantityBaseGrams / portion.gramWeight)
  if (pieces < 1) {
    return null
  }
  return {
    pieces,
    gramWeight: portion.gramWeight,
    unitName: portion.unitName,
  }
}

function scaleIngredientLine(
  ingredient: MealIngredientResponse,
  factor: number,
  quantityBase: number,
  baseUnit: string,
  quantityGrams: number = quantityBase,
): PortionLine {
  return {
    mealIngredientId: ingredient.id,
    productId: ingredient.productId,
    productName: ingredient.productName,
    baseUnit,
    quantityBase: round(quantityBase, 3),
    quantityGrams: round(quantityGrams, 3),
    calories: round((ingredient.calories ?? 0) * factor),
    protein: round((ingredient.protein ?? 0) * factor),
    carbs: round((ingredient.carbs ?? 0) * factor),
    fat: round((ingredient.fat ?? 0) * factor),
  }
}

function sumLines(lines: PortionLine[]) {
  return lines.reduce(
    (acc, line) => ({
      calories: round(acc.calories + line.calories),
      protein: round(acc.protein + line.protein),
      carbs: round(acc.carbs + line.carbs),
      fat: round(acc.fat + line.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function computePersonPortion(
  meal: MealResponse,
  person: PersonColumn,
  selectedPeopleDailyTotal: number,
): PersonPortionView | null {
  const plannedDays = meal.plannedDays != null && meal.plannedDays >= 1 ? meal.plannedDays : 1
  const scale = resolveScale(
    meal.mealType,
    meal.recipeCalories,
    person,
    selectedPeopleDailyTotal,
    plannedDays,
  )
  if (scale == null) {
    return null
  }

  const lines: PortionLine[] = (meal.ingredients ?? []).map((ingredient) => {
    const quantityBase = round(ingredient.quantityBase * scale, 3)
    return scaleIngredientLine(ingredient, scale, quantityBase, ingredient.baseUnit ?? 'g')
  })

  const share =
    meal.mealType === 'WHOLE' && selectedPeopleDailyTotal > 0
      ? person.dailyKcalLimit / selectedPeopleDailyTotal
      : null

  return {
    appliedScale: round(scale, 4),
    sharePercent: share != null ? round(share * 100, 1) : null,
    lines,
    totals: sumLines(lines),
  }
}

function mealHasCountablePieces(
  meal: MealResponse,
  productById: ProductLookup,
): boolean {
  return (meal.ingredients ?? []).some((ingredient) =>
    Boolean(resolvePieceMeta(productById.get(ingredient.productId), Number(ingredient.quantityBase))),
  )
}

/**
 * Składnikowy + dokładnie 2 osoby + produkty sztukowe:
 * 1) x = limitA / (limitA+limitB)
 * 2) sztuki z szablonu dzielone całkowicie (najbliższe S/y ≈ x)
 * 3) od celów posiłku odejmij kcal sztuk → nowe X na resztę produktów
 */
function computeIngredientPieceSplit(
  meal: MealResponse,
  personA: PersonColumn,
  personB: PersonColumn,
  productById: ProductLookup,
): Map<number, PersonPortionView | null> {
  const result = new Map<number, PersonPortionView | null>()
  const targetA = toNumber(personA.targetKcal)
  const targetB = toNumber(personB.targetKcal)
  const dailySum = personA.dailyKcalLimit + personB.dailyKcalLimit

  if (
    Number.isNaN(targetA) ||
    targetA <= 0 ||
    Number.isNaN(targetB) ||
    targetB <= 0 ||
    dailySum <= 0
  ) {
    result.set(personA.personId, null)
    result.set(personB.personId, null)
    return result
  }

  const shareA = personA.dailyKcalLimit / dailySum
  const ingredients = meal.ingredients ?? []

  type CountablePlan = {
    ingredient: MealIngredientResponse
    meta: PieceMeta
    piecesA: number
    piecesB: number
  }

  const countable: CountablePlan[] = []
  const divisible: MealIngredientResponse[] = []

  for (const ingredient of ingredients) {
    const meta = resolvePieceMeta(
      productById.get(ingredient.productId),
      Number(ingredient.quantityBase),
    )
    if (!meta) {
      divisible.push(ingredient)
      continue
    }
    const piecesA = allocateWholePieces(meta.pieces, shareA)
    countable.push({
      ingredient,
      meta,
      piecesA,
      piecesB: meta.pieces - piecesA,
    })
  }

  let pieceKcalA = 0
  let pieceKcalB = 0
  for (const item of countable) {
    const kcalPerPiece = (item.ingredient.calories ?? 0) / item.meta.pieces
    pieceKcalA += kcalPerPiece * item.piecesA
    pieceKcalB += kcalPerPiece * item.piecesB
  }

  const remainA = targetA - pieceKcalA
  const remainB = targetB - pieceKcalB
  const remainSum = remainA + remainB
  const remShareA = remainSum > 0 ? remainA / remainSum : 0.5

  function buildLines(piecesOf: 'piecesA' | 'piecesB', remShare: number): PortionLine[] {
    const lines: PortionLine[] = []

    for (const item of countable) {
      const pieces = item[piecesOf]
      const factor = item.meta.pieces > 0 ? pieces / item.meta.pieces : 0
      lines.push(
        scaleIngredientLine(
          item.ingredient,
          factor,
          pieces,
          item.meta.unitName,
          pieces * item.meta.gramWeight,
        ),
      )
    }

    for (const ingredient of divisible) {
      const quantityBase = Number(ingredient.quantityBase) * remShare
      lines.push(
        scaleIngredientLine(ingredient, remShare, quantityBase, ingredient.baseUnit ?? 'g'),
      )
    }

    return lines
  }

  const linesA = buildLines('piecesA', remShareA)
  const linesB = buildLines('piecesB', 1 - remShareA)

  result.set(personA.personId, {
    appliedScale: round(remShareA, 4),
    sharePercent: round(shareA * 100, 1),
    lines: linesA,
    totals: sumLines(linesA),
  })
  result.set(personB.personId, {
    appliedScale: round(1 - remShareA, 4),
    sharePercent: round((1 - shareA) * 100, 1),
    lines: linesB,
    totals: sumLines(linesB),
  })

  return result
}

/** Wylicza porcje dla wszystkich zaznaczonych osób (z wariantem sztukowym dla 2 osób). */
export function computePortionsForPeople(
  meal: MealResponse,
  people: PersonColumn[],
  selectedPeopleDailyTotal: number,
  productById: ProductLookup = new Map(),
): Map<number, PersonPortionView | null> {
  if (
    meal.mealType === 'INGREDIENT' &&
    people.length === 2 &&
    mealHasCountablePieces(meal, productById)
  ) {
    return computeIngredientPieceSplit(meal, people[0], people[1], productById)
  }

  const result = new Map<number, PersonPortionView | null>()
  for (const person of people) {
    result.set(person.personId, computePersonPortion(meal, person, selectedPeopleDailyTotal))
  }
  return result
}
