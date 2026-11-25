import { Link } from '@tanstack/react-router'
import { ThemeToggle } from './ThemeToggle.tsx'

/** Site header. `children` sit between the logo and the right-hand controls, such as search. */
export function Header({
  signedIn,
  actions,
  children,
}: {
  signedIn: boolean
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-line border-b px-4 py-2.5 sm:px-8">
      <Link to="/" className="font-extrabold text-base text-gold-text no-underline">
        Insane Reaper
      </Link>
      {children}
      <span className="flex-auto" />
      <ThemeToggle />
      {actions}
      {signedIn ? (
        <Link to="/account" className="px-2 font-semibold text-text no-underline">
          Account
        </Link>
      ) : (
        <Link to="/start" className="px-2 font-semibold text-text no-underline">
          Sign in
        </Link>
      )}
    </header>
  )
}

/** A bordered header button with an icon and a label. */
export function HeaderButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded border border-line2 px-3 font-semibold"
    />
  )
}
