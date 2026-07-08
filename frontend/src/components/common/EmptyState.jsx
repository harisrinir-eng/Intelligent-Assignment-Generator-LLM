export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {Icon && (
        <div className="w-16 h-16 rounded-3xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-center mb-4 shadow-xl shadow-black/30">
          <Icon className="w-7 h-7 text-slate-400" />
        </div>
      )}

      <h3 className="text-base font-semibold text-slate-100 mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-slate-500 max-w-xs mb-5 leading-relaxed">
          {description}
        </p>
      )}

      {action}
    </div>
  )
}