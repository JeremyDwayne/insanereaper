import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export type Theme = 'dark' | 'light'

const parse = (value: string | undefined): Theme => (value === 'light' ? 'light' : 'dark')

/** The theme cookie, read from the request on the server and from document.cookie in the browser. Dark by default. */
export const getTheme = createIsomorphicFn()
  .server(() => parse(getCookie('theme')))
  .client(() => parse(document.cookie.match(/(?:^|; )theme=(\w+)/)?.[1]))

/** Switches the page theme and remembers it for a year. */
export function setTheme(theme: Theme) {
  document.documentElement.className = theme
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing from some browsers we support.
  document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`
}
