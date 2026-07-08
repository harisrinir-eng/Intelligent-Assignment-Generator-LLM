export function DifficultyBadge({ difficulty }) {
  const map = {
    easy: 'badge-green',
    medium: 'badge-amber',
    hard: 'badge-red',
  }

  const label = difficulty
    ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
    : 'Medium'

  return (
    <span className={map[difficulty] || 'badge-slate'}>
      {label}
    </span>
  )
}

export function BloomBadge({ level }) {
  const map = {
    K1: 'badge-blue',
    K2: 'badge-green',
    K3: 'badge-amber',
    K4: 'badge-teal',
  }

  const labelMap = {
    K1: 'K1 - Remember',
    K2: 'K2 - Understand',
    K3: 'K3 - Apply',
    K4: 'K4 - Analyze',
  }

  return (
    <span className={map[level] || 'badge-slate'}>
      {labelMap[level] || 'K2 - Understand'}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    published: 'badge-teal',
    draft: 'badge-slate',
    submitted: 'badge-blue',
    evaluated: 'badge-blue',
    reviewed: 'badge-green',
  }

  const label = status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : 'Draft'

  return (
    <span className={map[status] || 'badge-slate'}>
      {label}
    </span>
  )
}

export function ScoreBadge({ score, max }) {
  const safeScore = Number(score || 0)
  const safeMax = Number(max || 0)
  const pct = safeMax > 0 ? safeScore / safeMax : 0

  const cls =
    pct >= 0.75
      ? 'badge-green'
      : pct >= 0.5
        ? 'badge-amber'
        : 'badge-red'

  return (
    <span className={cls}>
      {safeScore.toFixed(1)} / {safeMax.toFixed(1)}
    </span>
  )
}