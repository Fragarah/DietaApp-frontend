import { useState } from 'react'
import { ProductForm } from './features/products/ProductForm'
import { ProductsTable } from './features/products/ProductsTable'
import type { ProductResponse } from './features/products/types'
import { AppNav, type AppView } from './shared/AppNav'
import { ThemeToggle } from './shared/ThemeToggle'
import './App.css'

type Screen = AppView | 'edit'

function App() {
  const [screen, setScreen] = useState<Screen>('add')
  const [tableReloadToken, setTableReloadToken] = useState(0)
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null)

  function handleViewChange(next: AppView) {
    setEditingProduct(null)
    setScreen(next)
    if (next === 'table') {
      setTableReloadToken((token) => token + 1)
    }
  }

  function handleEdit(product: ProductResponse) {
    setEditingProduct(product)
    setScreen('edit')
  }

  function handleEditCancel() {
    setEditingProduct(null)
    setScreen('table')
    setTableReloadToken((token) => token + 1)
  }

  function handleEditSaved() {
    setEditingProduct(null)
    setScreen('table')
    setTableReloadToken((token) => token + 1)
  }

  const navView: AppView = screen === 'edit' ? 'table' : screen

  return (
    <main className="app-shell">
      <ThemeToggle />
      <AppNav activeView={navView} onChange={handleViewChange} />
      {screen === 'add' ? <ProductForm /> : null}
      {screen === 'table' ? (
        <ProductsTable reloadToken={tableReloadToken} onEdit={handleEdit} />
      ) : null}
      {screen === 'edit' && editingProduct ? (
        <ProductForm
          product={editingProduct}
          onCancel={handleEditCancel}
          onSaved={handleEditSaved}
        />
      ) : null}
    </main>
  )
}

export default App
