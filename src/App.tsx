import { useState } from 'react'
import { useAuth } from './features/auth/AuthContext'
import { LoginPage } from './features/auth/LoginPage'
import { MealForm } from './features/meals/MealForm'
import { MealsTable } from './features/meals/MealsTable'
import type { MealResponse } from './features/meals/types'
import { PeoplePage } from './features/people/PeoplePage'
import { PortionsBoard } from './features/portions/PortionsBoard'
import { ProductForm } from './features/products/ProductForm'
import { ProductsTable } from './features/products/ProductsTable'
import type { ProductResponse } from './features/products/types'
import { pl } from './i18n/pl'
import { AppNav, type AppView } from './shared/AppNav'
import { ThemeToggle } from './shared/ThemeToggle'
import { UserMenu } from './shared/UserMenu'
import './App.css'

type Screen = AppView | 'edit' | 'editMeal'

function AppShell() {
  const { user, logout } = useAuth()
  const [screen, setScreen] = useState<Screen>('portions')
  const [tableReloadToken, setTableReloadToken] = useState(0)
  const [mealsReloadToken, setMealsReloadToken] = useState(0)
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null)
  const [editingMeal, setEditingMeal] = useState<MealResponse | null>(null)

  function handleViewChange(next: AppView) {
    setEditingProduct(null)
    setEditingMeal(null)
    setScreen(next)
    if (next === 'table') {
      setTableReloadToken((token) => token + 1)
    }
    if (next === 'mealsTable') {
      setMealsReloadToken((token) => token + 1)
    }
  }

  function handleEdit(product: ProductResponse) {
    setEditingMeal(null)
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

  function handleEditMeal(meal: MealResponse) {
    setEditingProduct(null)
    setEditingMeal(meal)
    setScreen('editMeal')
  }

  function handleEditMealCancel() {
    setEditingMeal(null)
    setScreen('mealsTable')
    setMealsReloadToken((token) => token + 1)
  }

  function handleEditMealSaved() {
    setEditingMeal(null)
    setScreen('mealsTable')
    setMealsReloadToken((token) => token + 1)
  }

  const navView: AppView =
    screen === 'edit' ? 'table' : screen === 'editMeal' ? 'mealsTable' : screen

  return (
    <main className="app-shell">
      {user ? <UserMenu user={user} onLogout={logout} /> : null}
      <ThemeToggle />
      <AppNav activeView={navView} onChange={handleViewChange} />
      {screen === 'portions' ? <PortionsBoard /> : null}
      {screen === 'people' ? <PeoplePage /> : null}
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
      {screen === 'addMeal' ? <MealForm /> : null}
      {screen === 'mealsTable' ? (
        <MealsTable reloadToken={mealsReloadToken} onEdit={handleEditMeal} />
      ) : null}
      {screen === 'editMeal' && editingMeal ? (
        <MealForm
          meal={editingMeal}
          onCancel={handleEditMealCancel}
          onSaved={handleEditMealSaved}
        />
      ) : null}
    </main>
  )
}

function App() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <main className="app-shell app-shell--boot">
        <ThemeToggle />
        <p className="app-boot">{pl.auth.loading}</p>
      </main>
    )
  }

  if (status === 'anonymous') {
    return (
      <>
        <ThemeToggle />
        <LoginPage />
      </>
    )
  }

  return <AppShell />
}

export default App
