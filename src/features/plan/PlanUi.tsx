import type { MealResponse } from '../meals/types'
import type { PersonResponse } from '../people/types'
import type { PersonColumn, PersonPortionView } from '../portions/portionMath'
import { buildPersonColumn, computePortionsForPeople } from '../portions/portionMath'
import type { ProductLookup } from '../portions/portionMath'
import { pl } from '../../i18n/pl'
import { formatCountableUnit } from '../../i18n/plCount'
import { formatPlanDayLabel } from './settings'
import type { ShoppingListItem } from './shoppingList'
import {
  buildDailyNutritionSummaries,
  sumRangeNutrition,
  type PersonDayNutrition,
} from './planNutrition'
import {
  formatPlanEntryLabel,
  peopleForPlanEntry,
  personInitial,
  PLAN_SLOT_CATEGORIES,
  type MealPlanEntry,
  type PlanSlotCategory,
} from './types'
import './Plan.css'

type PlanSlotPickerProps = {
  open: boolean
  meal: MealResponse
  days: string[]
  entries: MealPlanEntry[]
  people: PersonResponse[]
  assigning: boolean
  error: string | null
  onClose: () => void
  onPickDay: (planDate: string, replaceExisting: boolean, personId: number | null) => void
}

export function PlanSlotPicker({
  open,
  meal,
  days,
  entries,
  people,
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

  function slotEntries(date: string): MealPlanEntry[] {
    return entries.filter(
      (entry) => entry.planDate === date && entry.mealCategory === category,
    )
  }

  function isSharedBusy(date: string): boolean {
    return slotEntries(date).length > 0
  }

  function isPersonBusy(date: string, personId: number): boolean {
    const slot = slotEntries(date)
    return slot.some(
      (entry) => entry.personId == null || entry.personId === personId,
    )
  }

  function conflictingMealName(date: string, personId: number | null): string | null {
    const slot = slotEntries(date)
    if (personId == null) {
      return slot[0]?.mealName ?? null
    }
    const hit = slot.find(
      (entry) => entry.personId == null || entry.personId === personId,
    )
    return hit?.mealName ?? null
  }

  function occupancyMeta(date: string): string {
    const slot = slotEntries(date)
    if (slot.length === 0) {
      return 'Wolny'
    }
    const shared = slot.find((entry) => entry.personId == null)
    if (shared) {
      return `Wspólny: ${shared.mealName}`
    }
    if (people.length === 0) {
      return slot.map((entry) => formatPlanEntryLabel(entry)).join(' · ')
    }
    return people
      .map((person) => {
        const entry = slot.find((item) => item.personId === person.id)
        return entry
          ? `${personInitial(person.name)}: ${entry.mealName}`
          : `${personInitial(person.name)}: wolny`
      })
      .join(' · ')
  }

  function handlePick(date: string, personId: number | null) {
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
      const conflict = span.some((d) =>
        personId == null ? isSharedBusy(d) : isPersonBusy(d, personId),
      )
      if (conflict && !window.confirm('Część slotów w zakresie garnka jest zajęta. Zastąpić?')) {
        return
      }
      onPickDay(date, conflict, personId)
      return
    }

    const busy = personId == null ? isSharedBusy(date) : isPersonBusy(date, personId)
    if (busy) {
      const name = conflictingMealName(date, personId) ?? 'inny posiłek'
      if (!window.confirm(`Slot zajęty przez „${name}”. Zastąpić?`)) {
        return
      }
    }
    onPickDay(date, busy, personId)
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
        <p className="plan-dialog__hint">
          Klik dnia = obie osoby; litera = tylko ta osoba.
        </p>
        {error ? <p className="plan-dialog__error">{error}</p> : null}
        <ul className="plan-slot-days">
          {days.map((date) => {
            const sharedBusy = isSharedBusy(date)
            return (
              <li key={date}>
                <div
                  className={`plan-slot-day${sharedBusy ? ' plan-slot-day--busy' : ''}`}
                >
                  <button
                    type="button"
                    className="plan-slot-day__main"
                    disabled={assigning}
                    onClick={() => handlePick(date, null)}
                  >
                    <span className="plan-slot-day__label">{formatPlanDayLabel(date)}</span>
                    <span className="plan-slot-day__meta">{occupancyMeta(date)}</span>
                  </button>
                  {people.length > 0 ? (
                    <div className="plan-slot-day__people">
                      {people.map((person) => {
                        const busy = isPersonBusy(date, person.id)
                        return (
                          <button
                            key={person.id}
                            type="button"
                            className={`plan-slot-day__person${busy ? ' plan-slot-day__person--busy' : ''}`}
                            disabled={assigning}
                            title={`${person.name}${busy ? ' (zajęty)' : ''}`}
                            aria-label={`Dodaj dla ${person.name}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              handlePick(date, person.id)
                            }}
                          >
                            {personInitial(person.name)}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
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
  const entriesBySlot = new Map<string, MealPlanEntry[]>()
  for (const entry of entries) {
    const key = `${entry.planDate}|${entry.mealCategory}`
    const list = entriesBySlot.get(key)
    if (list) {
      list.push(entry)
    } else {
      entriesBySlot.set(key, [entry])
    }
  }

  const dailyNutrition = buildDailyNutritionSummaries({
    days,
    entries,
    mealsById,
    people,
    productById,
  })
  const rangeNutrition = sumRangeNutrition(dailyNutrition, people)

  return (
    <div className="plan-grid-block">
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
                  const slotEntries = entriesBySlot.get(`${date}|${category}`) ?? []
                  return (
                    <td key={category}>
                      {slotEntries.length === 0 ? (
                        <span className="plan-cell--empty">—</span>
                      ) : (
                        <div className="plan-cell-stack">
                          {slotEntries.map((entry) => (
                            <PlanCell
                              key={entry.id}
                              entry={entry}
                              meal={mealsById.get(entry.mealId) ?? null}
                              people={people}
                              productById={productById}
                              onDelete={() => onDelete(entry)}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {people.length > 0 ? (
        <PlanNutritionSummary
          daily={dailyNutrition}
          range={rangeNutrition}
          dayCount={days.length}
          hasEntries={entries.length > 0}
        />
      ) : null}
    </div>
  )
}

function PlanNutritionSummary({
  daily,
  range,
  dayCount,
  hasEntries,
}: {
  daily: ReturnType<typeof buildDailyNutritionSummaries>
  range: PersonDayNutrition[]
  dayCount: number
  hasEntries: boolean
}) {
  return (
    <section className="plan-nutrition" aria-label={pl.portions.plan.nutritionDailyTitle}>
      <h3 className="plan-nutrition__title">{pl.portions.plan.nutritionDailyTitle}</h3>
      {!hasEntries ? (
        <p className="plan-nutrition__hint">{pl.portions.plan.nutritionEmpty}</p>
      ) : (
        <div className="plan-nutrition__days">
          {daily.map((day) => (
            <div key={day.planDate} className="plan-nutrition__day">
              <div className="plan-nutrition__day-label">{formatPlanDayLabel(day.planDate)}</div>
              <NutritionTable rows={day.people} />
            </div>
          ))}
        </div>
      )}

      <h3 className="plan-nutrition__title">
        {pl.portions.plan.nutritionRangeTitle.replace('{days}', String(dayCount))}
      </h3>
      <NutritionTable rows={range} />
    </section>
  )
}

function NutritionTable({ rows }: { rows: PersonDayNutrition[] }) {
  return (
    <table className="plan-nutrition-table">
      <thead>
        <tr>
          <th>{pl.portions.plan.nutritionPerson}</th>
          <th>{pl.portions.plan.nutritionKcal}</th>
          <th>{pl.portions.plan.nutritionProtein}</th>
          <th>{pl.portions.plan.nutritionCarbs}</th>
          <th>{pl.portions.plan.nutritionFat}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((person) => (
          <tr key={person.personId}>
            <th scope="row">{person.personName}</th>
            <td>{formatMacro(person.totals.calories)}</td>
            <td>{formatMacro(person.totals.protein)}</td>
            <td>{formatMacro(person.totals.carbs)}</td>
            <td>{formatMacro(person.totals.fat)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatMacro(value: number): string {
  return Math.round(value).toLocaleString('pl-PL')
}

function PlanCell({
  entry,
  meal,
  people,
  productById,
  onDelete,
}: {
  entry: MealPlanEntry
  meal: MealResponse | null
  people: PersonResponse[]
  productById: ProductLookup
  onDelete: () => void
}) {
  const category = meal?.mealCategory ?? entry.mealCategory
  const entryPeople = peopleForPlanEntry(entry, people)
  const selectedPeopleDailyTotal = entryPeople.reduce(
    (sum, person) => sum + Number(person.dailyKcalLimit),
    0,
  )
  const personColumns = entryPeople.map((person) => buildPersonColumn(person, category))
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
        <strong>{formatPlanEntryLabel(entry)}</strong>
        <button type="button" className="plan-cell__delete" onClick={onDelete} title="Usuń">
          ×
        </button>
      </div>
      {kcalParts.length > 0 ? (
        <p className="plan-cell__kcal">~{kcalParts.join('/')} kcal</p>
      ) : null}
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
                <span className="shopping-list__qty">
                  {item.pieces != null && item.pieceUnit
                    ? `${formatQty(item.pieces)} ${formatCountableUnit(item.pieceUnit, item.pieces)} (${formatQty(item.grams)} ${pl.meal.summary.grams})`
                    : `${formatQty(item.grams)} ${pl.meal.summary.grams}`}
                </span>
                <div className="shopping-list__name">
                  <strong>{item.productName}</strong>
                  {item.categoryName ? (
                    <span className="shopping-list__category">{item.categoryName}</span>
                  ) : null}
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
