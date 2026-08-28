import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ProductResponse } from '../products/types'
import './ProductSearchField.css'

type ProductSearchFieldProps = {
  products: ProductResponse[]
  value: string
  onChange: (productId: string) => void
  disabled?: boolean
  placeholder: string
  loadingLabel: string
  emptyLabel: string
  loading?: boolean
  label: string
  error?: string
}

function normalize(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function ProductSearchField({
  products,
  value,
  onChange,
  disabled = false,
  placeholder,
  loadingLabel,
  emptyLabel,
  loading = false,
  label,
  error,
}: ProductSearchFieldProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = products.find((product) => String(product.id) === value) ?? null

  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setQuery(selected?.name ?? '')
  }, [selected?.name, value])

  const suggestions = useMemo(() => {
    const needle = normalize(query)
    if (!needle) {
      return products.slice(0, 12)
    }
    return products
      .filter((product) => normalize(product.name).includes(needle))
      .slice(0, 12)
  }, [products, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        if (selected) {
          setQuery(selected.name)
        }
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [selected])

  function choose(product: ProductResponse) {
    onChange(String(product.id))
    setQuery(product.name)
    setOpen(false)
  }

  function clearSelection() {
    onChange('')
    setQuery('')
    setOpen(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true)
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
      if (selected) {
        setQuery(selected.name)
      }
      return
    }

    if (!open || suggestions.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const product = suggestions[activeIndex]
      if (product) {
        choose(product)
      }
    }
  }

  return (
    <div className="field product-search" ref={rootRef}>
      <span>{label}</span>
      <div className="product-search__control">
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && suggestions[activeIndex]
              ? `${listId}-option-${suggestions[activeIndex].id}`
              : undefined
          }
          autoComplete="off"
          disabled={disabled || loading}
          placeholder={loading ? loadingLabel : placeholder}
          value={query}
          onChange={(event) => {
            const next = event.target.value
            setQuery(next)
            setOpen(true)
            if (selected && next !== selected.name) {
              onChange('')
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <button
            type="button"
            className="product-search__clear"
            onClick={clearSelection}
            disabled={disabled || loading}
            aria-label="Wyczyść wybór"
          >
            ×
          </button>
        ) : null}
      </div>

      {open && !disabled && !loading ? (
        <ul className="product-search__list" id={listId} role="listbox">
          {suggestions.length === 0 ? (
            <li className="product-search__empty">{emptyLabel}</li>
          ) : (
            suggestions.map((product, index) => (
              <li key={product.id} role="presentation">
                <button
                  type="button"
                  id={`${listId}-option-${product.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`product-search__option${
                    index === activeIndex ? ' product-search__option--active' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(product)}
                >
                  <span>{product.name}</span>
                  <span className="product-search__meta">
                    {product.caloriesPer100} kcal / 100 {product.baseUnit}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {error ? <span className="field__error">{error}</span> : null}
    </div>
  )
}
