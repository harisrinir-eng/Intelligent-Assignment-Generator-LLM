import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  GraduationCap,
  ClipboardList,
  User,
  Sparkles,
} from 'lucide-react'
import AnimatedTopRibbon from '../common/AnimatedTopRibbon'

const facultyNav = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/faculty/dashboard' },
  { label: 'Assignments', icon: BookOpen, href: '/faculty/dashboard' },
]

const studentNav = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/student/dashboard' },
  { label: 'My Assignments', icon: ClipboardList, href: '/student/dashboard' },
]

export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const nav = user?.role === 'faculty' ? facultyNav : studentNav
  const homeHref = user?.role === 'faculty' ? '/faculty/dashboard' : '/student/dashboard'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="ai-bg-orb one" />
      <div className="ai-bg-orb two" />
      <div className="ai-bg-orb three" />

      <aside className="w-72 flex-shrink-0 border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl flex flex-col shadow-2xl shadow-black/40">
        <Link
          to={homeHref}
          className="px-6 py-5 border-b border-slate-800/80 hover:bg-slate-900/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-indigo-950/40 border border-slate-700 bg-slate-900">
              <img
                src="/assigniq-logo.png"
                alt="AssignIQ Logo"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-none tracking-wide">
                AssignIQ
              </div>
              <div className="text-xs text-slate-300 leading-tight mt-1">
                AI Assignment & Evaluation System
              </div>
            </div>
          </div>
        </Link>

        <div className="px-4 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-900 border border-slate-700 soft-glow">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-400/50 flex items-center justify-center">
              {user?.role === 'faculty' ? (
                <GraduationCap className="w-5 h-5 text-indigo-200" />
              ) : (
                <User className="w-5 h-5 text-indigo-200" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">
                {user?.full_name}
              </div>
              <div className="text-xs text-slate-300 capitalize">
                {user?.role}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ label, icon: Icon, href }) => {
            const active = location.pathname === href

            return (
              <Link
                key={label}
                to={href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${active
                    ? 'bg-gradient-to-r from-indigo-500/25 to-sky-500/15 text-white border border-indigo-400/50 shadow-lg shadow-indigo-950/20'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent hover:border-slate-600'
                  }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${active ? 'text-indigo-200' : 'text-slate-400 group-hover:text-white'
                    }`}
                />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-3 pb-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-sky-200 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-100">
                  Local AI Enabled
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Flan-T5 + MiniLM for Bloom-level question generation and evaluation.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 py-4 border-t border-slate-800/80">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-red-500/10 hover:text-red-200 border border-transparent hover:border-red-400/40 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <AnimatedTopRibbon />
        <div className="min-h-full">{children}</div>
      </main>
    </div>
  )
}