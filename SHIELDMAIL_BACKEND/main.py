from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
from agents import analyze_email

load_dotenv()

app = FastAPI(
    title="Sheidmail Threat Detection API",
    description="AI-powered email threat analysis using CrewAI agents",
    version="1.0.0"
)

# Allow Chrome extension and website to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock this down to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

THREAT_THRESHOLD = int(os.getenv("THREAT_THRESHOLD", 70))


# ─────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────

class EmailPayload(BaseModel):
    sender: Optional[str] = "Unknown"
    subject: Optional[str] = "No Subject"
    body: str
    headers: Optional[str] = None
    user_phone: Optional[str] = None  # Will be used later for Twilio SMS


class ThreatResponse(BaseModel):
    threat_score: int
    threat_level: str
    summary: str
    indicators: list[str]
    safety_measures: list[str]
    legal_note: str
    alert_triggered: bool
    message: str


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "Sheidmail Threat Detection API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/analyze", response_model=ThreatResponse)
async def analyze(payload: EmailPayload):
    """
    Main endpoint — accepts email data, runs CrewAI analysis,
    returns threat score + full breakdown.
    """
    if not payload.body or len(payload.body.strip()) < 5:
        raise HTTPException(status_code=400, detail="Email body is too short to analyze.")

    email_data = {
        "sender": payload.sender,
        "subject": payload.subject,
        "body": payload.body,
        "headers": payload.headers or ""
    }

    try:
        result = analyze_email(email_data)
    except Exception as e:
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


@app.post("/analyze/test")
def test_analyze():
    """
    Test endpoint with a dummy phishing email — 
    use this to verify the AI is working without a real email.
    """
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

    result = analyze_email(dummy_email)
    return result
