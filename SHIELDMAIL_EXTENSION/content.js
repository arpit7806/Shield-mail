const API_URL = "https://shieldmail-ai.onrender.com/analyze";

let lastAnalyzedSubject = "";
let isAnalyzing = false;

// ─────────────────────────────────────────────
// GMAIL EMAIL SCRAPER
// ─────────────────────────────────────────────

function scrapeEmail() {
  try {
    // Subject
    const subjectEl = document.querySelector('h2.hP');
    const subject = subjectEl ? subjectEl.innerText.trim() : "No Subject";

    // Sender
    const senderEl = document.querySelector('span.gD');
    const sender = senderEl
      ? (senderEl.getAttribute('email') || senderEl.innerText.trim())
      : "Unknown";

    // Body
    const bodyEls = document.querySelectorAll('div.a3s.aiL');
    let body = "";
    bodyEls.forEach(el => { body += el.innerText + "\n"; });
    body = body.trim();

    if (!body || body.length < 10) return null;

    return { subject, sender, body };
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────
// POPUP OVERLAY
// ─────────────────────────────────────────────

function removeExistingPopup() {
  const existing = document.getElementById('sheidmail-popup');
  if (existing) existing.remove();
}

function showLoadingPopup() {
  removeExistingPopup();

  const popup = document.createElement('div');
  popup.id = 'sheidmail-popup';
  popup.innerHTML = `
    <div id="sheidmail-inner">
      <div id="sheidmail-header">
        <span id="sheidmail-logo">🛡️ Sheidmail</span>
        <button id="sheidmail-close">✕</button>
      </div>
      <div id="sheidmail-body">
        <div id="sheidmail-spinner"></div>
        <p id="sheidmail-status">Scanning email for threats...</p>
      </div>
    </div>
  `;

  applyStyles(popup);
  document.body.appendChild(popup);

  document.getElementById('sheidmail-close').onclick = removeExistingPopup;
}

function showResultPopup(data) {
  removeExistingPopup();

  const score = data.threat_score;
  const level = data.threat_level;

  // Color based on score
  let color = '#22c55e';      // green - safe
  let emoji = '✅';
  if (score >= 40 && score < 70) { color = '#f59e0b'; emoji = '⚠️'; }
  if (score >= 70)               { color = '#ef4444'; emoji = '🚨'; }

  const indicatorsList = (data.indicators || [])
    .map(i => `<li>${i}</li>`).join('');

  const popup = document.createElement('div');
  popup.id = 'sheidmail-popup';
  popup.innerHTML = `
    <div id="sheidmail-inner">
      <div id="sheidmail-header">
        <span id="sheidmail-logo">🛡️ Sheidmail</span>
        <button id="sheidmail-close">✕</button>
      </div>
      <div id="sheidmail-body">
        <div id="sheidmail-score-ring" style="border-color:${color}">
          <span id="sheidmail-score-num" style="color:${color}">${score}%</span>
          <span id="sheidmail-score-label">THREAT</span>
        </div>
        <div id="sheidmail-level" style="background:${color}20; color:${color}; border:1px solid ${color}">
          ${emoji} ${level}
        </div>
        <p id="sheidmail-summary">${data.summary}</p>
        ${indicatorsList ? `<ul id="sheidmail-indicators">${indicatorsList}</ul>` : ''}
        <p id="sheidmail-sms-note">${data.alert_triggered
          ? '📱 SMS alert sent to your registered number!'
          : ''}</p>
      </div>
    </div>
  `;

  applyStyles(popup);
  document.body.appendChild(popup);
  document.getElementById('sheidmail-close').onclick = removeExistingPopup;
}

function showErrorPopup(msg) {
  removeExistingPopup();
  const popup = document.createElement('div');
  popup.id = 'sheidmail-popup';
  popup.innerHTML = `
    <div id="sheidmail-inner">
      <div id="sheidmail-header">
        <span id="sheidmail-logo">🛡️ Sheidmail</span>
        <button id="sheidmail-close">✕</button>
      </div>
      <div id="sheidmail-body">
        <p style="color:#ef4444; font-size:13px;">⚠️ ${msg}</p>
      </div>
    </div>
  `;
  applyStyles(popup);
  document.body.appendChild(popup);
  document.getElementById('sheidmail-close').onclick = removeExistingPopup;
}

function applyStyles(popup) {
  popup.style.cssText = `
    position: fixed;
    top: 80px;
    right: 24px;
    z-index: 999999;
    width: 320px;
    font-family: 'Google Sans', Arial, sans-serif;
    animation: sheidmail-slide-in 0.3s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes sheidmail-slide-in {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    #sheidmail-inner {
      background: #1e1e2e;
      border: 1px solid #313244;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    #sheidmail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #181825;
      border-bottom: 1px solid #313244;
    }
    #sheidmail-logo {
      font-size: 14px;
      font-weight: 700;
      color: #cdd6f4;
      letter-spacing: 0.5px;
    }
    #sheidmail-close {
      background: none;
      border: none;
      color: #6c7086;
      cursor: pointer;
      font-size: 16px;
      padding: 0;
      line-height: 1;
    }
    #sheidmail-close:hover { color: #cdd6f4; }
    #sheidmail-body {
      padding: 18px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    #sheidmail-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #313244;
      border-top-color: #89b4fa;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #sheidmail-status {
      color: #a6adc8;
      font-size: 13px;
      margin: 0;
      text-align: center;
    }
    #sheidmail-score-ring {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 4px solid;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    #sheidmail-score-num {
      font-size: 26px;
      font-weight: 800;
      line-height: 1;
    }
    #sheidmail-score-label {
      font-size: 9px;
      color: #6c7086;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    #sheidmail-level {
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    #sheidmail-summary {
      color: #a6adc8;
      font-size: 12px;
      text-align: center;
      margin: 0;
      line-height: 1.5;
    }
    #sheidmail-indicators {
      width: 100%;
      padding: 0 0 0 16px;
      margin: 0;
      color: #f38ba8;
      font-size: 11px;
      line-height: 1.7;
    }
    #sheidmail-sms-note {
      color: #a6e3a1;
      font-size: 11px;
      margin: 0;
      text-align: center;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────
// MAIN ANALYZER
// ─────────────────────────────────────────────

async function analyzeCurrentEmail() {
  if (isAnalyzing) return;

  const emailData = scrapeEmail();
  if (!emailData) return;

  // Don't re-analyze same email
  if (emailData.subject === lastAnalyzedSubject) return;
  lastAnalyzedSubject = emailData.subject;

  isAnalyzing = true;
  showLoadingPopup();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: emailData.sender,
        subject: emailData.subject,
        body: emailData.body
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    showResultPopup(data);

    // Save last result to storage
    chrome.storage.local.set({ lastResult: data, lastEmail: emailData.subject });

  } catch (err) {
    showErrorPopup('Could not reach Sheidmail API. Check your connection.');
    console.error('[Sheidmail]', err);
  } finally {
    isAnalyzing = false;
  }
}

// ─────────────────────────────────────────────
// OBSERVER - detects when user opens an email
// ─────────────────────────────────────────────

const observer = new MutationObserver(() => {
  const emailOpen = document.querySelector('div.a3s.aiL');
  if (emailOpen) {
    setTimeout(analyzeCurrentEmail, 1500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Also check on initial load
setTimeout(analyzeCurrentEmail, 2000);
