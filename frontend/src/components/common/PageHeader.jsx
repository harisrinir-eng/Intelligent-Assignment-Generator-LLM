import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function PageHeader({ title, subtitle, backHref, actions }) {
  const navigate = useNavigate()

  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {backHref && (
          <button
            onClick={() => navigate(backHref)}
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100 mb-3 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}

        <h1 className="page-header bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          {title}
        </h1>

        {subtitle && (
          <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-3 ml-4">
          {actions}
        </div>
      )}
    </div>
  )
}