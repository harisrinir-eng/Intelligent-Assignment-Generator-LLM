import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Clock,
  CheckCircle,
  ChevronRight,
  Award,
  Sparkles,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/common/PageHeader'
import { DifficultyBadge, StatusBadge } from '../../components/common/Badges'
import ScoreBar from '../../components/common/ScoreBar'
import { PageLoader } from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [assignments, setAssignments] = useState([])
  const [mySubmissions, setMySubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('available')

  useEffect(() => {
    Promise.all([
      api.get('/student/assignments'),
      api.get('/student/my-submissions'),
    ])
      .then(([aRes, sRes]) => {
        setAssignments(aRes.data)
        setMySubmissions(sRes.data)
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AppLayout>
        <PageLoader text="Loading assignments…" />
      </AppLayout>
    )
  }

  const pending = assignments.filter((a) => !a.already_submitted)
  const submitted = assignments.filter((a) => a.already_submitted)

  const statCards = [
    {
      label: 'Pending Assignments',
      value: pending.length,
      icon: Clock,
      color: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    },
    {
      label: 'Submitted',
      value: submitted.length,
      icon: CheckCircle,
      color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    },
    {
      label: 'Total Available',
      value: assignments.length,
      icon: BookOpen,
      color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    },
  ]

  return (
    <AppLayout>
      <div className="p-8">
        <PageHeader
          title={`Hello, ${user?.full_name?.split(' ')[0]} 👋`}
          subtitle="View assignments, submit answers, and check AI-generated feedback and scores."
        />

        {/* Hero panel */}
        <motion.div
          className="card p-6 mb-8 relative overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute left-24 bottom-0 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-300 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              AI-assisted assignment evaluation
            </div>

            <h2 className="text-xl font-bold text-white">
              Track your academic submissions clearly
            </h2>

            <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
              Open pending assignments, submit your answers, and review AI score,
              rubric coverage, and faculty feedback once evaluated.
            </p>
          </div>
        </motion.div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              className="stat-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border ${s.color}`}
              >
                <s.icon className="w-5 h-5" />
              </div>

              <div>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs font-medium text-slate-400">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-slate-800/80">
          {[
            { id: 'available', label: `Available (${assignments.length})` },
            { id: 'results', label: `My Results (${mySubmissions.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.id
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-200'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'available' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {assignments.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No assignments yet"
                description="Your faculty has not published any assignments. Check back soon."
              />
            ) : (
              <div className="card divide-y divide-slate-800/80 overflow-hidden">
                {assignments.map((a, i) => (
                  <motion.div
                    key={a.id}
                    className="flex items-center px-6 py-4 hover:bg-slate-900/70 transition-colors cursor-pointer group"
                    onClick={() =>
                      a.already_submitted
                        ? navigate(`/student/results/${a.submission_id}`)
                        : navigate(`/student/assignments/${a.id}`)
                    }
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mr-4 border ${a.already_submitted
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                        }`}
                    >
                      {a.already_submitted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <BookOpen className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {a.title}
                        </span>

                        {a.already_submitted ? (
                          <span className="badge badge-green">Submitted</span>
                        ) : (
                          <span className="badge badge-amber">Pending</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="text-slate-400">{a.subject}</span>
                        <span>·</span>
                        <DifficultyBadge difficulty={a.difficulty} />
                        <span>·</span>
                        <span>
                          {a.question_count} questions · {a.total_marks} marks
                        </span>
                        <span>·</span>
                        <span>by {a.creator_name}</span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors ml-3 flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'results' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {mySubmissions.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No results yet"
                description="Submit assignments to view AI scores and faculty feedback."
              />
            ) : (
              <div className="card divide-y divide-slate-800/80 overflow-hidden">
                {mySubmissions.map((sub, i) => (
                  <motion.div
                    key={sub.id}
                    className="flex items-center px-6 py-4 hover:bg-slate-900/70 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/student/results/${sub.id}`)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {sub.assignment_title}
                        </span>
                        <StatusBadge status={sub.status} />
                      </div>

                      <div className="text-xs text-slate-500 mb-2">
                        {sub.subject} ·{' '}
                        {new Date(sub.submitted_at).toLocaleDateString('en-IN')}
                      </div>

                      <div className="w-56">
                        <ScoreBar
                          score={sub.final_total}
                          max={sub.total_max}
                          label={`${Number(sub.final_total || 0).toFixed(1)} / ${sub.total_max}`}
                          showPct
                        />
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors ml-3" />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AppLayout>
  )
}