export default function Spinner({ size = 'md', text = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-9 h-9',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizes[size]} border-2 border-slate-700 border-t-indigo-400 rounded-full animate-spin shadow-lg shadow-indigo-500/20`}
      />

      {text && (
        <p className="text-sm text-slate-400">
          {text}
        </p>
      )}
    </div>
  )
}

export function PageLoader({ text = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" text={text} />
    </div>
  )
}