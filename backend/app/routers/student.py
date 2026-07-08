import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app import schemas
from app.deps import require_student
from app.services import evaluation_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/student", tags=["student"])


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract text from PDF or DOCX file bytes."""
    filename_lower = filename.lower()
    if filename_lower.endswith(".pdf"):
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text.strip()
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise HTTPException(status_code=400, detail=f"Could not extract text from PDF: {str(e)}")
    elif filename_lower.endswith(".docx"):
        try:
            import io
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
            return text.strip()
        except Exception as e:
            logger.error(f"DOCX extraction error: {e}")
            raise HTTPException(status_code=400, detail=f"Could not extract text from DOCX: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF or DOCX.")


@router.get("/assignments")
def list_assignments(
    current_user: models.User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """List all published assignments available to students."""
    assignments = db.query(models.Assignment).filter(
        models.Assignment.status == models.AssignmentStatusEnum.published
    ).order_by(models.Assignment.created_at.desc()).all()

    # Check which ones this student has already submitted
    submission_map = {}
    for sub in db.query(models.Submission).filter(
        models.Submission.student_id == current_user.id
    ).all():
        submission_map[sub.assignment_id] = sub.id

    result = []
    for a in assignments:
        total_marks = sum(q.max_marks for q in a.questions)
        result.append({
            "id": a.id,
            "title": a.title,
            "subject": a.subject,
            "topic": a.topic,
            "difficulty": a.difficulty.value,
            "instructions": a.instructions,
            "created_at": a.created_at.isoformat(),
            "question_count": len(a.questions),
            "total_marks": total_marks,
            "creator_name": a.creator.full_name if a.creator else "Faculty",
            "already_submitted": a.id in submission_map,
            "submission_id": submission_map.get(a.id)
        })
    return result


@router.get("/assignments/{assignment_id}")
def get_assignment(
    assignment_id: int,
    current_user: models.User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Get assignment details with questions (no expected answers shown to students)."""
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id,
        models.Assignment.status == models.AssignmentStatusEnum.published
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not published")

    # Check existing submission
    existing_sub = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id,
        models.Submission.student_id == current_user.id
    ).first()

    return {
        "id": assignment.id,
        "title": assignment.title,
        "subject": assignment.subject,
        "topic": assignment.topic,
        "difficulty": assignment.difficulty.value,
        "instructions": assignment.instructions,
        "created_at": assignment.created_at.isoformat(),
        "creator_name": assignment.creator.full_name if assignment.creator else "Faculty",
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "max_marks": q.max_marks,
                "order_index": q.order_index
            }
            for q in assignment.questions
        ],
        "already_submitted": existing_sub is not None,
        "submission_id": existing_sub.id if existing_sub else None
    }


@router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: int,
    answers_json: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """
    Submit answers for an assignment.
    Accepts either typed answers (JSON) or a file upload (PDF/DOCX).
    If a file is uploaded, its text is used as the answer for all questions collectively,
    split by question if possible, otherwise applied to first question.
    """
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id,
        models.Assignment.status == models.AssignmentStatusEnum.published
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not published")

    # Prevent duplicate submission
    existing = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id,
        models.Submission.student_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted this assignment")

    # Parse answers JSON
    try:
        answers_list = json.loads(answers_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid answers format")

    # Build answer map: question_id -> answer_text
    answer_map = {str(a["question_id"]): a.get("answer_text", "") for a in answers_list}

    # If file uploaded, extract and distribute text
    if file and file.filename:
        file_bytes = await file.read()
        extracted_text = extract_text_from_file(file_bytes, file.filename)
        questions = assignment.questions

        # Try to split by question number markers
        import re
        sections = re.split(r'\n(?:Q(?:uestion)?\s*\.?\s*\d+[\.:)])', extracted_text, flags=re.IGNORECASE)
        if len(sections) >= len(questions):
            for i, q in enumerate(questions):
                answer_map[str(q.id)] = sections[i + 1].strip() if i + 1 < len(sections) else extracted_text
        else:
            # Distribute equally or assign full text to each
            chunk_size = max(len(extracted_text) // len(questions), 100) if questions else len(extracted_text)
            for i, q in enumerate(questions):
                start = i * chunk_size
                end = start + chunk_size if i < len(questions) - 1 else len(extracted_text)
                answer_map[str(q.id)] = extracted_text[start:end].strip()

    # Create submission
    submission = models.Submission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        status=models.SubmissionStatusEnum.evaluated
    )
    db.add(submission)
    db.flush()

    # Evaluate each answer
    for question in assignment.questions:
        answer_text = answer_map.get(str(question.id), "")
        eval_result = evaluation_service.evaluate_answer(
            student_answer=answer_text,
            expected_answer=question.expected_answer or "",
            key_points_json=question.key_points_json,
            max_marks=question.max_marks,
            question_text=question.question_text
        )
        answer = models.Answer(
            submission_id=submission.id,
            question_id=question.id,
            answer_text=answer_text,
            **eval_result
        )
        db.add(answer)

    db.commit()
    db.refresh(submission)
    return {"submission_id": submission.id, "message": "Submission evaluated successfully"}


@router.get("/submissions/{submission_id}/result")
def get_result(
    submission_id: int,
    current_user: models.User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Get evaluation result for a submission."""
    sub = db.query(models.Submission).filter(
        models.Submission.id == submission_id,
        models.Submission.student_id == current_user.id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = sub.assignment
    total_max = sum(q.max_marks for q in assignment.questions)
    ai_total = sum((a.ai_score or 0) for a in sub.answers)
    final_total = sum((a.final_score or 0) for a in sub.answers)

    answers_data = []
    for ans in sub.answers:
        q = ans.question
        covered = []
        missing = []
        try:
            covered = json.loads(ans.covered_points_json or "[]")
        except Exception:
            pass
        try:
            missing = json.loads(ans.missing_points_json or "[]")
        except Exception:
            pass

        answers_data.append({
            "id": ans.id,
            "question_id": q.id,
            "question_text": q.question_text,
            "max_marks": q.max_marks,
            "answer_text": ans.answer_text,
            "ai_score": ans.ai_score,
            "final_score": ans.final_score,
            "faculty_override_score": ans.faculty_override_score,
            "ai_feedback": ans.ai_feedback,
            "faculty_remark": ans.faculty_remark,
            "covered_points": covered,
            "missing_points": missing,
            "semantic_similarity": ans.semantic_similarity,
            "keyword_coverage": ans.keyword_coverage,
            "completeness_score": ans.completeness_score,
            "reviewed_at": ans.reviewed_at.isoformat() if ans.reviewed_at else None,
        })

    return {
        "id": sub.id,
        "assignment_id": assignment.id,
        "assignment_title": assignment.title,
        "subject": assignment.subject,
        "submitted_at": sub.submitted_at.isoformat(),
        "status": sub.status.value,
        "total_max": total_max,
        "ai_total": round(ai_total, 2),
        "final_total": round(final_total, 2),
        "answers": answers_data
    }


@router.get("/my-submissions")
def my_submissions(
    current_user: models.User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """List all submissions by this student."""
    submissions = db.query(models.Submission).filter(
        models.Submission.student_id == current_user.id
    ).order_by(models.Submission.submitted_at.desc()).all()

    result = []
    for sub in submissions:
        assignment = sub.assignment
        total_max = sum(q.max_marks for q in assignment.questions)
        final_total = sum((a.final_score or 0) for a in sub.answers)
        result.append({
            "id": sub.id,
            "assignment_id": assignment.id,
            "assignment_title": assignment.title,
            "subject": assignment.subject,
            "submitted_at": sub.submitted_at.isoformat(),
            "status": sub.status.value,
            "final_total": round(final_total, 2),
            "total_max": total_max
        })
    return result
