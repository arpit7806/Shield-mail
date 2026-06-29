// content.js — ShieldMail Chrome Extension
// Runs on Gmail, detects open emails and triggers threat analysis

const SHIELDMAIL_API = "https://shieldmail-ai.onrender.com/analyze";
let lastAnalyzedSubject = "";
let isAnalyzing = false;

// Watch for Gmail navigation (Gmail is a SPA)
const observer = new MutationObserver(() => {
  const emailOpen = document.querySelector('[data-message-id]');
  if (emailOpen) {
    const subject = getSubject();
    if (subject && subject !== lastAnalyzedSubject && !isAnalyzing) {
      lastAnalyzedSubject = subject;
      setTimeout(scanCurrentEmail, 1500);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

function getSubject() {
  const el = document.querySelector('h2.hP');
  return el ? el.innerText.trim() : "";
}

function getSender() {
  const el = document.querySelector('.gD');
  return el ? (el.getAttribute('email') || el.innerText.trim()) : "Unknown";
}

function getBody() {
  const bodies = document.querySelectorAll('.a3s.aiL');
  if (!bodies.length) return "";
  return Array.from(bodies).map(b => b.innerText.trim()).join("\n\n");
}

async function scanCurrentEmail() {
  const emailData = {
    sender: getSender(),
    subject: getSubject(),
    body: getBody(),
    headers: ""
  };

  if (!emailData.body || emailData.body.length < 10) return;

  isAnalyzing = true;
  showLoadingPopup();

  try {
    const response = await fetch(SHIELDMAIL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    chrome.storage.local.set({ lastResult: data, lastEmail: emailData.subject });
    showThreatPopup(data);

  } catch (err) {
    showErrorPopup('Could not reach ShieldMail API. Check your connection.');
    console.error('[ShieldMail]', err);
  } finally {
    isAnalyzing = false;
  }
}

// ─────────────────────────────────────────────
// POPUP UI
// ─────────────────────────────────────────────

function removeExistingPopup() {
  const existing = document.getElementById('sm-popup');
  if (existing) existing.remove();
}

function getScoreColor(score) {
  if (score >= 75) return "#ef4444";
  if (score >= 45) return "#f97316";
  if (score >= 20) return "#eab308";
  return "#22c55e";
}

function getLevelEmoji(level) {
  const map = { CRITICAL: "🚨", HIGH: "⚠️", MEDIUM: "🔶", LOW: "🟡", SAFE: "✅" };
  return map[level] || "🔍";
}

function showLoadingPopup() {
  removeExistingPopup();
  const popup = document.createElement("div");
  popup.id = "sm-popup";
  popup.innerHTML = `
    <div id="sm-inner">
      <div id="sm-header">
        <span id="sm-logo">🛡️ ShieldMail</span>
        <button id="sm-close">✕</button>
      </div>
      <div id="sm-body">
        <div id="sm-spinner"></div>
        <p id="sm-status">Scanning email for threats...</p>
      </div>
      <style>
        #sm-popup {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999999;
          animation: sm-slide-in 0.3s ease;
        }
        @keyframes sm-slide-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        #sm-inner {
          background: #1e1e2e;
          border: 1px solid #313244;
          border-radius: 14px;
          padding: 16px 20px;
          min-width: 300px;
          font-family: 'Segoe UI', sans-serif;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        #sm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        #sm-logo {
          font-size: 15px;
          font-weight: 700;
          color: #cdd6f4;
        }
        #sm-close {
          background: none;
          border: none;
          color: #6c7086;
          font-size: 16px;
          cursor: pointer;
        }
        #sm-close:hover { color: #cdd6f4; }
        #sm-body { text-align: center; }
        #sm-spinner {
          width: 32px; height: 32px;
          border: 3px solid #313244;
          border-top: 3px solid #89b4fa;
          border-radius: 50%;
          animation: sm-spin 0.8s linear infinite;
          margin: 0 auto 10px;
        }
        @keyframes sm-spin { to { transform: rotate(360deg); } }
        #sm-status { color: #a6adc8; font-size: 13px; margin: 0; }
      </style>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('sm-close').onclick = removeExistingPopup;
}

function showThreatPopup(data) {
  removeExistingPopup();
  const color = getScoreColor(data.threat_score);
  const emoji = getLevelEmoji(data.threat_level);
  const score = data.threat_score;

  const indicatorsList = data.indicators && data.indicators.length
    ? data.indicators.map(i => `<li>⚠ ${i}</li>`).join('')
    : '';

  const safetyList = data.safety_measures && data.safety_measures.length
    ? data.safety_measures.map(s => `<li>✓ ${s}</li>`).join('')
    : '';

  const popup = document.createElement("div");
  popup.id = "sm-popup";
  popup.innerHTML = `
    <div id="sm-inner">
      <div id="sm-header">
        <span id="sm-logo">🛡️ ShieldMail</span>
        <button id="sm-close">✕</button>
      </div>
      <div id="sm-body">
        <div id="sm-score-ring" style="border-color:${color}">
          <span id="sm-score-num" style="color:${color}">${score}%</span>
          <span id="sm-score-label">THREAT</span>
        </div>
        <div id="sm-level" style="background:${color}20; color:${color}; border:1px solid ${color}">
          ${emoji} ${data.threat_level}
        </div>
        <p id="sm-summary">${data.summary}</p>
        ${indicatorsList ? `<ul id="sm-indicators">${indicatorsList}</ul>` : ''}
        ${safetyList ? `<ul id="sm-safety">${safetyList}</ul>` : ''}
        <p id="sm-footer">Auto-closes in 15s · ShieldMail AI</p>
      </div>
      <style>
        #sm-popup {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999999;
          animation: sm-slide-in 0.3s ease;
        }
        @keyframes sm-slide-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        #sm-inner {
          background: #1e1e2e;
          border: 1px solid ${color};
          border-radius: 14px;
          padding: 16px 20px;
          min-width: 320px;
          max-width: 400px;
          font-family: 'Segoe UI', sans-serif;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        #sm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        #sm-logo { font-size: 15px; font-weight: 700; color: #cdd6f4; }
        #sm-close { background: none; border: none; color: #6c7086; font-size: 16px; cursor: pointer; }
        #sm-close:hover { color: #cdd6f4; }
        #sm-body { text-align: center; }
        #sm-score-ring {
          width: 80px; height: 80px;
          border-radius: 50%;
          border: 4px solid;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          margin: 0 auto 10px;
        }
        #sm-score-num { font-size: 22px; font-weight: 700; line-height: 1; }
        #sm-score-label { font-size: 9px; color: #6c7086; letter-spacing: 1px; }
        #sm-level {
          display: inline-block;
          padding: 3px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        #sm-summary { font-size: 12px; color: #a6adc8; text-align: left; line-height: 1.5; margin-bottom: 8px; }
        #sm-indicators { font-size: 11px; color: #f38ba8; text-align: left; padding-left: 16px; margin-bottom: 8px; }
        #sm-safety { font-size: 11px; color: #a6e3a1; text-align: left; padding-left: 16px; margin-bottom: 8px; }
        #sm-footer { font-size: 10px; color: #45475a; margin: 0; }
      </style>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('sm-close').onclick = removeExistingPopup;
  setTimeout(removeExistingPopup, 15000);
}

function showErrorPopup(msg) {
  removeExistingPopup();
  const popup = document.createElement("div");
  popup.id = "sm-popup";
  popup.innerHTML = `
    <div id="sm-inner">
      <div id="sm-header">
        <span id="sm-logo">🛡️ ShieldMail</span>
        <button id="sm-close">✕</button>
      </div>
      <div id="sm-body">
        <p id="sm-error">⚠️ ${msg}</p>
      </div>
      <style>
        #sm-popup {
          position: fixed; top: 20px; left: 50%;
          transform: translateX(-50%); z-index: 999999;
        }
        #sm-inner {
          background: #1e1e2e; border: 1px solid #ef4444;
          border-radius: 14px; padding: 16px 20px; min-width: 280px;
          font-family: 'Segoe UI', sans-serif;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        #sm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        #sm-logo { font-size: 15px; font-weight: 700; color: #cdd6f4; }
        #sm-close { background: none; border: none; color: #6c7086; font-size: 16px; cursor: pointer; }
        #sm-error { color: #f38ba8; font-size: 13px; text-align: center; margin: 0; }
      </style>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('sm-close').onclick = removeExistingPopup;
  setTimeout(removeExistingPopup, 8000);
}
