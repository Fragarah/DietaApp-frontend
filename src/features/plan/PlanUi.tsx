import type { MealResponse } from '../meals/types'
import type { PersonResponse } from '../people/types'
import type { PersonColumn, PersonPortionView } from '../portions/portionMath'
import { buildPersonColumn, computePortionsForPeople } from '../portions/portionMath'
import type { ProductLookup } from '../portions/portionMath'
import { pl } from '../../i18n/pl'
import { formatCountableUnit } from '../../i18n/plCount'
import { formatPlanDayLabel } from './settings'
import type { ShoppingListItem } from './shoppingList'
import { PLAN_SLOT_CATEGORIES, type MealPlanEntry, type PlanSlotCategory } from './types'
import './Plan.css'

type PlanSlotPickerProps = {
  open: boolean
  meal: MealResponse
  days: string[]
  entries: MealPlanEntry[]
  assigning: boolean
  error: string | null
  onClose: () => void
  onPickDay: (planDate: string, replaceExisting: boolean) => void
}

export function PlanSlotPicker({
  open,
  meal,
  days,
  entries,
  assigning,
  error,
  onClose,
  onPickDay,
}: PlanSlotPickerProps) {
  if (!open) {
    return null
  }

  const category = meal.mealCategory
  const isWholeBatch = meal.mealType === 'WHOLE' && (meal.plannedDays ?? 0) > 1
  const batchDays = meal.plannedDays ?? 1

  function occupancy(date: string): MealPlanEntry | undefined {
    return entries.find(
      (entry) => entry.planDate === date && entry.mealCategory === category,
    )
  }

  function handlePick(date: string) {
    if (assigning) {
      return
    }
    if (isWholeBatch) {
      const endIndex = days.indexOf(date) + batchDays - 1
      if (endIndex >= days.length) {
        window.alert(
          `Garnek na ${batchDays} dni nie mieści się w zakresie od wybranego dnia.`,
        )
        return
      }
      const span = days.slice(days.indexOf(date), endIndex + 1)
      const conflict = span.some((d) => occupancy(d))
      if (conflict && !window.confirm('Część slotów w zakresie garnka jest zajęta. Zastąpić?')) {
        return
      }
      onPickDay(date, conflict)
      return
    }

    const existing = occupancy(date)
    if (existing && !window.confirm(`Slot zajęty przez „${existing.mealName}”. Zastąpić?`)) {
      return
    }
    onPickDay(date, Boolean(existing))
  }

  return (
    <div className="plan-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="plan-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-slot-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="plan-slot-picker-title">Dodaj do planu</h2>
        <p className="plan-dialog__hint">
          {meal.name} · {category}
          {isWholeBatch ? ` · garnek ${batchDays} dni` : null}
        </p>
        {error ? <p className="plan-dialog__error">{error}</p> : null}
        <ul className="plan-slot-days">
          {days.map((date) => {
            const existing = occupancy(date)
            return (
              <li key={date}>
                <button
                  type="button"
                  className={`plan-slot-day${existing ? ' plan-slot-day--busy' : ''}`}
                  disabled={assigning}
                  onClick={() => handlePick(date)}
                >
                  <span className="plan-slot-day__label">{formatPlanDayLabel(date)}</span>
                  <span className="plan-slot-day__meta">
                    {existing ? existing.mealName : 'Wolny slot'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn btn--secondary" onClick={onClose} disabled={assigning}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

type PlanGridProps = {
  days: string[]
  entries: MealPlanEntry[]
  mealsById: Map<number, MealResponse>
  people: PersonResponse[]
  productById: ProductLookup
  onDelete: (entry: MealPlanEntry) => void
}

export function PlanGrid({
  days,
  entries,
  mealsById,
  people,
  productById,
  onDelete,
}: PlanGridProps) {
  const entryMap = new Map(
    entries.map((entry) => [`${entry.planDate}|${entry.mealCategory}`, entry] as const),
  )
  const selectedPeopleDailyTotal = people.reduce(
    (sum, person) => sum + Number(person.dailyKcalLimit),
    0,
  )

  return (
    <div className="plan-grid-wrap">
      <table className="plan-grid">
        <thead>
          <tr>
            <th>Dzień</th>
            {PLAN_SLOT_CATEGORIES.map((category) => (
              <th key={category}>{categoryLabel(category)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((date) => (
            <tr key={date}>
              <th scope="row">{formatPlanDayLabel(date)}</th>
              {PLAN_SLOT_CATEGORIES.map((category) => {
                const entry = entryMap.get(`${date}|${category}`)
                return (
                  <td key={category}>
                    {entry ? (
                      <PlanCell
                        entry={entry}
                        meal={mealsById.get(entry.mealId) ?? null}
                        people={people}
                        selectedPeopleDailyTotal={selectedPeopleDailyTotal}
                        productById={productById}
                        onDelete={() => onDelete(entry)}
                      />
                    ) : (
                      <span className="plan-cell--empty">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlanCell({
  entry,
  meal,
  people,
  selectedPeopleDailyTotal,
  productById,
  onDelete,
}: {
  entry: MealPlanEntry
  meal: MealResponse | null
  people: PersonResponse[]
  selectedPeopleDailyTotal: number
  productById: ProductLookup
  onDelete: () => void
}) {
  const category = meal?.mealCategory ?? entry.mealCategory
  const personColumns = people.map((person) => buildPersonColumn(person, category))
  const portions = computeCellPortions(
    meal,
    personColumns,
    selectedPeopleDailyTotal,
    productById,
  )

  const kcalParts = personColumns.map((person) => {
    const portion = portions.get(person.personId)
    return portion ? formatKcal(portion.totals.calories) : '—'
  })

  const ingredientRows =
    meal?.ingredients?.map((ingredient) => {
      const grams = personColumns.map((person) => {
        const portion = portions.get(person.personId)
        const line = portion?.lines.find((item) => item.productId === ingredient.productId)
        return line ? formatGrams(line.quantityGrams) : '—'
      })
      return { name: ingredient.productName, grams }
    }) ?? []

  return (
    <div className="plan-cell">
      <div className="plan-cell__head">
        <strong>{entry.mealName}</strong>
        <button type="button" className="plan-cell__delete" onClick={onDelete} title="Usuń">
          ×
        </button>
      </div>
      <p className="plan-cell__kcal">~{kcalParts.join('/') } kcal</p>
      {entry.batchDay != null && entry.batchTotal != null ? (
        <p className="plan-cell__batch">
          batch dzień {entry.batchDay}/{entry.batchTotal}
        </p>
      ) : null}
      <ul className="plan-cell__ingredients">
        {ingredientRows.map((row) => (
          <li key={row.name}>
            {row.name}: {row.grams.join('/')} g
          </li>
        ))}
      </ul>
    </div>
  )
}

function computeCellPortions(
  meal: MealResponse | null,
  personColumns: PersonColumn[],
  selectedPeopleDailyTotal: number,
  productById: ProductLookup,
): Map<number, PersonPortionView | null> {
  if (!meal || personColumns.length === 0) {
    return new Map()
  }
  return computePortionsForPeople(meal, personColumns, selectedPeopleDailyTotal, productById)
}

function formatKcal(value: number): string {
  return Math.round(value).toLocaleString('pl-PL')
}

function formatGrams(value: number): string {
  return Math.round(value).toLocaleString('pl-PL')
}

function categoryLabel(category: PlanSlotCategory): string {
  const labels: Record<PlanSlotCategory, string> = {
    SNIADANIE: 'Śniadanie',
    LUNCH: 'Lunch',
    OBIAD: 'Obiad',
    DESER: 'Deser',
  }
  return labels[category]
}

type ShoppingListPreviewProps = {
  open: boolean
  rangeLabel: string
  items: ShoppingListItem[]
  emptyReason: 'plan' | 'people' | null
  onClose: () => void
}

export function ShoppingListPreview({
  open,
  rangeLabel,
  items,
  emptyReason,
  onClose,
}: ShoppingListPreviewProps) {
  if (!open) {
    return null
  }

  return (
    <div className="plan-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="plan-dialog plan-dialog--shopping"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-list-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="shopping-list-title">{pl.portions.plan.shoppingTitle}</h2>
        <p className="plan-dialog__hint">
          {pl.portions.plan.shoppingRange.replace('{range}', rangeLabel)}
        </p>
        {emptyReason === 'people' ? (
          <p className="plan-dialog__hint">{pl.portions.plan.shoppingEmptyPeople}</p>
        ) : null}
        {emptyReason === 'plan' ? (
          <p className="plan-dialog__hint">{pl.portions.plan.shoppingEmptyPlan}</p>
        ) : null}
        {!emptyReason && items.length === 0 ? (
          <p className="plan-dialog__hint">{pl.portions.plan.shoppingEmptyPlan}</p>
        ) : null}
        {items.length > 0 ? (
          <ul className="shopping-list">
            {items.map((item) => (
              <li key={item.productId} className="shopping-list__item">
                <div className="shopping-list__name">
                  <strong>{item.productName}</strong>
                  {item.categoryName ? (
                    <span className="shopping-list__category">{item.categoryName}</span>
                  ) : null}
                </div>
                <div className="shopping-list__qty">
                  {item.pieces != null && item.pieceUnit
                    ? `${formatQty(item.pieces)} ${formatCountableUnit(item.pieceUnit, item.pieces)} (${formatQty(item.grams)} ${pl.meal.summary.grams})`
                    : `${formatQty(item.grams)} ${pl.meal.summary.grams}`}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          {pl.portions.plan.shoppingClose}
        </button>
      </div>
    </div>
  )
}

function formatQty(value: number): string {
  return Math.round(value).toLocaleString('pl-PL')
}
