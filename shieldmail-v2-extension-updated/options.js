// options.js — ShieldMail AI Settings

const phoneInput = document.getElementById("phoneInput");
const saveBtn    = document.getElementById("saveBtn");
const toast      = document.getElementById("toast");

// ── Load saved phone number on page open ──────────────────────────
chrome.storage.local.get("alertPhone", (data) => {
  if (data.alertPhone) {
    phoneInput.value = data.alertPhone;
  }
});

// ── Save button ───────────────────────────────────────────────────
saveBtn.addEventListener("click", () => {
  const phone = phoneInput.value.trim();

  // Validate: must start with + and have 10-15 digits
  const phoneRegex = /^\+[1-9]\d{9,14}$/;

  if (!phone) {
    showToast("⚠️ Please enter a phone number.", "error");
    return;
  }

  if (!phoneRegex.test(phone)) {
    showToast("❌ Invalid format. Use: +919711147334", "error");
    return;
  }

  chrome.storage.local.set({ alertPhone: phone }, () => {
    showToast(`✅ Saved! SMS alerts will be sent to ${phone}`, "success");
  });
});

// ── Toast helper ──────────────────────────────────────────────────
function showToast(message, type) {
  toast.innerText = message;
  toast.className = type === "success" ? "toast-success" : "toast-error";
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 4000);
}
