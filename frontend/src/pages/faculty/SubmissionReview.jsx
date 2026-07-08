import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Edit3,
  Save,
  Cpu,
  Sparkles,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/common/PageHeader'
import ScoreBar from '../../components/common/ScoreBar'
import { PageLoader } from '../../components/common/Spinner'
import api from '../../api/axios'
import toast from 'react-hot-toast'

function MetricPill({ label, value, color }) {
  const safeValue = Number(value || 0)

  return (
    <div className={`px-3 py-2 rounded-2xl text-xs border ${color}`}>
      <div className="font-bold text-base leading-none mb-1">
        {(safeValue * 100).toFixed(0)}%
      </div>
      <div className="opacity-80">{label}</div>
    </div>
  )
}

export default function SubmissionReview() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    api.get(`/faculty/submissions/${id}`)
      .then((res) => {
        setSubmission(res.data)

        const init = {}
        res.data.answers.forEach((answer) => {
          init[answer.id] = {
            score:
              answer.faculty_override_score ??
              answer.final_score ??
              answer.ai_score ??
              0,
            remark: answer.faculty_remark ?? '',
          }
        })

        setOverrides(init)
      })
      .catch(() => toast.error('Failed to load submission'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    setSaving(true)

    try {
      const overrideList = Object.entries(overrides).map(
        ([answer_id, { score, remark }]) => ({
          answer_id: Number(answer_id),
          override_score: Number(score),
          faculty_remark: remark,
        })
      )

      await api.post(`/faculty/submissions/${id}/override`, {
        overrides: overrideList,
      })

      toast.success('Review saved successfully!')
      navigate(-1)
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageLoader text="Loading submission…" />
      </AppLayout>
    )
  }

  if (!submission) {
    return (
      <AppLayout>
        <div className="p-8 text-slate-400">Submission not found.</div>
      </AppLayout>
    )
  }

  const aiTotal = submission.answers.reduce(
    (sum, answer) => sum + (answer.ai_score ?? 0),
    0
  )

  const currentTotal = submission.answers.reduce((sum, answer) => {
    const override = overrides[answer.id]
    return sum + (override ? Number(override.score) : answer.final_score ?? answer.ai_score ?? 0)
  }, 0)

  const maxTotal = submission.answers.reduce(
    (sum, answer) => sum + (answer.max_marks ?? 10),
    0
  )

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Review Submission"
          subtitle={`${submission.student_name} · ${submission.assignment_title}`}
          backHref={`/faculty/assignments/${submission.assignment_id}`}
          actions={
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Review'}
            </button>
          }
        />

        {/* Score summary */}
        <motion.div
          className="card p-6 mb-6 relative overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute left-28 bottom-0 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-300 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              Faculty review and score override
            </div>

            <div className="flex items-center justify-between mb-3 gap-4">
              <span className="text-sm font-semibold text-slate-200">
                Overall Score
              </span>

              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap justify-end">
                <span>
                  AI:{' '}
                  <strong className="text-slate-200">
                    {aiTotal.toFixed(1)}
                  </strong>
                </span>
                <span>
                  Faculty:{' '}
                  <strong className="text-indigo-300">
                    {currentTotal.toFixed(1)}
                  </strong>
                </span>
                <span>
                  Max:{' '}
                  <strong className="text-slate-200">
                    {maxTotal}
                  </strong>
                </span>
              </div>
            </div>

            <ScoreBar score={currentTotal} max={maxTotal} showPct />
          </div>
        </motion.div>

        {/* Per-question review */}
        <div className="space-y-5">
          {submission.answers.map((ans, idx) => {
            const override = overrides[ans.id] || {}

            const covered = (() => {
              try {
                return JSON.parse(ans.covered_points_json || '[]')
              } catch {
                return []
              }
            })()

            const missing = (() => {
              try {
                return JSON.parse(ans.missing_points_json || '[]')
              } catch {
                return []
              }
            })()

            return (
              <motion.div
                key={ans.id}
                className="card overflow-hidden"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
              >
                {/* Question header */}
                <div className="bg-slate-900/80 px-5 py-4 border-b border-slate-800/80 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-2xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold text-slate-100">
                      Question {idx + 1}
                    </span>
                  </div>

                  <span className="text-xs text-slate-500">
                    Max: {ans.max_marks} marks
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  {/* Question */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      QUESTION
                    </p>
                    <p className="text-sm text-slate-100 leading-relaxed">
                      {ans.question_text}
                    </p>
                  </div>

                  {/* Expected vs student */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-emerald-300 mb-2">
                        Expected Answer
                      </p>
                      <p className="text-sm text-emerald-100 leading-relaxed">
                        {ans.expected_answer || '—'}
                      </p>
                    </div>

                    <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-sky-300 mb-2">
                        Student Answer
                      </p>
                      <p className="text-sm text-sky-100 leading-relaxed whitespace-pre-wrap">
                        {ans.answer_text || (
                          <span className="italic text-sky-300/70">
                            No answer provided
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* AI Metrics */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">
                      AI EVALUATION METRICS
                    </p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <MetricPill
                        label="Semantic Sim"
                        value={ans.semantic_similarity ?? 0}
                        color="bg-purple-500/10 text-purple-300 border-purple-500/30"
                      />
                      <MetricPill
                        label="Key Coverage"
                        value={ans.keyword_coverage ?? 0}
                        color="bg-amber-500/10 text-amber-300 border-amber-500/30"
                      />
                      <MetricPill
                        label="Completeness"
                        value={ans.completeness_score ?? 0}
                        color="bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                      />

                      <div className="px-3 py-2 rounded-2xl text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                        <div className="font-semibold">
                          AI Score: {Number(ans.ai_score || 0).toFixed(1)} /{' '}
                          {ans.max_marks}
                        </div>
                      </div>
                    </div>

                    {/* Covered / Missing */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {covered.length > 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                          <p className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Covered Concepts
                          </p>

                          <ul className="space-y-1.5">
                            {covered.map((point, i) => (
                              <li
                                key={i}
                                className="text-xs text-emerald-100"
                              >
                                • {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {missing.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                          <p className="text-xs font-semibold text-red-300 mb-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Missing Concepts
                          </p>

                          <ul className="space-y-1.5">
                            {missing.map((point, i) => (
                              <li key={i} className="text-xs text-red-100">
                                • {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {ans.ai_feedback && (
                      <div className="mt-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                        <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-sky-300" />
                          AI Feedback
                        </p>

                        <p className="text-sm text-slate-400 leading-relaxed">
                          {ans.ai_feedback}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Faculty override */}
                  <div className="border-t border-slate-800/80 pt-4">
                    <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      FACULTY OVERRIDE
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">
                          Override Score (0 – {ans.max_marks})
                        </label>

                        <input
                          type="number"
                          min={0}
                          max={ans.max_marks}
                          step={0.5}
                          className="input"
                          value={override.score ?? ''}
                          onChange={(e) =>
                            setOverrides((old) => ({
                              ...old,
                              [ans.id]: {
                                ...old[ans.id],
                                score: e.target.value,
                              },
                            }))
                          }
                        />

                        <p className="text-xs text-slate-500 mt-1">
                          AI score: {Number(ans.ai_score || 0).toFixed(1)}
                        </p>
                      </div>

                      <div>
                        <label className="label">Faculty Remark</label>

                        <textarea
                          className="input"
                          rows={3}
                          placeholder="Optional remark visible to student…"
                          value={override.remark ?? ''}
                          onChange={(e) =>
                            setOverrides((old) => ({
                              ...old,
                              [ans.id]: {
                                ...old[ans.id],
                                remark: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            className="btn-primary px-8 py-3"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Review…' : 'Save & Finalize Review'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}