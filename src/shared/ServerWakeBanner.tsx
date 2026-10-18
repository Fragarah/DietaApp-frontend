import { useEffect, useState } from 'react'
import { pl } from '../i18n/pl'
import { subscribeServerWake } from './api/serverWake'
import './ServerWakeBanner.css'

export function ServerWakeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => subscribeServerWake(setVisible), [])

  if (!visible) {
    return null
  }

  return (
    <div className="server-wake-banner" role="status" aria-live="polite">
      {pl.serverWake.message}
    </div>
  )
}
