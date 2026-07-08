"""
LLM Service
-----------
Uses:
- google/flan-t5-small for text generation (question generation, feedback, rubrics)
- sentence-transformers/all-MiniLM-L6-v2 for semantic embeddings

Models are loaded once at startup and reused across requests.
Includes off-topic validation, retries, and intelligent fallbacks.
"""

import logging
import re
from typing import List

logger = logging.getLogger(__name__)

_generator = None
_embedder = None
_models_loaded = False
_load_error = None

# Lightweight model for local/demo use.
# flan-t5-small is faster and easier to run on CPU than flan-t5-base.
GEN_MODEL_NAME = "google/flan-t5-small"
EMB_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def load_models():
    """
    Load generation and embedding models once.
    If any model fails, fallback logic will still keep the app usable.
    """
    global _generator, _embedder, _models_loaded, _load_error

    if _models_loaded:
        return

    try:
        logger.info(f"Loading {GEN_MODEL_NAME} ...")
        from transformers import pipeline

        _generator = pipeline(
            "text2text-generation",
            model=GEN_MODEL_NAME,
            device=-1,  # CPU
        )
        logger.info("Generation model loaded successfully.")

    except Exception as e:
        logger.error(f"Failed to load generation model: {e}")
        _load_error = str(e)
        _generator = None

    try:
        logger.info(f"Loading {EMB_MODEL_NAME} ...")
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer(EMB_MODEL_NAME)
        logger.info("Sentence-transformer loaded successfully.")

    except Exception as e:
        logger.error(f"Failed to load sentence-transformer: {e}")
        _embedder = None

    _models_loaded = True


def _generate_text(
    prompt: str,
    max_tokens: int = 160,
    do_sample: bool = False,
    temperature: float = 0.7,
) -> str:
    """
    Generate text using Flan-T5.
    Uses deterministic decoding by default for stable academic/demo output.
    """
    global _generator

    if _generator is None:
        return ""

    try:
        if do_sample:
            result = _generator(
                prompt,
                max_new_tokens=max_tokens,
                do_sample=True,
                temperature=temperature,
                top_p=0.9,
                repetition_penalty=1.25,
                no_repeat_ngram_size=3,
            )
        else:
            result = _generator(
                prompt,
                max_new_tokens=max_tokens,
                num_beams=4,
                do_sample=False,
                repetition_penalty=1.25,
                no_repeat_ngram_size=3,
                early_stopping=True,
            )

        if result and isinstance(result, list):
            return result[0].get("generated_text", "").strip()

        return ""

    except Exception as e:
        logger.warning(f"Text generation error: {e}")
        return ""


# ----------------------- Embeddings -----------------------

def get_embedding(text: str):
    global _embedder

    if _embedder is None:
        return None

    try:
        return _embedder.encode(text, convert_to_numpy=True)

    except Exception as e:
        logger.warning(f"Embedding error: {e}")
        return None


def compute_semantic_similarity(text_a: str, text_b: str) -> float:
    """
    Compute semantic similarity using sentence-transformers.
    Falls back to keyword overlap if embeddings are unavailable.
    """
    if not text_a or not text_b:
        return 0.0

    emb_a = get_embedding(text_a)
    emb_b = get_embedding(text_b)

    if emb_a is None or emb_b is None:
        return _fallback_similarity(text_a, text_b)

    try:
        from sklearn.metrics.pairwise import cosine_similarity

        sim = cosine_similarity(emb_a.reshape(1, -1), emb_b.reshape(1, -1))[0][0]
        return float(max(0.0, min((sim + 1) / 2, 1.0)))

    except Exception as e:
        logger.warning(f"Cosine similarity error: {e}")
        return _fallback_similarity(text_a, text_b)


def _fallback_similarity(text_a: str, text_b: str) -> float:
    words_a = set(re.findall(r"\b\w{3,}\b", text_a.lower()))
    words_b = set(re.findall(r"\b\w{3,}\b", text_b.lower()))

    if not words_a or not words_b:
        return 0.0

    return len(words_a & words_b) / max(len(words_a), len(words_b))


# ----------------------- Topic Validation -----------------------

OFF_TOPIC_PATTERNS = [
    "the passage",
    "this passage",
    "the paragraph",
    "the text above",
    "best title",
    "the author",
    "according to the passage",
    "the following passage",
    "the article",
    "the story",
    "main idea of the",
    "what does the author",
]


def is_question_on_topic(question: str, topic: str) -> bool:
    """
    Validate that a generated question is actually about the given topic.
    Rejects common Flan-T5 hallucinations such as reading-comprehension style output.
    """
    if not question or len(question.strip()) < 10:
        return False

    q_lower = question.lower()

    for pattern in OFF_TOPIC_PATTERNS:
        if pattern in q_lower:
            return False

    topic_words = [
        word.lower()
        for word in re.findall(r"\b\w+\b", topic)
        if len(word) > 3
    ]

    if topic_words and not any(word in q_lower for word in topic_words):
        return False

    question_starters = (
        "what",
        "why",
        "how",
        "explain",
        "describe",
        "discuss",
        "compare",
        "analyze",
        "analyse",
        "evaluate",
        "define",
        "list",
        "illustrate",
        "differentiate",
        "outline",
        "justify",
        "design",
    )

    if "?" not in question and not q_lower.lstrip().startswith(question_starters):
        return False

    return True


# ----------------------- Public API -----------------------

def generate_question(subject: str, topic: str, difficulty: str, index: int) -> str:
    """
    Generate a single exam question with retry and on-topic validation.
    Falls back to a curated template if all attempts fail.
    """
    from app.utils.prompts import question_generation_prompt

    max_retries = 3

    for attempt in range(max_retries):
        prompt = question_generation_prompt(subject, topic, difficulty, index + attempt)

        result = _generate_text(
            prompt,
            max_tokens=120,
            do_sample=(attempt > 0),
            temperature=0.8,
        )

        cleaned = _clean_generated_text(result)

        if cleaned and is_question_on_topic(cleaned, topic):
            return cleaned

        logger.info(
            f"Question generation attempt {attempt + 1} off-topic or empty. "
            f"Got: {cleaned[:80]!r}"
        )

    logger.warning(
        f"All LLM attempts failed for topic '{topic}'. Using template fallback."
    )
    return _fallback_question(subject, topic, difficulty, index)


def generate_expected_answer(question: str, subject: str, topic: str) -> str:
    from app.utils.prompts import expected_answer_prompt

    prompt = expected_answer_prompt(question, subject, topic)
    result = _generate_text(prompt, max_tokens=200)
    cleaned = _clean_generated_text(result)

    if not cleaned or len(cleaned.split()) < 8:
        return _fallback_expected_answer(topic, subject)

    return cleaned


def extract_key_points(question: str, expected_answer: str) -> List[str]:
    from app.utils.prompts import key_points_prompt

    prompt = key_points_prompt(question, expected_answer)
    result = _generate_text(prompt, max_tokens=120)
    points = _parse_key_points(result)

    if not points:
        return _fallback_key_points(expected_answer)

    return points


def generate_feedback(
    question: str,
    student_answer: str,
    expected_answer: str,
    missing: List[str],
) -> str:
    from app.utils.prompts import feedback_prompt

    prompt = feedback_prompt(question, student_answer, expected_answer, missing)
    result = _generate_text(prompt, max_tokens=140)
    cleaned = _clean_generated_text(result)

    if not cleaned or len(cleaned.split()) < 5:
        return _fallback_feedback(missing)

    return cleaned


# ----------------------- Parsing Helpers -----------------------

def _clean_generated_text(text: str) -> str:
    if not text:
        return ""

    text = re.sub(
        r"^(Question:|Answer:|Model Answer:|Key points:|Key concepts:|Feedback:)\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(
        r"^Topic:.*?->\s*Question:\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(r"\s+", " ", text).strip()
    return text


def _parse_key_points(raw: str) -> List[str]:
    if not raw:
        return []

    if "," in raw and "\n" not in raw:
        parts = [part.strip().strip(".").strip() for part in raw.split(",")]
        parts = [
            part
            for part in parts
            if 2 <= len(part.split()) <= 8 and len(part) > 3
        ]

        if parts:
            return parts[:5]

    points = []

    for line in raw.split("\n"):
        line = line.strip().lstrip("-•*0123456789. ").strip()

        if 5 < len(line) < 80:
            points.append(line)

    if not points:
        for part in re.split(r"[,;]", raw):
            part = part.strip()

            if 5 < len(part) < 80:
                points.append(part)

    return points[:5]


# ----------------------- Fallbacks -----------------------

_TEMPLATE_BANK = {
    "easy": [
        "Define {topic} in the context of {subject} and list its main characteristics.",
        "What is {topic}? Explain its purpose with a simple example from {subject}.",
        "Briefly describe the basic concept of {topic} and why it is important in {subject}.",
        "List and explain the key features of {topic} as used in {subject}.",
    ],
    "medium": [
        "Explain how {topic} works and discuss its key components in {subject}.",
        "Describe the working principle of {topic} with a relevant example in {subject}.",
        "Compare {topic} with related concepts in {subject} and highlight the differences.",
        "Discuss the practical applications of {topic} in {subject} with suitable examples.",
        "Explain the advantages and limitations of {topic} in modern {subject}.",
    ],
    "hard": [
        "Critically analyze the role of {topic} in modern {subject} and discuss its limitations.",
        "Design a real-world application of {topic} in {subject} and justify your design choices.",
        "Evaluate the trade-offs of using {topic} compared to alternative approaches in {subject}.",
        "Propose improvements to existing implementations of {topic} in {subject} with reasoning.",
        "Analyze how {topic} influences current research directions in {subject}.",
    ],
}


def _fallback_question(subject: str, topic: str, difficulty: str, index: int) -> str:
    templates = _TEMPLATE_BANK.get(difficulty.lower(), _TEMPLATE_BANK["medium"])
    template = templates[index % len(templates)]

    return template.format(topic=topic, subject=subject)


def _fallback_expected_answer(topic: str, subject: str) -> str:
    return (
        f"A complete answer should clearly define {topic} and explain its core principles "
        f"within the context of {subject}. It should describe the key components or "
        f"mechanisms involved, mention at least one practical example or application, "
        f"and highlight the importance or limitations of {topic}."
    )


def _fallback_key_points(expected_answer: str) -> List[str]:
    candidates = re.findall(
        r"\b[A-Z][a-zA-Z]+(?:\s+[a-z]+){0,2}\b",
        expected_answer,
    )

    unique = list(dict.fromkeys(candidates))
    cleaned = [candidate for candidate in unique if len(candidate) > 3][:4]

    if cleaned:
        return cleaned

    return [
        "Accurate definition",
        "Core mechanism or principle",
        "Practical application",
        "Key terminology",
    ]


def _fallback_feedback(missing: List[str]) -> str:
    if missing:
        return (
            "Your answer covers some aspects of the topic but is missing key concepts: "
            f"{', '.join(missing[:3])}. Try elaborating on these areas with definitions "
            "and examples to strengthen your response."
        )

    return (
        "Your answer demonstrates a reasonable understanding of the topic. "
        "To improve further, ensure each key concept is explained with sufficient depth "
        "and supported by relevant examples."
    )