import { useCallback, useEffect, useState } from 'react'
import { pl } from '../../i18n/pl'
import { fetchProducts } from './api'
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
}

export function ProductsTable({ reloadToken = 0 }: ProductsTableProps) {
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <section className="products-table-card">
      <header className="products-table-card__header">
        <p className="products-table-card__brand">{pl.appName}</p>
        <h1>{pl.table.title}</h1>
        <p className="products-table-card__subtitle">{pl.table.subtitle}</p>
      </header>

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
