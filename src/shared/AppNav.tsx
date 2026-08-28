import { pl } from '../i18n/pl'
import './AppNav.css'

export type AppView = 'portions' | 'people' | 'add' | 'table' | 'addMeal' | 'mealsTable'

type AppNavProps = {
  activeView: AppView
  onChange: (view: AppView) => void
}

export function AppNav({ activeView, onChange }: AppNavProps) {
  return (
    <nav className="app-nav" aria-label="Główna nawigacja">
      <button
        type="button"
        className={`app-nav__btn${activeView === 'portions' ? ' app-nav__btn--active' : ''}`}
        aria-current={activeView === 'portions' ? 'page' : undefined}
        onClick={() => onChange('portions')}
      >
        {pl.nav.portions}
      </button>
      <button
        type="button"
        className={`app-nav__btn${activeView === 'people' ? ' app-nav__btn--active' : ''}`}
        aria-current={activeView === 'people' ? 'page' : undefined}
        onClick={() => onChange('people')}
      >
        {pl.nav.people}
      </button>
      <button
        type="button"
        className={`app-nav__btn${activeView === 'add' ? ' app-nav__btn--active' : ''}`}
        aria-current={activeView === 'add' ? 'page' : undefined}
        onClick={() => onChange('add')}
      >
        {pl.nav.addProduct}
      </button>
      <button
        type="button"
        className={`app-nav__btn${activeView === 'table' ? ' app-nav__btn--active' : ''}`}
        aria-current={activeView === 'table' ? 'page' : undefined}
        onClick={() => onChange('table')}
      >
        {pl.nav.productsTable}
      </button>
      <button
        type="button"
        className={`app-nav__btn${activeView === 'addMeal' ? ' app-nav__btn--active' : ''}`}
        aria-current={activeView === 'addMeal' ? 'page' : undefined}
        onClick={() => onChange('addMeal')}
      >
        {pl.nav.addMeal}
      </button>
      <button
        type="button"
        className={`app-nav__btn${activeView === 'mealsTable' ? ' app-nav__btn--active' : ''}`}
        aria-current={activeView === 'mealsTable' ? 'page' : undefined}
        onClick={() => onChange('mealsTable')}
      >
        {pl.nav.mealsTable}
      </button>
    </nav>
  )
}
