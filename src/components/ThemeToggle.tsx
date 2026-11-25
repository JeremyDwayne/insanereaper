import { useRouteContext } from '@tanstack/react-router'
import { useState } from 'react'
import { setTheme } from '#/theme.ts'
import { MoonIcon, SunIcon } from './icons.tsx'

/** Switches between dark and light without a request; the cookie keeps the choice for the next page load. */
export function ThemeToggle() {
  const [theme, setLocal] = useState(useRouteContext({ from: '__root__' }).theme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      className="inline-flex size-10 cursor-pointer items-center justify-center rounded border border-line2"
      onClick={() => {
        setTheme(next)
        setLocal(next)
      }}
    >
      {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}
