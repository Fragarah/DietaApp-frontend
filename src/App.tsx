import { useState } from 'react'
import { ProductForm } from './features/products/ProductForm'
import { ProductsTable } from './features/products/ProductsTable'
import { AppNav, type AppView } from './shared/AppNav'
import { ThemeToggle } from './shared/ThemeToggle'
import './App.css'

function App() {
  const [view, setView] = useState<AppView>('add')
  const [tableReloadToken, setTableReloadToken] = useState(0)

  function handleViewChange(next: AppView) {
    setView(next)
    if (next === 'table') {
      setTableReloadToken((token) => token + 1)
    }
  }

  return (
    <main className="app-shell">
      <ThemeToggle />
      <AppNav activeView={view} onChange={handleViewChange} />
      {view === 'add' ? <ProductForm /> : <ProductsTable reloadToken={tableReloadToken} />}
    </main>
  )
}

export default App
