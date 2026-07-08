import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Upload,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/common/PageHeader'
import { DifficultyBadge, BloomBadge } from '../../components/common/Badges'
import { PageLoader } from '../../components/common/Spinner'
import api from '../../api/axios'
import toast from 'react-hot-toast'

export default function TakeAssignment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [answers, setAnswers] = useState({})
  const [currentQ, setCurrentQ] = useState(0)
  const [uploadMode, setUploadMode] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)

  useEffect(() => {
    api.get(`/student/assignments/${id}`)
      .then((res) => {
        setAssignment(res.data)

        if (res.data.already_submitted) {
          toast('You have already submitted this assignment.')
          navigate(`/student/results/${res.data.submission_id}`)
        }

        const init = {}
        res.data.questions.forEach((q) => {
          init[q.id] = ''
        })
        setAnswers(init)
      })
      .catch(() => toast.error('Assignment not found'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleFileChange = (e) => {
    const file = e.target.files[0]

    if (!file) return

    const ext = file.name.split('.').pop().toLowerCase()

    if (!['pdf', 'docx'].includes(ext)) {
      toast.error('Only PDF or DOCX files are supported')
      return
    }

    setUploadedFile(file)
    toast.success(`File "${file.name}" selected`)
  }

  const handleSubmit = async () => {
    if (!uploadedFile) {
      const blanks = assignment.questions.filter((q) => !answers[q.id]?.trim())

      if (blanks.length === assignment.questions.length) {
        return toast.error('Please answer at least one question or upload a file')
      }
    }

    const confirmed = window.confirm(
      'Are you sure you want to submit? This cannot be undone.'
    )

    if (!confirmed) return

    setSubmitting(true)

    try {
      const answersJson = JSON.stringify(
        assignment.questions.map((q) => ({
          question_id: q.id,
          answer_text: answers[q.id] || '',
        }))
      )

      const formData = new FormData()
      formData.append('answers_json', answersJson)

      if (uploadedFile) {
        formData.append('file', uploadedFile)
      }

      const res = await api.post(`/student/assignments/${id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success('Assignment submitted and evaluated!')
      navigate(`/student/results/${res.data.submission_id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageLoader text="Loading assignment…" />
      </AppLayout>
    )
  }

  if (!assignment) {
    return (
      <AppLayout>
        <div className="p-8 text-slate-400">Assignment not found.</div>
      </AppLayout>
    )
  }

  const questions = assignment.questions
  const currentQuestion = questions[currentQ]
  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length
  const totalMarks = questions.reduce((s, q) => s + Number(q.max_marks), 0)

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title={assignment.title}
          subtitle={`${assignment.subject} · ${assignment.topic} · ${totalMarks} marks`}
          backHref="/student/dashboard"
        />

        {/* Assignment meta */}
        <div className="card p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <DifficultyBadge difficulty={assignment.difficulty} />
              <span className="badge badge-slate">{questions.length} questions</span>
              <span className="badge badge-slate">{totalMarks} marks</span>
              <span className="text-xs text-slate-500">
                by {assignment.creator_name}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setUploadMode(false)}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border ${!uploadMode
                    ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-950/30'
                    : 'bg-slate-900/70 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
              >
                Type Answers
              </button>

              <button
                onClick={() => setUploadMode(true)}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border ${uploadMode
                    ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-950/30'
                    : 'bg-slate-900/70 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
              >
                <Upload className="w-3 h-3 inline mr-1" />
                Upload File
              </button>
            </div>
          </div>

          {assignment.instructions && (
            <div className="mt-4 p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-sky-100 leading-relaxed">
                {assignment.instructions}
              </p>
            </div>
          )}
        </div>

        {uploadMode ? (
          <motion.div
            className="card p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-black/30">
                <FileText className="w-8 h-8 text-indigo-300" />
              </div>

              <h3 className="text-lg font-semibold text-white mb-1">
                Upload Your Answer Document
              </h3>

              <p className="text-sm text-slate-400 mb-6 max-w-2xl mx-auto leading-relaxed">
                Upload a text-based PDF or DOCX file. The system will extract your
                answers automatically. Format your document with "Question 1:",
                "Question 2:", etc. headers for best parsing.
              </p>

              {uploadedFile ? (
                <div className="flex items-center gap-3 justify-center p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-4">
                  <FileText className="w-5 h-5 text-emerald-300" />
                  <span className="text-sm font-medium text-emerald-100">
                    {uploadedFile.name}
                  </span>

                  <button
                    onClick={() => setUploadedFile(null)}
                    className="ml-auto text-emerald-300 hover:text-red-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 rounded-2xl p-10 cursor-pointer hover:border-indigo-400 hover:bg-indigo-500/10 transition-all mb-4"
                >
                  <Upload className="w-9 h-9 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-300">Click to browse or drag & drop</p>
                  <p className="text-xs text-slate-500 mt-1">
                    PDF, DOCX only. Text-based documents work best.
                  </p>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex gap-2 justify-center">
                {!uploadedFile && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn-secondary"
                  >
                    <Upload className="w-4 h-4" /> Browse File
                  </button>
                )}

                <button
                  className="btn-primary px-8"
                  onClick={handleSubmit}
                  disabled={submitting || !uploadedFile}
                >
                  {submitting ? (
                    'Submitting…'
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Submit File
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div>
            {/* Question navigation pills */}
            <div className="card p-4 mb-5 flex gap-2 flex-wrap items-center">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQ(i)}
                  className={`w-9 h-9 rounded-2xl text-sm font-semibold transition-all border ${currentQ === i
                      ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-950/30'
                      : answers[q.id]?.trim()
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-900/70 text-slate-500 border-slate-700 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                >
                  {i + 1}
                </button>
              ))}

              <span className="ml-auto text-xs text-slate-500 self-center">
                {answeredCount} / {questions.length} answered
              </span>
            </div>

            {/* Current question */}
            <AnimatePresence mode="wait">
              {currentQuestion && (
                <motion.div
                  key={currentQ}
                  className="card p-6"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {currentQ + 1}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <BloomBadge level={currentQuestion.bloom_level || 'K2'} />
                        <span className="badge badge-blue">
                          {currentQuestion.max_marks} marks
                        </span>
                      </div>

                      <p className="text-base font-semibold text-slate-100 leading-relaxed">
                        {currentQuestion.question_text}
                      </p>
                    </div>
                  </div>

                  <textarea
                    className="input"
                    rows={9}
                    placeholder="Type your answer here. Cover the key concepts, explanation, and examples where needed."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) =>
                      setAnswers((a) => ({
                        ...a,
                        [currentQuestion.id]: e.target.value,
                      }))
                    }
                  />

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentQ((i) => Math.max(0, i - 1))}
                        disabled={currentQ === 0}
                        className="btn-secondary py-1.5 text-xs disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Previous
                      </button>

                      <button
                        onClick={() =>
                          setCurrentQ((i) => Math.min(questions.length - 1, i + 1))
                        }
                        disabled={currentQ === questions.length - 1}
                        className="btn-secondary py-1.5 text-xs disabled:opacity-40"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="text-xs text-slate-500">
                      {(answers[currentQuestion.id] || '')
                        .split(/\s+/)
                        .filter(Boolean).length}{' '}
                      words
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit bar */}
            <div className="mt-5 card p-4 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                <span className="font-semibold text-slate-200">{answeredCount}</span>{' '}
                of{' '}
                <span className="font-semibold text-slate-200">
                  {questions.length}
                </span>{' '}
                questions answered
              </div>

              <button
                className="btn-primary px-8 py-2.5"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Sparkles className="w-4 h-4" /> Evaluating…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}