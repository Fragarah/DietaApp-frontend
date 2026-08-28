import { useEffect, useRef, useState } from 'react'
import { pl } from '../../i18n/pl'
import { useAuth } from './AuthContext'
import './LoginPage.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google script failed')))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google script failed'))
    document.head.appendChild(script)
  })
}

export function LoginPage() {
  const { signInWithGoogleIdToken, loginError, clearLoginError } = useAuth()
  const buttonHostRef = useRef<HTMLDivElement>(null)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setScriptError(pl.auth.missingClientId)
      return
    }

    let cancelled = false

    async function setupGoogleButton() {
      try {
        await loadGoogleScript()
        if (cancelled || !buttonHostRef.current || !window.google?.accounts?.id) {
          return
        }

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID!,
          callback: (response) => {
            if (!response.credential) {
              return
            }
            clearLoginError()
            setBusy(true)
            void signInWithGoogleIdToken(response.credential).finally(() => {
              setBusy(false)
            })
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        buttonHostRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(buttonHostRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 320,
          locale: 'pl',
        })
      } catch {
        if (!cancelled) {
          setScriptError(pl.auth.scriptFailed)
        }
      }
    }

    void setupGoogleButton()
    return () => {
      cancelled = true
    }
  }, [clearLoginError, signInWithGoogleIdToken])

  const errorMessage = loginError ?? scriptError

  return (
    <main className="login-page">
      <section className="login-page__panel" aria-labelledby="login-title">
        <p className="login-page__brand">{pl.appName}</p>
        <h1 id="login-title" className="login-page__title">
          {pl.auth.title}
        </h1>
        <p className="login-page__subtitle">{pl.auth.subtitle}</p>

        {errorMessage ? (
          <p className="login-page__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div
          ref={buttonHostRef}
          className={`login-page__google${busy ? ' login-page__google--busy' : ''}`}
          aria-busy={busy}
        />

        {busy ? <p className="login-page__busy">{pl.auth.signingIn}</p> : null}
      </section>
    </main>
  )
}
