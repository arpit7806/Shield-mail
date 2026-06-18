console.log("🔥 ShieldMail AI v2.1 background script started");

// Listen for messages from content.js
chrome.runtime.onMessage.addListener((data, sender) => {

  console.log("📨 Received email data:", data.sender, "|", data.subject);

  // Validate
  if (!data.sender || !data.subject || !data.body) {
    console.warn("⚠️ Invalid email data — missing fields");
    return;
  }

  // Read saved phone number from settings, then send to backend
  chrome.storage.local.get("alertPhone", (stored) => {
    const phone = stored.alertPhone || null;

    if (!phone) {
      console.warn("⚠️ No alert phone set — open extension Settings to add your number");
    }

    fetch("https://shield-mail-x2r5.onrender.com/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:  data.sender,
        subject: data.subject,
        body:    data.body,
        phone:   phone
      })
    })
    .then(res => res.json())
    .then((result) => {

      console.log("🤖 AI Analysis complete:");
      console.log(`   Risk: ${result.risk} — ${result.status}`);
      console.log(`   Threat: ${result.threatType}`);
      console.log(`   Confidence: ${result.confidence}`);

      // Save full analysis for popup.js to display
      const latestScan = {
        sender:                data.sender,
        subject:               data.subject,
        risk:                  result.risk,
        status:                result.status,
        threatType:            result.threatType,
        confidence:            result.confidence,
        whatItCanDo:           result.whatItCanDo,
        whatToDo:              result.whatToDo,
        keyRedFlags:           result.keyRedFlags,
        safeIndicators:        result.safeIndicators,
        senderTrustScore:      result.senderTrustScore,
        urgencyManipulation:   result.urgencyManipulation,
        impersonationDetected: result.impersonationDetected,
        impersonationTarget:   result.impersonationTarget,
        urlAnalysis:           result.urlAnalysis,
        scannedAt:             result.scannedAt
      };

      chrome.storage.local.set({ latestScan });

      // Send risk + threat data back to content.js for the warning banner
      if (sender.tab && sender.tab.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          risk:       result.risk,
          status:     result.status,
          threatType: result.threatType,
          whatToDo:   result.whatToDo,
          confidence: result.confidence
        });
      }

    })
    .catch(err => {
      console.error("❌ Backend error:", err.message);
    });

  });

});
