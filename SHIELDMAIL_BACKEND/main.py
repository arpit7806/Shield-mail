from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="ShieldMail Threat Detection API",
    description="AI-powered email threat analysis using CrewAI agents",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

THREAT_THRESHOLD = int(os.getenv("THREAT_THRESHOLD", 70))


class EmailPayload(BaseModel):
    sender: Optional[str] = "Unknown"
    subject: Optional[str] = "No Subject"
    body: str
    headers: Optional[str] = None
    user_phone: Optional[str] = None


class ThreatResponse(BaseModel):
    threat_score: int
    threat_level: str
    summary: str
    indicators: list[str]
    safety_measures: list[str]
    legal_note: str
    alert_triggered: bool
    message: str


@app.get("/")
def root():
    return {
        "service": "ShieldMail Threat Detection API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/analyze", response_model=ThreatResponse)
async def analyze(payload: EmailPayload):
    if not payload.body or len(payload.body.strip()) < 5:
        raise HTTPException(status_code=400, detail="Email body is too short to analyze.")

    email_data = {
        "sender": payload.sender,
        "subject": payload.subject,
        "body": payload.body,
        "headers": payload.headers or ""
    }

    try:
        from agents import analyze_email
        result = analyze_email(email_data)
    except Exception as e:
        error_msg = str(e).lower()

        # Handle rate limit gracefully — return a basic pattern-based score
        if "rate limit" in error_msg or "ratelimit" in error_msg or "429" in error_msg:
            from agents import detect_patterns, extract_urls, check_url_reputation
            result = fallback_analysis(email_data)
        else:
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    score = result.get("threat_score", 0)
    alert_triggered = score >= THREAT_THRESHOLD

    return ThreatResponse(
        threat_score=score,
        threat_level=result.get("threat_level", "UNKNOWN"),
        summary=result.get("summary", ""),
        indicators=result.get("indicators", []),
        safety_measures=result.get("safety_measures", []),
        legal_note=result.get("legal_note", ""),
        alert_triggered=alert_triggered,
        message=(
            f"⚠️ HIGH THREAT DETECTED ({score}%) — SMS alert will be triggered."
            if alert_triggered else
            f"✅ Threat score: {score}% — Within safe limits."
        )
    )


def fallback_analysis(email_data: dict) -> dict:
    """
    Rule-based fallback when AI rate limit is hit.
    Uses pattern matching tools directly without LLM.
    """
    import re

    body = email_data.get("body", "")
    sender = email_data.get("sender", "")
    subject = email_data.get("subject", "")
    full_text = f"{sender} {subject} {body}".lower()

    score = 0
    indicators = []
    safety_measures = []

    urgency_keywords = ["urgent", "immediately", "act now", "suspended", "account locked", "verify now", "expires"]
    credential_keywords = ["password", "login", "verify your account", "credit card", "bank details", "otp"]
    scam_phrases = ["you have won", "click here to claim", "wire transfer", "gift card", "bitcoin"]
    suspicious_tlds = [".tk", ".ml", ".ga", ".cf", ".pw", ".xyz", ".click"]
    shorteners = ["bit.ly", "tinyurl.com", "goo.gl", "rb.gy"]

    for kw in urgency_keywords:
        if kw in full_text:
            score += 10
            indicators.append(f"Urgency language: '{kw}'")

    for kw in credential_keywords:
        if kw in full_text:
            score += 15
            indicators.append(f"Credential harvesting attempt: '{kw}'")

    for phrase in scam_phrases:
        if phrase in full_text:
            score += 20
            indicators.append(f"Scam phrase: '{phrase}'")

    urls = re.findall(r'https?://[^\s]+', body)
    for url in urls:
        for tld in suspicious_tlds:
            if tld in url:
                score += 15
                indicators.append(f"Suspicious TLD in URL: {url}")
        for shortener in shorteners:
            if shortener in url:
                score += 10
                indicators.append(f"URL shortener detected: {url}")
        if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', url):
            score += 20
            indicators.append(f"Raw IP in URL: {url}")

    score = min(score, 100)

    if score >= 75:
        level = "HIGH"
        safety_measures = ["Do not click any links", "Do not reply", "Report as phishing", "Contact your bank if financial info was requested"]
    elif score >= 45:
        level = "MEDIUM"
        safety_measures = ["Be cautious with links", "Verify sender identity", "Do not share personal info"]
    elif score >= 20:
        level = "LOW"
        safety_measures = ["Exercise basic caution", "Verify sender if unsure"]
    else:
        level = "SAFE"
        safety_measures = ["Email appears safe", "Always stay vigilant"]

    return {
        "threat_score": score,
        "threat_level": level,
        "summary": f"Rule-based analysis detected {len(indicators)} suspicious indicator(s). AI analysis was temporarily unavailable due to rate limits.",
        "indicators": indicators if indicators else ["No obvious threats detected"],
        "safety_measures": safety_measures,
        "legal_note": "Preserve this email as evidence if you believe it is part of a cybercrime."
    }


@app.post("/analyze/test")
def test_analyze():
    dummy_email = {
        "sender": "security@paypa1-verify.tk",
        "subject": "URGENT: Your account has been suspended!",
        "body": (
            "Dear Customer,\n\n"
            "We have detected unusual activity on your account. "
            "Your account will be permanently suspended unless you verify your credentials immediately.\n\n"
            "Click here now to verify: http://bit.ly/paypal-urgent-verify\n\n"
            "You must act within 24 hours or lose access forever.\n\n"
            "Enter your password and credit card details to restore access.\n\n"
            "- PayPal Security Team"
        ),
        "headers": "Received from: 185.234.219.3"
    }

    from agents import analyze_email
    try:
        result = analyze_email(dummy_email)
    except Exception as e:
        if "rate limit" in str(e).lower():
            result = fallback_analysis(dummy_email)
        else:
            raise HTTPException(status_code=500, detail=str(e))

    return result
