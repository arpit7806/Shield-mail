// utils/urlAnalyzer.js
// Pre-processes URLs before sending to Claude
// Gives Claude richer context → better accuracy

const SUSPICIOUS_TLDS = [
  ".tk", ".ml", ".ga", ".cf", ".gq", // free TLDs heavily abused
  ".xyz", ".top", ".click", ".link",
  ".zip", ".mov" // Google's controversial new TLDs used in phishing
];

const TRUSTED_DOMAINS = [
  "google.com", "gmail.com", "microsoft.com", "apple.com",
  "amazon.com", "paypal.com", "facebook.com", "instagram.com",
  "linkedin.com", "twitter.com", "github.com", "youtube.com"
];

// Homoglyph / typosquat patterns (e.g. paypa1.com, g00gle.com)
const HOMOGLYPH_PATTERNS = [
  { real: "paypal", fakes: ["paypa1", "payp4l", "paypall", "paypal-secure"] },
  { real: "google", fakes: ["g00gle", "googie", "go0gle", "google-login"] },
  { real: "microsoft", fakes: ["microsofft", "micros0ft", "microsoft-verify"] },
  { real: "apple", fakes: ["app1e", "apple-id", "applecare-alert"] },
  { real: "amazon", fakes: ["amaz0n", "amazon-security", "amazone"] },
  { real: "paypal", fakes: ["paypal-support", "paypal-alert", "secure-paypal"] },
  { real: "netflix", fakes: ["netf1ix", "netflix-billing", "netflex"] },
  { real: "bank", fakes: ["bank-secure", "banking-alert", "bank-verify"] }
];

/**
 * Extract all URLs from email body text
 */
function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  // Deduplicate
  return [...new Set(matches)];
}

/**
 * Analyze a single URL for risk signals
 */
function analyzeUrl(url) {
  const signals = [];
  let riskScore = 0;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // 1. Check for IP address instead of domain
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(hostname)) {
      signals.push("Uses raw IP address instead of domain name");
      riskScore += 40;
    }

    // 2. Suspicious TLD check
    const suspiciousTld = SUSPICIOUS_TLDS.find(tld => hostname.endsWith(tld));
    if (suspiciousTld) {
      signals.push(`Suspicious TLD detected: ${suspiciousTld}`);
      riskScore += 30;
    }

    // 3. Homoglyph / brand spoofing check
    for (const pattern of HOMOGLYPH_PATTERNS) {
      const isSpoofing = pattern.fakes.some(fake => hostname.includes(fake));
      const isTrusted = hostname.includes(pattern.real) &&
        TRUSTED_DOMAINS.some(d => hostname.endsWith(d));

      if (isSpoofing && !isTrusted) {
        signals.push(`Possible brand impersonation: ${pattern.real}`);
        riskScore += 50;
        break;
      }
    }

    // 4. Excessive subdomains (e.g. login.secure.paypal.verify.xyz.com)
    const subdomainCount = hostname.split(".").length - 2;
    if (subdomainCount > 3) {
      signals.push(`Excessive subdomains (${subdomainCount}) — common obfuscation technique`);
      riskScore += 20;
    }

    // 5. URL contains sensitive keywords
    const sensitiveKeywords = [
      "login", "verify", "secure", "account", "update",
      "confirm", "banking", "password", "credential", "signin"
    ];
    const foundKeywords = sensitiveKeywords.filter(k => fullUrl.includes(k));
    if (foundKeywords.length > 0) {
      signals.push(`Sensitive keywords in URL: ${foundKeywords.join(", ")}`);
      riskScore += foundKeywords.length * 10;
    }

    // 6. URL shortener detection
    const shorteners = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "short.link"];
    if (shorteners.some(s => hostname.includes(s))) {
      signals.push("URL shortener used — hides true destination");
      riskScore += 25;
    }

    // 7. HTTPS check
    if (parsed.protocol !== "https:") {
      signals.push("Non-HTTPS link — unencrypted connection");
      riskScore += 15;
    }

    // 8. Trusted domain check (reduce risk)
    const isTrusted = TRUSTED_DOMAINS.some(d => hostname.endsWith(d));
    if (isTrusted) {
      riskScore = Math.max(0, riskScore - 30);
      signals.push(`Recognized trusted domain: ${hostname}`);
    }

    return {
      url,
      hostname,
      riskScore: Math.min(100, riskScore),
      signals,
      isSuspicious: riskScore > 30
    };

  } catch {
    // Malformed URL itself is suspicious
    return {
      url,
      hostname: "unknown",
      riskScore: 50,
      signals: ["Malformed or unreadable URL"],
      isSuspicious: true
    };
  }
}

/**
 * Analyze all URLs in an email body
 * Returns a summary object to inject into the Claude prompt
 */
function analyzeEmailUrls(body) {
  const urls = extractUrls(body);

  if (urls.length === 0) {
    return {
      totalFound: 0,
      highRiskCount: 0,
      overallUrlRisk: "none",
      urls: [],
      promptSummary: "No URLs found in email body."
    };
  }

  const analyzed = urls.map(analyzeUrl);
  const highRisk = analyzed.filter(u => u.riskScore > 60);
  const suspicious = analyzed.filter(u => u.isSuspicious);

  const overallUrlRisk =
    highRisk.length > 0 ? "high" :
    suspicious.length > 0 ? "medium" : "low";

  // Build a concise summary for the Claude prompt
  const promptSummary = analyzed.map(u =>
    `- ${u.url}\n  Risk: ${u.riskScore}/100 | Signals: ${u.signals.join("; ") || "none"}`
  ).join("\n");

  return {
    totalFound: urls.length,
    highRiskCount: highRisk.length,
    suspiciousCount: suspicious.length,
    overallUrlRisk,
    urls: analyzed,
    promptSummary
  };
}

module.exports = { analyzeEmailUrls };
