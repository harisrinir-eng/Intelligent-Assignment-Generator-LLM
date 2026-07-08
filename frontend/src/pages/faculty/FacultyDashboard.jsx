import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Plus,
  Users,
  Clock,
  TrendingUp,
  ChevronRight,
  Sparkles,
  Eye,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/common/PageHeader'
import { DifficultyBadge, StatusBadge } from '../../components/common/Badges'
import { PageLoader } from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function FacultyDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [assignments, setAssignments] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [findingSubmission, setFindingSubmission] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/faculty/assignments'),
      api.get('/faculty/analytics'),
    ])
      .then(([aRes, anaRes]) => {
        setAssignments(aRes.data)
        setAnalytics(anaRes.data)
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AppLayout>
        <PageLoader text="Loading dashboard…" />
      </AppLayout>
    )
  }

  const findAssignmentWithSubmissions = async ({ pendingOnly = false } = {}) => {
    if (assignments.length === 0) {
      toast('No assignments available')
      return
    }

    setFindingSubmission(true)

    try {
      for (const assignment of assignments) {
        const res = await api.get(`/faculty/assignments/${assignment.id}/submissions`)
        const submissions = res.data || []

        if (pendingOnly) {
          const pending = submissions.find((s) => s.status !== 'reviewed')

          if (pending) {
            navigate(`/faculty/assignments/${assignment.id}?tab=submissions`)
            return
          }
        } else if (submissions.length > 0) {
          navigate(`/faculty/assignments/${assignment.id}?tab=submissions`)
          return
        }
      }

      toast(
        pendingOnly
          ? 'No pending review available'
          : 'No student submissions available'
      )
    } catch {
      toast.error('Could not check submissions')
    } finally {
      setFindingSubmission(false)
    }
  }

  const openAllAssignments = () => {
    if (assignments.length > 0) {
      navigate(`/faculty/assignments/${assignments[0].id}`)
      return
    }

    toast('No assignments available')
  }

  const statCards = [
    {
      label: 'Assignments Created',
      value: analytics?.total_assignments ?? 0,
      sub: `${analytics?.published_assignments ?? 0} published`,
      icon: BookOpen,
      color: 'bg-indigo-500/15 text-indigo-100 border-indigo-400/60',
      onClick: openAllAssignments,
    },
    {
      label: 'Total Submissions',
      value: analytics?.total_submissions ?? 0,
      sub: findingSubmission ? 'checking submissions…' : 'click to view submissions',
      icon: Users,
      color: 'bg-cyan-500/15 text-cyan-100 border-cyan-400/60',
      onClick: () => findAssignmentWithSubmissions({ pendingOnly: false }),
    },
    {
      label: 'Pending Review',
      value: analytics?.pending_review ?? 0,
      sub:
        (analytics?.pending_review ?? 0) > 0
          ? 'click to review pending'
          : 'no pending review',
      icon: Clock,
      color: 'bg-amber-500/15 text-amber-100 border-amber-400/60',
      onClick: () => findAssignmentWithSubmissions({ pendingOnly: true }),
    },
    {
      label: 'Avg AI Score',
      value: analytics?.avg_ai_score_pct != null ? `${analytics.avg_ai_score_pct}%` : '—',
      sub: 'across all answers',
      icon: TrendingUp,
      color: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/60',
      onClick: () => findAssignmentWithSubmissions({ pendingOnly: false }),
    },
  ]

  return (
    <AppLayout>
      <div className="p-8">
        <PageHeader
          title={`Welcome, ${user?.full_name || 'Faculty'}`}
          subtitle="Manage Bloom-level assignments, review submissions, and track student progress using local AI evaluation."
          actions={
            <button
              className="btn-primary"
              onClick={() => navigate('/faculty/assignments/create')}
            >
              <Plus className="w-4 h-4" /> New Assignment
            </button>
          }
        />

        <motion.div
          className="card p-6 mb-8 relative overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute right-28 bottom-0 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative flex items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-500 text-xs text-slate-100 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                Flan-T5 + MiniLM local AI pipeline
              </div>

              <h2 className="text-xl font-black text-white">
                Create academic assignments faster
              </h2>

              <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                Generate K1, K2, K3, and K4 questions with expected answers and rubric
                key points. Faculty can edit, regenerate, save as draft, or publish.
              </p>
            </div>

            <button
              className="btn-primary flex-shrink-0"
              onClick={() => navigate('/faculty/assignments/create')}
            >
              <Plus className="w-4 h-4" /> Generate Questions
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {statCards.map((s, i) => (
            <motion.button
              type="button"
              key={s.label}
              className="stat-card text-left hover:border-indigo-400/70 hover:bg-slate-800 transition-all cursor-pointer"
              onClick={s.onClick}
              disabled={findingSubmission}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border ${s.color}`}
              >
                <s.icon className="w-5 h-5" />
              </div>

              <div>
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-sm font-bold text-slate-100">{s.label}</div>
                <div className="text-xs text-slate-300 mt-0.5">{s.sub}</div>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div>
              <h2 className="section-title">Your Assignments</h2>
              <p className="text-xs text-slate-300 mt-1">
                Click an assignment to view questions and student submissions.
              </p>
            </div>

            <button
              onClick={() => navigate('/faculty/assignments/create')}
              className="btn-secondary text-xs py-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Create New
            </button>
          </div>

          {assignments.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No assignments yet"
              description="Create your first Bloom-level LLM-generated assignment for students."
              action={
                <button
                  className="btn-primary"
                  onClick={() => navigate('/faculty/assignments/create')}
                >
                  <Plus className="w-4 h-4" /> Create Assignment
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-700">
              {assignments.map((a, i) => (
                <motion.div
                  key={a.id}
                  className="flex items-center px-6 py-4 hover:bg-slate-800 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/faculty/assignments/${a.id}`)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white truncate">
                        {a.title}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                      <span>{a.subject}</span>
                      <span>·</span>
                      <span>{a.question_count} questions</span>
                      <span>·</span>
                      <span>{a.total_marks} marks</span>
                      <span>·</span>
                      <DifficultyBadge difficulty={a.difficulty} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/faculty/assignments/${a.id}?tab=submissions`)
                    }}
                    className="btn-secondary text-xs py-1.5 mr-3"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}