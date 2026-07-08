"""
Evaluation Service
------------------
Hybrid AI evaluation pipeline:
1. Semantic similarity (sentence-transformers) — 50%
2. Keyword/key-point coverage — 30%
3. Completeness/length sanity — 20%
4. LLM-based feedback explanation
"""

import json
import logging
from typing import Optional

from app.services import llm_service
from app.utils.scoring import (
    compute_keyword_coverage,
    compute_completeness_score,
    compute_final_score,
)

logger = logging.getLogger(__name__)


def evaluate_answer(
    student_answer: str,
    expected_answer: str,
    key_points_json: Optional[str],
    max_marks: float,
    question_text: str = ""
) -> dict:
    """
    Full evaluation pipeline for a single answer.
    Returns dict with all evaluation fields.
    """
    student_answer = (student_answer or "").strip()
    expected_answer = (expected_answer or "").strip()

    # Parse key points
    key_points = []
    if key_points_json:
        try:
            key_points = json.loads(key_points_json)
        except Exception:
            key_points = []

    # 1. Semantic similarity
    semantic_sim = 0.0
    if student_answer and expected_answer:
        semantic_sim = llm_service.compute_semantic_similarity(student_answer, expected_answer)

    # 2. Keyword / key-point coverage
    keyword_cov, covered, missing = 0.0, [], []
    if student_answer and key_points:
        keyword_cov, covered, missing = compute_keyword_coverage(student_answer, key_points)
    elif student_answer and expected_answer:
        # Fall back to word overlap against expected answer
        keyword_cov, covered, missing = compute_keyword_coverage(
            student_answer,
            [w for w in expected_answer.split(". ") if len(w) > 10]
        )

    # 3. Completeness
    completeness = compute_completeness_score(student_answer, expected_answer)

    # 4. Final AI score
    ai_score = compute_final_score(semantic_sim, keyword_cov, completeness, max_marks)

    # 5. AI Feedback
    ai_feedback = ""
    if student_answer:
        ai_feedback = llm_service.generate_feedback(
            question=question_text,
            student_answer=student_answer,
            expected_answer=expected_answer,
            missing=missing[:3]
        )
    else:
        ai_feedback = "No answer was provided for this question."

    return {
        "ai_score": ai_score,
        "ai_feedback": ai_feedback,
        "covered_points_json": json.dumps(covered),
        "missing_points_json": json.dumps(missing),
        "semantic_similarity": round(semantic_sim, 4),
        "keyword_coverage": round(keyword_cov, 4),
        "completeness_score": round(completeness, 4),
        "final_score": ai_score,  # Default final = AI score (until faculty overrides)
    }
