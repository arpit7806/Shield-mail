document.addEventListener("DOMContentLoaded", () => {

  chrome.storage.local.get("latestScan", (data) => {
    if (!data.latestScan) return;

    const scan = data.latestScan;

    document.getElementById("sender").innerText = scan.sender || "Unknown";
    document.getElementById("subject").innerText = scan.subject || "No subject";
    document.getElementById("riskScore").innerText = scan.risk || 0;

    let status = "SAFE";
    let color = "green";

    if (scan.risk > 70) {
      status = "DANGEROUS";
      color = "red";
    } else if (scan.risk > 30) {
      status = "SUSPICIOUS";
      color = "orange";
    }

    const badge = document.getElementById("status");
    badge.innerText = status;
    badge.style.background = color;
  });

  // Buttons (for later use)
  document.getElementById("blockBtn").addEventListener("click", () => {
    alert("Block sender feature coming soon");
  });

  document.getElementById("reportBtn").addEventListener("click", () => {
    alert("Report email feature coming soon");
  });

});