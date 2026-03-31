# 🛡️ ShieldMail — AI-Powered Email Security Backend

> Detect. Explain. Automate. — An intelligent email firewall powered by Claude AI.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Quick Start](#quick-start)
5. [API Reference](#api-reference)
6. [n8n Automation Setup](#n8n-automation-setup)
7. [Environment Variables](#environment-variables)
8. [Running Tests](#running-tests)
9. [Design Decisions](#design-decisions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / REST
┌───────────────────────────▼─────────────────────────────────────┐
│                   Express.js API Server                         │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌────────────┐   │
│  │  /scan   │  │ /dashboard │  │   /urls   │  │  /health   │   │
│  └────┬─────┘  └─────┬──────┘  └─────┬─────┘  └────────────┘   │
│       │              │               │                          │
│  ┌────▼──────────────────────────────▼──────────────────────┐   │
│  │                  Scan Orchestrator                        │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐   │   │
│  │  │emailParser │  │ urlAnalyzer │  │ aiAnalysisService│   │   │
│  │  └────────────┘  └─────────────┘  └────────┬─────────┘   │   │
│  │                                            │              │   │
│  │                                    ┌───────▼────────┐    │   │
│  │                                    │  Anthropic API │    │   │
│  │                                    └───────┬────────┘    │   │
│  │                                            │              │   │
│  │  ┌──────────────────────────────────────────▼──────────┐ │   │
│  │  │           automationService (n8n webhooks)          │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │          statsStore (in-memory, swap for Redis/DB)        │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    n8n Automation Platform                       │
│         WhatsApp Alerts │ SMS │ Slack │ Ticketing               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js 4 |
| AI Engine | Anthropic Claude (claude-sonnet-4-20250514) |
| Security | Helmet, express-rate-limit, express-validator |
| Logging | Winston |
| File Upload | Multer |
| Automation | n8n (via webhooks) |
| Testing | Jest + Supertest |

---

## Project Structure

```
shieldmail/
├── server.js                  # App entry point
├── .env.example               # Environment template
├── package.json
├── jest.config.js
│
├── config/
│   └── logger.js              # Winston logger
│
├── middleware/
│   ├── errorHandler.js        # Global error + 404 handlers
│   └── validators.js          # express-validator schemas
│
├── models/
│   └── statsStore.js          # In-memory scan metrics store
│
├── routes/
│   ├── health.js              # GET /health
│   ├── scan.js                # POST /api/v1/scan[/upload]
│   ├── dashboard.js           # GET /api/v1/dashboard
│   └── urlAnalysis.js         # POST /api/v1/urls/analyze
│
├── services/
│   ├── scanService.js         # Main scan orchestrator
│   ├── aiAnalysisService.js   # Anthropic Claude integration
│   └── automationService.js   # n8n webhook dispatcher
│
├── utils/
│   ├── emailParser.js         # Header/metadata/urgency parser
│   └── urlAnalyzer.js         # URL extraction + risk scoring
│
├── tests/
│   └── scan.test.js           # Jest test suite
│
└── logs/                      # Auto-created by Winston
```

---

## Quick Start

### 1. Install dependencies

```bash
cd shieldmail
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY
```

### 3. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3000`.

---

## API Reference

### `GET /health`

Returns server health and uptime stats.

**Response:**
```json
{
  "status": "healthy",
  "service": "ShieldMail-Backend",
  "version": "1.0.0",
  "uptime": "42s",
  "memoryUsed": "48 MB",
  "totalScans": 7
}
```

---

### `POST /api/v1/scan`

Analyse a raw email string.

**Request body:**
```json
{
  "emailContent": "From: evil@phish.tk\nSubject: URGENT\n\nClick here...",
  "options": {
    "triggerAutomation": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scanId": "uuid-v4",
    "scannedAt": "2026-03-20T10:00:00.000Z",
    "durationMs": 1240,
    "classification": "DANGEROUS",
    "metadata": {
      "senderEmail": "evil@phish.tk",
      "subject": "URGENT",
      "hasHtml": false
    },
    "threatAnalysis": {
      "phishingProbabilityScore": 94,
      "confidence": "HIGH",
      "threatCategory": "Credential Harvesting",
      "attackVector": "Fake login page via spoofed PayPal domain",
      "urgencyDetected": true,
      "urgencyPhrases": ["URGENT"],
      "senderTrust": { "trustScore": 20, "trustLevel": "untrusted", "signals": [...] },
      "keyRedFlags": ["Suspicious TLD .tk", "Brand impersonation: paypal"],
      "safeIndicators": [],
      "recommendedAction": "Do not click any links. Report and delete immediately."
    },
    "explanations": {
      "technical": "The sender domain paypa1.tk does not resolve to any...",
      "eli5": "Someone is pretending to be PayPal to steal your password..."
    },
    "urlAnalysis": {
      "totalFound": 2,
      "highRiskCount": 2,
      "overallUrlRisk": "high",
      "urls": [...]
    },
    "automation": {
      "triggered": true,
      "alertChannels": ["WhatsApp", "SMS"],
      "webhookResults": { "dangerous": { "fired": true, "status": 200 } }
    }
  }
}
```

---

### `POST /api/v1/scan/upload`

Upload a `.eml` or `.txt` email file.

**Form data:**
- `emailFile` — the email file (max 1 MB)
- `options` — (optional) JSON string, e.g. `{"triggerAutomation":true}`

---

### `GET /api/v1/dashboard`

Returns aggregate security statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalScanned": 45,
    "dangerous": 8,
    "suspicious": 12,
    "safe": 25,
    "automationFired": 8,
    "totalMaliciousUrls": 19,
    "avgPhishingScore": 34,
    "overallRisk": "MEDIUM",
    "trendByDay": {
      "2026-03-20": { "safe": 5, "suspicious": 2, "dangerous": 1 }
    },
    "recentScans": [...]
  }
}
```

---

### `GET /api/v1/dashboard/history?page=1&limit=20&filter=DANGEROUS`

Paginated scan history with optional classification filter.

---

### `POST /api/v1/urls/analyze`

Analyse a list of URLs without running a full email scan.

**Request body:**
```json
{
  "urls": [
    "https://paypal-secure.xyz/verify",
    "https://www.google.com"
  ]
}
```

---

### `GET /api/v1/urls/check?url=https://example.com`

Quick single-URL risk check.

---

## n8n Automation Setup

ShieldMail fires webhooks to n8n when dangerous or suspicious emails are detected.

### Step 1: Create Webhook nodes in n8n

1. Open n8n → **New Workflow**
2. Add **Webhook** node → set method to `POST`
3. Copy the webhook URL into your `.env`:

```env
N8N_WEBHOOK_DANGEROUS=https://your-n8n.com/webhook/dangerous
N8N_WEBHOOK_SUSPICIOUS=https://your-n8n.com/webhook/suspicious
N8N_WEBHOOK_REPORT=https://your-n8n.com/webhook/report
```

### Step 2: Build your alert workflow

Suggested n8n workflow for dangerous emails:

```
Webhook (POST) 
  → IF node (classification === "DANGEROUS")
    → WhatsApp node (send alert with subject + score)
    → Twilio SMS node (send short alert)
    → Slack node (post to #security channel)
```

### Webhook Payload Structure

Every webhook receives this JSON body:

```json
{
  "scanId": "uuid",
  "triggeredAt": "ISO timestamp",
  "classification": "DANGEROUS",
  "phishingScore": 94,
  "senderEmail": "evil@phish.tk",
  "subject": "URGENT: Verify your account",
  "keyRedFlags": ["Suspicious TLD", "Brand spoofing"],
  "recommendedAction": "Delete and report immediately.",
  "highRiskUrlCount": 2,
  "suspiciousUrls": [...],
  "alerts": {
    "whatsapp": true,
    "sms": true,
    "email": false
  }
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Your Anthropic API key |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `N8N_WEBHOOK_DANGEROUS` | No | n8n webhook URL for dangerous emails |
| `N8N_WEBHOOK_SUSPICIOUS` | No | n8n webhook URL for suspicious emails |
| `N8N_WEBHOOK_REPORT` | No | n8n audit trail webhook |
| `ALERT_WHATSAPP_ENABLED` | No | Include WhatsApp in alert payload (`true`/`false`) |
| `ALERT_SMS_ENABLED` | No | Include SMS in alert payload |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms (default: 900000) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window (default: 100) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `*`) |
| `LOG_LEVEL` | No | Winston log level (default: `info`) |

---

## Running Tests

```bash
# Run all tests
npm test

# With coverage report
npm test -- --coverage

# Watch mode (during development)
npm test -- --watch
```

Test coverage includes:
- URL risk scoring (IP addresses, suspicious TLDs, spoofing, homoglyphs)
- Email parsing (headers, sender trust, urgency detection)
- Stats store (recording, aggregation, pagination)

---

## Design Decisions

**Why in-memory stats store?**  
For portability and zero-dependency demo setup. Swap `models/statsStore.js` for a Redis or PostgreSQL adapter without changing any other module — the interface is identical.

**Why Claude Sonnet?**  
Sonnet offers the best speed/quality trade-off for real-time analysis. The structured JSON system prompt ensures deterministic output parsing.

**Why per-layer URL analysis before the AI call?**  
Pre-computed URL signals (homoglyph detection, TLD scoring) are injected into the AI prompt, giving Claude richer context and dramatically improving classification accuracy compared to sending raw email text alone.

**Why n8n for automation?**  
n8n is workflow-agnostic — you can wire any notification channel (WhatsApp, SMS, Slack, PagerDuty, JIRA) without changing backend code. The webhook contract is documented and stable.
