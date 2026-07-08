import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Send, ChevronRight, Sparkles, Eye } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/common/PageHeader'
import { BloomBadge, DifficultyBadge, StatusBadge } from '../../components/common/Badges'
import ScoreBar from '../../components/common/ScoreBar'
import { PageLoader } from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import api from '../../api/axios'
import toast from 'react-hot-toast'

export default function AssignmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [assignment, setAssignment] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [tab, setTab] = useState(searchParams.get('tab') || 'overview')

  useEffect(() => {
    Promise.all([
      api.get(`/faculty/assignments/${id}`),
      api.get(`/faculty/assignments/${id}/submissions`),
    ])
      .then(([aRes, sRes]) => {
        setAssignment(aRes.data)
        setSubmissions(sRes.data)

        if (searchParams.get('tab') === 'submissions') {
          setTab('submissions')
        }
      })
      .catch(() => toast.error('Failed to load assignment'))
      .finally(() => setLoading(false))
  }, [id, searchParams])

  const handlePublish = async () => {
    setPublishing(true)

    try {
      await api.put(`/faculty/assignments/${id}`, {
        ...assignment,
        difficulty: assignment.difficulty || 'medium',
        status: 'published',
        questions: assignment.questions.map((q) => ({
          question_text: q.question_text,
          max_marks: q.max_marks,
          expected_answer: q.expected_answer,
          key_points_json: q.key_points_json,
          order_index: q.order_index,
          bloom_level: q.bloom_level || 'K2',
        })),
      })

      setAssignment((a) => ({ ...a, status: 'published' }))
      toast.success('Assignment published successfully!')
    } catch {
      toast.error('Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageLoader />
      </AppLayout>
    )
  }

  if (!assignment) {
    return (
      <AppLayout>
        <div className="p-8 text-slate-300">Assignment not found.</div>
      </AppLayout>
    )
  }

  const totalMarks = assignment.questions.reduce((s, q) => s + Number(q.max_marks), 0)

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title={assignment.title}
          subtitle={`${assignment.subject} · ${assignment.topic}`}
          backHref="/faculty/dashboard"
          actions={
            assignment.status === 'draft' && (
              <button
                className="btn-primary"
                onClick={handlePublish}
                disabled={publishing}
              >
                <Send className="w-4 h-4" />
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            )
          }
        />

        {/* Meta row */}
        <div className="card p-4 mb-6 flex flex-wrap items-center gap-3">
          <StatusBadge status={assignment.status} />
          <DifficultyBadge difficulty={assignment.difficulty} />
          <span className="badge badge-slate">
            {assignment.questions.length} questions
          </span>
          <span className="badge badge-slate">
            {totalMarks} total marks
          </span>
          <span className="badge badge-blue">
            {submissions.length} submissions
          </span>

          <span className="text-xs text-slate-300 ml-auto">
            Created{' '}
            {new Date(assignment.created_at).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'submissions', label: `Submissions (${submissions.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors -mb-px ${tab === t.id
                  ? 'border-indigo-300 text-indigo-100'
                  : 'border-transparent text-slate-300 hover:text-white'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {assignment.instructions && (
              <div className="card p-5">
                <h3 className="text-sm font-bold text-white mb-2">
                  Instructions
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {assignment.instructions}
                </p>
              </div>
            )}

            {assignment.questions.map((q, i) => (
              <div key={q.id} className="card p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-2xl bg-indigo-500/20 text-indigo-100 border border-indigo-400/60 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <BloomBadge level={q.bloom_level || 'K2'} />
                      <span className="badge badge-blue">
                        {q.max_marks} marks
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-white mb-3 leading-relaxed">
                      {q.question_text}
                    </p>

                    {q.expected_answer && (
                      <div className="bg-slate-950 border border-slate-600 rounded-2xl p-4 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                          <p className="text-xs font-bold text-slate-100">
                            Expected Answer
                          </p>
                        </div>

                        <p className="text-sm text-slate-300 leading-relaxed">
                          {q.expected_answer}
                        </p>
                      </div>
                    )}

                    {q.key_points_json &&
                      (() => {
                        try {
                          const pts = JSON.parse(q.key_points_json)

                          return pts.length > 0 ? (
                            <div className="bg-slate-950 border border-slate-600 rounded-2xl p-4">
                              <p className="text-xs font-bold text-slate-100 mb-2">
                                Key Points / Rubric
                              </p>

                              <ul className="space-y-1.5">
                                {pts.map((pt, pi) => (
                                  <li
                                    key={pi}
                                    className="flex items-start gap-2 text-xs text-slate-300"
                                  >
                                    <span className="text-indigo-200 mt-0.5 flex-shrink-0">
                                      •
                                    </span>
                                    <span>{pt}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null
                        } catch {
                          return null
                        }
                      })()}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {tab === 'submissions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {submissions.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No submissions yet"
                description="Students will appear here once they submit."
              />
            ) : (
              <div className="card divide-y divide-slate-700 overflow-hidden">
                {submissions.map((sub, i) => (
                  <motion.div
                    key={sub.id}
                    className="flex items-center px-5 py-4 hover:bg-slate-800 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/faculty/submissions/${sub.id}/review`)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 text-cyan-100 border border-cyan-400/60 text-sm font-black flex items-center justify-center flex-shrink-0 mr-4">
                      {sub.student_name.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-white">
                          {sub.student_name}
                        </span>
                        <StatusBadge status={sub.status} />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
                        <span>AI: {Number(sub.ai_total || 0).toFixed(1)} / {sub.max_total}</span>
                        <span>Final: {Number(sub.final_total || 0).toFixed(1)} / {sub.max_total}</span>
                        <span>
                          Submitted {new Date(sub.submitted_at).toLocaleDateString('en-IN')}
                        </span>
                      </div>

                      <div className="mt-2 w-56">
                        <ScoreBar
                          score={sub.final_total}
                          max={sub.max_total}
                          showPct={false}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary text-xs py-1.5 mr-3"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/faculty/submissions/${sub.id}/review`)
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Review
                    </button>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors ml-2 flex-shrink-0" />
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