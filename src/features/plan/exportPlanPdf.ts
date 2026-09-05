import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { pl } from '../../i18n/pl'
import { formatCountableUnit } from '../../i18n/plCount'
import type { MealResponse } from '../meals/types'
import type { PersonResponse } from '../people/types'
import {
  buildPersonColumn,
  computePortionsForPeople,
  type ProductLookup,
} from '../portions/portionMath'
import { getDefaultPortion, isCountableUnit } from '../products/types'
import { formatPlanDayLabel, formatPlanRangeLabel } from './settings'
import type { ShoppingListItem } from './shoppingList'
import { PLAN_SLOT_CATEGORIES, type MealPlanEntry } from './types'

const FONT_REGULAR = 'NotoSans'
const FONT_BOLD = 'NotoSans'
const FONT_ITALIC = 'NotoSans'
const INK = '#1a221c'
const MUTED = '#5a655c'
const RULE = '#c8d0c9'
const ACCENT = '#3d6b52'

/** Od tej liczby pozycji lista zakupów idzie w 2 kolumnach. */
const SHOPPING_TWO_COL_THRESHOLD = 8
const MARGIN_X = 12

let fontCache: { regular: string; bold: string; italic: string } | null = null

export type PlanPdfInput = {
  planStartDate: string
  planLengthDays: number
  days: string[]
  entries: MealPlanEntry[]
  mealsById: Map<number, MealResponse>
  people: PersonResponse[]
  productById: ProductLookup
  shoppingItems: ShoppingListItem[]
}

type ShoppingLine =
  | { kind: 'category'; label: string }
  | { kind: 'item'; label: string; qty: string }

type DinnerRecipe = {
  mealId: number
  name: string
  notes: string | null
  dates: string[]
}

type PlanCellContent = {
  name: string
  notes: string | null
  ingredients: string[]
}

type PlanTableCell = {
  content: string
  planCell: PlanCellContent
}

export async function exportPlanPdf(input: PlanPdfInput): Promise<void> {
  const fonts = await loadFonts()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.addFileToVFS('NotoSans-Regular.ttf', fonts.regular)
  doc.addFileToVFS('NotoSans-Bold.ttf', fonts.bold)
  doc.addFileToVFS('NotoSans-Italic.ttf', fonts.italic)
  doc.addFont('NotoSans-Regular.ttf', FONT_REGULAR, 'normal')
  doc.addFont('NotoSans-Bold.ttf', FONT_BOLD, 'bold')
  doc.addFont('NotoSans-Italic.ttf', FONT_ITALIC, 'italic')

  const range = formatPlanRangeLabel(input.planStartDate, input.planLengthDays)

  drawPlanPage(doc, input, range)
  drawShoppingPage(doc, input, range)

  const dinners = collectDinnerRecipes(input.entries, input.mealsById)
  for (const dinner of dinners) {
    doc.addPage('a4', 'portrait')
    drawRecipePage(doc, dinner, input)
  }

  const fileName = `plan-diety-${input.planStartDate}_${input.planLengthDays}d.pdf`
  doc.save(fileName)
}

async function loadFonts(): Promise<{ regular: string; bold: string; italic: string }> {
  if (fontCache) {
    return fontCache
  }
  const [regularBuf, boldBuf, italicBuf] = await Promise.all([
    fetch('/fonts/NotoSans-Regular.ttf').then((r) => {
      if (!r.ok) {
        throw new Error('Brak czcionki NotoSans-Regular')
      }
      return r.arrayBuffer()
    }),
    fetch('/fonts/NotoSans-Bold.ttf').then((r) => {
      if (!r.ok) {
        throw new Error('Brak czcionki NotoSans-Bold')
      }
      return r.arrayBuffer()
    }),
    fetch('/fonts/NotoSans-Italic.ttf').then((r) => {
      if (!r.ok) {
        throw new Error('Brak czcionki NotoSans-Italic')
      }
      return r.arrayBuffer()
    }),
  ])
  fontCache = {
    regular: arrayBufferToBase64(regularBuf),
    bold: arrayBufferToBase64(boldBuf),
    italic: arrayBufferToBase64(italicBuf),
  }
  return fontCache
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function drawPageHeader(doc: jsPDF, title: string, subtitle: string): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFont(FONT_BOLD, 'bold')
  doc.setFontSize(14)
  doc.setTextColor(INK)
  doc.text(title, MARGIN_X, 14)

  doc.setDrawColor(ACCENT)
  doc.setLineWidth(0.55)
  doc.line(MARGIN_X, 16, MARGIN_X + 40, 16)

  doc.setFont(FONT_REGULAR, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text(subtitle, MARGIN_X, 21.5)

  doc.setDrawColor(RULE)
  doc.setLineWidth(0.2)
  doc.line(MARGIN_X, 23.5, pageWidth - MARGIN_X, 23.5)
}

function drawPlanPage(doc: jsPDF, input: PlanPdfInput, range: string): void {
  const peopleOrder = input.people.map((person) => person.name).join('/')
  const planTitle =
    peopleOrder.length > 0
      ? `${pl.portions.plan.pdfPlanTitle} (${peopleOrder})`
      : pl.portions.plan.pdfPlanTitle
  drawPageHeader(doc, planTitle, range)

  const entryMap = new Map(
    input.entries.map((entry) => [`${entry.planDate}|${entry.mealCategory}`, entry] as const),
  )
  const selectedPeopleDailyTotal = input.people.reduce(
    (sum, person) => sum + Number(person.dailyKcalLimit),
    0,
  )

  const head = [
    pl.portions.plan.pdfDayColumn,
    ...PLAN_SLOT_CATEGORIES.map((category) => pl.meal.categories[category]),
  ]

  const body = input.days.map((date) => [
    formatPlanDayLabel(date),
    ...PLAN_SLOT_CATEGORIES.map((category) => {
      const entry = entryMap.get(`${date}|${category}`)
      if (!entry) {
        return pl.portions.plan.pdfEmptyCell
      }
      return buildPlanTableCell(
        entry,
        input.mealsById.get(entry.mealId) ?? null,
        input.people,
        selectedPeopleDailyTotal,
        input.productById,
      )
    }),
  ])

  autoTable(doc, {
    startY: 26,
    head: [head],
    body,
    theme: 'grid',
    styles: {
      font: FONT_REGULAR,
      fontStyle: 'normal',
      fontSize: 6.5,
      textColor: INK,
      lineColor: RULE,
      lineWidth: 0.15,
      cellPadding: { top: 1.4, right: 1.3, bottom: 1.4, left: 1.3 },
      valign: 'top',
      overflow: 'linebreak',
      minCellHeight: 8,
      fillColor: [255, 255, 255],
    },
    headStyles: {
      font: FONT_BOLD,
      fontStyle: 'bold',
      fillColor: [255, 255, 255],
      textColor: INK,
      halign: 'center',
      valign: 'middle',
      fontSize: 8,
      cellPadding: 1.6,
      lineWidth: 0.25,
      lineColor: INK,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 24, valign: 'middle', fontSize: 7 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index === 0) {
        return
      }
      data.cell.styles.halign = 'left'
      data.cell.styles.fontSize = 6
      const raw = data.cell.raw
      if (isPlanTableCell(raw)) {
        ;(data.cell as { __planCell?: PlanCellContent }).__planCell = raw.planCell
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index === 0) {
        return
      }
      const planCell = (data.cell as { __planCell?: PlanCellContent }).__planCell
      if (!planCell) {
        return
      }
      drawFormattedPlanCell(doc, data.cell.x, data.cell.y, data.cell.width, data.cell.height, planCell)
    },
    margin: { left: 8, right: 8, top: 10, bottom: 10 },
  })
}

function isPlanTableCell(value: unknown): value is PlanTableCell {
  return (
    typeof value === 'object' &&
    value != null &&
    'planCell' in value &&
    'content' in value
  )
}

function buildPlanTableCell(
  entry: MealPlanEntry,
  meal: MealResponse | null,
  people: PersonResponse[],
  selectedPeopleDailyTotal: number,
  productById: ProductLookup,
): PlanTableCell {
  const isDinner = entry.mealCategory === 'OBIAD'
  const notes =
    !isDinner && meal?.notes?.trim()
      ? meal.notes.trim()
      : null
  const ingredients = isDinner
    ? []
    : buildIngredientWeightLines(entry, meal, people, selectedPeopleDailyTotal, productById)

  const planCell: PlanCellContent = {
    name: entry.mealName,
    notes,
    ingredients,
  }

  const heightLines = [planCell.name, ...planCell.ingredients]
  if (planCell.notes) {
    heightLines.push(planCell.notes)
  }

  return {
    content: heightLines.join('\n'),
    planCell,
  }
}

function buildIngredientWeightLines(
  entry: MealPlanEntry,
  meal: MealResponse | null,
  people: PersonResponse[],
  selectedPeopleDailyTotal: number,
  productById: ProductLookup,
): string[] {
  const ingredients = meal?.ingredients ?? []
  if (ingredients.length === 0) {
    return []
  }
  if (people.length === 0 || !meal) {
    return ingredients.map((ingredient) => ingredient.productName)
  }

  const personColumns = people.map((person) =>
    buildPersonColumn(person, meal.mealCategory ?? entry.mealCategory),
  )
  const portions = computePortionsForPeople(
    meal,
    personColumns,
    selectedPeopleDailyTotal,
    productById,
  )

  return ingredients.map((ingredient) => {
    const grams = personColumns.map((person) => {
      const portion = portions.get(person.personId)
      const line = portion?.lines.find((item) => item.productId === ingredient.productId)
      return line != null ? `${Math.round(line.quantityGrams)}g` : '—'
    })
    return `${ingredient.productName}: ${grams.join('/')}`
  })
}

function drawFormattedPlanCell(
  doc: jsPDF,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  planCell: PlanCellContent,
): void {
  const padX = 1.3
  const padY = 1.4
  const maxWidth = cellWidth - padX * 2
  let y = cellY + padY + 2.2

  // Zakryj domyślny tekst autoTable (jednolity styl).
  doc.setFillColor(255, 255, 255)
  doc.rect(cellX + 0.2, cellY + 0.2, cellWidth - 0.4, cellHeight - 0.4, 'F')

  doc.setFont(FONT_BOLD, 'bold')
  doc.setFontSize(6.2)
  doc.setTextColor(INK)
  const nameLines = doc.splitTextToSize(planCell.name, maxWidth) as string[]
  for (const line of nameLines) {
    if (y > cellY + cellHeight - 1.5) {
      return
    }
    doc.text(line, cellX + padX, y)
    y += 3.1
  }

  if (planCell.ingredients.length > 0) {
    y += 0.5
    doc.setFont(FONT_REGULAR, 'normal')
    doc.setFontSize(5.4)
    doc.setTextColor(INK)
    for (const ingredient of planCell.ingredients) {
      const ingredientLines = doc.splitTextToSize(ingredient, maxWidth) as string[]
      for (const line of ingredientLines) {
        if (y > cellY + cellHeight - 1.5) {
          return
        }
        doc.text(line, cellX + padX, y)
        y += 2.8
      }
    }
  }

  if (planCell.notes) {
    y += 0.6
    doc.setFont(FONT_ITALIC, 'italic')
    doc.setFontSize(5.4)
    doc.setTextColor(MUTED)
    const noteLines = doc.splitTextToSize(planCell.notes, maxWidth) as string[]
    for (const line of noteLines) {
      if (y > cellY + cellHeight - 1.5) {
        return
      }
      doc.text(line, cellX + padX, y)
      y += 2.8
    }
  }
}

function drawShoppingPage(doc: jsPDF, input: PlanPdfInput, range: string): void {
  doc.addPage('a4', 'portrait')
  drawPageHeader(doc, pl.portions.plan.pdfShoppingTitle, range)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxY = pageHeight - 12
  const startY = 28

  if (input.shoppingItems.length === 0) {
    doc.setFont(FONT_REGULAR, 'normal')
    doc.setFontSize(11)
    doc.setTextColor(MUTED)
    doc.text(pl.portions.plan.pdfShoppingEmpty, MARGIN_X, startY + 6)
    return
  }

  const lines = buildShoppingLines(input.shoppingItems)
  const useTwoCols = input.shoppingItems.length >= SHOPPING_TWO_COL_THRESHOLD
  const gap = 8
  const colWidth = useTwoCols
    ? (pageWidth - MARGIN_X * 2 - gap) / 2
    : pageWidth - MARGIN_X * 2

  if (!useTwoCols) {
    drawShoppingColumn(doc, lines, MARGIN_X, startY, colWidth, maxY)
    return
  }

  const splitAt = splitLinesForTwoColumns(lines)
  drawShoppingColumn(doc, lines.slice(0, splitAt), MARGIN_X, startY, colWidth, maxY)
  drawShoppingColumn(
    doc,
    lines.slice(splitAt),
    MARGIN_X + colWidth + gap,
    startY,
    colWidth,
    maxY,
  )
}

function buildShoppingLines(items: ShoppingListItem[]): ShoppingLine[] {
  const lines: ShoppingLine[] = []
  for (const group of groupByCategory(items)) {
    lines.push({ kind: 'category', label: group.category })
    for (const item of group.items) {
      lines.push({
        kind: 'item',
        label: item.productName,
        qty: formatShoppingQty(item),
      })
    }
  }
  return lines
}

function splitLinesForTwoColumns(lines: ShoppingLine[]): number {
  if (lines.length <= 1) {
    return lines.length
  }
  const weights = lines.map((line) => (line.kind === 'category' ? 1.35 : 1))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let acc = 0
  let splitAt = Math.ceil(lines.length / 2)
  for (let i = 0; i < lines.length; i++) {
    acc += weights[i]!
    if (acc >= total / 2) {
      splitAt = i + 1
      if (splitAt < lines.length && lines[splitAt]?.kind === 'item') {
        let back = splitAt - 1
        while (back > 0 && lines[back]?.kind !== 'category') {
          back -= 1
        }
        if (back > 0) {
          splitAt = back
        }
      }
      break
    }
  }
  return Math.max(1, Math.min(splitAt, lines.length - 1))
}

function drawShoppingColumn(
  doc: jsPDF,
  lines: ShoppingLine[],
  x: number,
  startY: number,
  colWidth: number,
  maxY: number,
): void {
  let y = startY
  const qtyWidth = Math.min(32, colWidth * 0.36)
  const nameWidth = colWidth - qtyWidth - 2

  for (const line of lines) {
    if (line.kind === 'category') {
      if (y + 6 > maxY) {
        break
      }
      y += 2
      doc.setFont(FONT_BOLD, 'bold')
      doc.setFontSize(10)
      doc.setTextColor(ACCENT)
      doc.text(line.label, x, y)
      doc.setDrawColor(RULE)
      doc.setLineWidth(0.25)
      doc.line(x, y + 1.4, x + colWidth, y + 1.4)
      y += 5.5
      continue
    }

    if (y + 5 > maxY) {
      break
    }

    doc.setFont(FONT_REGULAR, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(INK)
    const nameLines = doc.splitTextToSize(line.label, nameWidth) as string[]
    const rowHeight = Math.max(4.5, nameLines.length * 3.8)
    if (y + rowHeight > maxY) {
      break
    }
    doc.text(nameLines, x, y)
    doc.setFont(FONT_BOLD, 'bold')
    doc.setFontSize(9)
    doc.text(line.qty, x + colWidth, y, { align: 'right' })
    y += rowHeight
  }
}

function drawRecipePage(doc: jsPDF, dinner: DinnerRecipe, input: PlanPdfInput): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN_X * 2
  const maxY = pageHeight - 14
  let y = 16

  const peopleOrder = input.people.map((person) => person.name).join('/')
  const title =
    peopleOrder.length > 0 ? `${dinner.name} (${peopleOrder})` : dinner.name

  doc.setFont(FONT_BOLD, 'bold')
  doc.setFontSize(18)
  doc.setTextColor(INK)
  const titleLines = doc.splitTextToSize(title, contentWidth) as string[]
  doc.text(titleLines, MARGIN_X, y)
  y += titleLines.length * 7.5 + 2

  doc.setDrawColor(ACCENT)
  doc.setLineWidth(0.55)
  doc.line(MARGIN_X, y, MARGIN_X + 36, y)
  y += 8

  const meal = input.mealsById.get(dinner.mealId) ?? null
  const gap = 10
  const colWidth = (contentWidth - gap) / 2
  const leftX = MARGIN_X
  const rightX = MARGIN_X + colWidth + gap

  const ingredientTotals = buildRecipeIngredientTotals(meal, input.people, input.productById)
  const portionLines = buildRecipePortionLines(meal, input.people, input.productById)

  const leftEnd = drawRecipeNamedColumn(
    doc,
    leftX,
    y,
    colWidth,
    maxY - 40,
    pl.portions.plan.pdfIngredientsHeading,
    ingredientTotals,
  )
  const rightEnd = drawRecipeNamedColumn(
    doc,
    rightX,
    y,
    colWidth,
    maxY - 40,
    pl.portions.plan.pdfPortionsHeading,
    portionLines,
  )

  y = Math.max(leftEnd, rightEnd) + 4

  doc.setDrawColor(RULE)
  doc.setLineWidth(0.25)
  doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y)
  y += 8

  doc.setFont(FONT_BOLD, 'bold')
  doc.setFontSize(12)
  doc.setTextColor(INK)
  doc.text(pl.portions.plan.pdfRecipeHeading, MARGIN_X, y)
  y += 7

  const notes = dinner.notes?.trim() || pl.portions.plan.pdfNoNotes
  doc.setFont(FONT_REGULAR, 'normal')
  doc.setFontSize(11)
  doc.setTextColor(INK)
  const noteLines = doc.splitTextToSize(notes, contentWidth) as string[]
  const lineHeight = 5.5
  for (const line of noteLines) {
    if (y + lineHeight > maxY) {
      break
    }
    doc.text(line, MARGIN_X, y)
    y += lineHeight
  }
}

function drawRecipeNamedColumn(
  doc: jsPDF,
  x: number,
  startY: number,
  colWidth: number,
  maxY: number,
  heading: string,
  lines: string[],
): number {
  let y = startY

  doc.setFont(FONT_BOLD, 'bold')
  doc.setFontSize(12)
  doc.setTextColor(INK)
  doc.text(heading, x, y)
  y += 7

  if (lines.length === 0) {
    doc.setFont(FONT_REGULAR, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(MUTED)
    const empty = doc.splitTextToSize(pl.portions.plan.pdfPortionsEmpty, colWidth) as string[]
    doc.text(empty, x, y)
    return y + empty.length * 4.2
  }

  doc.setFont(FONT_REGULAR, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(INK)
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, colWidth) as string[]
    for (const part of wrapped) {
      if (y + 5 > maxY) {
        return y
      }
      doc.text(part, x, y)
      y += 5
    }
  }
  return y
}

function buildRecipePortionLines(
  meal: MealResponse | null,
  people: PersonResponse[],
  productById: ProductLookup,
): string[] {
  if (!meal || people.length === 0) {
    return []
  }

  const selectedPeopleDailyTotal = people.reduce(
    (sum, person) => sum + Number(person.dailyKcalLimit),
    0,
  )
  const personColumns = people.map((person) =>
    buildPersonColumn(person, meal.mealCategory),
  )
  const portions = computePortionsForPeople(
    meal,
    personColumns,
    selectedPeopleDailyTotal,
    productById,
  )

  const lines: string[] = []
  for (const ingredient of meal.ingredients ?? []) {
    const grams = personColumns.map((person) => {
      const portion = portions.get(person.personId)
      const line = portion?.lines.find((item) => item.productId === ingredient.productId)
      return line != null ? `${Math.round(line.quantityGrams)}g` : '—'
    })
    lines.push(`${ingredient.productName}: ${grams.join('/')}`)
  }
  return lines
}

/**
 * Suma porcji zaznaczonych osób × liczba dni (WHOLE: plannedDays, inaczej 1).
 */
function buildRecipeIngredientTotals(
  meal: MealResponse | null,
  people: PersonResponse[],
  productById: ProductLookup,
): string[] {
  if (!meal || people.length === 0) {
    return []
  }

  const days =
    meal.mealType === 'WHOLE' && meal.plannedDays != null && meal.plannedDays >= 1
      ? meal.plannedDays
      : 1

  const selectedPeopleDailyTotal = people.reduce(
    (sum, person) => sum + Number(person.dailyKcalLimit),
    0,
  )
  const personColumns = people.map((person) =>
    buildPersonColumn(person, meal.mealCategory),
  )
  const portions = computePortionsForPeople(
    meal,
    personColumns,
    selectedPeopleDailyTotal,
    productById,
  )

  const lines: string[] = []
  for (const ingredient of meal.ingredients ?? []) {
    let totalGrams = 0
    for (const person of personColumns) {
      const portion = portions.get(person.personId)
      const line = portion?.lines.find((item) => item.productId === ingredient.productId)
      if (line) {
        totalGrams += line.quantityGrams
      }
    }
    totalGrams *= days

    const product = productById.get(ingredient.productId)
    const defaultPortion = product ? getDefaultPortion(product) : null
    const countable =
      isCountableUnit(ingredient.baseUnit ?? '') ||
      Boolean(
        defaultPortion &&
          isCountableUnit(defaultPortion.unitName) &&
          defaultPortion.gramWeight > 0,
      )

    if (
      countable &&
      defaultPortion &&
      isCountableUnit(defaultPortion.unitName) &&
      defaultPortion.gramWeight > 0
    ) {
      const pieces = totalGrams / defaultPortion.gramWeight
      lines.push(
        `${ingredient.productName}: ${Math.round(pieces).toLocaleString('pl-PL')} ${formatCountableUnit(defaultPortion.unitName, pieces)} (${Math.round(totalGrams).toLocaleString('pl-PL')} g)`,
      )
    } else {
      lines.push(`${ingredient.productName}: ${Math.round(totalGrams).toLocaleString('pl-PL')} g`)
    }
  }
  return lines
}

function groupByCategory(
  items: ShoppingListItem[],
): { category: string; items: ShoppingListItem[] }[] {
  const map = new Map<string, ShoppingListItem[]>()
  for (const item of items) {
    const category = item.categoryName.trim() || pl.portions.plan.pdfOtherCategory
    const list = map.get(category) ?? []
    list.push(item)
    map.set(category, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pl'))
    .map(([category, groupItems]) => ({ category, items: groupItems }))
}

function formatShoppingQty(item: ShoppingListItem): string {
  const grams = `${Math.round(item.grams).toLocaleString('pl-PL')} g`
  if (item.pieces != null && item.pieceUnit) {
    const pieces = Math.round(item.pieces)
    return `${pieces.toLocaleString('pl-PL')} ${formatCountableUnit(item.pieceUnit, pieces)} (${grams})`
  }
  return grams
}

function collectDinnerRecipes(
  entries: MealPlanEntry[],
  mealsById: Map<number, MealResponse>,
): DinnerRecipe[] {
  const order: number[] = []
  const byId = new Map<number, DinnerRecipe>()

  for (const entry of entries) {
    if (entry.mealCategory !== 'OBIAD') {
      continue
    }
    const meal = mealsById.get(entry.mealId)
    const existing = byId.get(entry.mealId)
    if (existing) {
      if (!existing.dates.includes(entry.planDate)) {
        existing.dates.push(entry.planDate)
      }
      continue
    }
    order.push(entry.mealId)
    byId.set(entry.mealId, {
      mealId: entry.mealId,
      name: meal?.name ?? entry.mealName,
      notes: meal?.notes ?? null,
      dates: [entry.planDate],
    })
  }

  return order.map((id) => byId.get(id)!).filter(Boolean)
}
