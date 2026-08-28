import { pl } from '../i18n/pl'
import type { AuthUser } from '../features/auth/types'
import './UserMenu.css'

type UserMenuProps = {
  user: AuthUser
  onLogout: () => void
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const label = user.displayName || user.email

  return (
    <div className="user-menu">
      {user.pictureUrl ? (
        <img
          className="user-menu__avatar"
          src={user.pictureUrl}
          alt=""
          width={32}
          height={32}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="user-menu__avatar user-menu__avatar--fallback" aria-hidden="true">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="user-menu__name" title={user.email}>
        {label}
      </span>
      <button type="button" className="user-menu__logout" onClick={onLogout}>
        {pl.auth.logout}
      </button>
    </div>
  )
}
