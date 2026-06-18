console.log("✅ ShieldMail AI v2.0 content script loaded");

let lastEmailId = null;

// ─── Extract email data from Gmail DOM ───────────────────────────────────────
function extractEmailData() {
  try {
    const sender  = document.querySelector(".gD")?.getAttribute("email");
    const subject = document.querySelector("h2.hP")?.innerText;
    const body    = document.querySelector(".a3s")?.innerText;

    if (!sender || !subject || !body) return;

    // Prevent duplicate scans of same email
    const emailId = sender + subject;
    if (emailId === lastEmailId) return;
    lastEmailId = emailId;

    console.log(`📩 Email detected from: ${sender}`);

    // Show scanning indicator
    showScanningBanner();

    chrome.runtime.sendMessage({ sender, subject, body });

  } catch (err) {
    console.error("❌ Extraction error:", err);
  }
}

// ─── Observe Gmail DOM for email opens ───────────────────────────────────────
const observer = new MutationObserver(() => {
  extractEmailData();
});

observer.observe(document.body, { childList: true, subtree: true });

// ─── Listen for AI result from background.js ─────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.risk === undefined) return;
  showResultBanner(msg);
});

// ─── Scanning in progress banner ─────────────────────────────────────────────
function showScanningBanner() {
  removeBanner();
  injectStyles();

  const banner = document.createElement("div");
  banner.id = "shieldmail-banner";
  banner.className = "shieldmail-scanning";

  banner.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <span style="font-size:20px;">🛡</span>
      <div>
        <div style="font-size:14px; font-weight:700;">ShieldMail AI</div>
        <div style="font-size:12px; opacity:0.85;">Analyzing email for threats...</div>
      </div>
      <div class="shieldmail-spinner"></div>
    </div>
  `;

  applyBannerBase(banner, "#1e40af");
  document.body.appendChild(banner);
}

// ─── Result banner with full AI threat details ────────────────────────────────
function showResultBanner(msg) {
  removeBanner();
  injectStyles();

  const { risk, status, threatType, whatToDo, confidence } = msg;

  let color, icon, animClass;

  if (risk > 80) {
    color = "#991b1b"; icon = "🚨"; animClass = "shieldmail-critical";
  } else if (risk > 60) {
    color = "#dc2626"; icon = "⛔"; animClass = "shieldmail-danger";
  } else if (risk > 30) {
    color = "#b45309"; icon = "⚠️"; animClass = "shieldmail-warning";
  } else {
    color = "#166534"; icon = "✅"; animClass = "shieldmail-safe";
  }

  const banner = document.createElement("div");
  banner.id = "shieldmail-banner";
  banner.className = animClass;

  const actionsHtml = (whatToDo && whatToDo.length > 0 && risk > 30)
    ? `<div style="margin-top:10px; font-size:12px; border-top:1px solid rgba(255,255,255,0.3); padding-top:8px;">
        <b>What to do:</b>
        <ul style="margin:4px 0 0 0; padding-left:16px;">
          ${whatToDo.slice(0, 3).map(a => `<li>${a}</li>`).join("")}
        </ul>
      </div>`
    : "";

  banner.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px;">

      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">${icon}</span>
          <div>
            <div style="font-size:15px; font-weight:700;">ShieldMail AI</div>
            <div style="font-size:12px; opacity:0.9;">${status} — ${threatType || "No Threat"}</div>
          </div>
        </div>
        <button id="shieldmail-close" style="
          background:none; border:none; color:white;
          font-size:18px; cursor:pointer; padding:0 4px; line-height:1;
        ">✖</button>
      </div>

      <div style="display:flex; gap:16px; font-size:13px;">
        <span>📊 Risk: <b>${risk}/100</b></span>
        <span>🎯 Confidence: <b>${confidence || "—"}</b></span>
      </div>

      ${actionsHtml}

      ${risk > 60 ? `<div style="font-size:11px; opacity:0.8; margin-top:4px;">
        📱 Threat alert sent to your registered mobile number.
      </div>` : ""}

    </div>
  `;

  applyBannerBase(banner, color);
  document.body.appendChild(banner);

  document.getElementById("shieldmail-close").onclick = removeBanner;

  // Auto-dismiss safe emails after 5 seconds
  if (risk <= 30) {
    setTimeout(removeBanner, 5000);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function removeBanner() {
  document.getElementById("shieldmail-banner")?.remove();
}

function applyBannerBase(banner, bgColor) {
  Object.assign(banner.style, {
    position:   "fixed",
    top:        "20px",
    left:       "50%",
    transform:  "translateX(-50%)",
    width:      "28%",
    minWidth:   "340px",
    maxWidth:   "480px",
    padding:    "16px 18px",
    borderRadius: "12px",
    background: bgColor,
    color:      "white",
    zIndex:     "999999",
    fontFamily: "Arial, sans-serif",
    boxShadow:  "0 4px 24px rgba(0,0,0,0.4)"
  });
}

function injectStyles() {
  if (document.getElementById("shieldmail-styles")) return;

  const style = document.createElement("style");
  style.id = "shieldmail-styles";
  style.innerHTML = `
    @keyframes shieldSlideDown {
      from { transform: translate(-50%, -100px); opacity: 0; }
      to   { transform: translate(-50%, 0);      opacity: 1; }
    }
    @keyframes shieldPulse {
      0%, 100% { box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
      50%       { box-shadow: 0 4px 32px rgba(220,38,38,0.7); }
    }
    @keyframes shieldBlink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.7; }
    }
    @keyframes shieldSpin {
      to { transform: rotate(360deg); }
    }

    .shieldmail-scanning { animation: shieldSlideDown 0.4s ease forwards; }
    .shieldmail-safe     { animation: shieldSlideDown 0.4s ease forwards; }
    .shieldmail-warning  { animation: shieldSlideDown 0.4s ease forwards, shieldPulse 2s infinite; }
    .shieldmail-danger   { animation: shieldSlideDown 0.4s ease forwards, shieldPulse 1.5s infinite; }
    .shieldmail-critical { animation: shieldSlideDown 0.3s ease forwards, shieldBlink 0.5s infinite; }

    .shieldmail-spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: shieldSpin 0.8s linear infinite;
      margin-left: auto;
    }
  `;
  document.head.appendChild(style);
}
