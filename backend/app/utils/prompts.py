"""
Prompt Templates
----------------
All Flan-T5 prompt templates for question generation, expected answers,
key points extraction, and student feedback generation.

Supports Bloom's taxonomy levels:
- K1: Remember
- K2: Understand
- K3: Apply
- K4: Analyze

Designed for local Hugging Face models such as google/flan-t5-small.
"""


BLOOM_LEVEL_DETAILS = {
    "K1": {
        "name": "Remember",
        "instruction": "Generate a recall-based question. Use verbs like define, list, identify, name, state, or recall.",
        "example": "Define self-attention in Transformer models.",
    },
    "K2": {
        "name": "Understand",
        "instruction": "Generate a concept-explanation question. Use verbs like explain, describe, summarize, interpret, or classify.",
        "example": "Explain how self-attention helps Transformer models understand context.",
    },
    "K3": {
        "name": "Apply",
        "instruction": "Generate an application-based question. Use verbs like apply, demonstrate, use, solve, or implement.",
        "example": "Apply the Transformer architecture to design a text classification system.",
    },
    "K4": {
        "name": "Analyze",
        "instruction": "Generate an analytical or scenario-based question. Use verbs like analyze, compare, differentiate, examine, justify, or troubleshoot.",
        "example": "Analyze why Transformer models handle long-range dependencies better than RNNs.",
    },
}


def _detect_bloom_level(topic: str, difficulty: str) -> str:
    """
    Detect Bloom level from topic text or fallback difficulty.
    assignment_service.py may pass Bloom guidance inside topic for compatibility.
    """
    topic_upper = topic.upper()

    for level in ["K1", "K2", "K3", "K4"]:
        if level in topic_upper:
            return level

    difficulty_map = {
        "easy": "K1",
        "medium": "K2",
        "hard": "K4",
    }

    return difficulty_map.get(difficulty.lower(), "K2")


def _clean_topic_for_prompt(topic: str) -> str:
    """
    Remove internal Bloom guidance from topic to keep the generated question natural.
    """
    if ". Generate a K" in topic:
        return topic.split(". Generate a K", 1)[0].strip()

    return topic.strip()


def question_generation_prompt(subject: str, topic: str, difficulty: str, index: int) -> str:
    """
    Generate one unique exam question for the given subject, topic, and Bloom level.
    The prompt is strict to reduce repeated and off-topic questions.
    """
    bloom_level = _detect_bloom_level(topic, difficulty)
    bloom = BLOOM_LEVEL_DETAILS.get(bloom_level, BLOOM_LEVEL_DETAILS["K2"])
    clean_topic = _clean_topic_for_prompt(topic)

    angles = [
        "definition and basic meaning",
        "core concept and importance",
        "working principle and components",
        "real-world application",
        "advantages and limitations",
        "comparison with related concepts",
        "step-by-step process",
        "practical use case",
        "problem-solving scenario",
        "critical analysis",
        "implementation perspective",
        "evaluation of effectiveness",
        "common challenges",
        "solution design",
        "future scope",
        "security or quality perspective",
        "performance perspective",
        "case-study based reasoning",
        "academic importance",
        "industry relevance",
    ]

    angle = angles[index % len(angles)]

    return (
        "You are a university professor creating exam questions.\n"
        f"Subject: {subject}\n"
        f"Topic: {clean_topic}\n"
        f"Bloom Level: {bloom_level} - {bloom['name']}\n"
        f"Question Focus: {angle}\n\n"
        f"Instruction: {bloom['instruction']}\n"
        f"The question must be strictly about the topic: {clean_topic}.\n"
        "Do not generate reading-comprehension questions.\n"
        "Do not ask about passages, paragraphs, titles, authors, articles, or stories.\n"
        "Do not repeat the same question structure.\n"
        "Generate only one question.\n\n"
        "Good examples:\n"
        "K1 Example: Define cloud computing and list its major service models.\n"
        "K2 Example: Explain how continuous integration improves software quality.\n"
        "K3 Example: Apply OWASP Top 10 principles to identify vulnerabilities in a login module.\n"
        "K4 Example: Analyze why Transformer models perform better than RNNs for long text sequences.\n\n"
        f"Topic-specific example: {bloom['example']}\n\n"
        f"Generate one {bloom_level} question about {clean_topic}:"
    )


def expected_answer_prompt(question: str, subject: str, topic: str) -> str:
    """
    Generate a model answer focused on the question, subject, and topic.
    """
    clean_topic = _clean_topic_for_prompt(topic)

    return (
        "You are a university professor writing an ideal model answer.\n"
        f"Subject: {subject}\n"
        f"Topic: {clean_topic}\n"
        f"Question: {question}\n\n"
        "Write a clear, factually correct model answer in 5-7 sentences.\n"
        f"Stay strictly on the topic: {clean_topic}.\n"
        "Include the main definition, core concept, working idea, and one relevant example if suitable.\n"
        "Do not include unnecessary introduction or conclusion.\n\n"
        "Model Answer:"
    )


def key_points_prompt(question: str, expected_answer: str) -> str:
    """
    Extract concise rubric key points.
    """
    return (
        "Extract exactly 4 short rubric key points for scoring this answer.\n"
        "Each key point must be 2-6 words only.\n"
        "Return comma-separated key points only.\n"
        "Do not add numbering, explanation, or extra text.\n\n"
        f"Question: {question}\n"
        f"Model Answer: {expected_answer}\n\n"
        "Key Points:"
    )


def feedback_prompt(question: str, student_answer: str, expected_answer: str, missing: list) -> str:
    """
    Constructive feedback for a student's answer.
    """
    missing_str = ", ".join(missing) if missing else "none"

    return (
        "You are an academic evaluator giving constructive feedback to a student.\n"
        f"Question: {question}\n"
        f"Expected Answer: {expected_answer}\n"
        f"Student Answer: {student_answer[:400]}\n"
        f"Missing Concepts: {missing_str}\n\n"
        "Write exactly 2-3 sentences of constructive academic feedback.\n"
        "Mention what is correct and what should be improved.\n"
        "Keep the tone professional and simple.\n\n"
        "Feedback:"
    )