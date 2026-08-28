import { useEffect, useState } from 'react'
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

function describeGooglePromptFailure(reason: string): string {
  switch (reason) {
    case 'unregistered_origin':
      return pl.auth.googleUnregisteredOrigin
    case 'invalid_client':
      return pl.auth.googleInvalidClient
    case 'opt_out_or_no_session':
    case 'suppressed_by_user':
    case 'user_cancel':
      return pl.auth.googleCancelled
    case 'secure_http_required':
      return pl.auth.googleSecureRequired
    case 'browser_not_supported':
      return pl.auth.googleBrowserUnsupported
    default:
      return pl.auth.googlePromptFailed.replace('{reason}', reason || 'unknown')
  }
}

export function LoginPage() {
  const { signInWithGoogleIdToken, loginError, clearLoginError } = useAuth()
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setScriptError(pl.auth.missingClientId)
      return
    }

    let cancelled = false

    async function setupGoogle() {
      try {
        await loadGoogleScript()
        if (cancelled || !window.google?.accounts?.id) {
          return
        }

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID!,
          callback: (response) => {
            if (!response.credential) {
              setScriptError(pl.auth.googleNoCredential)
              return
            }
            clearLoginError()
            setScriptError(null)
            setBusy(true)
            void signInWithGoogleIdToken(response.credential).finally(() => {
              setBusy(false)
            })
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        })

        if (!cancelled) {
          setReady(true)
        }
      } catch {
        if (!cancelled) {
          setScriptError(pl.auth.scriptFailed)
        }
      }
    }

    void setupGoogle()
    return () => {
      cancelled = true
      window.google?.accounts.id.cancel()
    }
  }, [clearLoginError, signInWithGoogleIdToken])

  function handleGoogleLogin() {
    if (!window.google?.accounts?.id) {
      setScriptError(pl.auth.scriptFailed)
      return
    }
    clearLoginError()
    setScriptError(null)
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        setScriptError(describeGooglePromptFailure(notification.getNotDisplayedReason()))
        return
      }
      if (notification.isSkippedMoment()) {
        setScriptError(describeGooglePromptFailure(notification.getSkippedReason()))
      }
    })
  }

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

        <button
          type="button"
          className="login-page__google-btn"
          onClick={handleGoogleLogin}
          disabled={!ready || busy}
          aria-busy={busy}
        >
          <span className="login-page__google-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="20" height="20">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
          </span>
          {pl.auth.continueWithGoogle}
        </button>

        {busy ? <p className="login-page__busy">{pl.auth.signingIn}</p> : null}
      </section>
    </main>
  )
}
