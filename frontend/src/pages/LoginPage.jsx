import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Eye,
  EyeOff,
  BookOpen,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Brain,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AnimatedTopRibbon from '../components/common/AnimatedTopRibbon'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ username: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.username || !form.password) {
      return toast.error('Please enter credentials')
    }

    setLoading(true)

    try {
      const user = await login(form.username, form.password)
      toast.success(`Welcome, ${user.full_name}!`)
      navigate(user.role === 'faculty' ? '/faculty/dashboard' : '/student/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (username, password) => {
    setForm({ username, password })
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <AnimatedTopRibbon />

      <div className="relative min-h-screen flex items-center justify-center p-4 pt-16">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-120px] left-[-80px] w-[460px] h-[460px] rounded-full bg-indigo-500/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-[-140px] right-[-120px] w-[520px] h-[520px] rounded-full bg-cyan-500/15 blur-3xl animate-pulse" />
          <div className="absolute top-1/3 right-1/3 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-5xl grid lg:grid-cols-2 rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-950/70 shadow-2xl shadow-black/50 backdrop-blur-2xl">
          {/* Left panel */}
          <div className="relative hidden lg:flex flex-col justify-between p-10 border-r border-slate-800/80 overflow-hidden">
            <div className="absolute -left-20 top-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute right-[-80px] bottom-[-80px] w-80 h-80 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-10">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-lg shadow-indigo-950/40 border border-slate-700 bg-slate-900">
                  <img
                    src="/assigniq-logo.png"
                    alt="AssignIQ Logo"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div>
                  <div className="text-white font-bold text-lg leading-tight">
                    AssignIQ
                  </div>
                  <div className="text-slate-400 text-xs">
                    AI Assignment & Evaluation System
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-300 mb-5">
                <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                Local AI-powered academic workflow
              </div>

              <h2 className="text-4xl font-black text-white leading-tight mb-4">
                Generate, evaluate,
                <br />
                and review smarter.
              </h2>

              <p className="text-slate-400 text-sm leading-relaxed max-w-md">
                Create Bloom-level academic assignments using local Hugging Face models,
                evaluate student responses with semantic similarity, and keep faculty
                review in the loop.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  {
                    icon: BookOpen,
                    label: 'Bloom-Level Question Generation',
                    desc: 'K1, K2, K3, and K4 question creation',
                  },
                  {
                    icon: Brain,
                    label: 'Semantic AI Evaluation',
                    desc: 'MiniLM-based similarity and rubric coverage',
                  },
                  {
                    icon: GraduationCap,
                    label: 'Faculty Override',
                    desc: 'Human-in-the-loop review and final grading',
                  },
                  {
                    icon: ShieldCheck,
                    label: 'Local Demo Friendly',
                    desc: 'No paid API, no Ollama server required',
                  },
                ].map(({ icon: Icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex items-start gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-indigo-300" />
                    </div>

                    <div>
                      <div className="text-white text-sm font-semibold">
                        {label}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        {desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-8 pt-6 border-t border-slate-800/80">
              <p className="text-slate-500 text-xs">
                AssignIQ · ITF 6202 LLM Course Mini Project · Academic Assignment Portal
              </p>
            </div>
          </div>

          {/* Right panel */}
          <div className="relative p-8 sm:p-10 flex flex-col justify-center bg-slate-950/60">
            <div className="mb-8">
              <div className="lg:hidden flex items-center gap-3 mb-8">
                <div className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-indigo-950/40 border border-slate-700 bg-slate-900">
                  <img
                    src="/assigniq-logo.png"
                    alt="AssignIQ Logo"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div>
                  <div className="text-white font-bold text-lg leading-tight">
                    AssignIQ
                  </div>
                  <div className="text-slate-400 text-xs">
                    AI Assignment & Evaluation System
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-black text-white mb-2">
                Sign in to continue
              </h1>

              <p className="text-slate-400 text-sm">
                Enter your credentials to access the portal.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. faculty1 or student1"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Password</label>

                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />

                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
                  >
                    {showPwd ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full justify-center py-3"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-500">Demo Accounts</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: 'Faculty 1',
                    username: 'faculty1',
                    password: 'faculty123',
                    color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/20',
                  },
                  {
                    label: 'Faculty 2',
                    username: 'faculty2',
                    password: 'faculty123',
                    color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/20',
                  },
                  {
                    label: 'Student 1',
                    username: 'student1',
                    password: 'student123',
                    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20',
                  },
                  {
                    label: 'Student 2',
                    username: 'student2',
                    password: 'student123',
                    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20',
                  },
                ].map(({ label, username, password, color }) => (
                  <button
                    key={username}
                    type="button"
                    onClick={() => fillDemo(username, password)}
                    className={`text-left px-3 py-2.5 rounded-2xl border text-xs font-medium transition-all ${color}`}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="opacity-70">{username}</div>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-600 text-center mt-7">
              Uses local Flan-T5 and MiniLM models for academic demo workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}