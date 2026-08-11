import { useCallback, useEffect, useState } from 'react'
import { pl } from '../../i18n/pl'
import { deleteProduct, fetchProducts } from './api'
import type { ProductResponse } from './types'
import './ProductsTable.css'

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

type ProductsTableProps = {
  reloadToken?: number
  onEdit?: (product: ProductResponse) => void
}

export function ProductsTable({ reloadToken = 0, onEdit }: ProductsTableProps) {
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [productToDelete, setProductToDelete] = useState<ProductResponse | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProducts()
      setProducts(data)
    } catch {
      setError(pl.errors.loadProducts)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts, reloadToken])

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

  return (
    <section className="products-table-card">
      <header className="products-table-card__header">
        <p className="products-table-card__brand">{pl.appName}</p>
        <h1>{pl.table.title}</h1>
        <p className="products-table-card__subtitle">{pl.table.subtitle}</p>
      </header>

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

      {!loading && products.length > 0 ? (
        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th>{pl.table.columns.name}</th>
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
              {products.map((product) => (
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
