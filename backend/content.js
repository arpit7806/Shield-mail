console.log("📩 Content script loaded");
console.log("✅ ShieldMail AI content script loaded");

// Prevent duplicate scanning
let lastEmailId = null;

// Extract email data from Gmail
function extractEmailData() {
  try {
    const sender = document.querySelector(".gD")?.getAttribute("email");
    const subject = document.querySelector("h2.hP")?.innerText;
    const body = document.querySelector(".a3s")?.innerText;

    if (!sender || !subject || !body) return;

    const emailId = sender + subject;
    if (emailId === lastEmailId) return;
    lastEmailId = emailId;

    console.log("📩 Email Detected");
    console.log("Sender:", sender);
    console.log("Subject:", subject);

    const emailData = { sender, subject, body };

    // ✅ Send WITHOUT callback (important)
    console.log("Sending email data...");
    chrome.runtime.sendMessage(emailData);

  } catch (err) {
    console.error("❌ Extraction error:", err);
  }
}

// Observe Gmail DOM changes
const observer = new MutationObserver(() => {
  extractEmailData();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for risk result from background.js
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg.risk) return;
  showWarningBanner(msg.risk);
});

// Show warning banner
function showWarningBanner(risk) {

  const existing = document.getElementById("shieldmail-warning");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "shieldmail-warning";

  let status = "Safe";
  let color = "#16a34a";
  let icon = "🛡";
  let animationClass = "safe";

  if (risk > 70) {
    status = "Dangerous";
    color = "#dc2626";
    icon = "🚨";
    animationClass = "danger";
  } 
  else if (risk > 30) {
    status = "Suspicious";
    color = "#f59e0b";
    icon = "⚠️";
    animationClass = "warning";
  }

  // Inject CSS animations (only once)
  if (!document.getElementById("shieldmail-style")) {
    const style = document.createElement("style");
    style.id = "shieldmail-style";

    style.innerHTML = `
      @keyframes slideDown {
        from {
          transform: translate(-50%, -80px);
          opacity: 0;
        }
        to {
          transform: translate(-50%, 0);
          opacity: 1;
        }
      }

      @keyframes glow {
        0% { box-shadow: 0 0 10px rgba(255,255,255,0.2); }
        50% { box-shadow: 0 0 25px rgba(255,255,255,0.6); }
        100% { box-shadow: 0 0 10px rgba(255,255,255,0.2); }
      }

      @keyframes dangerBlink {
        0% { opacity: 1; box-shadow: 0 0 10px red; }
        50% { opacity: 0.6; box-shadow: 0 0 25px red; }
        100% { opacity: 1; box-shadow: 0 0 10px red; }
      }

      .shieldmail-banner {
        animation: slideDown 0.5s ease forwards;
      }

      .shieldmail-warning {
        animation: slideDown 0.5s ease forwards, glow 2s infinite;
      }

      .shieldmail-danger {
        animation: slideDown 0.4s ease forwards, dangerBlink 0.6s infinite;
      }
    `;

    document.head.appendChild(style);
  }

  banner.classList.add("shieldmail-banner");

  if (animationClass === "warning") {
    banner.classList.add("shieldmail-warning");
  }
  if (animationClass === "danger") {
    banner.classList.add("shieldmail-danger");
  }

  banner.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">${icon}</span>
          <div>
            <div style="font-size:16px; font-weight:700;">ShieldMail AI</div>
            <div style="font-size:13px; opacity:0.9;">
              ${status} Email Detected
            </div>
          </div>
        </div>

        <button id="closeBannerBtn" style="
          background:none;
          border:none;
          color:white;
          font-size:18px;
          cursor:pointer;
        ">✖</button>
      </div>

      <div style="font-size:14px;">
        📊 Risk Score: <b>${risk}</b>
      </div>
      ${risk > 70 ? `
      <div style="font-size:13px; opacity:0.9;">
          📩 Threat report has been sent to your registered mobile number via SMS.
      </div>
      ` : ""}

    </div>
  `;

  banner.style.position = "fixed";
  banner.style.top = "20px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.width = "25%";
  banner.style.minWidth = "320px";
  banner.style.padding = "18px";
  banner.style.borderRadius = "12px";
  banner.style.background = color;
  banner.style.color = "white";
  banner.style.zIndex = "9999";
  banner.style.fontFamily = "Arial, sans-serif";

  document.body.appendChild(banner);

  document.getElementById("closeBannerBtn").onclick = () => {
    banner.remove();
  };
}