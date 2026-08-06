import { pl } from '../i18n/pl'
import './AppNav.css'

export type AppView = 'add' | 'table'

type AppNavProps = {
  activeView: AppView
  onChange: (view: AppView) => void
}

export function AppNav({ activeView, onChange }: AppNavProps) {
  return (
    <nav className="app-nav" aria-label="Główna nawigacja">
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
    </nav>
  )
}
