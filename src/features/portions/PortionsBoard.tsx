import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pl } from '../../i18n/pl'
import { formatCountableUnit } from '../../i18n/plCount'
import { assignMealPlan, deleteMealPlanEntry, fetchMealPlan } from '../plan/api'
import { PlanGrid, PlanSlotPicker, ShoppingListPreview } from '../plan/PlanUi'
import { exportPlanPdf } from '../plan/exportPlanPdf'
import { buildShoppingList } from '../plan/shoppingList'
import {
  addDaysIso,
  eachDayIso,
  formatPlanRangeLabel,
  getPlanLengthDays,
  getStoredPlanStartDate,
  setPlanLengthDays,
  setStoredPlanStartDate,
  todayIsoDate,
} from '../plan/settings'
import type { MealPlanEntry } from '../plan/types'
import { fetchMeals } from '../meals/api'
import { MEAL_CATEGORIES, type MealCategory, type MealResponse } from '../meals/types'
import { fetchPersons } from '../people/api'
import type { PersonResponse } from '../people/types'
import { fetchProducts } from '../products/api'
import {
  getDefaultPortion,
  isCountableUnit,
  type ProductResponse,
} from '../products/types'
import { buildPersonColumn, computePortionsForPeople, type PersonPortionView } from './portionMath'
import './PortionsBoard.css'

function formatNumber(value: number): string {
  return value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })
}

function formatGramsWhole(value: number): string {
  return Math.round(value).toLocaleString('pl-PL')
}

/** Odchylenie kcal od celu: ≤5% ok, ≤10% ostrzeżenie, inaczej poza zakresem. */
function kcalAccuracyTone(
  actualKcal: number,
  targetKcal: string,
): 'ok' | 'warn' | 'bad' | null {
  const target = Number(String(targetKcal).replace(',', '.'))
  if (!(target > 0) || Number.isNaN(actualKcal)) {
    return null
  }
  const pct = (Math.abs(actualKcal - target) / target) * 100
  if (pct <= 5) {
    return 'ok'
  }
  if (pct <= 10) {
    return 'warn'
  }
  return 'bad'
}

export function PortionsBoard({ reloadToken = 0 }: { reloadToken?: number }) {
  const [meals, setMeals] = useState<MealResponse[]>([])
  const [savedPeople, setSavedPeople] = useState<PersonResponse[]>([])
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mealQuery, setMealQuery] = useState('')
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [categoryFilters, setCategoryFilters] = useState<Set<MealCategory>>(new Set())
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([])
  const [peoplePanelOpen, setPeoplePanelOpen] = useState(true)
  const mealPickerRef = useRef<HTMLDivElement>(null)
  const [planStartDate, setPlanStartDate] = useState(
    () => getStoredPlanStartDate() ?? todayIsoDate(),
  )
  const [planLengthDays, setPlanLengthDaysState] = useState(() => getPlanLengthDays())
  const [planEntries, setPlanEntries] = useState<MealPlanEntry[]>([])
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planMessage, setPlanMessage] = useState<string | null>(null)
  const [slotPickerOpen, setSlotPickerOpen] = useState(false)
  const [assigningPlan, setAssigningPlan] = useState(false)
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const [printingPdf, setPrintingPdf] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [mealData, peopleData, productData] = await Promise.all([
          fetchMeals(),
          fetchPersons(),
          fetchProducts(),
        ])
        if (!cancelled) {
          setMeals(
            [...mealData].sort((a, b) =>
              a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }),
            ),
          )
          const people = [...peopleData].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
          setSavedPeople(people)
          setSelectedPersonIds((current) => {
            if (current.length === 0) {
              return people.map((person) => person.id)
            }
            const stillThere = current.filter((id) => people.some((person) => person.id === id))
            return stillThere.length > 0 ? stillThere : people.map((person) => person.id)
          })
          setProducts(productData)
        }
      } catch {
        if (!cancelled) {
          setError(pl.portions.errors.loadFailed)
          setMeals([])
          setSavedPeople([])
          setSelectedPersonIds([])
          setProducts([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const planDays = useMemo(
    () => eachDayIso(planStartDate, planLengthDays),
    [planStartDate, planLengthDays],
  )
  const planEndDate = useMemo(
    () => addDaysIso(planStartDate, planLengthDays - 1),
    [planStartDate, planLengthDays],
  )

  const loadPlan = useCallback(async () => {
    setPlanLoading(true)
    setPlanError(null)
    try {
      const data = await fetchMealPlan(planStartDate, planEndDate)
      setPlanEntries(data)
    } catch {
      setPlanError(pl.portions.plan.loadFailed)
      setPlanEntries([])
    } finally {
      setPlanLoading(false)
    }
  }, [planStartDate, planEndDate])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan, reloadToken])

  useEffect(() => {
    setStoredPlanStartDate(planStartDate)
  }, [planStartDate])

  useEffect(() => {
    if (!pickerOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (mealPickerRef.current?.contains(target)) {
        return
      }
      setPickerOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pickerOpen])

  const selectedMeal = useMemo(
    () => meals.find((meal) => meal.id === selectedMealId) ?? null,
    [meals, selectedMealId],
  )

  const isWhole = selectedMeal?.mealType === 'WHOLE'

  const personColumns = useMemo(() => {
    const mealCategory = selectedMeal?.mealCategory ?? null
    return selectedPersonIds
      .map((id) => savedPeople.find((person) => person.id === id))
      .filter((person): person is PersonResponse => person != null)
      .map((person) => buildPersonColumn(person, mealCategory))
  }, [savedPeople, selectedPersonIds, selectedMeal])

  const selectedPeopleDailyTotal = useMemo(
    () => personColumns.reduce((sum, person) => sum + person.dailyKcalLimit, 0),
    [personColumns],
  )

  const productById = useMemo(() => {
    const map = new Map<number, ProductResponse>()
    for (const product of products) {
      map.set(product.id, product)
    }
    return map
  }, [products])

  const portionsByPersonId = useMemo((): Map<number, PersonPortionView | null> => {
    if (!selectedMeal || personColumns.length === 0) {
      return new Map()
    }
    return computePortionsForPeople(
      selectedMeal,
      personColumns,
      selectedPeopleDailyTotal,
      productById,
    )
  }, [selectedMeal, personColumns, selectedPeopleDailyTotal, productById])

  const prepMassTotals = useMemo(() => {
    const byIngredient = new Map<
      number,
      {
        productName: string
        grams: number
        pieces: number | null
        pieceUnit: string | null
        sortKey: number
      }
    >()
    let totalGrams = 0

    function addLine(params: {
      productId: number
      productName: string
      quantityGrams: number
      quantityBase: number
      baseUnit: string
      sortKey: number
    }) {
      totalGrams += params.quantityGrams
      const product = productById.get(params.productId)
      const defaultPortion = product ? getDefaultPortion(product) : null
      const countable =
        isCountableUnit(params.baseUnit) ||
        Boolean(
          defaultPortion &&
            isCountableUnit(defaultPortion.unitName) &&
            defaultPortion.gramWeight > 0,
        )
      const pieceUnit = countable
        ? isCountableUnit(params.baseUnit)
          ? params.baseUnit
          : (defaultPortion?.unitName ?? null)
        : null
      const linePieces = countable
        ? isCountableUnit(params.baseUnit)
          ? params.quantityBase
          : defaultPortion && defaultPortion.gramWeight > 0
            ? params.quantityGrams / defaultPortion.gramWeight
            : null
        : null

      const current = byIngredient.get(params.productId)
      if (current) {
        current.grams += params.quantityGrams
        if (current.pieces != null && linePieces != null) {
          current.pieces += linePieces
        }
      } else {
        byIngredient.set(params.productId, {
          productName: params.productName,
          grams: params.quantityGrams,
          pieces: linePieces,
          pieceUnit,
          sortKey: params.sortKey,
        })
      }
    }

    // Suma dziennych porcji zaznaczonych osób (= 1 dzień z garnka przy WHOLE).
    for (const person of personColumns) {
      const portion = portionsByPersonId.get(person.personId)
      if (!portion) {
        continue
      }
      portion.lines.forEach((line, index) => {
        addLine({
          productId: line.productId,
          productName: line.productName,
          quantityGrams: line.quantityGrams,
          quantityBase: line.quantityBase,
          baseUnit: line.baseUnit,
          sortKey: line.mealIngredientId || index,
        })
      })
    }

    const ingredients = [...byIngredient.values()].sort((a, b) => a.sortKey - b.sortKey)
    return { totalGrams, ingredients }
  }, [personColumns, portionsByPersonId, productById])

  const wholeDailyPotKcal = useMemo(() => {
    if (!selectedMeal || selectedMeal.mealType !== 'WHOLE') {
      return null
    }
    const days = selectedMeal.plannedDays != null && selectedMeal.plannedDays >= 1
      ? selectedMeal.plannedDays
      : 1
    return selectedMeal.recipeCalories / days
  }, [selectedMeal])

  const filteredMeals = useMemo(() => {
    const needle = mealQuery.trim().toLocaleLowerCase('pl-PL')
    return meals.filter((meal) => {
      if (categoryFilters.size > 0 && !categoryFilters.has(meal.mealCategory)) {
        return false
      }
      if (!needle) {
        return true
      }
      return meal.name.toLocaleLowerCase('pl-PL').includes(needle)
    })
  }, [meals, mealQuery, categoryFilters])

  const peopleSummary = useMemo(() => {
    if (personColumns.length === 0) {
      return pl.portions.peoplePanel.noneSelected
    }
    const countLabel =
      personColumns.length === 1
        ? pl.portions.peoplePanel.onePerson
        : pl.portions.peoplePanel.manyPersons.replace(
            '{count}',
            String(personColumns.length),
          )
    const names = personColumns.map((person) => person.label).join(', ')
    return `${countLabel} · ${names}`
  }, [personColumns])

  function togglePerson(personId: number) {
    setSelectedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    )
  }

  function toggleCategory(category: MealCategory) {
    setCategoryFilters((current) => {
      const next = new Set(current)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
    setPickerOpen(true)
  }

  function chooseMeal(meal: MealResponse) {
    setSelectedMealId(meal.id)
    setMealQuery(meal.name)
    setPickerOpen(false)
  }

  const mealsById = useMemo(() => {
    const map = new Map<number, MealResponse>()
    for (const meal of meals) {
      map.set(meal.id, meal)
    }
    return map
  }, [meals])

  const planPeople = useMemo(
    () =>
      selectedPersonIds
        .map((id) => savedPeople.find((person) => person.id === id))
        .filter((person): person is PersonResponse => person != null),
    [savedPeople, selectedPersonIds],
  )

  const shoppingItems = useMemo(
    () =>
      buildShoppingList({
        entries: planEntries,
        mealsById,
        people: planPeople,
        productById,
      }),
    [planEntries, mealsById, planPeople, productById],
  )

  const shoppingEmptyReason =
    planPeople.length === 0 ? 'people' : planEntries.length === 0 ? 'plan' : null

  function handlePlanStartChange(value: string) {
    if (!value) {
      return
    }
    setPlanStartDate(value)
  }

  function handlePlanLengthChange(value: string) {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
      return
    }
    setPlanLengthDays(parsed)
    setPlanLengthDaysState(parsed)
  }

  async function handleAssignToPlan(planDate: string, replaceExisting: boolean) {
    if (!selectedMeal) {
      return
    }
    setAssigningPlan(true)
    setPlanError(null)
    setPlanMessage(null)
    try {
      const mode =
        selectedMeal.mealType === 'WHOLE' && (selectedMeal.plannedDays ?? 0) > 1
          ? 'WHOLE_BATCH'
          : 'SINGLE'
      await assignMealPlan({
        mealId: selectedMeal.id,
        startDate: planDate,
        mode,
        replaceExisting,
      })
      setSlotPickerOpen(false)
      setPlanMessage(pl.portions.plan.assignSuccess)
      await loadPlan()
    } catch {
      setPlanError(pl.portions.plan.assignFailed)
    } finally {
      setAssigningPlan(false)
    }
  }

  async function handleDeletePlanEntry(entry: MealPlanEntry) {
    const isBatch = entry.batchGroupId != null && (entry.batchTotal ?? 0) > 1
    const confirmed = isBatch
      ? window.confirm(
          pl.portions.plan.deleteGroupConfirm.replace(
            '{days}',
            String(entry.batchTotal ?? entry.plannedDays ?? 1),
          ),
        )
      : window.confirm(pl.portions.plan.deleteConfirm.replace('{name}', entry.mealName))
    if (!confirmed) {
      return
    }
    setPlanError(null)
    try {
      await deleteMealPlanEntry(entry.id, isBatch)
      await loadPlan()
    } catch {
      setPlanError(pl.portions.plan.deleteFailed)
    }
  }

  async function handleExportPdf() {
    setPrintingPdf(true)
    setPlanError(null)
    try {
      await exportPlanPdf({
        planStartDate,
        planLengthDays,
        days: planDays,
        entries: planEntries,
        mealsById,
        people: planPeople,
        productById,
        shoppingItems,
      })
    } catch {
      setPlanError(pl.portions.plan.pdfExportFailed)
    } finally {
      setPrintingPdf(false)
    }
  }

  return (
    <section className="portions-board">
      <header className="portions-board__header">
        <p className="portions-board__brand">{pl.appName}</p>
        <h1>{pl.portions.title}</h1>
      </header>

      {error ? (
        <p className="portions-board__banner portions-board__banner--error" role="alert">
          {error}
        </p>
      ) : null}
      {planError ? (
        <p className="portions-board__banner portions-board__banner--error" role="alert">
          {planError}
        </p>
      ) : null}
      {planMessage ? (
        <p className="portions-board__banner" role="status">
          {planMessage}
        </p>
      ) : null}

      <section className="people-panel" aria-labelledby="people-panel-title">
        {peoplePanelOpen ? (
          <>
            <div className="people-panel__bar">
              <h2 id="people-panel-title">{pl.portions.peoplePanel.title}</h2>
              <button
                type="button"
                className="btn btn--collapse"
                onClick={() => setPeoplePanelOpen(false)}
              >
                {pl.portions.peoplePanel.collapse}
              </button>
            </div>
            <p className="people-panel__hint">{pl.portions.peoplePanel.hint}</p>

            {loading ? (
              <p className="people-panel__status">{pl.portions.loadingPeople}</p>
            ) : null}

            {!loading && savedPeople.length === 0 ? (
              <p className="people-panel__status">{pl.portions.peoplePanel.empty}</p>
            ) : null}

            {!loading && savedPeople.length > 0 ? (
              <ul className="people-panel__picks" role="list">
                {savedPeople.map((person) => {
                  const active = selectedPersonIds.includes(person.id)
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        className={`people-pick${active ? ' people-pick--active' : ''}`}
                        aria-pressed={active}
                        onClick={() => togglePerson(person.id)}
                      >
                        <span className="people-pick__name">{person.name}</span>
                        <span className="people-pick__hint">
                          {pl.portions.peoplePanel.dailyLimitHint.replace(
                            '{kcal}',
                            String(person.dailyKcalLimit),
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="people-panel__collapsed"
            onClick={() => setPeoplePanelOpen(true)}
            aria-expanded={false}
            aria-label={pl.portions.peoplePanel.expand}
          >
            <span id="people-panel-title">{pl.portions.peoplePanel.title}</span>
            <span className="people-panel__collapsed-meta">{peopleSummary}</span>
          </button>
        )}
      </section>

      <section className="plan-range" aria-label={pl.portions.plan.rangeLabel}>
        <label className="plan-range__calendar">
          <svg
            className="plan-range__icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <span className="visually-hidden">{pl.portions.plan.calendar}</span>
          <input
            type="date"
            value={planStartDate}
            onChange={(event) => handlePlanStartChange(event.target.value)}
          />
        </label>
        <span className="plan-range__label">
          {formatPlanRangeLabel(planStartDate, planLengthDays)}
        </span>
        <label className="plan-range__length">
          <span>{pl.portions.plan.lengthLabel}</span>
          <input
            type="number"
            min={1}
            max={31}
            value={planLengthDays}
            onChange={(event) => handlePlanLengthChange(event.target.value)}
          />
        </label>
        <div className="plan-range__actions">
          <button
            type="button"
            className="plan-range__shopping-btn"
            onClick={() => setShoppingOpen(true)}
          >
            {pl.portions.plan.shoppingPreview}
          </button>
          <button
            type="button"
            className="plan-range__icon-btn"
            title={pl.portions.plan.printPdf}
            aria-label={pl.portions.plan.printPdf}
            disabled={printingPdf}
            onClick={() => {
              void handleExportPdf()
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 9V4h10v5M7 15H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="7"
                y="13"
                width="10"
                height="7"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.75"
              />
            </svg>
          </button>
        </div>
      </section>

      <section className="portions-meal-section">
        <div className="portions-meal-row">
          <label className="portions-field portions-field--meal">
            <span>{pl.portions.fields.meal}</span>
            <div className="portions-meal-picker" ref={mealPickerRef}>
              <input
                type="search"
                value={mealQuery}
                disabled={loading || Boolean(error)}
                placeholder={
                  loading ? pl.portions.loadingMeals : pl.portions.placeholders.mealSearch
                }
                onChange={(event) => {
                  setMealQuery(event.target.value)
                  setPickerOpen(true)
                  if (selectedMeal && event.target.value !== selectedMeal.name) {
                    setSelectedMealId(null)
                  }
                }}
                onFocus={() => setPickerOpen(true)}
              />
              {pickerOpen && !loading && !error ? (
                <ul className="portions-meal-picker__list" role="listbox">
                  {filteredMeals.length === 0 ? (
                    <li className="portions-meal-picker__empty">
                      {pl.portions.errors.noMealMatches}
                    </li>
                  ) : (
                    filteredMeals.map((meal) => (
                      <li key={meal.id}>
                        <button type="button" onMouseDown={() => chooseMeal(meal)}>
                          <span>{meal.name}</span>
                          <span className="portions-meal-picker__meta">
                            {pl.meal.categories[meal.mealCategory]} · {pl.meal.types[meal.mealType]}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          </label>
          {selectedMeal ? (
            <button
              type="button"
              className="plan-add-btn"
              title={pl.portions.plan.addToPlan}
              aria-label={pl.portions.plan.addToPlan}
              disabled={!planStartDate || assigningPlan}
              onClick={() => {
                setPlanMessage(null)
                setPlanError(null)
                setSlotPickerOpen(true)
              }}
            >
              +
            </button>
          ) : null}
        </div>

        <div
          className="portions-category-tags"
          role="group"
          aria-label={pl.portions.fields.categoryFilters}
        >
          {MEAL_CATEGORIES.map((category) => {
            const active = categoryFilters.has(category)
            return (
              <button
                key={category}
                type="button"
                className={`portions-tag${active ? ' portions-tag--active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleCategory(category)}
              >
                {pl.meal.categories[category]}
              </button>
            )
          })}
        </div>
      </section>

      {!selectedMeal ? (
        <p className="portions-board__status">{pl.portions.hints.pickMeal}</p>
      ) : personColumns.length === 0 ? (
        <p className="portions-board__status">{pl.portions.hints.selectPeople}</p>
      ) : (
        <>
          <p className="portions-board__meta">
            {pl.meal.types[selectedMeal.mealType]} · {formatNumber(selectedMeal.recipeCalories)}{' '}
            {pl.portions.summary.recipeKcal}
            {isWhole ? (
              <>
                {' '}
                · {pl.portions.summary.plannedDays.replace(
                  '{days}',
                  String(selectedMeal.plannedDays ?? 1),
                )}
                {wholeDailyPotKcal != null ? (
                  <>
                    {' '}
                    ·{' '}
                    {pl.portions.summary.dailyPot.replace(
                      '{kcal}',
                      formatNumber(wholeDailyPotKcal),
                    )}
                  </>
                ) : null}
                {' '}
                · {pl.portions.summary.sharePool} {formatNumber(selectedPeopleDailyTotal)} kcal
              </>
            ) : null}
          </p>

          <div className="portions-layout">
            <aside className="portions-totals-rail" aria-label={pl.portions.summary.prepTotals}>
              <h3>{pl.portions.summary.prepTotals}</h3>
              <ul className="portions-totals-rail__list">
                <li className="portions-totals-rail__list--total">
                  <span className="portions-totals-rail__name">
                    {pl.portions.summary.totalMass}
                  </span>
                  <span className="portions-totals-rail__mass">
                    {formatNumber(prepMassTotals.totalGrams)} {pl.meal.summary.grams}
                  </span>
                </li>
                {prepMassTotals.ingredients.map((item) => (
                  <li key={item.productName + item.sortKey}>
                    <span className="portions-totals-rail__name">{item.productName}</span>
                    <span className="portions-totals-rail__mass">
                      {item.pieces != null && item.pieceUnit
                        ? `${formatNumber(item.pieces)} ${formatCountableUnit(item.pieceUnit, item.pieces)} (${formatNumber(item.grams)} ${pl.meal.summary.grams})`
                        : `${formatNumber(item.grams)} ${pl.meal.summary.grams}`}
                    </span>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="portions-columns">
            {personColumns.map((person) => {
              const portion = portionsByPersonId.get(person.personId) ?? null
              const expectedWholeKcal =
                isWhole &&
                wholeDailyPotKcal != null &&
                selectedPeopleDailyTotal > 0 &&
                person.dailyKcalLimit > 0
                  ? wholeDailyPotKcal * (person.dailyKcalLimit / selectedPeopleDailyTotal)
                  : null
              const kcalTone = portion
                ? isWhole
                  ? expectedWholeKcal != null
                    ? kcalAccuracyTone(portion.totals.calories, String(expectedWholeKcal))
                    : null
                  : kcalAccuracyTone(portion.totals.calories, person.targetKcal)
                : null
              const totalMassGrams = portion
                ? portion.lines.reduce((sum, line) => sum + line.quantityGrams, 0)
                : 0

              return (
                <article key={person.id} className="portion-column">
                  <header className="portion-column__title">
                    <h3>{person.label}</h3>
                    <p className="portion-column__daily">
                      {pl.portions.peoplePanel.dailyLimitHint.replace(
                        '{kcal}',
                        String(person.dailyKcalLimit),
                      )}
                      {' · '}
                      {person.targetKcal
                        ? pl.portions.peoplePanel.mealSlotTarget
                            .replace(
                              '{category}',
                              pl.meal.categories[selectedMeal.mealCategory],
                            )
                            .replace('{kcal}', formatNumber(Number(person.targetKcal)))
                        : pl.portions.peoplePanel.mealSlotTargetMissing.replace(
                            '{category}',
                            pl.meal.categories[selectedMeal.mealCategory],
                          )}
                    </p>
                    {portion ? (
                      <p
                        className={
                          kcalTone
                            ? `portion-column__computed portion-column__computed--${kcalTone}`
                            : 'portion-column__computed'
                        }
                      >
                        {isWhole
                          ? pl.portions.summary.perDayFromPot
                          : pl.portions.summary.fromTemplate}
                        : {formatNumber(portion.totals.calories)} kcal
                        {portion.sharePercent != null
                          ? ` · ${formatNumber(portion.sharePercent)}%`
                          : ''}
                      </p>
                    ) : null}
                  </header>

                  {!portion ? (
                    <p className="portion-column__hint">
                      {isWhole
                        ? pl.portions.hints.missingDailyLimit
                        : pl.portions.hints.missingMealTarget}
                    </p>
                  ) : (
                    <>
                      <dl className="portion-column__totals">
                        <div>
                          <dt>{pl.portions.summary.calories}</dt>
                          <dd>{formatNumber(portion.totals.calories)}</dd>
                        </div>
                        <div>
                          <dt>{pl.portions.summary.protein}</dt>
                          <dd>
                            {formatNumber(portion.totals.protein)} {pl.meal.summary.grams}
                          </dd>
                        </div>
                        <div>
                          <dt>{pl.portions.summary.carbs}</dt>
                          <dd>
                            {formatNumber(portion.totals.carbs)} {pl.meal.summary.grams}
                          </dd>
                        </div>
                        <div>
                          <dt>{pl.portions.summary.fat}</dt>
                          <dd>
                            {formatNumber(portion.totals.fat)} {pl.meal.summary.grams}
                          </dd>
                        </div>
                      </dl>

                      <ul className="portion-column__lines">
                        <li className="portion-line portion-line--total">
                          <div className="portion-line__mass">
                            {formatGramsWhole(totalMassGrams)} {pl.meal.summary.grams}
                          </div>
                          <div className="portion-line__body">
                            <div className="portion-line__title">
                              <strong>{pl.portions.summary.totalMass}</strong>
                            </div>
                          </div>
                        </li>
                        {portion.lines.map((line) => (
                          <li key={line.mealIngredientId} className="portion-line">
                            <div className="portion-line__mass">
                              {formatGramsWhole(line.quantityGrams)} {pl.meal.summary.grams}
                            </div>
                            <div className="portion-line__body">
                              <div className="portion-line__title">
                                <strong>{line.productName}</strong>
                              </div>
                              {line.baseUnit !== 'g' && line.baseUnit !== 'ml' ? (
                                <div className="portion-line__qty">
                                  {formatNumber(line.quantityBase)}{' '}
                                  {formatCountableUnit(line.baseUnit, line.quantityBase)}
                                </div>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </article>
              )
            })}
            </div>
          </div>
        </>
      )}

      <section className="plan-preview" aria-labelledby="plan-preview-title">
        <h2 id="plan-preview-title">{pl.portions.plan.title}</h2>
        {planLoading ? (
          <p className="portions-board__status">{pl.portions.loadingMeals}</p>
        ) : (
          <PlanGrid
            days={planDays}
            entries={planEntries}
            mealsById={mealsById}
            people={planPeople}
            productById={productById}
            onDelete={(entry) => {
              void handleDeletePlanEntry(entry)
            }}
          />
        )}
      </section>

      {selectedMeal ? (
        <PlanSlotPicker
          open={slotPickerOpen}
          meal={selectedMeal}
          days={planDays}
          entries={planEntries}
          assigning={assigningPlan}
          error={planError}
          onClose={() => setSlotPickerOpen(false)}
          onPickDay={(planDate, replaceExisting) => {
            void handleAssignToPlan(planDate, replaceExisting)
          }}
        />
      ) : null}

      <ShoppingListPreview
        open={shoppingOpen}
        rangeLabel={formatPlanRangeLabel(planStartDate, planLengthDays)}
        items={shoppingItems}
        emptyReason={shoppingEmptyReason}
        onClose={() => setShoppingOpen(false)}
      />
    </section>
  )
}
