// services/aiAnalysisService.js
// The brain of ShieldMail — sends email data to Claude and gets structured threat analysis

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * The system prompt — defines Claude's role and output contract.
 * This is the most important piece of the entire AI system.
 */
const SYSTEM_PROMPT = `You are ShieldMail, an expert email security analyst with deep knowledge of:
- Phishing and social engineering tactics
- Email spoofing and impersonation techniques
- Malware delivery via email
- Business Email Compromise (BEC) attacks
- Urgency manipulation and psychological pressure tactics

You will be given an email's sender, subject, body, and pre-analyzed URL signals.
Your job is to analyze it thoroughly and return a structured threat assessment.

CRITICAL RULES:
1. You MUST respond with ONLY valid JSON — no preamble, no explanation outside JSON
2. Risk score 0-100: 0 = completely safe, 100 = confirmed attack
3. Be conservative — do not over-flag legitimate emails
4. Base your analysis on actual threat signals, not just suspicious-sounding words
5. The "smsAlert" field must be under 320 characters (SMS limit)

SCORING GUIDE:
0-30   → SAFE: Normal email, no threat signals
31-60  → SUSPICIOUS: Some red flags, needs caution  
61-80  → DANGEROUS: Strong phishing/threat indicators
81-100 → CRITICAL: Near-certain attack, immediate action required

RESPONSE FORMAT (strict JSON):
{
  "risk": <number 0-100>,
  "classification": "SAFE" | "SUSPICIOUS" | "DANGEROUS" | "CRITICAL",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "threatType": <string, e.g. "Credential Harvesting", "BEC Fraud", "Malware Delivery", "Spam", "Legitimate">,
  "attackVector": <string, how the attack works, or "N/A" if safe>,
  "whatItCanDo": <string, plain English explanation of the potential damage — max 2 sentences>,
  "whatToDo": [<string>, <string>, <string>],
  "keyRedFlags": [<string>],
  "safeIndicators": [<string>],
  "senderTrustScore": <number 0-100>,
  "urgencyManipulation": <boolean>,
  "impersonationDetected": <boolean>,
  "impersonationTarget": <string or null>,
  "smsAlert": <string, human-readable SMS under 320 chars>
}`;

/**
 * Build the user prompt with all available context
 */
function buildPrompt(sender, subject, body, urlAnalysis) {
  return `Analyze this email for security threats:

━━━━━━━━━━━━━━━━━━━━━━━━
SENDER: ${sender}
SUBJECT: ${subject}
━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL BODY:
${body.substring(0, 3000)}${body.length > 3000 ? "\n[Body truncated at 3000 chars]" : ""}

━━━━━━━━━━━━━━━━━━━━━━━━
URL ANALYSIS (pre-computed):
Total URLs found: ${urlAnalysis.totalFound}
High-risk URLs: ${urlAnalysis.highRiskCount}
Overall URL risk: ${urlAnalysis.overallUrlRisk}

URL Details:
${urlAnalysis.promptSummary}
━━━━━━━━━━━━━━━━━━━━━━━━

Based on ALL signals above (sender domain, subject line, body content, URL analysis), 
provide your threat assessment as JSON.`;
}

/**
 * Format the SMS alert from Claude's response
 * Falls back to building one if Claude's is too long
 */
function formatSmsAlert(analysis, sender, subject) {
  // Use Claude's pre-formatted SMS if it fits
  if (analysis.smsAlert && analysis.smsAlert.length <= 320) {
    return analysis.smsAlert;
  }

  // Fallback: build it ourselves
  const icon = analysis.classification === "CRITICAL" ? "🚨🚨" : "🚨";
  return `${icon} ShieldMail Alert
Risk: ${analysis.risk}/100 (${analysis.classification})
From: ${sender}
Threat: ${analysis.threatType}
Action: ${analysis.whatToDo?.[0] || "Do not interact with this email."}`.substring(0, 320);
}

/**
 * Main analysis function — call this from server.js
 */
async function analyzeEmail(sender, subject, body, urlAnalysis) {
  console.log("🤖 Sending to Claude for analysis...");

  const startTime = Date.now();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildPrompt(sender, subject, body, urlAnalysis)
        }
      ]
    });

    const rawText = response.content[0].text.trim();
    const durationMs = Date.now() - startTime;

    console.log(`✅ Claude responded in ${durationMs}ms`);

    // Parse JSON — strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    // Attach formatted SMS
    analysis.smsAlert = formatSmsAlert(analysis, sender, subject);
    analysis.durationMs = durationMs;

    return analysis;

  } catch (err) {
    console.error("❌ Claude analysis failed:", err.message);

    // Return a safe fallback so the extension doesn't break
    return {
      risk: 0,
      classification: "SAFE",
      confidence: "LOW",
      threatType: "Analysis Failed",
      attackVector: "N/A",
      whatItCanDo: "Could not analyze this email. Treat with caution.",
      whatToDo: ["Exercise caution with this email", "Do not click unknown links"],
      keyRedFlags: [],
      safeIndicators: [],
      senderTrustScore: 50,
      urgencyManipulation: false,
      impersonationDetected: false,
      impersonationTarget: null,
      smsAlert: null,
      error: err.message,
      durationMs: Date.now() - startTime
    };
  }
}

module.exports = { analyzeEmail };
