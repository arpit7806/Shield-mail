// background.js — service worker
const API_URL = "https://shieldmail-ai.onrender.com/analyze";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_EMAIL") {
    analyzeWithRetry(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function analyzeWithRetry(emailData, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for cold start

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();

    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 3000)); // wait 3s before retry
    }
  }
}
