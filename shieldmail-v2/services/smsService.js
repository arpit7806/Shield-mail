// services/smsService.js
// Direct Twilio integration — no n8n needed

/**
 * Send threat alert SMS via Twilio REST API
 * Using raw fetch so we don't need the Twilio SDK package
 */
async function sendThreatSms(toPhone, analysis, emailMeta) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone  = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    console.warn("⚠️ Twilio credentials not configured — skipping SMS");
    return { sent: false, reason: "Twilio not configured" };
  }

  if (!toPhone) {
    console.warn("⚠️ No phone number provided — skipping SMS");
    return { sent: false, reason: "No phone number" };
  }

  // Build the human-readable SMS
  const message = buildSmsMessage(analysis, emailMeta);

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          To:   toPhone,
          From: fromPhone,
          Body: message
        })
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ SMS sent to ${toPhone} | SID: ${result.sid}`);
      return { sent: true, sid: result.sid };
    } else {
      console.error("❌ Twilio error:", result.message);
      return { sent: false, reason: result.message };
    }

  } catch (err) {
    console.error("❌ SMS send failed:", err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Build a clean, human-readable SMS from AI analysis
 * Structured for non-technical users
 */
function buildSmsMessage(analysis, emailMeta) {
  const { risk, classification, threatType, whatItCanDo, whatToDo } = analysis;
  const { sender, subject } = emailMeta;

  const icon = classification === "CRITICAL" ? "🚨🚨" : "🚨";

  const lines = [
    `${icon} SHIELDMAIL SECURITY ALERT`,
    ``,
    `Risk Score: ${risk}/100 — ${classification}`,
    `From: ${sender}`,
    `Subject: ${subject?.substring(0, 50)}`,
    ``,
    `⚠️ Threat: ${threatType}`,
    `What it can do: ${whatItCanDo}`,
    ``,
    `✅ What to do:`,
    ...(whatToDo || []).slice(0, 3).map((action, i) => `${i + 1}. ${action}`),
    ``,
    `— ShieldMail AI`
  ];

  // Join and truncate to SMS safe length
  return lines.join("\n").substring(0, 1600); // MMS limit for multi-part SMS
}

module.exports = { sendThreatSms };
