import { CheckIcon } from './icons.tsx'

/** A read-only done or not-done box: filled with a check when done, outlined when not. */
export function Mark({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex size-[18px] flex-none items-center justify-center rounded-sm bg-gold text-on-gold">
      <CheckIcon size={14} />
      <span className="sr-only">Done</span>
    </span>
  ) : (
    <span className="inline-flex size-[18px] flex-none rounded-sm border-2 border-muted">
      <span className="sr-only">Not done</span>
    </span>
  )
}
