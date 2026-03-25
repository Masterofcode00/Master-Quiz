/* ============================================================
   ADMIN DASHBOARD — dashboard.js
   Handles: UI render, add/delete questions, show results,
            live clock, stats, localStorage persistence
   ============================================================ */

"use strict";

/* ────────────────────────────────────────────────
   AUTH HELPERS
──────────────────────────────────────────────── */
function getToken() {
  return sessionStorage.getItem('auth_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

/* ────────────────────────────────────────────────
   STORE — backend API helpers
──────────────────────────────────────────────── */
const STORE = {
  async getQuestions() {
    try {
      const res = await fetch('/api/questions');
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  },
  async getResults() {
    try {
      const res = await fetch('/api/results');
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  },
  async addQuestion(q) {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(q),
    });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to add question');
      }
      return await res.json();
    },
    async uploadQuestionBank(file) {
      const formData = new FormData();
      formData.append('file', file);
  
      const headers = authHeaders();
      delete headers['Content-Type']; // Let the browser set the boundary
  
      const res = await fetch('/api/questions/upload', {
        method: 'POST',
        headers: headers,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to upload question bank');
      }
      return await res.json();
    },
  async deleteQuestion(id) {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete');
  },
  async clearResults() {
    const res = await fetch('/api/results', {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear');
  },
};

/* ────────────────────────────────────────────────
   TOAST
──────────────────────────────────────────────── */
let _toastTimer;
function showToast(msg, type = "info") {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("show")));
  _toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}

/* ────────────────────────────────────────────────
   LIVE CLOCK
──────────────────────────────────────────────── */
function startClock() {
  const el = document.getElementById("live-time");
  if (!el) return;
  function tick() {
    el.textContent = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
    });
  }
  tick();
  setInterval(tick, 1000);
}

/* ────────────────────────────────────────────────
   STATS — update top stat cards
──────────────────────────────────────────────── */
async function updateStats() {
  const questions = await STORE.getQuestions();
  const results   = await STORE.getResults();

  const qCount   = document.getElementById("stat-questions");
  const rCount   = document.getElementById("stat-results");
  const avgScore = document.getElementById("stat-avg");

  if (qCount) animateCount(qCount, questions.length);
  if (rCount) animateCount(rCount, results.length);

  if (avgScore) {
    if (!results.length) {
      avgScore.textContent = "—";
    } else {
      const avg = results.reduce((s, r) => s + (r.pct || 0), 0) / results.length;
      animateCount(avgScore, Math.round(avg), "%");
    }
  }

  // sidebar badge
  const badge = document.getElementById("q-badge");
  if (badge) badge.textContent = questions.length;
}

function animateCount(el, target, suffix = "") {
  const start    = parseInt(el.textContent) || 0;
  const duration = 500;
  const startTs  = performance.now();
  function step(ts) {
    const pct = Math.min((ts - startTs) / duration, 1);
    const val = start + (target - start) * easeOut(pct);
    el.textContent = (isNaN(val) ? target : Math.round(val)) + suffix;
    if (pct < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* ────────────────────────────────────────────────
   SELECTED ANSWER STATE
──────────────────────────────────────────────── */
let selectedAnswer = null;

function selectAnswer(index) {
  selectedAnswer = index;
  document.querySelectorAll(".answer-opt").forEach((el, i) => {
    el.classList.toggle("selected", i === index);
  });
  // Also update hidden input
  const hidden = document.getElementById("answer");
  if (hidden) hidden.value = index;
}

/* ────────────────────────────────────────────────
   ADD QUESTION
──────────────────────────────────────────────── */
async function addQuestion() {
  const qText = document.getElementById("question")?.value.trim();
  const ops   = ["op1","op2","op3","op4"].map(id => document.getElementById(id)?.value.trim() || "");
  const ansEl = document.getElementById("answer");
  const ans   = selectedAnswer !== null ? selectedAnswer : parseInt(ansEl?.value, 10);

  if (!qText)                         { showToast("⚠ Question text is required.", "error"); return; }
  if (ops.some(o => !o))              { showToast("⚠ All four options are required.", "error"); return; }
  if (isNaN(ans) || ans < 0 || ans > 3) { showToast("⚠ Select the correct answer (A–D).", "error"); return; }

  try {
    await STORE.addQuestion({ question: qText, options: ops, answer: ans });

    // Clear fields
    ["question","op1","op2","op3","op4"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = "";
        el.style.transition = "border-color 0.15s";
        el.style.borderColor = "rgba(99,211,158,0.6)";
        setTimeout(() => el.style.borderColor = "", 700);
      }
    });

    selectedAnswer = null;
    document.querySelectorAll(".answer-opt").forEach(el => el.classList.remove("selected"));
    if (ansEl) ansEl.value = "";

    await updateStats();
    await renderQuestionList();
    showToast(`✓ Question added successfully.`, "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

/* ────────────────────────────────────────────────
   UPLOAD QUESTION BANK (EXCEL/CSV)
──────────────────────────────────────────────── */
async function uploadFile() {
  const fileInput = document.getElementById("bulk-upload-file");
  if (!fileInput || !fileInput.files.length) {
    showToast("⚠ Please select an Excel (.xlsx) or CSV file first.", "error");
    return;
  }
  
  const file = fileInput.files[0];
  
  try {
    const response = await STORE.uploadQuestionBank(file);
    fileInput.value = ""; // Clear file input
    await updateStats();
    await renderQuestionList();
    showToast(`✓ ${response.message}`, "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

/* ────────────────────────────────────────────────
   DELETE QUESTION
──────────────────────────────────────────────── */
async function deleteQuestion(id) {
  try {
    await STORE.deleteQuestion(id);
    await updateStats();
    await renderQuestionList();
    showToast("Question removed.", "info");
  } catch {
    showToast("Failed to delete question.", "error");
  }
}

/* ────────────────────────────────────────────────
   RENDER QUESTION LIST (right panel)
──────────────────────────────────────────────── */
async function renderQuestionList() {
  const list = document.getElementById("question-list");
  if (!list) return;

  const questions = await STORE.getQuestions();

  if (!questions.length) {
    list.innerHTML = `<div class="q-list-empty">No questions added yet.</div>`;
    return;
  }

  list.innerHTML = questions.map((q, i) => `
    <div class="q-item" data-id="${q.id}">
      <span class="q-num">Q${i + 1}</span>
      <div style="flex:1;min-width:0;">
        <div class="q-text-preview">${escapeHtml(q.question)}</div>
        <div class="q-opts-preview">
          ${q.options.map((o, j) => `<span style="color:${j===q.answer?"var(--accent)":"var(--text-3)"}">${["A","B","C","D"][j]}:${escapeHtml(o)}</span>`).join("  ")}
        </div>
      </div>
      <button class="q-del" onclick="deleteQuestion(${q.id})" title="Delete">✕</button>
    </div>
  `).join("");
}

/* ────────────────────────────────────────────────
   LOAD RESULTS
──────────────────────────────────────────────── */
async function loadResults() {
  const container = document.getElementById("results");
  const btn       = document.querySelector(".btn-submit");

  if (!container) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Loading…`;
  }

  const results = await STORE.getResults();

  if (btn) { btn.disabled = false; btn.innerHTML = "⟳ &nbsp;Refresh Results"; }

  if (!results.length) {
    container.innerHTML = `
      <div class="results-empty">
        <span class="empty-icon">📭</span>
        No results recorded yet.
      </div>`;
    return;
  }

  const sorted = [...results].sort((a, b) => (b.pct || 0) - (a.pct || 0));
  const medals = ["🥇","🥈","🥉"];

  const rows = sorted.map((r, i) => {
    const pct   = r.pct ?? Math.round((r.score / r.total) * 100);
    const cls   = pct >= 80 ? "score-high" : pct >= 50 ? "score-mid" : "score-low";
    const rankCls = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "rank-n";
    const rankLabel = medals[i] || `#${i+1}`;
    const date  = r.timestamp
      ? new Date(r.timestamp).toLocaleDateString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })
      : "—";

    return `
      <tr>
        <td><span class="rank-badge ${rankCls}">${rankLabel}</span></td>
        <td>${escapeHtml(r.name || "Anonymous")}</td>
        <td><span class="score-pill ${cls}">${r.score ?? "?"}/${r.total ?? "?"}</span></td>
        <td style="color:${pct>=80?"var(--accent)":pct>=50?"var(--gold)":"var(--danger)"};font-weight:600;">${pct}%</td>
        <td style="color:var(--text-3);font-size:0.75rem;">${r.totalTime || "—"}</td>
        <td style="color:var(--text-3);font-size:0.72rem;">${date}</td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <table class="result-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Participant</th>
          <th>Score</th>
          <th>Pct</th>
          <th>Time</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  await updateStats();
  showToast(`Loaded ${results.length} result${results.length > 1 ? "s" : ""}.`, "success");
}

/* ────────────────────────────────────────────────
   CLEAR RESULTS
──────────────────────────────────────────────── */
async function clearResults() {
  if (!confirm("Clear all results? This cannot be undone.")) return;
  try {
    await STORE.clearResults();
    const container = document.getElementById("results");
    if (container) container.innerHTML = `<div class="results-empty"><span class="empty-icon">📭</span>Results cleared.</div>`;
    await updateStats();
    showToast("All results cleared.", "info");
  } catch {
    showToast("Failed to clear results.", "error");
  }
}

/* ────────────────────────────────────────────────
   INITIALIZATION
──────────────────────────────────────────────── */
function initDashboard() {
  // Init everything
  startClock();
  updateStats();
  renderQuestionList();

  // Check if user has a valid session
  const token = sessionStorage.getItem('auth_token');
  if (!token) {
    showToast('Please login first.', 'error');
    setTimeout(() => location.href = 'invigilator.html', 1500);
    return;
  }

  // Enter key on last option submits
  document.getElementById("op4")?.addEventListener("keydown", e => {
    if (e.key === "Enter") addQuestion();
  });
}

/* ────────────────────────────────────────────────
   RIPPLE
──────────────────────────────────────────────── */
document.addEventListener("click", e => {
  const btn = e.target.closest(".btn");
  if (!btn) return;
  const r   = btn.getBoundingClientRect();
  const sz  = Math.max(r.width, r.height);
  const rip = document.createElement("span");
  rip.style.cssText = `
    position:absolute;width:${sz}px;height:${sz}px;
    left:${e.clientX-r.left-sz/2}px;top:${e.clientY-r.top-sz/2}px;
    border-radius:50%;background:rgba(255,255,255,0.15);
    transform:scale(0);animation:_ripple 0.55s ease-out forwards;
    pointer-events:none;
  `;
  btn.appendChild(rip);
  rip.addEventListener("animationend", () => rip.remove());
});

(function injectRippleKF() {
  const s = document.createElement("style");
  s.textContent = `@keyframes _ripple { to { transform:scale(2.5); opacity:0; } }`;
  document.head.appendChild(s);
})();

/* ────────────────────────────────────────────────
   UTILS
──────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ────────────────────────────────────────────────
   EXPOSE GLOBALS & BOOT
──────────────────────────────────────────────── */
window.addQuestion    = addQuestion;
window.deleteQuestion = deleteQuestion;
window.loadResults    = loadResults;
window.clearResults   = clearResults;
window.selectAnswer   = selectAnswer;
window.uploadFile     = uploadFile;
window.showToast      = showToast;

// Boot on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}