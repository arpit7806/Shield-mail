from crewai import Agent, Task, Crew, Process, LLM
try:
    from crewai.tools import tool
except ImportError:
    from crewai_tools import tool
import re
import json
import os
from dotenv import load_dotenv

load_dotenv()

llm = LLM(
    model="groq/llama-3.1-8b-instant",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.2
)


# ─────────────────────────────────────────────
# TOOLS
# ─────────────────────────────────────────────

@tool("URL Extractor")
def extract_urls(email_body: str) -> str:
    """Extracts all URLs and links from the email body text."""
    url_pattern = r'https?://[^\s<>"\'{}|\\^`\[\]]+'
    urls = re.findall(url_pattern, email_body)
    if not urls:
        return "No URLs found in the email."
    return f"Found {len(urls)} URL(s):\n" + "\n".join(urls)


@tool("IP Address Extractor")
def extract_ips(email_text: str) -> str:
    """Extracts all IP addresses found in the email headers or body."""
    ip_pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
    ips = re.findall(ip_pattern, email_text)
    if not ips:
        return "No IP addresses found."
    return f"Found {len(ips)} IP address(es):\n" + "\n".join(set(ips))


@tool("Suspicious Pattern Detector")
def detect_patterns(email_body: str) -> str:
    """
    Detects common phishing and cyber threat patterns in email text.
    Checks for urgency language, credential requests, suspicious phrases,
    lookalike domains, and social engineering tactics.
    """
    red_flags = []

    urgency_keywords = [
        "urgent", "immediately", "act now", "limited time", "expires today",
        "verify now", "suspended", "account locked", "unusual activity",
        "confirm your identity", "security alert"
    ]
    credential_keywords = [
        "enter your password", "login credentials", "verify your account",
        "update payment", "confirm credit card", "bank details", "ssn",
        "social security", "otp", "one time password"
    ]
    suspicious_phrases = [
        "click here to claim", "you have won", "congratulations you",
        "wire transfer", "western union", "gift card", "bitcoin",
        "nigerian prince", "inheritance", "lottery winner"
    ]
    lookalike_patterns = [
        r'paypa1\.com', r'g00gle\.com', r'arnazon\.com', r'micros0ft\.com',
        r'app1e\.com', r'faceb00k\.com'
    ]

    body_lower = email_body.lower()

    for kw in urgency_keywords:
        if kw in body_lower:
            red_flags.append(f"Urgency language detected: '{kw}'")

    for kw in credential_keywords:
        if kw in body_lower:
            red_flags.append(f"Credential harvesting attempt: '{kw}'")

    for phrase in suspicious_phrases:
        if phrase in body_lower:
            red_flags.append(f"Scam phrase detected: '{phrase}'")

    for pattern in lookalike_patterns:
        if re.search(pattern, body_lower):
            red_flags.append(f"Lookalike domain detected matching pattern: '{pattern}'")

    if not red_flags:
        return "No suspicious patterns detected."

    return f"Found {len(red_flags)} red flag(s):\n" + "\n".join(f"- {f}" for f in red_flags)


@tool("URL Reputation Checker")
def check_url_reputation(urls_text: str) -> str:
    """
    Checks URLs against known threat indicators.
    Looks for URL shorteners, suspicious TLDs, excessive redirects,
    and known malicious domain patterns.
    """
    suspicious_shorteners = [
        "bit.ly", "tinyurl.com", "t.co", "ow.ly", "buff.ly",
        "goo.gl", "is.gd", "cli.gs", "rb.gy"
    ]
    suspicious_tlds = [".tk", ".ml", ".ga", ".cf", ".pw", ".top", ".xyz", ".click"]

    findings = []
    urls = re.findall(r'https?://[^\s]+', urls_text)

    for url in urls:
        for shortener in suspicious_shorteners:
            if shortener in url:
                findings.append(f"URL shortener detected (hides real destination): {url}")
        for tld in suspicious_tlds:
            if url.endswith(tld) or tld + "/" in url:
                findings.append(f"Suspicious TLD detected: {url}")
        if url.count('/') > 6:
            findings.append(f"Deeply nested URL path (possible redirect chain): {url}")
        if re.search(r'@', url):
            findings.append(f"URL contains '@' symbol (classic phishing trick): {url}")
        if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', url):
            findings.append(f"URL uses raw IP instead of domain name: {url}")

    if not findings:
        return "No suspicious URL patterns found."
    return "\n".join(f"- {f}" for f in findings)


# ─────────────────────────────────────────────
# AGENTS
# ─────────────────────────────────────────────

def build_scanner_agent():
    return Agent(
        role="Email Threat Intelligence Scanner",
        goal=(
            "Thoroughly analyze email content, extract all suspicious indicators "
            "including malicious URLs, IP addresses, phishing patterns, and social "
            "engineering tactics. Compile a detailed threat report."
        ),
        backstory=(
            "You are a senior cybersecurity analyst specializing in email-based threats. "
            "You have analyzed thousands of phishing campaigns, BEC attacks, and malware "
            "delivery emails. You are methodical, thorough, and never miss red flags."
        ),
        tools=[extract_urls, extract_ips, detect_patterns, check_url_reputation],
        llm=llm,
        verbose=True,
        allow_delegation=False
    )


def build_scorer_agent():
    return Agent(
        role="Cyber Threat Risk Scorer",
        goal=(
            "Based on the threat intelligence report, assign a precise threat score "
            "from 0 to 100 and provide actionable safety recommendations. "
            "Output must be valid JSON only."
        ),
        backstory=(
            "You are a risk assessment expert who translates raw threat indicators "
            "into clear risk scores and human-readable safety guidance. You communicate "
            "complex threats in simple terms so victims can take immediate action."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False
    )


# ─────────────────────────────────────────────
# TASKS
# ─────────────────────────────────────────────

def build_scan_task(agent, email_data: dict) -> Task:
    email_text = f"""
SENDER: {email_data.get('sender', 'Unknown')}
SUBJECT: {email_data.get('subject', 'No Subject')}
BODY:
{email_data.get('body', '')}
HEADERS:
{email_data.get('headers', 'Not provided')}
"""
    return Task(
        description=(
            f"Analyze this email for cyber threats:\n{email_text}\n\n"
            "Use all available tools to:\n"
            "1. Extract all URLs and check their reputation\n"
            "2. Extract all IP addresses\n"
            "3. Detect phishing/scam patterns\n"
            "4. Identify social engineering tactics\n"
            "Compile everything into a structured threat intelligence report."
        ),
        expected_output=(
            "A detailed threat intelligence report listing all found indicators, "
            "red flags, suspicious URLs, IPs, and patterns with clear explanations."
        ),
        agent=agent
    )


def build_score_task(agent, scan_task: Task) -> Task:
    return Task(
        description=(
            "Based on the threat intelligence report from the scanner, produce a final "
            "risk assessment. Output ONLY valid JSON in exactly this format:\n"
            "{\n"
            '  "threat_score": <integer 0-100>,\n'
            '  "threat_level": "<SAFE|LOW|MEDIUM|HIGH|CRITICAL>",\n'
            '  "summary": "<2-3 sentence summary of the threat>",\n'
            '  "indicators": ["<indicator 1>", "<indicator 2>", ...],\n'
            '  "safety_measures": ["<action 1>", "<action 2>", ...],\n'
            '  "legal_note": "<advice if this can be used for legal purposes>"\n'
            "}"
        ),
        expected_output="Valid JSON object with threat_score, threat_level, summary, indicators, safety_measures, and legal_note.",
        agent=agent,
        context=[scan_task]
    )


# ─────────────────────────────────────────────
# MAIN RUNNER
# ─────────────────────────────────────────────

def analyze_email(email_data: dict) -> dict:
    scanner = build_scanner_agent()
    scorer = build_scorer_agent()

    scan_task = build_scan_task(scanner, email_data)
    score_task = build_score_task(scorer, scan_task)

    crew = Crew(
        agents=[scanner, scorer],
        tasks=[scan_task, score_task],
        process=Process.sequential,
        verbose=True
    )

    result = crew.kickoff()

    try:
        raw = str(result)
        raw = re.sub(r'```json|```', '', raw).strip()
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', str(result), re.DOTALL)
        if match:
            parsed = json.loads(match.group())
        else:
            parsed = {
                "threat_score": 50,
                "threat_level": "MEDIUM",
                "summary": "Analysis completed but result parsing failed. Manual review recommended.",
                "indicators": [],
                "safety_measures": ["Do not click any links in this email", "Contact your IT team"],
                "legal_note": "Preserve this email as evidence if needed."
            }

    return parsed
