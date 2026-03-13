/* ============================================================
   INVIGILATOR LOGIN — invigilator.js
   Handles: UI rebuild, login validation, password toggle,
            attempt limiting, session, ripple effects
   ============================================================ */

"use strict";

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */
const AUTH = {
  maxAttempts:   5,
  lockoutMs:     60_000,   // 1 minute lockout
  redirectUrl:   "dashboard.html",
  sessionKey:    "inv_session",
  tokenKey:      "auth_token",
};

/* ────────────────────────────────────────────────
   STATE
──────────────────────────────────────────────── */
let attempts     = 0;
let lockedUntil  = null;
let showPassword = false;

/* ────────────────────────────────────────────────
   BUILD UI — replaces raw HTML with polished layout
──────────────────────────────────────────────── */
function buildUI() {
  document.body.innerHTML = `
    <div class="bg-geo"></div>
    <div class="split-line"></div>

    <div class="login-card" id="login-card">
      <div class="card-accent"></div>

      <div class="card-header">
        <div class="lock-icon" id="lock-icon">
          ${iconLock()}
        </div>
        <h2 class="card-title">Invigilator Login</h2>
        <p class="card-subtitle">Authorised Personnel Only</p>
      </div>

      <div class="card-body">

        <!-- Error / success message -->
        <div class="form-message" id="form-message">
          <span id="msg-text"></span>
        </div>

        <!-- Username -->
        <div class="field">
          <label class="field-label" for="username">Username</label>
          <div class="input-wrap">
            <span class="input-icon">${iconUser()}</span>
            <input
              id="username"
              class="field-input"
              type="text"
              placeholder="Enter username"
              autocomplete="username"
              spellcheck="false"
            >
          </div>
        </div>

        <!-- Password -->
        <div class="field">
          <label class="field-label" for="password">Password</label>
          <div class="input-wrap">
            <span class="input-icon">${iconKey()}</span>
            <input
              id="password"
              class="field-input"
              type="password"
              placeholder="Enter password"
              autocomplete="current-password"
            >
            <button class="pw-toggle" id="pw-toggle" type="button" aria-label="Toggle password visibility" onclick="togglePassword()">
              ${iconEye()}
            </button>
          </div>
        </div>

        <!-- Submit -->
        <button class="btn-login" id="btn-login" onclick="login()">
          Authenticate
        </button>

      </div>

      <div class="card-footer">
        <span class="card-footer-text" id="footer-status">SECURE SESSION</span>
        <a class="back-link" href="index.html">← Back to Home</a>
      </div>
    </div>
  `;

  // Bind Enter key
  document.getElementById("username")?.addEventListener("keydown", handleEnter);
  document.getElementById("password")?.addEventListener("keydown", handleEnter);

  // Check if already logged in
  checkSession();

  // Animate lock icon on load
  setTimeout(() => {
    const li = document.getElementById("lock-icon");
    if (li) {
      li.style.transition = "box-shadow 0.6s ease, border-color 0.6s ease";
      li.style.borderColor = "rgba(197,164,100,0.45)";
      li.style.boxShadow = "0 0 28px rgba(197,164,100,0.18)";
    }
  }, 800);
}

/* ────────────────────────────────────────────────
   SESSION CHECK — skip login if already authed
──────────────────────────────────────────────── */
function checkSession() {
  const session = sessionStorage.getItem(AUTH.sessionKey);
  if (session) {
    try {
      const { expiry, user } = JSON.parse(session);
      if (Date.now() < expiry) {
        showMessage(`Welcome back, ${user}. Redirecting…`, "success");
        setTimeout(() => location.href = AUTH.redirectUrl, 1000);
        return;
      }
    } catch {}
    sessionStorage.removeItem(AUTH.sessionKey);
  }
}

/* ────────────────────────────────────────────────
   LOGIN
──────────────────────────────────────────────── */
async function login() {
  // Lockout check
  if (lockedUntil && Date.now() < lockedUntil) {
    const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
    showMessage(`Too many attempts. Try again in ${remaining}s.`, "error");
    shakeCard();
    return;
  }

  const username = document.getElementById("username")?.value.trim();
  const password = document.getElementById("password")?.value;
  const btn      = document.getElementById("btn-login");

  if (!username || !password) {
    showMessage("Please enter both username and password.", "error");
    shakeCard();
    return;
  }

  // Loading state
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    btn.classList.remove("loading");
    btn.disabled = false;

    if (res.ok) {
      const data = await res.json();

      // ✓ Success
      attempts = 0;
      lockedUntil = null;

      // Save token and session
      sessionStorage.setItem(AUTH.tokenKey, data.access_token);
      sessionStorage.setItem(AUTH.sessionKey, JSON.stringify({
        user:   data.username,
        role:   data.role,
        expiry: Date.now() + 8 * 60 * 60 * 1000,
      }));

      showMessage(`✓ Authenticated as ${data.username}. Redirecting…`, "success");
      updateFooter(`AUTHENTICATED · ${data.username.toUpperCase()}`);

      // Lock icon turns green
      const li = document.getElementById("lock-icon");
      if (li) {
        li.style.borderColor = "rgba(82,183,136,0.5)";
        li.style.background  = "rgba(82,183,136,0.1)";
        li.style.boxShadow   = "0 0 28px rgba(82,183,136,0.2)";
        li.innerHTML = iconUnlock();
      }

      setTimeout(() => location.href = AUTH.redirectUrl, 1400);
    } else {
      // ✗ Failed
      attempts++;
      const left = AUTH.maxAttempts - attempts;

      if (attempts >= AUTH.maxAttempts) {
        lockedUntil = Date.now() + AUTH.lockoutMs;
        attempts = 0;
        showMessage(`Account locked for ${AUTH.lockoutMs / 1000}s. Too many failed attempts.`, "error");
        startLockCountdown();
      } else {
        showMessage(
          left === 1
            ? `Invalid credentials. 1 attempt remaining.`
            : `Invalid credentials. ${left} attempts remaining.`,
          "error"
        );
      }

      shakeCard();
      // Clear password field
      const pw = document.getElementById("password");
      if (pw) { pw.value = ""; pw.focus(); }

      // Lock icon pulses red
      const li = document.getElementById("lock-icon");
      if (li) {
        li.style.borderColor = "rgba(224,82,82,0.5)";
        li.style.boxShadow   = "0 0 20px rgba(224,82,82,0.2)";
        setTimeout(() => {
          li.style.borderColor = "";
          li.style.boxShadow   = "";
        }, 1200);
      }
    }
  } catch (err) {
    btn.classList.remove("loading");
    btn.disabled = false;
    showMessage("Network error. Is the server running?", "error");
    shakeCard();
  }
}

/* ────────────────────────────────────────────────
   LOCKOUT COUNTDOWN
──────────────────────────────────────────────── */
function startLockCountdown() {
  const btn = document.getElementById("btn-login");
  const interval = setInterval(() => {
    const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(interval);
      lockedUntil = null;
      if (btn) { btn.disabled = false; btn.textContent = "Authenticate"; }
      showMessage("You can try again now.", "success");
      updateFooter("SECURE SESSION");
    } else {
      if (btn) {
        btn.disabled = true;
        btn.textContent = `Locked (${remaining}s)`;
        btn.style.background = "rgba(224,82,82,0.2)";
        btn.style.color = "#e05252";
      }
      updateFooter(`LOCKED · ${remaining}s`);
    }
  }, 500);
}

/* ────────────────────────────────────────────────
   PASSWORD TOGGLE
──────────────────────────────────────────────── */
function togglePassword() {
  showPassword = !showPassword;
  const pw  = document.getElementById("password");
  const btn = document.getElementById("pw-toggle");
  if (!pw || !btn) return;
  pw.type  = showPassword ? "text" : "password";
  btn.innerHTML = showPassword ? iconEyeOff() : iconEye();
}

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */
function showMessage(text, type) {
  const el  = document.getElementById("form-message");
  const txt = document.getElementById("msg-text");
  if (!el || !txt) return;
  txt.textContent = text;
  el.className = `form-message show ${type}`;
  // Re-trigger animation
  el.style.animation = "none";
  el.offsetHeight;
  el.style.animation = "";
}

function updateFooter(text) {
  const el = document.getElementById("footer-status");
  if (el) el.textContent = text;
}

function shakeCard() {
  const card = document.getElementById("login-card");
  if (!card) return;
  card.classList.remove("shake");
  card.offsetHeight; // reflow
  card.classList.add("shake");
  card.addEventListener("animationend", () => card.classList.remove("shake"), { once: true });
}

function handleEnter(e) {
  if (e.key === "Enter") login();
}

/* ── SVG Icons ── */
function iconLock() {
  return `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
}
function iconUnlock() {
  return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:#52b788;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
}
function iconUser() {
  return `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
}
function iconKey() {
  return `<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="5"/><path d="M21 3l-9.4 9.4M16 8l2 2"/></svg>`;
}
function iconEye() {
  return `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function iconEyeOff() {
  return `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

/* ────────────────────────────────────────────────
   RIPPLE EFFECT on btn
──────────────────────────────────────────────── */
document.addEventListener("click", e => {
  const btn = e.target.closest(".btn-login");
  if (!btn || btn.disabled) return;
  const r   = btn.getBoundingClientRect();
  const sz  = Math.max(r.width, r.height);
  const rip = document.createElement("span");
  rip.style.cssText = `
    position:absolute;width:${sz}px;height:${sz}px;
    left:${e.clientX-r.left-sz/2}px;top:${e.clientY-r.top-sz/2}px;
    border-radius:50%;background:rgba(255,255,255,0.18);
    transform:scale(0);animation:_rpl 0.55s ease-out forwards;pointer-events:none;
  `;
  btn.appendChild(rip);
  rip.addEventListener("animationend", () => rip.remove());
});

(function injectKF() {
  const s = document.createElement("style");
  s.textContent = `@keyframes _rpl { to { transform:scale(2.5); opacity:0; } }`;
  document.head.appendChild(s);
})();

/* ────────────────────────────────────────────────
   EXPOSE GLOBALS & BOOT
──────────────────────────────────────────────── */
window.login          = login;
window.togglePassword = togglePassword;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", buildUI);
} else {
  buildUI();
}