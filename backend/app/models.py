from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class RoleEnum(str, enum.Enum):
    faculty = "faculty"
    student = "student"


class DifficultyEnum(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class BloomLevelEnum(str, enum.Enum):
    K1 = "K1"
    K2 = "K2"
    K3 = "K3"
    K4 = "K4"


class AssignmentStatusEnum(str, enum.Enum):
    draft = "draft"
    published = "published"


class SubmissionStatusEnum(str, enum.Enum):
    submitted = "submitted"
    evaluated = "evaluated"
    reviewed = "reviewed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assignments = relationship(
        "Assignment",
        back_populates="creator",
        foreign_keys="Assignment.created_by",
    )
    submissions = relationship("Submission", back_populates="student")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    subject = Column(String(100), nullable=False)
    topic = Column(String(200), nullable=False)

    # Kept for backward compatibility.
    # Actual question level is now stored in Question.bloom_level.
    difficulty = Column(SAEnum(DifficultyEnum), nullable=False)

    instructions = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(
        SAEnum(AssignmentStatusEnum),
        default=AssignmentStatusEnum.draft,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    creator = relationship(
        "User",
        back_populates="assignments",
        foreign_keys=[created_by],
    )
    questions = relationship(
        "Question",
        back_populates="assignment",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
    )
    submissions = relationship(
        "Submission",
        back_populates="assignment",
        cascade="all, delete-orphan",
    )


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    max_marks = Column(Float, nullable=False, default=10.0)
    expected_answer = Column(Text, nullable=True)
    key_points_json = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)

    # New field for Bloom's taxonomy level.
    # K1 = Remember, K2 = Understand, K3 = Apply, K4 = Analyze.
    bloom_level = Column(
        SAEnum(BloomLevelEnum),
        nullable=True,
        default=BloomLevelEnum.K2,
    )

    assignment = relationship("Assignment", back_populates="questions")
    answers = relationship(
        "Answer",
        back_populates="question",
        cascade="all, delete-orphan",
    )


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(
        SAEnum(SubmissionStatusEnum),
        default=SubmissionStatusEnum.submitted,
        nullable=False,
    )

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", back_populates="submissions")
    answers = relationship(
        "Answer",
        back_populates="submission",
        cascade="all, delete-orphan",
    )


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    answer_text = Column(Text, nullable=True)
    ai_score = Column(Float, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    covered_points_json = Column(Text, nullable=True)
    missing_points_json = Column(Text, nullable=True)
    semantic_similarity = Column(Float, nullable=True)
    keyword_coverage = Column(Float, nullable=True)
    completeness_score = Column(Float, nullable=True)
    final_score = Column(Float, nullable=True)
    faculty_override_score = Column(Float, nullable=True)
    faculty_remark = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    submission = relationship("Submission", back_populates="answers")
    question = relationship("Question", back_populates="answers")
    reviewer = relationship("User", foreign_keys=[reviewed_by])