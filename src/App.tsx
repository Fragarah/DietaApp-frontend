import { useState, type ReactNode } from 'react'
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

/** Widoki nawigacji trzymane w pamięci po pierwszym wejściu (do odświeżenia strony). */
type KeepAliveView = AppView

function KeepAliveScreen({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <div className="app-screen" hidden={!active} aria-hidden={!active}>
      {children}
    </div>
  )
}

function AppShell() {
  const { user, logout } = useAuth()
  const [screen, setScreen] = useState<Screen>('portions')
  const [mountedViews, setMountedViews] = useState<Set<KeepAliveView>>(
    () => new Set<KeepAliveView>(['portions']),
  )
  const [tableReloadToken, setTableReloadToken] = useState(0)
  const [mealsReloadToken, setMealsReloadToken] = useState(0)
  const [portionsReloadToken, setPortionsReloadToken] = useState(0)
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null)
  const [editingMeal, setEditingMeal] = useState<MealResponse | null>(null)

  function ensureMounted(view: KeepAliveView) {
    setMountedViews((current) => {
      if (current.has(view)) {
        return current
      }
      const next = new Set(current)
      next.add(view)
      return next
    })
  }

  function handleViewChange(next: AppView) {
    setEditingProduct(null)
    setEditingMeal(null)
    ensureMounted(next)
    setScreen(next)
    if (next === 'table') {
      setTableReloadToken((token) => token + 1)
    }
    if (next === 'mealsTable') {
      setMealsReloadToken((token) => token + 1)
    }
    if (next === 'portions') {
      setPortionsReloadToken((token) => token + 1)
    }
  }

  function handleEdit(product: ProductResponse) {
    setEditingMeal(null)
    setEditingProduct(product)
    setScreen('edit')
  }

  function handleEditCancel() {
    setEditingProduct(null)
    ensureMounted('table')
    setScreen('table')
    setTableReloadToken((token) => token + 1)
  }

  function handleEditSaved() {
    setEditingProduct(null)
    ensureMounted('table')
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
    ensureMounted('mealsTable')
    setScreen('mealsTable')
    setMealsReloadToken((token) => token + 1)
    setPortionsReloadToken((token) => token + 1)
  }

  function handleEditMealSaved() {
    setEditingMeal(null)
    ensureMounted('mealsTable')
    setScreen('mealsTable')
    setMealsReloadToken((token) => token + 1)
    setPortionsReloadToken((token) => token + 1)
  }

  const navView: AppView =
    screen === 'edit' ? 'table' : screen === 'editMeal' ? 'mealsTable' : screen

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__start">
          {user ? (
            <UserMenu user={user} onLogout={logout} activeView={navView} />
          ) : null}
        </div>
        <div className="app-topbar__end">
          <ThemeToggle />
        </div>
      </header>
      <AppNav activeView={navView} onChange={handleViewChange} />

      {mountedViews.has('portions') ? (
        <KeepAliveScreen active={screen === 'portions'}>
          <PortionsBoard reloadToken={portionsReloadToken} />
        </KeepAliveScreen>
      ) : null}

      {mountedViews.has('people') ? (
        <KeepAliveScreen active={screen === 'people'}>
          <PeoplePage />
        </KeepAliveScreen>
      ) : null}

      {mountedViews.has('add') ? (
        <KeepAliveScreen active={screen === 'add'}>
          <ProductForm />
        </KeepAliveScreen>
      ) : null}

      {mountedViews.has('table') ? (
        <KeepAliveScreen active={screen === 'table'}>
          <ProductsTable reloadToken={tableReloadToken} onEdit={handleEdit} />
        </KeepAliveScreen>
      ) : null}

      {screen === 'edit' && editingProduct ? (
        <ProductForm
          product={editingProduct}
          onCancel={handleEditCancel}
          onSaved={handleEditSaved}
        />
      ) : null}

      {mountedViews.has('addMeal') ? (
        <KeepAliveScreen active={screen === 'addMeal'}>
          <MealForm />
        </KeepAliveScreen>
      ) : null}

      {mountedViews.has('mealsTable') ? (
        <KeepAliveScreen active={screen === 'mealsTable'}>
          <MealsTable reloadToken={mealsReloadToken} onEdit={handleEditMeal} />
        </KeepAliveScreen>
      ) : null}

      {screen === 'editMeal' && editingMeal ? (
        <MealForm
          key={editingMeal.id}
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
        <ThemeToggle floating />
        <p className="app-boot">{pl.auth.loading}</p>
      </main>
    )
  }

  if (status === 'anonymous') {
    return (
      <>
        <ThemeToggle floating />
        <LoginPage />
      </>
    )
  }

  return <AppShell />
}

export default App
