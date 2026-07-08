import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Send,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/common/PageHeader'
import Spinner from '../../components/common/Spinner'
import api from '../../api/axios'
import toast from 'react-hot-toast'

const SUBJECT_OPTIONS = [
  'Large Language Models',
  'Advanced Software Testing',
  'Cloud Computing',
  'AI-driven Cybersecurity',
  'Agile Software Development',
  'Research Methodology',
  'Other',
]

const BLOOM_OPTIONS = [
  { value: 'K1', label: 'K1 - Remember' },
  { value: 'K2', label: 'K2 - Understand' },
  { value: 'K3', label: 'K3 - Apply' },
  { value: 'K4', label: 'K4 - Analyze' },
]

const BLOOM_BADGE = {
  K1: 'bg-blue-500/20 text-blue-100 border-blue-400/70 shadow-blue-500/10',
  K2: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/70 shadow-emerald-500/10',
  K3: 'bg-amber-500/20 text-amber-100 border-amber-400/70 shadow-amber-500/10',
  K4: 'bg-violet-500/25 text-violet-100 border-violet-400/70 shadow-violet-500/10',
}

const MIN_QUESTIONS = 1
const MAX_QUESTIONS = 25
const MIN_MARKS = 1

export default function CreateAssignment() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [regeneratingIndex, setRegeneratingIndex] = useState(null)

  const [selectedSubject, setSelectedSubject] = useState('Large Language Models')
  const [customSubject, setCustomSubject] = useState('')

  const [config, setConfig] = useState({
    title: '',
    subject: 'Large Language Models',
    topic: '',
    difficulty: 'medium',
    num_questions: '3',
    marks_per_question: '10',
    instructions: '',
  })

  const [questions, setQuestions] = useState([])
  const [expandedQ, setExpandedQ] = useState(null)

  const getFinalSubject = () => {
    if (selectedSubject === 'Other') {
      return customSubject.trim()
    }

    return selectedSubject
  }

  const getQuestionCount = () => Number.parseInt(config.num_questions, 10)
  const getMarksPerQuestion = () => Number.parseFloat(config.marks_per_question)

  const handleSubjectChange = (value) => {
    setSelectedSubject(value)

    if (value !== 'Other') {
      setConfig((c) => ({ ...c, subject: value }))
    } else {
      setConfig((c) => ({ ...c, subject: customSubject }))
    }
  }

  const handleCustomSubjectChange = (value) => {
    setCustomSubject(value)
    setConfig((c) => ({ ...c, subject: value }))
  }

  const handleGenerate = async () => {
    const finalSubject = getFinalSubject()
    const questionCount = getQuestionCount()
    const marks = getMarksPerQuestion()

    if (!config.title.trim() || !finalSubject || !config.topic.trim()) {
      return toast.error('Please fill in title, subject, and topic')
    }

    if (
      Number.isNaN(questionCount) ||
      questionCount < MIN_QUESTIONS ||
      questionCount > MAX_QUESTIONS
    ) {
      return toast.error(`Number of questions must be between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}`)
    }

    if (Number.isNaN(marks) || marks < MIN_MARKS) {
      return toast.error('Marks per question must be at least 1')
    }

    setGenerating(true)

    try {
      const res = await api.post('/faculty/assignments/generate', {
        title: config.title.trim(),
        subject: finalSubject,
        topic: config.topic.trim(),
        difficulty: config.difficulty,
        num_questions: questionCount,
        marks_per_question: marks,
        instructions: config.instructions,
      })

      const qs = res.data.questions.map((q, i) => ({
        ...q,
        bloom_level: q.bloom_level || 'K2',
        key_points_json: JSON.stringify(q.key_points || []),
        order_index: i,
        _keyPointsText: (q.key_points || []).join('\n'),
      }))

      setConfig((c) => ({ ...c, subject: finalSubject }))
      setQuestions(qs)
      setExpandedQ(0)
      setStep(2)
      toast.success(`${qs.length} Bloom-level questions generated!`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const updateQuestion = (idx, field, value) => {
    setQuestions((qs) =>
      qs.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    )
  }

  const regenerateQuestion = async (idx) => {
    const q = questions[idx]
    const finalSubject = getFinalSubject() || config.subject

    if (!finalSubject || !config.topic.trim()) {
      return toast.error('Subject and topic are required')
    }

    setRegeneratingIndex(idx)

    try {
      const existingQuestions = questions
        .filter((_, i) => i !== idx)
        .map((item) => item.question_text)

      const res = await api.post('/faculty/assignments/regenerate-question', {
        subject: finalSubject,
        topic: config.topic.trim(),
        bloom_level: q.bloom_level || 'K2',
        marks_per_question: Number(q.max_marks || getMarksPerQuestion() || 10),
        existing_questions: existingQuestions,
      })

      const regenerated = res.data

      setQuestions((qs) =>
        qs.map((item, i) =>
          i === idx
            ? {
              ...item,
              question_text: regenerated.question_text || item.question_text,
              expected_answer: regenerated.expected_answer || '',
              key_points: regenerated.key_points || [],
              key_points_json: JSON.stringify(regenerated.key_points || []),
              _keyPointsText: (regenerated.key_points || []).join('\n'),
              bloom_level: regenerated.bloom_level || item.bloom_level || 'K2',
              max_marks: regenerated.max_marks || item.max_marks,
            }
            : item
        )
      )

      toast.success(`Question ${idx + 1} regenerated`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Regeneration failed')
    } finally {
      setRegeneratingIndex(null)
    }
  }

  const addQuestion = () => {
    const marks = getMarksPerQuestion()

    setQuestions((qs) => [
      ...qs,
      {
        question_text: '',
        expected_answer: '',
        key_points: [],
        key_points_json: '[]',
        _keyPointsText: '',
        max_marks: Number.isNaN(marks) ? 10 : marks,
        order_index: qs.length,
        bloom_level: 'K2',
      },
    ])

    setExpandedQ(questions.length)
  }

  const removeQuestion = (idx) => {
    setQuestions((qs) =>
      qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i }))
    )

    if (expandedQ === idx) {
      setExpandedQ(null)
    }
  }

  const handleSave = async (publish = false) => {
    if (questions.length === 0) {
      return toast.error('Add at least one question')
    }

    if (questions.some((q) => !q.question_text.trim())) {
      return toast.error('All questions must have text')
    }

    setSaving(true)

    try {
      const finalSubject = getFinalSubject() || config.subject

      const payload = {
        title: config.title.trim(),
        subject: finalSubject,
        topic: config.topic.trim(),
        difficulty: config.difficulty,
        instructions: config.instructions,
        status: publish ? 'published' : 'draft',
        questions: questions.map((q, i) => {
          const kp = q._keyPointsText
            ? q._keyPointsText
              .split('\n')
              .filter((line) => line.trim())
              .map((line) => line.replace(/^[-•]\s*/, '').trim())
            : q.key_points || []

          return {
            question_text: q.question_text,
            max_marks: Number(q.max_marks),
            expected_answer: q.expected_answer,
            key_points_json: JSON.stringify(kp),
            order_index: i,
            bloom_level: q.bloom_level || 'K2',
          }
        }),
      }

      const res = await api.post('/faculty/assignments', payload)

      toast.success(publish ? 'Assignment published!' : 'Assignment saved as draft')
      navigate(`/faculty/assignments/${res.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const getBloomLabel = (level) => {
    return BLOOM_OPTIONS.find((item) => item.value === level)?.label || 'K2 - Understand'
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Create Assignment"
          subtitle="Generate Bloom-level assignment questions with model answers and rubrics"
          backHref="/faculty/dashboard"
        />

        <div className="flex items-center gap-3 mb-8">
          {['Configure', 'Edit & Publish'].map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-2xl flex items-center justify-center text-xs font-black transition-all border ${step > i + 1
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : step === i + 1
                    ? 'bg-indigo-500 text-white border-indigo-300 shadow-lg shadow-indigo-500/30'
                    : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
              >
                {i + 1}
              </div>

              <span
                className={`text-sm font-semibold ${step === i + 1 ? 'text-slate-100' : 'text-slate-400'
                  }`}
              >
                {s}
              </span>

              {i < 1 && <div className="w-10 h-px bg-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <motion.div
            className="card p-7 space-y-6 border-slate-700 bg-slate-900/95"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <h2 className="text-xl font-bold text-white">
                Assignment Configuration
              </h2>

              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                AssignIQ automatically distributes questions across K1, K2, K3,
                and K4. Faculty can edit Bloom levels before publishing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="label">Assignment Title *</label>
                <input
                  className="input"
                  placeholder="e.g. Cloud Computing Assignment - I"
                  value={config.title}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, title: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="label">Subject *</label>
                <select
                  className="input"
                  value={selectedSubject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                >
                  {SUBJECT_OPTIONS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Topic *</label>
                <input
                  className="input"
                  placeholder="e.g. Security Issues in Cloud Service Models"
                  value={config.topic}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, topic: e.target.value }))
                  }
                />
              </div>

              {selectedSubject === 'Other' && (
                <div className="col-span-2">
                  <label className="label">Custom Subject *</label>
                  <input
                    className="input"
                    placeholder="Enter custom subject name"
                    value={customSubject}
                    onChange={(e) => handleCustomSubjectChange(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="label">
                  Number of Questions ({MIN_QUESTIONS}–{MAX_QUESTIONS})
                </label>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter number of questions"
                  value={config.num_questions}
                  onChange={(e) => {
                    const value = e.target.value

                    if (/^\d*$/.test(value)) {
                      setConfig((c) => ({ ...c, num_questions: value }))
                    }
                  }}
                  onBlur={() => {
                    const value = getQuestionCount()

                    if (Number.isNaN(value)) {
                      setConfig((c) => ({ ...c, num_questions: '3' }))
                      return
                    }

                    const clamped = Math.min(
                      Math.max(value, MIN_QUESTIONS),
                      MAX_QUESTIONS
                    )

                    setConfig((c) => ({ ...c, num_questions: String(clamped) }))
                  }}
                />
              </div>

              <div>
                <label className="label">Marks per Question</label>
                <input
                  className="input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Enter marks"
                  value={config.marks_per_question}
                  onChange={(e) => {
                    const value = e.target.value

                    if (/^\d*\.?\d*$/.test(value)) {
                      setConfig((c) => ({ ...c, marks_per_question: value }))
                    }
                  }}
                  onBlur={() => {
                    const value = getMarksPerQuestion()

                    if (Number.isNaN(value) || value < MIN_MARKS) {
                      setConfig((c) => ({ ...c, marks_per_question: '10' }))
                      return
                    }

                    setConfig((c) => ({
                      ...c,
                      marks_per_question: String(value),
                    }))
                  }}
                />
              </div>

              <div className="col-span-2">
                <label className="label">Instructions optional</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Any additional instructions for students…"
                  value={config.instructions}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, instructions: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="pt-2">
              <div className="p-4 rounded-2xl bg-indigo-500/15 border border-indigo-400/40 flex items-start gap-3 mb-5">
                <Sparkles className="w-5 h-5 text-indigo-200 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-100 leading-relaxed">
                  Clicking <strong>Generate</strong> will create{' '}
                  <strong>{config.num_questions || '0'}</strong> unique
                  Bloom-level questions with expected answers and key-point rubrics.
                  You can edit every question before publishing.
                </p>
              </div>

              <button
                className="btn-primary w-full justify-center py-3 text-base"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Spinner size="sm" /> Generating questions…
                  </>
                ) : (
                  <>
                    <Cpu className="w-5 h-5" /> Generate Bloom-Level Questions
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="card p-5 mb-5 flex items-center justify-between border-slate-700 bg-slate-900/95">
              <div className="text-sm text-slate-300 leading-relaxed">
                <span className="font-bold text-white">{config.title}</span>
                <span className="mx-2 text-slate-500">·</span>
                <span className="text-slate-200">{config.subject}</span>
                <span className="mx-2 text-slate-500">·</span>
                <span className="text-slate-200">{questions.length} questions</span>
                <span className="mx-2 text-slate-500">·</span>
                <span className="text-slate-200">
                  {questions.reduce((s, q) => s + Number(q.max_marks), 0)} total marks
                </span>
              </div>

              <button onClick={() => setStep(1)} className="btn-secondary text-xs py-2">
                Back to Config
              </button>
            </div>

            <div className="space-y-4 mb-5">
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className={`rounded-3xl overflow-hidden border bg-slate-900/95 shadow-xl shadow-black/30 transition-all ${expandedQ === idx
                    ? 'border-indigo-400/70'
                    : 'border-slate-700 hover:border-slate-500'
                    }`}
                >
                  <div
                    className="flex items-center px-6 py-5 cursor-pointer hover:bg-slate-800/80 transition-colors"
                    onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-100 border border-indigo-400/60 text-sm font-black flex items-center justify-center flex-shrink-0 mr-4">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`text-xs font-black px-3 py-1 rounded-full border shadow-lg ${BLOOM_BADGE[q.bloom_level] || BLOOM_BADGE.K2
                            }`}
                        >
                          {getBloomLabel(q.bloom_level)}
                        </span>

                        <span className="text-sm font-semibold text-slate-200">
                          {q.max_marks} marks
                        </span>
                      </div>

                      <p className="text-base font-semibold text-slate-100 truncate leading-relaxed">
                        {q.question_text || 'Untitled question'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeQuestion(idx)
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-200 hover:bg-red-500/20 border border-transparent hover:border-red-400/40 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {expandedQ === idx ? (
                        <ChevronUp className="w-5 h-5 text-slate-200" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedQ === idx && (
                      <motion.div
                        className="px-6 pb-6 border-t border-slate-700 pt-5 space-y-5 bg-slate-950/60"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <div>
                            <label className="label">Bloom Level</label>
                            <select
                              className="input"
                              value={q.bloom_level || 'K2'}
                              onChange={(e) =>
                                updateQuestion(idx, 'bloom_level', e.target.value)
                              }
                            >
                              {BLOOM_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="label">Marks</label>
                            <input
                              className="input"
                              type="text"
                              inputMode="decimal"
                              value={q.max_marks}
                              onChange={(e) => {
                                const value = e.target.value

                                if (/^\d*\.?\d*$/.test(value)) {
                                  updateQuestion(idx, 'max_marks', value)
                                }
                              }}
                              onBlur={() => {
                                const value = Number.parseFloat(q.max_marks)

                                updateQuestion(
                                  idx,
                                  'max_marks',
                                  Number.isNaN(value) || value < MIN_MARKS ? 1 : value
                                )
                              }}
                            />
                          </div>

                          <button
                            type="button"
                            className="btn-secondary justify-center py-2.5"
                            onClick={() => regenerateQuestion(idx)}
                            disabled={regeneratingIndex === idx}
                          >
                            {regeneratingIndex === idx ? (
                              <>
                                <Spinner size="sm" /> Regenerating…
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" /> Regenerate
                              </>
                            )}
                          </button>
                        </div>

                        <div>
                          <label className="label">Question Text *</label>
                          <textarea
                            className="input text-slate-50"
                            rows={3}
                            value={q.question_text}
                            onChange={(e) =>
                              updateQuestion(idx, 'question_text', e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label className="label">Expected Answer / Model Answer</label>
                          <textarea
                            className="input text-slate-50"
                            rows={4}
                            value={q.expected_answer}
                            onChange={(e) =>
                              updateQuestion(idx, 'expected_answer', e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label className="label">Key Points / Rubric one per line</label>
                          <textarea
                            className="input text-slate-50"
                            rows={4}
                            placeholder="- Define the concept&#10;- Explain the mechanism&#10;- Provide a practical example"
                            value={q._keyPointsText}
                            onChange={(e) =>
                              updateQuestion(idx, '_keyPointsText', e.target.value)
                            }
                          />

                          <p className="text-sm text-slate-300 mt-2">
                            These points are used by the AI evaluation engine to score student
                            answers.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <button
              onClick={addQuestion}
              className="btn-secondary w-full justify-center py-3 mb-6 text-base"
            >
              <Plus className="w-4 h-4" /> Add Question Manually
            </button>

            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1 justify-center py-3 text-base"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                <Save className="w-4 h-4" /> Save as Draft
              </button>

              <button
                className="btn-primary flex-1 justify-center py-3 text-base"
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Spinner size="sm" /> Saving…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Save & Publish
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  )
}