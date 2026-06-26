# Sheidmail — AI Threat Detection Backend

FastAPI + CrewAI powered email threat analysis engine.

## Setup

```bash
# 1. Clone / navigate to this folder
cd sheidmail-ai

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Open .env and add your OPENAI_API_KEY

# 5. Run the server
uvicorn main:app --reload --port 8000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| POST | `/analyze` | Analyze an email |
| POST | `/analyze/test` | Test with a dummy phishing email |

## Sample Request

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "security@paypa1-verify.tk",
    "subject": "URGENT: Verify your account now!",
    "body": "Click here immediately to avoid suspension: http://bit.ly/fake-link",
    "user_phone": "+919999999999"
  }'
```

## Sample Response

```json
{
  "threat_score": 91,
  "threat_level": "CRITICAL",
  "summary": "This email exhibits classic phishing characteristics...",
  "indicators": [
    "Lookalike domain: paypa1-verify.tk",
    "URL shortener hiding real destination",
    "Urgency language: 'immediately'"
  ],
  "safety_measures": [
    "Do not click any links",
    "Report to your email provider",
    "Change passwords if you interacted"
  ],
  "legal_note": "This email constitutes evidence of phishing...",
  "alert_triggered": true,
  "message": "⚠️ HIGH THREAT DETECTED (91%) — SMS alert will be triggered."
}
```

## Architecture

```
Chrome Extension
      │
      ▼
POST /analyze
      │
      ▼
FastAPI (main.py)
      │
      ▼
CrewAI Crew (agents.py)
  ├── Scanner Agent  ──► extract_urls, detect_patterns, check_url_reputation
  └── Scorer Agent   ──► outputs JSON threat score
      │
      ▼
ThreatResponse (returned to extension)
      │
      ▼ (if score >= threshold)
Twilio SMS ← coming in Phase 6
```
