console.log("🔥 ShieldMail AI background script started");

// Listen for messages from content.js
chrome.runtime.onMessage.addListener((data, sender) => {

  console.log("📨 Received email data:", data);

  // Safety check
  if (!data.sender || !data.subject || !data.body) {
    console.warn("⚠️ Invalid email data");
    return;
  }

  // Send data to backend
  fetch("http://localhost:3000/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(async (result) => {

    console.log("🤖 AI Result:", result);

    let riskScore = result.risk || 0;
    let status = riskScore > 70 ? "Danger" : "Safe";

    // 🚨 Trigger SMS only if dangerous
    if (riskScore > 70) {
      console.log("🚨 High risk detected! Sending webhook...");

      try {
        await fetch("https://adityaonly.app.n8n.cloud/webhook-test/phishing-alert", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: data.sender,
            riskScore: riskScore,
            subject: data.subject,
            dashboardUrl: "https://your-dashboard-link.com",
            phone: "+919711147334"
          })
        });

        console.log("✅ Webhook sent successfully");

      } catch (err) {
        console.error("❌ Webhook failed:", err);
      }
    }

    // Save for popup
    const latestScan = {
      sender: data.sender,
      subject: data.subject,
      risk: riskScore,
      status: status
    };

    chrome.storage.local.set({ latestScan });

    // Send risk back to content.js (for banner)
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        risk: riskScore
      });
    }

  })
  .catch(err => {
    console.error("❌ Backend error:", err);
  });

});