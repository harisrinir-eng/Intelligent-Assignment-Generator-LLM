# Intelligent-Assignment-Generator-LLM

A full-stack web portal that uses transformer-based LLMs to generate assignments, evaluate student answers using hybrid AI, and support faculty-guided grading workflows.

---

## Features

### Faculty
- Create assignments using **Flan-T5** (google/flan-t5-small) for question and rubric generation
- Edit generated questions and key-point rubrics before publishing
- View all student submissions with AI-generated scores
- Override AI scores per question and add faculty remarks (human-in-the-loop)
- Dashboard analytics: total submissions, pending reviews, average AI score

### Student
- View all published assignments
- Answer questions in-portal (question-by-question navigation)
- Upload answers as a text-based PDF or DOCX file
- View AI provisional scores, semantic similarity, key-point coverage, and feedback
- View faculty override scores and remarks

### AI Evaluation (Hybrid Pipeline)
1. **Semantic Similarity** (50%) — `sentence-transformers/all-MiniLM-L6-v2` cosine similarity
2. **Key-Point Coverage** (30%) — word overlap against extracted rubric points
3. **Answer Completeness** (20%) — length and content sanity checks
4. **LLM Feedback** — Flan-T5 generated constructive academic feedback

---

## LLM / AI Concepts Demonstrated

| Concept | Implementation |
|---|---|
| Transformer text generation | Flan-T5-small via HuggingFace `transformers` |
| Semantic embeddings | `all-MiniLM-L6-v2` sentence vectors |
| Cosine similarity | `sklearn.metrics.pairwise.cosine_similarity` |
| Prompt engineering | Structured academic prompts in `utils/prompts.py` |
| Human-in-the-loop | Faculty override on AI scores |
| Explainable AI | Covered/missing concepts, metric breakdown |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, Framer Motion, React Router |
| Backend | FastAPI, Uvicorn, SQLAlchemy, Pydantic, Python 3.10+ |
| Database | SQLite (auto-created on first run) |
| AI/NLP | Flan-T5-small, sentence-transformers, scikit-learn |
| Auth | JWT (python-jose), bcrypt (passlib) |
| File Parsing | PyMuPDF (PDF), python-docx (DOCX) |

---

## Demo Credentials

| Role | Username | Password |
|---|---|---|
| Faculty | faculty1 | faculty123 |
| Faculty | faculty2 | faculty123 |
| Student | student1 | student123 |
| Student | student2 | student123 |
| Student | student3 | student123 |

---

## Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- ~2 GB disk space for AI model downloads (done automatically on first run)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at: http://127.0.0.1:8000

> **Note:** On first run, Flan-T5-small (~300MB) and all-MiniLM-L6-v2 (~90MB) are downloaded from HuggingFace automatically. Requires internet connection on first launch only.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Project Structure

```
assignment-portal/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, startup lifecycle
│   │   ├── database.py          # SQLite + SQLAlchemy engine
│   │   ├── models.py            # ORM models (User, Assignment, Question, Submission, Answer)
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── deps.py              # JWT auth dependencies
│   │   ├── seed.py              # Demo user seeder
│   │   ├── routers/
│   │   │   ├── auth.py          # Login, /me
│   │   │   ├── faculty.py       # Assignment CRUD, override, analytics
│   │   │   └── student.py       # Assignment view, submit (text+file), results
│   │   ├── services/
│   │   │   ├── llm_service.py   # Flan-T5 generation + sentence-transformer embeddings
│   │   │   ├── evaluation_service.py  # Hybrid AI evaluation pipeline
│   │   │   └── assignment_service.py  # Question generation orchestration
│   │   └── utils/
│   │       ├── security.py      # JWT + bcrypt
│   │       ├── scoring.py       # Keyword coverage, completeness, final score formula
│   │       └── prompts.py       # Prompt templates for Flan-T5
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Router, protected routes
    │   ├── main.jsx
    │   ├── api/axios.js         # Axios instance with JWT interceptor
    │   ├── context/AuthContext.jsx
    │   ├── components/
    │   │   ├── layout/AppLayout.jsx
    │   │   └── common/          # PageHeader, Spinner, Badges, ScoreBar, EmptyState
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── faculty/         # FacultyDashboard, CreateAssignment, AssignmentDetail, SubmissionReview
    │   │   └── student/         # StudentDashboard, TakeAssignment, StudentResult
    │   └── styles/index.css
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | — | JWT login |
| GET | /api/auth/me | any | Current user info |
| POST | /api/faculty/assignments/generate | faculty | LLM question generation |
| POST | /api/faculty/assignments | faculty | Create assignment |
| GET | /api/faculty/assignments | faculty | List my assignments |
| GET | /api/faculty/assignments/{id} | faculty | Assignment detail |
| PUT | /api/faculty/assignments/{id} | faculty | Update assignment |
| GET | /api/faculty/assignments/{id}/submissions | faculty | List submissions |
| GET | /api/faculty/submissions/{id} | faculty | Submission detail |
| POST | /api/faculty/submissions/{id}/override | faculty | Override scores |
| GET | /api/faculty/analytics | faculty | Dashboard stats |
| GET | /api/student/assignments | student | List published assignments |
| GET | /api/student/assignments/{id} | student | Assignment questions |
| POST | /api/student/assignments/{id}/submit | student | Submit answers (text or file) |
| GET | /api/student/submissions/{id}/result | student | View evaluation result |
| GET | /api/student/my-submissions | student | List my submissions |
| GET | /api/health | — | Health check |

---

## Scoring Formula

```
Final Score = (Semantic Similarity × 0.50 +
               Key-Point Coverage  × 0.30 +
               Completeness Score  × 0.20) × Max Marks

Clamped: 0 ≤ score ≤ max_marks
Empty answer → score = 0
Very short (<5 words) → score ≤ 5% of max
```

---

## Limitations

- Flan-T5-small is lightweight and may produce generic questions; flan-t5-base gives better output
- No OCR support — uploaded documents must be text-based PDFs
- No scanned document support
- No plagiarism detection
- No email notifications
- Single institution, no multi-tenant support

## Future Enhancements

- Upgrade to Flan-T5-base or Mistral-7B-Instruct for better generation quality
- Add question bank with tagging
- Bloom's taxonomy level classification per question
- Similarity-based plagiarism detection
- Export results as CSV/PDF
- Assignment deadline management
