import { useEffect, useRef, useState } from 'react'
import { getTheme, type Theme } from '#/theme.ts'

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** The widget's public site key. Dev builds use Cloudflare's test key, which always passes. */
const SITE_KEY = import.meta.env.DEV ? '1x00000000000000000000AA' : '0x4AAAAAAGTIdi-0VgyIfMw7'

declare global {
  interface Window {
    turnstile?: {
      render(
        el: HTMLElement,
        options: {
          sitekey: string
          theme: Theme
          size: 'flexible'
          callback: (token: string) => void
          'expired-callback': () => void
        },
      ): string
      remove(id: string): void
    }
  }
}

/**
 * Cloudflare's bot check. Calls `onToken` with a single-use token, and with '' when it expires.
 * Give it a new `key` to get a fresh token.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    let id: string | undefined
    let live = true
    const render = () => {
      if (!live) return
      id = window.turnstile?.render(el, {
        sitekey: SITE_KEY,
        theme: getTheme(),
        size: 'flexible',
        callback: onToken,
        'expired-callback': () => onToken(''),
      })
    }
    if (window.turnstile) render()
    else {
      const script =
        document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`) ??
        document.head.appendChild(Object.assign(document.createElement('script'), { src: SCRIPT, async: true }))
      script.addEventListener('load', render)
      // Drop the failed tag so the next mount tries again.
      script.addEventListener('error', () => {
        script.remove()
        if (live) setBlocked(true)
      })
    }
    return () => {
      live = false
      if (id) window.turnstile?.remove(id)
    }
  }, [onToken])

  return blocked ? (
    <p className="m-0 font-semibold">
      The bot check did not load. Turn off any content blocker for this page, then reload.
    </p>
  ) : (
    <div ref={box} />
  )
}
