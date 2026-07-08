from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class RoleEnum(str, Enum):
    faculty = "faculty"
    student = "student"


class DifficultyEnum(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class BloomLevelEnum(str, Enum):
    K1 = "K1"
    K2 = "K2"
    K3 = "K3"
    K4 = "K4"


class AssignmentStatusEnum(str, Enum):
    draft = "draft"
    published = "published"


class SubmissionStatusEnum(str, Enum):
    submitted = "submitted"
    evaluated = "evaluated"
    reviewed = "reviewed"


# Auth
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str
    user_id: int


class UserOut(BaseModel):
    id: int
    full_name: str
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


# Questions
class QuestionGenerateRequest(BaseModel):
    title: str
    subject: str
    topic: str

    # Kept for backward compatibility with your existing frontend/backend flow.
    # Internally, question generation will use Bloom levels K1-K4.
    difficulty: DifficultyEnum = DifficultyEnum.medium

    num_questions: int
    marks_per_question: float
    instructions: Optional[str] = None

    @validator("num_questions")
    def validate_num_questions(cls, v):
        # Updated from 10 to 20 because your requirement is up to 20 questions.
        if v < 1 or v > 20:
            raise ValueError("Number of questions must be between 1 and 20")
        return v

    @validator("marks_per_question")
    def validate_marks(cls, v):
        if v <= 0:
            raise ValueError("Marks per question must be greater than 0")
        return v


class QuestionRegenerateRequest(BaseModel):
    subject: str
    topic: str
    bloom_level: BloomLevelEnum
    marks_per_question: float
    existing_questions: List[str] = []

    @validator("marks_per_question")
    def validate_regenerate_marks(cls, v):
        if v <= 0:
            raise ValueError("Marks per question must be greater than 0")
        return v


class QuestionIn(BaseModel):
    question_text: str
    max_marks: float
    expected_answer: Optional[str] = None
    key_points_json: Optional[str] = None
    order_index: int = 0

    # New field for Bloom's taxonomy level.
    # Optional keeps old frontend requests working.
    bloom_level: Optional[BloomLevelEnum] = None


class QuestionOut(BaseModel):
    id: int
    assignment_id: int
    question_text: str
    max_marks: float
    expected_answer: Optional[str]
    key_points_json: Optional[str]
    order_index: int

    # New field for UI display/editing.
    bloom_level: Optional[str] = None

    class Config:
        from_attributes = True


class GeneratedQuestion(BaseModel):
    question_text: str
    expected_answer: str
    key_points: List[str]
    max_marks: float

    # New field returned after AI generation.
    bloom_level: Optional[str] = None


# Assignments
class AssignmentCreate(BaseModel):
    title: str
    subject: str
    topic: str

    # Kept for backward compatibility.
    difficulty: DifficultyEnum = DifficultyEnum.medium

    instructions: Optional[str] = None
    questions: List[QuestionIn]
    status: AssignmentStatusEnum = AssignmentStatusEnum.draft


class AssignmentOut(BaseModel):
    id: int
    title: str
    subject: str
    topic: str
    difficulty: str
    instructions: Optional[str]
    created_by: int
    status: str
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionOut] = []
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True


class AssignmentListItem(BaseModel):
    id: int
    title: str
    subject: str
    topic: str
    difficulty: str
    status: str
    created_at: datetime
    question_count: int
    total_marks: float
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True


# Submissions
class AnswerIn(BaseModel):
    question_id: int
    answer_text: Optional[str] = ""


class SubmissionCreate(BaseModel):
    answers: List[AnswerIn]


class AnswerOut(BaseModel):
    id: int
    submission_id: int
    question_id: int
    answer_text: Optional[str]
    ai_score: Optional[float]
    ai_feedback: Optional[str]
    covered_points_json: Optional[str]
    missing_points_json: Optional[str]
    semantic_similarity: Optional[float]
    keyword_coverage: Optional[float]
    completeness_score: Optional[float]
    final_score: Optional[float]
    faculty_override_score: Optional[float]
    faculty_remark: Optional[str]
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class SubmissionOut(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    submitted_at: datetime
    status: str
    answers: List[AnswerOut] = []
    student_name: Optional[str] = None
    assignment_title: Optional[str] = None

    class Config:
        from_attributes = True


class SubmissionListItem(BaseModel):
    id: int
    assignment_id: int
    assignment_title: str
    student_id: int
    student_name: str
    submitted_at: datetime
    status: str
    ai_total: Optional[float]
    final_total: Optional[float]
    max_total: float

    class Config:
        from_attributes = True


# Faculty override
class OverrideRequest(BaseModel):
    overrides: List[dict]  # [{answer_id, override_score, faculty_remark}]


# Analytics
class AnalyticsOut(BaseModel):
    total_assignments: int
    published_assignments: int
    total_submissions: int
    pending_review: int
    reviewed_count: int
    avg_ai_score_pct: Optional[float]