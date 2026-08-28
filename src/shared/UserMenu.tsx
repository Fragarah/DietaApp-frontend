import { useEffect, useRef, useState } from 'react'
import { pl } from '../i18n/pl'
import type { AuthUser } from '../features/auth/types'
import './UserMenu.css'

type UserMenuProps = {
  user: AuthUser
  onLogout: () => void
  /** Zamyka rozwinięcie na mobile przy zmianie karty nawigacji. */
  activeView?: string
}

export function UserMenu({ user, onLogout, activeView }: UserMenuProps) {
  const label = user.displayName || user.email
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [activeView])

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (rootRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`user-menu${open ? ' user-menu--open' : ''}`}>
      <button
        type="button"
        className="user-menu__toggle"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
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
      </button>

      <div className="user-menu__details">
        <span className="user-menu__name" title={user.email}>
          {label}
        </span>
        <button type="button" className="user-menu__logout" onClick={onLogout}>
          {pl.auth.logout}
        </button>
      </div>
    </div>
  )
}
