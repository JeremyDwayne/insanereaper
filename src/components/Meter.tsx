/** A progress bar with its count: solid gold for drops, segmented blue for achievements. */
export function Meter({
  got,
  total,
  kind,
  height = 'h-1.5',
}: {
  got: number
  total: number
  kind: 'drops' | 'tasks'
  height?: string
}) {
  const fill = kind === 'drops' ? 'bg-gold' : 'bg-ach'
  return (
    <span className="flex items-center gap-2 text-muted text-xs tabular-nums">
      <span className={`${height} flex-auto bg-track ${kind === 'tasks' ? 'segmented' : ''}`}>
        <span
          className={`block ${height} ${fill} ${kind === 'tasks' ? 'segmented' : ''}`}
          style={{ width: `${total ? (got / total) * 100 : 0}%` }}
        />
      </span>
      {got}/{total}
    </span>
  )
}
