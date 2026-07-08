import json
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app import schemas
from app.deps import require_faculty
from app.services import assignment_service
from app.services import llm_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/faculty", tags=["faculty"])


def _safe_bloom_level(value):
    """
    Convert incoming Bloom level safely into DB enum.
    Defaults to K2 when missing/invalid.
    """
    if value is None:
        return models.BloomLevelEnum.K2

    try:
        if hasattr(value, "value"):
            value = value.value
        return models.BloomLevelEnum(value)
    except Exception:
        return models.BloomLevelEnum.K2


@router.post("/assignments/generate")
def generate_questions(
    request: schemas.QuestionGenerateRequest,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    """Generate assignment questions using LLM with Bloom-level distribution."""
    try:
        questions = assignment_service.generate_assignment_questions(
            subject=request.subject,
            topic=request.topic,
            difficulty=request.difficulty.value,
            num_questions=request.num_questions,
            marks_per_question=request.marks_per_question,
        )
        return {"questions": [q.dict() for q in questions]}
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.post("/assignments/regenerate-question")
def regenerate_single_question(
    request: schemas.QuestionRegenerateRequest,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    """
    Regenerate one question based on selected Bloom level.
    Useful when faculty changes K1/K2/K3/K4 for a single question in UI.
    """
    try:
        bloom_level = request.bloom_level.value
        bloom_info = assignment_service.BLOOM_LEVELS.get(
            bloom_level,
            assignment_service.BLOOM_LEVELS["K2"],
        )

        question_text = ""

        for attempt in range(6):
            bloom_topic = assignment_service._build_bloom_topic(
                request.topic,
                bloom_level,
            )

            candidate = llm_service.generate_question(
                subject=request.subject,
                topic=bloom_topic,
                difficulty=bloom_info["difficulty"],
                index=attempt,
            )

            candidate = assignment_service._remove_duplicate_prefix(candidate)

            if candidate and not assignment_service._is_duplicate_question(
                candidate,
                request.existing_questions,
            ):
                question_text = candidate
                break

        if not question_text:
            question_text = assignment_service._fallback_question(
                subject=request.subject,
                topic=request.topic,
                bloom_level=bloom_level,
                question_number=len(request.existing_questions),
            )

        expected_answer = llm_service.generate_expected_answer(
            question_text,
            request.subject,
            request.topic,
        )

        key_points = llm_service.extract_key_points(
            question_text,
            expected_answer,
        )

        return schemas.GeneratedQuestion(
            question_text=question_text,
            expected_answer=expected_answer,
            key_points=key_points,
            max_marks=request.marks_per_question,
            bloom_level=bloom_level,
        ).dict()

    except Exception as e:
        logger.error(f"Single question regeneration failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Regeneration failed: {str(e)}",
        )


@router.post("/assignments", response_model=schemas.AssignmentOut)
def create_assignment(
    payload: schemas.AssignmentCreate,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    """Create and optionally publish an assignment."""
    assignment = models.Assignment(
        title=payload.title,
        subject=payload.subject,
        topic=payload.topic,
        difficulty=models.DifficultyEnum(payload.difficulty.value),
        instructions=payload.instructions,
        created_by=current_user.id,
        status=models.AssignmentStatusEnum(payload.status.value),
    )
    db.add(assignment)
    db.flush()

    for i, q in enumerate(payload.questions):
        question = models.Question(
            assignment_id=assignment.id,
            question_text=q.question_text,
            max_marks=q.max_marks,
            expected_answer=q.expected_answer,
            key_points_json=q.key_points_json,
            order_index=i,
            bloom_level=_safe_bloom_level(q.bloom_level),
        )
        db.add(question)

    db.commit()
    db.refresh(assignment)

    return _assignment_to_out(assignment)


@router.get("/assignments", response_model=List[schemas.AssignmentListItem])
def list_assignments(
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    assignments = (
        db.query(models.Assignment)
        .filter(models.Assignment.created_by == current_user.id)
        .order_by(models.Assignment.created_at.desc())
        .all()
    )

    result = []
    for a in assignments:
        total_marks = sum(q.max_marks for q in a.questions)
        result.append(
            schemas.AssignmentListItem(
                id=a.id,
                title=a.title,
                subject=a.subject,
                topic=a.topic,
                difficulty=a.difficulty.value,
                status=a.status.value,
                created_at=a.created_at,
                question_count=len(a.questions),
                total_marks=total_marks,
                creator_name=current_user.full_name,
            )
        )
    return result


@router.get("/assignments/{assignment_id}", response_model=schemas.AssignmentOut)
def get_assignment(
    assignment_id: int,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.id == assignment_id,
            models.Assignment.created_by == current_user.id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return _assignment_to_out(assignment)


@router.put("/assignments/{assignment_id}", response_model=schemas.AssignmentOut)
def update_assignment(
    assignment_id: int,
    payload: schemas.AssignmentCreate,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.id == assignment_id,
            models.Assignment.created_by == current_user.id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment.title = payload.title
    assignment.subject = payload.subject
    assignment.topic = payload.topic
    assignment.difficulty = models.DifficultyEnum(payload.difficulty.value)
    assignment.instructions = payload.instructions
    assignment.status = models.AssignmentStatusEnum(payload.status.value)

    for q in assignment.questions:
        db.delete(q)
    db.flush()

    for i, q in enumerate(payload.questions):
        question = models.Question(
            assignment_id=assignment.id,
            question_text=q.question_text,
            max_marks=q.max_marks,
            expected_answer=q.expected_answer,
            key_points_json=q.key_points_json,
            order_index=i,
            bloom_level=_safe_bloom_level(q.bloom_level),
        )
        db.add(question)

    db.commit()
    db.refresh(assignment)
    return _assignment_to_out(assignment)


@router.get("/assignments/{assignment_id}/submissions")
def get_submissions(
    assignment_id: int,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.id == assignment_id,
            models.Assignment.created_by == current_user.id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    submissions = (
        db.query(models.Submission)
        .filter(models.Submission.assignment_id == assignment_id)
        .all()
    )

    total_max = sum(q.max_marks for q in assignment.questions)
    result = []

    for sub in submissions:
        ai_total = sum((a.ai_score or 0) for a in sub.answers)
        final_total = sum((a.final_score or 0) for a in sub.answers)

        result.append(
            {
                "id": sub.id,
                "assignment_id": sub.assignment_id,
                "assignment_title": assignment.title,
                "student_id": sub.student_id,
                "student_name": sub.student.full_name,
                "submitted_at": sub.submitted_at.isoformat(),
                "status": sub.status.value,
                "ai_total": round(ai_total, 2),
                "final_total": round(final_total, 2),
                "max_total": total_max,
            }
        )

    return result


@router.get("/submissions/{submission_id}")
def get_submission_detail(
    submission_id: int,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    sub = db.query(models.Submission).filter(models.Submission.id == submission_id).first()

    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.id == sub.assignment_id,
            models.Assignment.created_by == current_user.id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=403, detail="Access denied")

    answers_data = []

    for ans in sub.answers:
        q = ans.question
        answers_data.append(
            {
                "id": ans.id,
                "question_id": q.id,
                "question_text": q.question_text,
                "bloom_level": q.bloom_level.value if q.bloom_level else None,
                "expected_answer": q.expected_answer,
                "key_points_json": q.key_points_json,
                "max_marks": q.max_marks,
                "answer_text": ans.answer_text,
                "ai_score": ans.ai_score,
                "ai_feedback": ans.ai_feedback,
                "covered_points_json": ans.covered_points_json,
                "missing_points_json": ans.missing_points_json,
                "semantic_similarity": ans.semantic_similarity,
                "keyword_coverage": ans.keyword_coverage,
                "completeness_score": ans.completeness_score,
                "final_score": ans.final_score,
                "faculty_override_score": ans.faculty_override_score,
                "faculty_remark": ans.faculty_remark,
                "reviewed_at": ans.reviewed_at.isoformat() if ans.reviewed_at else None,
            }
        )

    return {
        "id": sub.id,
        "assignment_id": sub.assignment_id,
        "assignment_title": assignment.title,
        "student_id": sub.student_id,
        "student_name": sub.student.full_name,
        "submitted_at": sub.submitted_at.isoformat(),
        "status": sub.status.value,
        "answers": answers_data,
    }


@router.post("/submissions/{submission_id}/override")
def override_scores(
    submission_id: int,
    payload: schemas.OverrideRequest,
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    sub = db.query(models.Submission).filter(models.Submission.id == submission_id).first()

    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.id == sub.assignment_id,
            models.Assignment.created_by == current_user.id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=403, detail="Access denied")

    for item in payload.overrides:
        answer_id = item.get("answer_id")
        override_score = item.get("override_score")
        faculty_remark = item.get("faculty_remark", "")

        ans = (
            db.query(models.Answer)
            .filter(
                models.Answer.id == answer_id,
                models.Answer.submission_id == submission_id,
            )
            .first()
        )

        if not ans:
            continue

        question = (
            db.query(models.Question)
            .filter(models.Question.id == ans.question_id)
            .first()
        )

        max_marks = question.max_marks if question else 10.0

        if override_score is not None:
            override_score = max(0.0, min(float(override_score), max_marks))
            ans.faculty_override_score = override_score
            ans.final_score = override_score

        if faculty_remark is not None:
            ans.faculty_remark = faculty_remark

        ans.reviewed_by = current_user.id
        ans.reviewed_at = datetime.utcnow()

    sub.status = models.SubmissionStatusEnum.reviewed
    db.commit()

    return {"message": "Override saved successfully"}


@router.get("/analytics")
def get_analytics(
    current_user: models.User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    assignments = (
        db.query(models.Assignment)
        .filter(models.Assignment.created_by == current_user.id)
        .all()
    )

    total_assignments = len(assignments)
    published = sum(
        1 for a in assignments if a.status == models.AssignmentStatusEnum.published
    )
    assignment_ids = [a.id for a in assignments]

    all_submissions = (
        db.query(models.Submission)
        .filter(models.Submission.assignment_id.in_(assignment_ids))
        .all()
        if assignment_ids
        else []
    )

    total_submissions = len(all_submissions)
    reviewed = sum(
        1 for s in all_submissions if s.status == models.SubmissionStatusEnum.reviewed
    )
    pending = total_submissions - reviewed

    ai_scores = []

    for sub in all_submissions:
        for ans in sub.answers:
            if ans.ai_score is not None:
                q = (
                    db.query(models.Question)
                    .filter(models.Question.id == ans.question_id)
                    .first()
                )
                if q and q.max_marks > 0:
                    ai_scores.append(ans.ai_score / q.max_marks * 100)

    avg_ai_pct = round(sum(ai_scores) / len(ai_scores), 1) if ai_scores else None

    return {
        "total_assignments": total_assignments,
        "published_assignments": published,
        "total_submissions": total_submissions,
        "pending_review": pending,
        "reviewed_count": reviewed,
        "avg_ai_score_pct": avg_ai_pct,
    }


def _assignment_to_out(assignment: models.Assignment) -> schemas.AssignmentOut:
    return schemas.AssignmentOut(
        id=assignment.id,
        title=assignment.title,
        subject=assignment.subject,
        topic=assignment.topic,
        difficulty=assignment.difficulty.value,
        instructions=assignment.instructions,
        created_by=assignment.created_by,
        status=assignment.status.value,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
        questions=[
            schemas.QuestionOut(
                id=q.id,
                assignment_id=q.assignment_id,
                question_text=q.question_text,
                max_marks=q.max_marks,
                expected_answer=q.expected_answer,
                key_points_json=q.key_points_json,
                order_index=q.order_index,
                bloom_level=q.bloom_level.value if q.bloom_level else None,
            )
            for q in assignment.questions
        ],
        creator_name=assignment.creator.full_name if assignment.creator else None,
    )