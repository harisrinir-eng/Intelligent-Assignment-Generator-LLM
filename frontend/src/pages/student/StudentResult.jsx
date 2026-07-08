import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle,
  AlertCircle,
  User,
  Cpu,
  ArrowLeft,
  Award,
  Sparkles,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/common/PageHeader'
import ScoreBar from '../../components/common/ScoreBar'
import { StatusBadge } from '../../components/common/Badges'
import { PageLoader } from '../../components/common/Spinner'
import api from '../../api/axios'
import toast from 'react-hot-toast'

function MetricChip({ label, value, color }) {
  const safeValue = Number(value || 0)

  return (
    <div className={`px-3 py-2 rounded-2xl text-xs text-center border ${color}`}>
      <div className="font-bold text-base leading-none mb-1">
        {(safeValue * 100).toFixed(0)}%
      </div>
      <div className="opacity-80">{label}</div>
    </div>
  )
}

export default function StudentResult() {
  const { submissionId } = useParams()
  const navigate = useNavigate()

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/student/submissions/${submissionId}/result`)
      .then((res) => setResult(res.data))
      .catch(() => toast.error('Could not load results'))
      .finally(() => setLoading(false))
  }, [submissionId])

  if (loading) {
    return (
      <AppLayout>
        <PageLoader text="Loading results…" />
      </AppLayout>
    )
  }

  if (!result) {
    return (
      <AppLayout>
        <div className="p-8 text-slate-400">Results not found.</div>
      </AppLayout>
    )
  }

  const scorePct =
    result.total_max > 0 ? (result.final_total / result.total_max) * 100 : 0

  const grade =
    scorePct >= 85
      ? 'O'
      : scorePct >= 70
        ? 'A+'
        : scorePct >= 60
          ? 'A'
          : scorePct >= 50
            ? 'B'
            : scorePct >= 40
              ? 'C'
              : 'F'

  const gradeColor =
    scorePct >= 70
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
      : scorePct >= 50
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
        : 'text-red-300 bg-red-500/10 border-red-500/30'

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Evaluation Result"
          subtitle={`${result.assignment_title} · ${result.subject}`}
          backHref="/student/dashboard"
        />

        {/* Score summary card */}
        <motion.div
          className="card p-6 mb-6 relative overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute left-32 bottom-0 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex items-center gap-6">
            {/* Grade circle */}
            <div
              className={`w-24 h-24 rounded-3xl flex flex-col items-center justify-center flex-shrink-0 font-bold border shadow-xl shadow-black/30 ${gradeColor}`}
            >
              <span className="text-3xl font-black">{grade}</span>
              <span className="text-xs opacity-80 font-medium">Grade</span>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-3 gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-300 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                    AI-assisted evaluation summary
                  </div>

                  <div className="text-3xl font-bold text-white">
                    {Number(result.final_total || 0).toFixed(1)}
                    <span className="text-lg text-slate-500 font-normal">
                      {' '}
                      / {result.total_max}
                    </span>
                  </div>

                  <div className="text-sm text-slate-400 mt-1">
                    Final Score · {scorePct.toFixed(1)}%
                  </div>
                </div>

                <div className="text-right">
                  <StatusBadge status={result.status} />
                  <div className="text-xs text-slate-500 mt-2">
                    Submitted{' '}
                    {new Date(result.submitted_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              <ScoreBar score={result.final_total} max={result.total_max} showPct />

              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-sky-300" />
                  AI Score: {Number(result.ai_total || 0).toFixed(1)}
                </span>

                {result.status === 'reviewed' && (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <CheckCircle className="w-3 h-3" />
                    Faculty Reviewed
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Per-question results */}
        <div className="space-y-5">
          {result.answers.map((ans, idx) => (
            <motion.div
              key={ans.id}
              className="card overflow-hidden"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
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

                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap justify-end">
                  <span>AI: {Number(ans.ai_score || 0).toFixed(1)}</span>

                  {ans.faculty_override_score != null && (
                    <span className="text-indigo-300 font-medium">
                      Faculty: {Number(ans.faculty_override_score || 0).toFixed(1)}
                    </span>
                  )}

                  <span className="font-bold text-slate-200">
                    Final: {Number(ans.final_score || 0).toFixed(1)} / {ans.max_marks}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm font-medium text-slate-100 leading-relaxed">
                  {ans.question_text}
                </p>

                {/* Score bar */}
                <ScoreBar score={ans.final_score} max={ans.max_marks} showPct />

                {/* AI metrics */}
                {ans.semantic_similarity != null && (
                  <div className="flex gap-2 flex-wrap">
                    <MetricChip
                      label="Semantic Sim"
                      value={ans.semantic_similarity}
                      color="bg-purple-500/10 text-purple-300 border-purple-500/30"
                    />
                    <MetricChip
                      label="Key Coverage"
                      value={ans.keyword_coverage}
                      color="bg-amber-500/10 text-amber-300 border-amber-500/30"
                    />
                    <MetricChip
                      label="Completeness"
                      value={ans.completeness_score}
                      color="bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                    />
                  </div>
                )}

                {/* Your answer */}
                {ans.answer_text && (
                  <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-sky-300 mb-2">
                      Your Answer
                    </p>
                    <p className="text-sm text-sky-100 leading-relaxed whitespace-pre-wrap">
                      {ans.answer_text}
                    </p>
                  </div>
                )}

                {/* Covered / Missing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ans.covered_points?.length > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Concepts Covered
                      </p>

                      <ul className="space-y-1.5">
                        {ans.covered_points.map((pt, i) => (
                          <li key={i} className="text-xs text-emerald-100">
                            • {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ans.missing_points?.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-red-300 mb-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Missing Concepts
                      </p>

                      <ul className="space-y-1.5">
                        {ans.missing_points.map((pt, i) => (
                          <li key={i} className="text-xs text-red-100">
                            • {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* AI Feedback */}
                {ans.ai_feedback && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-sky-300" /> AI Feedback
                    </p>

                    <p className="text-sm text-slate-400 leading-relaxed">
                      {ans.ai_feedback}
                    </p>
                  </div>
                )}

                {/* Faculty remark */}
                {ans.faculty_remark && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-indigo-300 mb-2 flex items-center gap-1">
                      <User className="w-3 h-3" /> Faculty Remark
                    </p>

                    <p className="text-sm text-indigo-100 leading-relaxed">
                      {ans.faculty_remark}
                    </p>

                    {ans.reviewed_at && (
                      <p className="text-xs text-indigo-300/70 mt-2">
                        Reviewed on{' '}
                        {new Date(ans.reviewed_at).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            className="btn-secondary"
            onClick={() => navigate('/student/dashboard')}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    </AppLayout>
  )
}