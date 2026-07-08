export default function ScoreBar({ score, max, label, showPct = true }) {
  const safeScore = Number(score || 0)
  const safeMax = Number(max || 0)
  const pct = safeMax > 0 ? Math.min((safeScore / safeMax) * 100, 100) : 0

  const color =
    pct >= 75
      ? 'bg-emerald-400'
      : pct >= 50
        ? 'bg-amber-400'
        : 'bg-red-400'

  const glow =
    pct >= 75
      ? 'shadow-emerald-400/40'
      : pct >= 50
        ? 'shadow-amber-400/40'
        : 'shadow-red-400/40'

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>{label}</span>
          {showPct && <span>{pct.toFixed(0)}%</span>}
        </div>
      )}

      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color} shadow-lg ${glow}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}