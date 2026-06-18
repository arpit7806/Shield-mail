// server.js — ShieldMail AI Backend
// Flow: Email → URL pre-analysis → Claude AI → Risk score + SMS alert

require("dotenv").config();

const express = require("express");
const cors    = require("cors");

const { analyzeEmailUrls } = require("./utils/urlAnalyzer");
const { analyzeEmail }     = require("./services/aiAnalysisService");
const { sendThreatSms }    = require("./services/smsService");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "ShieldMail AI", version: "2.0.0" });
});

// ─── Main Scan Endpoint ───────────────────────────────────────────────────────
app.post("/scan", async (req, res) => {
  const { sender, subject, body, phone } = req.body;

  // Validate required fields
  if (!sender || !subject || !body) {
    return res.status(400).json({
      error: "Missing required fields: sender, subject, body"
    });
  }

  console.log(`\n📩 New scan request`);
  console.log(`   Sender:  ${sender}`);
  console.log(`   Subject: ${subject}`);

  try {

    // ── Step 1: Pre-analyze URLs in the email body ──────────────────────────
    console.log("🔗 Analyzing URLs...");
    const urlAnalysis = analyzeEmailUrls(body);
    console.log(`   Found ${urlAnalysis.totalFound} URLs, ${urlAnalysis.highRiskCount} high-risk`);

    // ── Step 2: Send everything to Claude for AI threat analysis ────────────
    const analysis = await analyzeEmail(sender, subject, body, urlAnalysis);

    console.log(`🎯 Risk Score: ${analysis.risk} — ${analysis.classification} (${analysis.confidence} confidence)`);

    // ── Step 3: Send SMS alert if threat detected ───────────────────────────
    let smsResult = { sent: false, reason: "Risk below threshold" };

    if (analysis.risk > 60) {
      console.log("🚨 Threat detected — sending SMS alert...");

      // Phone priority: request body > environment variable
      const alertPhone = phone || process.env.ALERT_PHONE_NUMBER;

      smsResult = await sendThreatSms(
        alertPhone,
        analysis,
        { sender, subject }
      );
    }

    // ── Step 4: Return full analysis to the extension ───────────────────────
    res.json({
      // Core fields used by background.js and popup.js
      risk:           analysis.risk,
      status:         analysis.classification,

      // Rich threat data for popup display
      threatType:     analysis.threatType,
      confidence:     analysis.confidence,
      attackVector:   analysis.attackVector,
      whatItCanDo:    analysis.whatItCanDo,
      whatToDo:       analysis.whatToDo,
      keyRedFlags:    analysis.keyRedFlags,
      safeIndicators: analysis.safeIndicators,

      // Sender intelligence
      senderTrustScore:       analysis.senderTrustScore,
      urgencyManipulation:    analysis.urgencyManipulation,
      impersonationDetected:  analysis.impersonationDetected,
      impersonationTarget:    analysis.impersonationTarget,

      // URL analysis summary
      urlAnalysis: {
        totalFound:    urlAnalysis.totalFound,
        highRiskCount: urlAnalysis.highRiskCount,
        overallRisk:   urlAnalysis.overallUrlRisk
      },

      // Meta
      smsAlert:    smsResult,
      durationMs:  analysis.durationMs,
      scannedAt:   new Date().toISOString()
    });

  } catch (err) {
    console.error("❌ Scan failed:", err);
    res.status(500).json({ error: "Internal scan error", detail: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 ShieldMail AI v2.0 running on http://localhost:${PORT}`);
  console.log(`   Claude model: claude-sonnet-4-6`);
  console.log(`   SMS via Twilio: ${process.env.TWILIO_ACCOUNT_SID ? "✅ configured" : "⚠️  not configured"}`);
  console.log(`   Alert phone: ${process.env.ALERT_PHONE_NUMBER || "not set"}\n`);
});
