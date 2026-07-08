"""
Assignment Service
------------------
Handles LLM-based question generation and assignment creation logic.

Features:
- Dynamic Bloom's taxonomy distribution for any number of questions
- Supports K1, K2, K3, K4 levels
- Validates question verb/style against Bloom level
- Prevents repeated / highly similar questions
- Uses stable question-angle banks to avoid repeated questions
- Uses subject-aware templates for known dropdown subjects
- Uses local LLM as support/fallback, not the only generator
- Generates question-specific expected answers and key points
- Returns bloom_level as a separate field
"""

import logging
import re
from typing import Dict, List

from app.services import llm_service
from app.schemas import GeneratedQuestion

logger = logging.getLogger(__name__)


BLOOM_LEVELS = {
    "K1": {
        "label": "Remember",
        "difficulty": "easy",
        "verbs": ["define", "list", "identify", "state", "name"],
        "instruction": "define, list, identify, recall, name, state",
    },
    "K2": {
        "label": "Understand",
        "difficulty": "medium",
        "verbs": ["explain", "describe", "summarize", "differentiate", "discuss"],
        "instruction": "explain, describe, summarize, interpret, discuss",
    },
    "K3": {
        "label": "Apply",
        "difficulty": "medium",
        "verbs": ["apply", "demonstrate", "use", "show", "design"],
        "instruction": "apply, demonstrate, use, solve, implement, design",
    },
    "K4": {
        "label": "Analyze",
        "difficulty": "hard",
        "verbs": ["analyze", "compare", "examine", "justify", "evaluate"],
        "instruction": "analyze, compare, examine, justify, evaluate, scenario-based reasoning",
    },
}


WEAK_QUESTION_PATTERNS = [
    "what is the best way",
    "what is the simplest method",
    "what is the best title",
    "according to the passage",
    "the passage",
    "the author",
    "the paragraph",
    "the article",
    "the story",
    "main idea",
]


SUBJECT_KEYWORDS = {
    "large language models": "llm",
    "llm": "llm",
    "advanced software testing": "testing",
    "software testing": "testing",
    "cloud computing": "cloud",
    "cloud architecture": "cloud",
    "ai-driven cybersecurity": "cybersecurity",
    "cybersecurity": "cybersecurity",
    "agile software development": "agile",
    "agile": "agile",
    "research methodology": "research",
    "research": "research",
}


GENERAL_QUESTION_BANK = {
    "K1": [
        "Define {topic} and state its purpose in {subject}.",
        "List the major characteristics of {topic} in {subject}.",
        "Identify the key components involved in {topic}.",
        "State the importance of {topic} in {subject}.",
        "Name the major types or categories related to {topic}.",
        "Define {topic} and list two real-world examples related to {subject}.",
        "Identify the basic terms and concepts associated with {topic}.",
        "State the role of {topic} in improving understanding of {subject}.",
    ],
    "K2": [
        "Explain the concept of {topic} in {subject} with a suitable example.",
        "Describe how {topic} works in the context of {subject}.",
        "Discuss the importance of {topic} in practical {subject} applications.",
        "Differentiate {topic} from related concepts in {subject}.",
        "Explain the advantages and limitations of {topic}.",
        "Describe the workflow or process involved in {topic}.",
        "Explain how {topic} affects performance, quality, security, or reliability in {subject}.",
        "Summarize the key challenges involved in implementing {topic}.",
        "Discuss the relationship between {topic} and real-world systems in {subject}.",
        "Describe how {topic} can be understood using a simple academic example.",
    ],
    "K3": [
        "Apply knowledge of {topic} to solve a practical problem in {subject}.",
        "Demonstrate how {topic} can be used in a real-world {subject} application.",
        "Use {topic} to design a basic solution for a practical scenario in {subject}.",
        "Apply {topic} to improve system performance, security, or quality in a case study.",
        "Show how {topic} can be implemented in a simple academic project.",
        "Design a workflow that uses {topic} to solve a real-world problem.",
        "Apply {topic} to evaluate an application or system before deployment.",
        "Use {topic} to prepare a step-by-step solution for a practical use case.",
        "Demonstrate how tools, methods, or techniques related to {topic} can be applied.",
        "Apply {topic} to identify and handle issues in a realistic technical scenario.",
    ],
    "K4": [
        "Analyze a scenario where {topic} affects performance, security, quality, or decision-making in {subject}.",
        "Compare different approaches related to {topic} and justify the most suitable one.",
        "Examine the limitations of {topic} and suggest suitable improvements.",
        "Evaluate the impact of {topic} on a real-world {subject} system.",
        "Analyze a failure scenario related to {topic} and recommend corrective actions.",
        "Justify how {topic} can improve the effectiveness of a technical or academic solution.",
        "Compare the benefits and risks of applying {topic} in a practical environment.",
        "Examine how {topic} influences scalability, reliability, security, or maintainability.",
        "Evaluate a case study where poor handling of {topic} causes system-level issues.",
        "Analyze the trade-offs involved in using {topic} in {subject}.",
    ],
}


SPECIAL_TOPIC_BANKS = {
    "cloud_security_service_models": {
        "K1": [
            "Define security issues in cloud service models and list common risks in SaaS, PaaS, and IaaS.",
            "Identify the major security threats associated with SaaS, PaaS, and IaaS cloud models.",
            "State the purpose of cloud security controls in protecting cloud service models.",
            "List the key security terms related to cloud service models, including access control, encryption, and misconfiguration.",
            "Name the major security responsibilities of cloud providers and cloud customers.",
            "Define shared responsibility in cloud security and state its relevance to service models.",
            "Identify common causes of data exposure in cloud service models.",
            "State the role of identity and access management in securing cloud services.",
        ],
        "K2": [
            "Explain how security responsibilities differ across SaaS, PaaS, and IaaS cloud service models.",
            "Describe how data privacy, access control, and misconfiguration risks occur in cloud service models.",
            "Discuss why shared responsibility is important for securing SaaS, PaaS, and IaaS environments.",
            "Explain how insecure APIs and weak authentication can affect cloud service security.",
            "Describe how encryption and identity management reduce security risks in cloud service models.",
            "Explain how cloud misconfiguration can lead to unauthorized access or data leakage.",
            "Describe the difference between provider-side and customer-side security responsibilities in cloud models.",
            "Discuss how monitoring and audit logs support security in cloud service models.",
            "Explain why role-based access control is important in SaaS, PaaS, and IaaS.",
            "Describe the relationship between compliance requirements and cloud service security.",
        ],
        "K3": [
            "Apply suitable security controls to protect a SaaS-based e-learning application.",
            "Use access control, encryption, and monitoring to secure a cloud-based hospital management system.",
            "Design a basic security plan for an IaaS-hosted web application.",
            "Apply cloud security best practices to reduce misconfiguration risks in a PaaS deployment.",
            "Demonstrate how multi-factor authentication and role-based access control can secure a cloud service.",
            "Apply shared responsibility principles to secure a SaaS application used by students and faculty.",
            "Use encryption, backup, and logging techniques to protect sensitive data in a cloud service model.",
            "Design a security checklist for deploying an application in a cloud service model.",
            "Apply cloud monitoring controls to detect suspicious access in a PaaS environment.",
            "Demonstrate how secure API management can reduce security issues in cloud applications.",
        ],
        "K4": [
            "Analyze a cloud data breach scenario and suggest mitigation techniques for SaaS, PaaS, and IaaS.",
            "Compare security risks in SaaS, PaaS, and IaaS and justify which model gives the customer more responsibility.",
            "Examine how cloud misconfiguration can lead to data exposure and suggest corrective actions.",
            "Evaluate the impact of weak identity and access management on cloud service security.",
            "Analyze how shared responsibility affects incident response in cloud service models.",
            "Compare encryption, access control, and monitoring as security controls for cloud service models.",
            "Examine a scenario where insecure APIs expose customer data in a cloud application and recommend improvements.",
            "Evaluate how compliance failures can affect an organization using SaaS, PaaS, or IaaS.",
            "Analyze the trade-offs between convenience and security in cloud service model adoption.",
            "Justify a layered security strategy for protecting applications across SaaS, PaaS, and IaaS.",
        ],
    },
    "performance_testing": {
        "K1": [
            "Define performance testing and state its purpose in advanced software testing.",
            "List the key metrics measured during performance testing.",
            "Identify the major types of performance testing used in software systems.",
            "State the role of response time, throughput, and resource utilization in performance testing.",
            "Name important tools used for performance testing.",
        ],
        "K2": [
            "Explain how performance testing helps identify system bottlenecks.",
            "Describe the working process of performance testing with a suitable example.",
            "Discuss the difference between load testing, stress testing, and endurance testing.",
            "Explain how performance test results are interpreted before deployment.",
            "Describe how performance testing improves reliability and scalability.",
        ],
        "K3": [
            "Apply performance testing to evaluate an e-commerce application during peak user traffic.",
            "Demonstrate how JMeter can be used to perform load testing on a web application.",
            "Use performance testing metrics to detect response time and throughput problems.",
            "Design a performance test plan for a college management system.",
            "Apply performance testing to validate whether an application can handle expected users.",
        ],
        "K4": [
            "Analyze a scenario where an application becomes slow under heavy load and suggest performance testing strategies.",
            "Compare load testing and stress testing and justify which is suitable for a banking application.",
            "Examine the limitations of performance testing when applied to cloud-based applications.",
            "Evaluate a failed performance test report and suggest optimization actions.",
            "Analyze how bottleneck detection during performance testing improves application scalability.",
        ],
    },
    "automation_testing": {
        "K1": [
            "Define automation testing and state its purpose in advanced software testing.",
            "List the major benefits of automation testing.",
            "Identify common tools used for automation testing.",
            "State the difference between manual testing and automation testing.",
            "Name suitable test cases for automation testing.",
        ],
        "K2": [
            "Explain how automation testing reduces repeated manual testing effort.",
            "Describe the working process of automation testing with a suitable example.",
            "Discuss the advantages and limitations of automation testing.",
            "Explain how automation testing supports regression testing.",
            "Describe how test scripts are created and executed in automation testing.",
        ],
        "K3": [
            "Apply automation testing to verify the login functionality of a web application.",
            "Demonstrate how Selenium can be used to automate a user registration workflow.",
            "Use automation testing to design a regression test suite for an e-commerce system.",
            "Apply automation testing in a continuous integration pipeline.",
            "Show how automated test scripts can validate form submission in a web application.",
        ],
        "K4": [
            "Analyze a scenario where automation testing fails due to frequent requirement changes and suggest improvements.",
            "Compare manual testing and automation testing and justify when automation is more suitable.",
            "Examine the limitations of automation testing in usability and exploratory testing.",
            "Evaluate the impact of poor test script maintenance on automation testing effectiveness.",
            "Analyze how automation testing improves software quality in frequent release cycles.",
        ],
    },
}


def _get_subject_family(subject: str) -> str:
    subject_lower = subject.lower().strip()

    for keyword, family in SUBJECT_KEYWORDS.items():
        if keyword in subject_lower:
            return family

    return "generic"


def _get_special_topic_key(subject: str, topic: str) -> str:
    family = _get_subject_family(subject)
    topic_lower = topic.lower()

    if family == "cloud" and (
        "security" in topic_lower
        or "service model" in topic_lower
        or "saas" in topic_lower
        or "paas" in topic_lower
        or "iaas" in topic_lower
    ):
        return "cloud_security_service_models"

    if family == "testing" and "performance" in topic_lower:
        return "performance_testing"

    if family == "testing" and "automation" in topic_lower:
        return "automation_testing"

    return ""


def _get_dynamic_bloom_distribution(num_questions: int) -> List[str]:
    """
    Dynamically distribute Bloom levels for any question count.

    Ratio:
    K1 = 20%
    K2 = 30%
    K3 = 30%
    K4 = 20%
    """
    if num_questions <= 0:
        return []

    if num_questions == 1:
        return ["K2"]

    if num_questions == 2:
        return ["K2", "K3"]

    if num_questions == 3:
        return ["K1", "K2", "K3"]

    percentages = {
        "K1": 0.20,
        "K2": 0.30,
        "K3": 0.30,
        "K4": 0.20,
    }

    distribution_counts: Dict[str, int] = {}

    for level, percentage in percentages.items():
        distribution_counts[level] = int(num_questions * percentage)

    for level in ["K1", "K2", "K3", "K4"]:
        if distribution_counts[level] == 0:
            distribution_counts[level] = 1

    current_total = sum(distribution_counts.values())

    add_order = ["K2", "K3", "K1", "K4"]
    add_index = 0

    while current_total < num_questions:
        level = add_order[add_index % len(add_order)]
        distribution_counts[level] += 1
        current_total += 1
        add_index += 1

    remove_order = ["K1", "K4", "K2", "K3"]
    remove_index = 0

    while current_total > num_questions:
        level = remove_order[remove_index % len(remove_order)]

        if distribution_counts[level] > 1:
            distribution_counts[level] -= 1
            current_total -= 1

        remove_index += 1

    bloom_sequence: List[str] = []
    level_order = ["K1", "K2", "K3", "K4"]

    while len(bloom_sequence) < num_questions:
        for level in level_order:
            if distribution_counts[level] > 0:
                bloom_sequence.append(level)
                distribution_counts[level] -= 1

                if len(bloom_sequence) == num_questions:
                    break

    return bloom_sequence


def _normalize_question(question: str) -> str:
    question = question.lower().strip()
    question = re.sub(r"[^a-z0-9\s]", "", question)
    question = re.sub(r"\s+", " ", question)
    return question


def _normalize_idea(question: str) -> str:
    """
    Normalizes the question idea more aggressively than exact text.
    This helps avoid repeated questions with only minor wording changes.
    """
    normalized = _normalize_question(question)

    stop_words = {
        "define",
        "explain",
        "describe",
        "discuss",
        "apply",
        "use",
        "show",
        "design",
        "demonstrate",
        "analyze",
        "compare",
        "examine",
        "evaluate",
        "justify",
        "state",
        "list",
        "identify",
        "name",
        "the",
        "a",
        "an",
        "and",
        "or",
        "in",
        "of",
        "to",
        "for",
        "with",
        "by",
        "how",
        "why",
        "what",
        "where",
        "when",
        "its",
        "it",
        "can",
        "be",
        "is",
        "are",
        "on",
        "as",
        "using",
        "used",
        "related",
        "concept",
        "context",
    }

    words = [word for word in normalized.split() if word not in stop_words]
    return " ".join(words[:12])


def _starts_with_allowed_bloom_verb(question: str, bloom_level: str) -> bool:
    """
    Ensures K1/K2/K3/K4 question text matches the expected Bloom level.
    """
    if not question:
        return False

    question_lower = question.lower().strip()
    allowed_verbs = BLOOM_LEVELS.get(bloom_level, BLOOM_LEVELS["K2"])["verbs"]

    return any(question_lower.startswith(verb) for verb in allowed_verbs)


def _is_bloom_mismatch(question: str, bloom_level: str) -> bool:
    """
    Rejects simple question forms when assigned to higher Bloom levels.
    Example:
    K4 question should not start with 'What is...'
    """
    question_lower = question.lower().strip()

    simple_k1_k2_starters = [
        "what is",
        "what are",
        "define",
        "list",
        "name",
        "state",
        "identify",
    ]

    if bloom_level in ["K3", "K4"]:
        if any(question_lower.startswith(starter) for starter in simple_k1_k2_starters):
            return True

    if bloom_level == "K4":
        strong_k4_indicators = [
            "analyze",
            "compare",
            "examine",
            "justify",
            "evaluate",
            "scenario",
            "case",
            "limitations",
            "impact",
            "failed",
            "failure",
            "bottleneck",
            "trade-off",
            "trade-offs",
            "improvements",
            "risks",
            "mitigation",
            "corrective",
            "limitations",
        ]

        if not any(indicator in question_lower for indicator in strong_k4_indicators):
            return True

    return False


def _is_weak_question(question: str, topic: str, bloom_level: str) -> bool:
    """
    Rejects weak/off-topic/Bloom-mismatched questions.
    """
    if not question or len(question.strip()) < 15:
        return True

    question_lower = question.lower()

    for pattern in WEAK_QUESTION_PATTERNS:
        if pattern in question_lower:
            return True

    topic_words = [
        word.lower()
        for word in re.findall(r"\b[a-zA-Z]{4,}\b", topic)
    ]

    if topic_words and not any(word in question_lower for word in topic_words):
        return True

    if _is_bloom_mismatch(question, bloom_level):
        return True

    if not _starts_with_allowed_bloom_verb(question, bloom_level):
        return True

    repeated_generic = [
        "explain the key aspects",
        "with relevant examples and academic justification",
    ]

    if all(pattern in question_lower for pattern in repeated_generic):
        return True

    return False


def _is_duplicate_question(
    candidate: str,
    existing_questions: List[str],
    similarity_threshold: float = 0.90,
) -> bool:
    """
    Checks exact, idea-level, and semantic duplicates.
    """
    if not candidate:
        return True

    candidate_norm = _normalize_question(candidate)
    candidate_idea = _normalize_idea(candidate)

    for existing in existing_questions:
        existing_norm = _normalize_question(existing)
        existing_idea = _normalize_idea(existing)

        if candidate_norm == existing_norm:
            return True

        if candidate_idea and existing_idea and candidate_idea == existing_idea:
            return True

        try:
            similarity = llm_service.compute_semantic_similarity(candidate, existing)

            if similarity >= similarity_threshold:
                return True

        except Exception as e:
            logger.warning(f"Similarity check failed: {e}")

    return False


def _build_bloom_topic(topic: str, bloom_level: str) -> str:
    bloom = BLOOM_LEVELS.get(bloom_level, BLOOM_LEVELS["K2"])
    verbs = ", ".join(bloom["verbs"])

    return (
        f"{topic}. Generate exactly one {bloom_level} - {bloom['label']} level question. "
        f"The question must begin with one of these verbs: {verbs}. "
        f"The question should focus on: {bloom['instruction']}."
    )


def _remove_duplicate_prefix(question_text: str) -> str:
    if not question_text:
        return ""

    prefixes = [
        "[K1 - Remember]",
        "[K2 - Understand]",
        "[K3 - Apply]",
        "[K4 - Analyze]",
        "K1 - Remember:",
        "K2 - Understand:",
        "K3 - Apply:",
        "K4 - Analyze:",
        "K1:",
        "K2:",
        "K3:",
        "K4:",
        "Question:",
    ]

    cleaned = question_text.strip()

    changed = True
    while changed:
        changed = False
        for prefix in prefixes:
            if cleaned.startswith(prefix):
                cleaned = cleaned.replace(prefix, "", 1).strip()
                changed = True

    return cleaned


def _get_question_bank(
    subject: str,
    topic: str,
    bloom_level: str,
) -> List[str]:
    special_key = _get_special_topic_key(subject, topic)

    if special_key and special_key in SPECIAL_TOPIC_BANKS:
        return SPECIAL_TOPIC_BANKS[special_key].get(
            bloom_level,
            GENERAL_QUESTION_BANK.get(bloom_level, GENERAL_QUESTION_BANK["K2"]),
        )

    return GENERAL_QUESTION_BANK.get(bloom_level, GENERAL_QUESTION_BANK["K2"])


def _subject_aware_fallback_question(
    subject: str,
    topic: str,
    bloom_level: str,
    question_number: int,
) -> str:
    """
    Stable question generation using question-angle banks.
    """
    templates = _get_question_bank(subject, topic, bloom_level)
    template = templates[question_number % len(templates)]
    return template.format(subject=subject, topic=topic)


def _template_expected_answer(
    subject: str,
    topic: str,
    question: str,
    bloom_level: str,
) -> str:
    """
    Question-specific expected answer.
    Uses subject family + Bloom level to produce more relevant answers.
    """
    family = _get_subject_family(subject)
    topic_lower = topic.lower()
    question_lower = question.lower()
    special_key = _get_special_topic_key(subject, topic)

    if special_key == "cloud_security_service_models":
        if bloom_level == "K1":
            return (
                "Security issues in cloud service models refer to risks that affect SaaS, PaaS, and IaaS environments. "
                "Common risks include data privacy issues, weak authentication, insecure APIs, misconfiguration, account hijacking, and poor access control. "
                "In SaaS, the customer mainly controls users and data, while in PaaS and IaaS the customer has more responsibility for application, platform, and infrastructure security. "
                "A complete answer should mention shared responsibility, identity management, encryption, monitoring, and compliance."
            )
        if bloom_level == "K2":
            return (
                "Security responsibilities differ across SaaS, PaaS, and IaaS because each model gives different levels of control to the customer. "
                "In SaaS, the provider manages most infrastructure and application security, while the customer manages users, access, and data usage. "
                "In PaaS, the provider secures the platform, but the customer must secure applications and configurations. "
                "In IaaS, the customer controls operating systems, applications, network rules, and data security. "
                "Therefore, understanding shared responsibility is essential for reducing cloud security risks."
            )
        if bloom_level == "K3":
            return (
                "To secure a cloud-based application, suitable controls such as strong authentication, role-based access control, encryption, secure APIs, monitoring, and backup policies should be applied. "
                "For example, a SaaS e-learning system should restrict faculty and student access based on roles, encrypt sensitive data, and monitor suspicious login attempts. "
                "In PaaS or IaaS deployments, secure configuration, patching, network rules, and logging are also important. "
                "This practical application reduces unauthorized access, data leakage, and service misuse."
            )
        return (
            "In a cloud data breach scenario, the cause may be weak access control, exposed storage, insecure APIs, poor configuration, or misunderstanding of shared responsibility. "
            "The impact can include data loss, privacy violation, service disruption, and compliance failure. "
            "A proper analysis should compare SaaS, PaaS, and IaaS responsibilities and identify which party controls the affected layer. "
            "Mitigation includes multi-factor authentication, least-privilege access, encryption, secure configuration, continuous monitoring, audit logging, and incident response planning."
        )

    if special_key == "performance_testing":
        if bloom_level == "K1":
            return (
                "Performance testing is a type of software testing used to evaluate how a system behaves under expected or heavy workloads. "
                "It measures response time, throughput, scalability, stability, error rate, and resource usage. "
                "Its main purpose is to identify bottlenecks before deployment. "
                "Common types include load testing, stress testing, spike testing, and endurance testing."
            )
        if bloom_level == "K2":
            return (
                "Performance testing helps identify bottlenecks by observing how an application responds under different user loads. "
                "Metrics such as response time, throughput, CPU usage, memory usage, and error rate are collected and analyzed. "
                "If performance degrades under load, the issue may be related to database queries, server capacity, network latency, or inefficient code. "
                "This helps teams optimize the application before real users are affected."
            )
        if bloom_level == "K3":
            return (
                "To apply performance testing to an application, testers define user scenarios, select a tool such as JMeter or LoadRunner, create virtual users, execute the test, and collect metrics. "
                "For example, an e-commerce system can be tested by simulating users browsing products, adding items to cart, and checking out. "
                "The results help determine whether the system can handle peak traffic. "
                "Based on the findings, teams can optimize database queries, caching, APIs, or server resources."
            )
        return (
            "In a heavy-load scenario, an application may become slow due to poor database queries, insufficient server resources, network latency, inefficient code, or lack of caching. "
            "Performance testing helps analyze response time, throughput, resource utilization, and failure points under increasing load. "
            "A good analysis compares test results against expected performance goals and identifies bottlenecks. "
            "Suitable improvements include query optimization, load balancing, caching, scaling infrastructure, and continuous monitoring."
        )

    if special_key == "automation_testing":
        if bloom_level == "K1":
            return (
                "Automation testing is a software testing technique where test cases are executed using automated tools or scripts instead of manual effort. "
                "It is used to improve speed, repeatability, accuracy, and test coverage. "
                "Common uses include regression testing, smoke testing, functional testing, and repeated validation tasks. "
                "Popular tools include Selenium, TestNG, JUnit, JMeter, and LoadRunner depending on the testing requirement."
            )
        if bloom_level == "K2":
            return (
                "Automation testing works by creating scripts or automated test cases that are executed by a testing tool. "
                "It reduces repeated manual effort and ensures that the same test cases are executed consistently across builds. "
                "It is especially useful for regression testing and continuous integration environments. "
                "However, it requires proper tool selection, script maintenance, and stable requirements."
            )
        if bloom_level == "K3":
            return (
                "To apply automation testing, testers first select stable and repetitive test cases, choose a suitable tool, prepare test data, write scripts, and execute them automatically. "
                "For example, Selenium can automate login, registration, and checkout workflows in a web application. "
                "The actual results are compared with expected outputs to detect failures quickly. "
                "This improves efficiency and supports frequent software releases."
            )
        return (
            "Automation testing is effective in frequent release cycles because it improves speed, consistency, and regression coverage. "
            "However, it may fail when requirements change frequently, test scripts are poorly maintained, or the system needs exploratory or usability testing. "
            "A suitable analysis should compare automation and manual testing based on cost, repeatability, stability, and coverage. "
            "The best strategy is to automate stable, high-value tests while keeping human judgment for exploratory and usability scenarios."
        )

    if family == "testing":
        return (
            f"A complete answer should explain {topic} in the context of {subject}. "
            "It should include the objective, process, tools or techniques, practical use, and result interpretation. "
            "For applied or analytical questions, the answer should connect the concept to a real software system and discuss quality, reliability, performance, or defect detection."
        )

    if family == "llm":
        if bloom_level == "K1":
            return (
                f"{topic} is an important concept in large language models used to improve language understanding or text generation. "
                "A complete answer should define the concept, mention its purpose, and list its main components or applications. "
                "For transformer-related topics, key terms may include tokens, embeddings, attention, encoder, decoder, and contextual representation. "
                "The answer should stay focused on the given topic."
            )
        if bloom_level == "K2":
            return (
                f"{topic} helps a language model represent, process, or generate text more effectively. "
                "In transformer-based models, mechanisms such as embeddings and attention help the model understand relationships between tokens. "
                "This improves tasks such as question answering, summarization, translation, and text generation. "
                "A suitable example should show how the concept improves model performance or language understanding."
            )
        if bloom_level == "K3":
            return (
                f"To apply {topic}, a system can use the concept in a practical NLP workflow such as chatbot development, text classification, summarization, or question answering. "
                "The input text is processed into tokens, represented using embeddings, and passed through model layers to generate predictions or responses. "
                "For example, a chatbot can use transformer-based representations to understand user queries and generate relevant answers. "
                "The application should clearly connect the concept to the chosen NLP task."
            )
        return (
            f"An analytical answer should examine why {topic} improves or limits performance in large language models. "
            "For transformer-related concepts, analysis may include attention mechanisms, long-range dependency handling, contextual understanding, computational cost, and training data limitations. "
            "The answer should compare the concept with older approaches such as RNNs or traditional NLP methods where relevant. "
            "It should justify advantages, limitations, and possible improvements."
        )

    if family == "cloud":
        return (
            f"A complete answer should explain {topic} in cloud computing. "
            "It should include definition, working principle, service models, deployment relevance, benefits, challenges, and a practical example. "
            "For higher Bloom levels, it should analyze scalability, security, cost, availability, management, and possible improvements."
        )

    if family == "cybersecurity":
        return (
            f"A complete answer should discuss {topic} as a cybersecurity concept. "
            "It should mention threats, detection or prevention methods, security controls, examples, and limitations. "
            "For scenario-based questions, it should include risk analysis, response strategy, and mitigation steps."
        )

    if family == "agile":
        return (
            f"A complete answer should describe {topic} in agile software development. "
            "It should include the purpose, process, team practices, benefits, and challenges. "
            "For application or analysis questions, it should connect the concept to sprint work, collaboration, code quality, or continuous improvement."
        )

    if family == "research":
        return (
            f"A complete answer should explain {topic} in research methodology. "
            "It should include definition, purpose, steps, examples, assumptions, and limitations. "
            "For analytical questions, it should discuss validity, reliability, bias, sample size, and interpretation."
        )

    return (
        f"A complete answer should address {topic} in the context of {subject}. "
        f"It should match the {bloom_level} level by giving the correct definition, explanation, application, or analysis. "
        "The answer should include relevant terminology, a clear explanation, and a suitable example. "
        "It should be specific to the exact question rather than giving a generic description."
    )


def _generate_expected_answer(
    question_text: str,
    subject: str,
    topic: str,
    bloom_level: str,
) -> str:
    """
    For known dropdown subjects, stable template answers are preferred.
    For generic subjects, try the local LLM and fallback if weak.
    """
    family = _get_subject_family(subject)

    if family != "generic":
        return _template_expected_answer(subject, topic, question_text, bloom_level)

    try:
        generated = llm_service.generate_expected_answer(question_text, subject, topic)
    except Exception:
        generated = ""

    weak_answer = (
        not generated
        or len(generated.split()) < 18
        or "complete answer should" in generated.lower()
        or "key concepts" in generated.lower()
    )

    if weak_answer:
        return _template_expected_answer(subject, topic, question_text, bloom_level)

    return generated


def _fallback_key_points(topic: str, bloom_level: str) -> List[str]:
    if bloom_level == "K1":
        return ["Definition", "Key terms", "Purpose", "Basic features"]

    if bloom_level == "K2":
        return ["Concept explanation", "Working process", "Importance", "Example"]

    if bloom_level == "K3":
        return ["Practical application", "Use case", "Implementation steps", "Result"]

    return ["Scenario analysis", "Comparison", "Justification", "Improvements"]


def _generate_key_points(
    question_text: str,
    expected_answer: str,
    bloom_level: str,
) -> List[str]:
    try:
        points = llm_service.extract_key_points(question_text, expected_answer)
    except Exception:
        points = []

    if not points or len(points) < 3:
        return _fallback_key_points(question_text, bloom_level)

    cleaned = []

    for point in points:
        point = str(point).strip().strip("-•. ")

        if 2 <= len(point.split()) <= 7 and point not in cleaned:
            cleaned.append(point)

    return cleaned[:4] if cleaned else _fallback_key_points(question_text, bloom_level)


def generate_assignment_questions(
    subject: str,
    topic: str,
    difficulty: str,
    num_questions: int,
    marks_per_question: float,
) -> List[GeneratedQuestion]:
    """
    Generate assignment questions.

    Flow:
    1. Choose Bloom level dynamically.
    2. Generate from stable question-angle bank first.
    3. Reject weak, repeated, or Bloom-mismatched questions.
    4. Use LLM only as fallback if template bank fails.
    5. Generate expected answer and key points.
    """
    results: List[GeneratedQuestion] = []
    existing_questions: List[str] = []
    bloom_sequence = _get_dynamic_bloom_distribution(num_questions)

    for i in range(num_questions):
        bloom_level = bloom_sequence[i] if i < len(bloom_sequence) else "K2"
        bloom = BLOOM_LEVELS.get(bloom_level, BLOOM_LEVELS["K2"])
        question_text = ""

        try:
            # Step 1: Stable template-first generation.
            for attempt in range(80):
                candidate = _subject_aware_fallback_question(
                    subject=subject,
                    topic=topic,
                    bloom_level=bloom_level,
                    question_number=i + attempt,
                )

                candidate = _remove_duplicate_prefix(candidate)

                if (
                    candidate
                    and not _is_weak_question(candidate, topic, bloom_level)
                    and not _is_duplicate_question(candidate, existing_questions)
                ):
                    question_text = candidate
                    existing_questions.append(candidate)
                    break

            # Step 2: LLM fallback only when templates fail.
            if not question_text:
                for variation in range(6):
                    bloom_topic = _build_bloom_topic(topic, bloom_level)

                    candidate = llm_service.generate_question(
                        subject=subject,
                        topic=bloom_topic,
                        difficulty=bloom["difficulty"],
                        index=i + (variation * max(num_questions, 1)),
                    )

                    candidate = _remove_duplicate_prefix(candidate)

                    if (
                        candidate
                        and not _is_weak_question(candidate, topic, bloom_level)
                        and not _is_duplicate_question(candidate, existing_questions)
                    ):
                        question_text = candidate
                        existing_questions.append(candidate)
                        break

            # Step 3: Strict guaranteed unique fallback.
            if not question_text:
                if bloom_level == "K1":
                    question_text = (
                        f"Define {topic} and state its purpose in {subject} "
                        f"with reference to case {i + 1}."
                    )
                elif bloom_level == "K2":
                    question_text = (
                        f"Explain {topic} in {subject} with a suitable example "
                        f"for case {i + 1}."
                    )
                elif bloom_level == "K3":
                    question_text = (
                        f"Apply knowledge of {topic} to solve a practical problem "
                        f"in {subject} for case {i + 1}."
                    )
                else:
                    question_text = (
                        f"Analyze a case where {topic} affects performance, security, "
                        f"quality, or decision-making in {subject} and suggest improvements "
                        f"for case {i + 1}."
                    )

                existing_questions.append(question_text)

            expected_answer = _generate_expected_answer(
                question_text,
                subject,
                topic,
                bloom_level,
            )

            key_points = _generate_key_points(
                question_text,
                expected_answer,
                bloom_level,
            )

            results.append(
                GeneratedQuestion(
                    question_text=question_text,
                    expected_answer=expected_answer,
                    key_points=key_points,
                    max_marks=marks_per_question,
                    bloom_level=bloom_level,
                )
            )

        except Exception as e:
            logger.error(f"Error generating question {i + 1}: {e}")

            fallback_text = _subject_aware_fallback_question(
                subject=subject,
                topic=topic,
                bloom_level=bloom_level,
                question_number=i,
            )

            expected_answer = _template_expected_answer(
                subject,
                topic,
                fallback_text,
                bloom_level,
            )

            results.append(
                GeneratedQuestion(
                    question_text=fallback_text,
                    expected_answer=expected_answer,
                    key_points=_fallback_key_points(topic, bloom_level),
                    max_marks=marks_per_question,
                    bloom_level=bloom_level,
                )
            )

    return results