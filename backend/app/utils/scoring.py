import re
from typing import List, Tuple


def compute_keyword_coverage(student_answer: str, key_points: List[str]) -> Tuple[float, List[str], List[str]]:
    """
    Check how many key points are covered in the student answer.
    Returns coverage ratio, covered list, missing list.
    """
    if not key_points:
        return 0.5, [], []

    student_lower = student_answer.lower()
    covered = []
    missing = []

    for point in key_points:
        point_clean = point.strip().lstrip("-•").strip()
        if not point_clean:
            continue
        # Extract significant words (3+ chars) from the key point
        words = [w for w in re.findall(r'\b\w{3,}\b', point_clean.lower()) if w not in STOPWORDS]
        if not words:
            continue
        # A point is covered if at least half its significant words appear in the answer
        matched_words = sum(1 for w in words if w in student_lower)
        if matched_words >= max(1, len(words) // 2):
            covered.append(point_clean)
        else:
            missing.append(point_clean)

    if not covered and not missing:
        return 0.5, [], []

    coverage = len(covered) / (len(covered) + len(missing))
    return coverage, covered, missing


def compute_completeness_score(student_answer: str, expected_answer: str) -> float:
    """
    Sanity check: penalize extremely short or empty answers.
    Returns 0.0 to 1.0
    """
    if not student_answer or not student_answer.strip():
        return 0.0

    student_words = len(student_answer.split())
    expected_words = len(expected_answer.split()) if expected_answer else 50

    if student_words < 5:
        return 0.05
    if student_words < 10:
        return 0.25
    if student_words < 20:
        return 0.5

    # Ratio-based check: don't penalize if student wrote more than expected
    ratio = min(student_words / max(expected_words * 0.4, 15), 1.0)
    return min(ratio, 1.0)


def compute_final_score(
    semantic_sim: float,
    keyword_coverage: float,
    completeness: float,
    max_marks: float
) -> float:
    """
    Hybrid scoring formula:
    - Semantic similarity: 50%
    - Keyword coverage: 30%
    - Completeness: 20%
    """
    if completeness < 0.05:
        return 0.0

    weighted = (
        semantic_sim * 0.50 +
        keyword_coverage * 0.30 +
        completeness * 0.20
    )
    # Apply completeness gate: if extremely incomplete, cap the score
    if completeness < 0.25:
        weighted = min(weighted, 0.25)

    score = weighted * max_marks
    # Clamp between 0 and max_marks
    return round(max(0.0, min(score, max_marks)), 2)


# Common English stopwords to skip during keyword matching
STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can",
    "has", "was", "its", "with", "that", "this", "from", "they",
    "been", "have", "their", "also", "into", "more", "than", "then",
    "when", "what", "which", "will", "used", "use", "how", "any",
    "each", "such", "may", "one", "two", "three"
}
