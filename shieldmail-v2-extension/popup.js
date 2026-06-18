document.addEventListener("DOMContentLoaded", () => {

  chrome.storage.local.get("latestScan", (data) => {
    if (!data.latestScan) {
      showIdleState();
      return;
    }

    const scan = data.latestScan;
    renderScan(scan);
  });

  document.getElementById("blockBtn").addEventListener("click", () => {
    alert("Block sender — coming soon");
  });

  document.getElementById("reportBtn").addEventListener("click", () => {
    alert("Report email — coming soon");
  });

});

function renderScan(scan) {
  const risk = scan.risk || 0;

  // Basic fields
  document.getElementById("sender").innerText  = scan.sender  || "Unknown";
  document.getElementById("subject").innerText = scan.subject || "No subject";
  document.getElementById("riskScore").innerText = risk;

  // Threat type
  const threatTypeEl = document.getElementById("threatType");
  if (threatTypeEl) {
    threatTypeEl.innerText = scan.threatType || "—";
  }

  // Confidence
  const confidenceEl = document.getElementById("confidence");
  if (confidenceEl) {
    confidenceEl.innerText = scan.confidence || "—";
  }

  // What it can do
  const whatItCanDoEl = document.getElementById("whatItCanDo");
  if (whatItCanDoEl) {
    whatItCanDoEl.innerText = scan.whatItCanDo || "—";
  }

  // What to do list
  const whatToDoEl = document.getElementById("whatToDo");
  if (whatToDoEl && scan.whatToDo?.length > 0) {
    whatToDoEl.innerHTML = scan.whatToDo
      .map(a => `<li>${a}</li>`)
      .join("");
  }

  // Red flags
  const redFlagsEl = document.getElementById("redFlags");
  if (redFlagsEl && scan.keyRedFlags?.length > 0) {
    redFlagsEl.innerHTML = scan.keyRedFlags
      .map(f => `<li>🚩 ${f}</li>`)
      .join("");
  }

  // URL analysis
  const urlEl = document.getElementById("urlSummary");
  if (urlEl && scan.urlAnalysis) {
    urlEl.innerText =
      `${scan.urlAnalysis.totalFound} URLs found — ` +
      `${scan.urlAnalysis.highRiskCount} high-risk (${scan.urlAnalysis.overallRisk} overall)`;
  }

  // Status badge
  let status = "SAFE";
  let color  = "#16a34a";

  if (risk > 80) { status = "CRITICAL";   color = "#7f1d1d"; }
  else if (risk > 60) { status = "DANGEROUS";  color = "#dc2626"; }
  else if (risk > 30) { status = "SUSPICIOUS"; color = "#d97706"; }

  const badge = document.getElementById("status");
  badge.innerText = status;
  badge.style.background = color;

  // Score ring color
  const ring = document.querySelector(".score-ring");
  if (ring) {
    ring.style.borderColor = color;
  }
}

function showIdleState() {
  document.getElementById("sender").innerText  = "No email scanned yet";
  document.getElementById("subject").innerText = "Open an email in Gmail";
  document.getElementById("riskScore").innerText = "—";
}
