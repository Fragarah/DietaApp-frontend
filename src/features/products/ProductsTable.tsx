import { useCallback, useEffect, useMemo, useState } from 'react'
import { pl } from '../../i18n/pl'
import { deleteProduct, fetchCategories, fetchProducts } from './api'
import type { Category, ProductResponse } from './types'
import './ProductsTable.css'

type NameSort = 'asc' | 'desc'

function formatNumber(value: number): string {
  return Number(value).toLocaleString('pl-PL', {
    maximumFractionDigits: 2,
  })
}

function formatDefaultPortion(product: ProductResponse): string {
  const portion = product.portions.find((item) => item.isDefault) ?? product.portions[0]
  if (!portion) {
    return '—'
  }
  return `${portion.unitName} (${formatNumber(portion.gramWeight)} g)`
}

function sortProductsByName(products: ProductResponse[], direction: NameSort): ProductResponse[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...products].sort(
    (a, b) => factor * a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }),
  )
}

function sortCategoriesByName(categories: Category[]): Category[] {
  return [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }),
  )
}

type ProductsTableProps = {
  reloadToken?: number
  onEdit?: (product: ProductResponse) => void
}

export function ProductsTable({ reloadToken = 0, onEdit }: ProductsTableProps) {
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [productToDelete, setProductToDelete] = useState<ProductResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [nameSort, setNameSort] = useState<NameSort>('asc')
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('')

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [productData, categoryData] = await Promise.all([fetchProducts(), fetchCategories()])
      setProducts(productData)
      setCategories(sortCategoriesByName(categoryData))
    } catch {
      setError(pl.errors.loadProducts)
      setProducts([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts, reloadToken])

  const filteredProducts = useMemo(() => {
    const filtered =
      categoryFilter === ''
        ? products
        : products.filter((product) => product.categoryId === categoryFilter)
    return sortProductsByName(filtered, nameSort)
  }, [products, categoryFilter, nameSort])

  async function confirmDelete() {
    if (!productToDelete) {
      return
    }

    setDeleting(true)
    setError(null)
    try {
      await deleteProduct(productToDelete.id)
      setProducts((current) => current.filter((product) => product.id !== productToDelete.id))
      setSuccessMessage(pl.table.deleteSuccess)
      setProductToDelete(null)
    } catch {
      setError(pl.errors.deleteFailed)
      setProductToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  function toggleNameSort() {
    setNameSort((current) => (current === 'asc' ? 'desc' : 'asc'))
  }

  return (
    <section className="products-table-card">
      <header className="products-table-card__header">
        <p className="products-table-card__brand">{pl.appName}</p>
        <h1>{pl.table.title}</h1>
        <p className="products-table-card__subtitle">{pl.table.subtitle}</p>
      </header>

      {!loading && categories.length > 0 ? (
        <div
          className="products-table-filters__chips"
          role="group"
          aria-label={pl.table.categoryFilterLabel}
        >
          <button
            type="button"
            className={`products-chip${categoryFilter === '' ? ' products-chip--active' : ''}`}
            onClick={() => setCategoryFilter('')}
          >
            {pl.table.allCategories}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`products-chip${
                categoryFilter === category.id ? ' products-chip--active' : ''
              }`}
              onClick={() => setCategoryFilter(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      {successMessage ? (
        <p className="products-table-card__banner products-table-card__banner--success" role="status">
          {successMessage}
        </p>
      ) : null}

      {error ? (
        <p className="products-table-card__banner products-table-card__banner--error" role="alert">
          {error}
          <button type="button" className="btn btn--secondary" onClick={() => void loadProducts()}>
            {pl.actions.retry}
          </button>
        </p>
      ) : null}

      {loading ? <p className="products-table-card__status">{pl.table.loading}</p> : null}

      {!loading && !error && products.length === 0 ? (
        <p className="products-table-card__status">{pl.table.empty}</p>
      ) : null}

      {!loading && products.length > 0 && filteredProducts.length === 0 ? (
        <p className="products-table-card__status">{pl.table.noMatches}</p>
      ) : null}

      {!loading && filteredProducts.length > 0 ? (
        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className="products-table__sort"
                    onClick={toggleNameSort}
                    aria-label={
                      nameSort === 'asc' ? pl.table.sortNameDesc : pl.table.sortNameAsc
                    }
                    title={nameSort === 'asc' ? pl.table.sortNameDesc : pl.table.sortNameAsc}
                  >
                    <span>{pl.table.columns.name}</span>
                    <span className="products-table__sort-icon" aria-hidden="true">
                      {nameSort === 'asc' ? '↑' : '↓'}
                    </span>
                  </button>
                </th>
                <th>{pl.table.columns.category}</th>
                <th>{pl.table.columns.baseUnit}</th>
                <th>{pl.table.columns.calories}</th>
                <th>{pl.table.columns.protein}</th>
                <th>{pl.table.columns.carbs}</th>
                <th>{pl.table.columns.fat}</th>
                <th>{pl.table.columns.defaultPortion}</th>
                <th className="products-table__actions-col">{pl.table.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.categoryName}</td>
                  <td>{product.baseUnit}</td>
                  <td>{formatNumber(product.caloriesPer100)}</td>
                  <td>{formatNumber(product.proteinPer100)}</td>
                  <td>{formatNumber(product.carbsPer100)}</td>
                  <td>{formatNumber(product.fatPer100)}</td>
                  <td>{formatDefaultPortion(product)}</td>
                  <td className="products-table__actions-col">
                    <div className="products-table__actions">
                      <button
                        type="button"
                        className="btn-edit"
                        aria-label={`${pl.actions.editProduct}: ${product.name}`}
                        title={pl.actions.editProduct}
                        onClick={() => onEdit?.(product)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        aria-label={`${pl.actions.deleteProduct}: ${product.name}`}
                        title={pl.actions.deleteProduct}
                        onClick={() => {
                          setSuccessMessage(null)
                          setProductToDelete(product)
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {productToDelete ? (
        <div
          className="confirm-dialog-backdrop"
          role="presentation"
          onClick={() => {
            if (!deleting) {
              setProductToDelete(null)
            }
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-message"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-dialog-title">{pl.table.deleteConfirmTitle}</h2>
            <p id="delete-dialog-message">
              {pl.table.deleteConfirmMessage.replace('{name}', productToDelete.name)}
            </p>
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="btn btn--danger"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? pl.actions.deleting : pl.table.deleteConfirmYes}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={deleting}
                onClick={() => setProductToDelete(null)}
              >
                {pl.table.deleteConfirmNo}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
