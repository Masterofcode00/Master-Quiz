/* ============================================================
   QUIZ PAGE — quiz.js
   Handles: UI build, registration, quiz engine, per-question
            timer, scoring, submit, results, confetti
   ============================================================ */

"use strict";

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */
const CONFIG = {
  timePerQuestion: 20,      // seconds per question
  showFeedback:    true,    // show correct/wrong after answer
  feedbackDelay:   1200,    // ms before auto-advancing
  resultsKey:      "quiz_results",
  questionsKey:    "quiz_questions",
};

/* ────────────────────────────────────────────────
   STATE
──────────────────────────────────────────────── */
const State = {
  player:      { name: "", roll: "" },
  questions:   [],
  current:     0,
  score:       0,
  answered:    false,
  timerHandle: null,
  timeLeft:    CONFIG.timePerQuestion,
  startTime:   null,
  timings:     [],   // seconds taken per question
};

/* ────────────────────────────────────────────────
   STORE — uses backend API
──────────────────────────────────────────────── */
const STORE = {
  async getQuestions() {
    try {
      const res = await fetch('/api/questions');
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  },
  async saveResult(r) {
    try {
      await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r),
      });
    } catch {}
  },
};

/* ────────────────────────────────────────────────
   TOAST
──────────────────────────────────────────────── */
let _toastTimer;
function showToast(msg, type = "info") {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("show")));
  _toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

/* ────────────────────────────────────────────────
   BUILD UI SHELL
──────────────────────────────────────────────── */
function buildShell() {
  document.body.innerHTML = `
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <canvas id="confetti-canvas"></canvas>
    <div class="toast"></div>

    <div class="quiz-wrapper">
      <div class="quiz-card">
        <div class="card-topbar"></div>

        <div class="card-header">
          <div class="header-left">
            <h2>Quiz Competition</h2>
            <p class="sub">Knowledge Arena</p>
          </div>
          <div class="header-badge">
            <span class="dot"></span>
            Live
          </div>
        </div>

        <div class="card-body" id="card-body">
          <!-- Stages injected here -->
        </div>
      </div>
    </div>
  `;

  showStageRegister();
}

/* ────────────────────────────────────────────────
   STAGE: REGISTER
──────────────────────────────────────────────── */
function showStageRegister() {
  const body = document.getElementById("card-body");
  body.innerHTML = `
    <div id="stage-register">
      <div class="field">
        <label class="field-label" for="name">
          <span class="lnum">1</span> Full Name
        </label>
        <input id="name" class="field-input" type="text" placeholder="Enter your full name" autocomplete="name" autofocus>
      </div>
      <div class="field">
        <label class="field-label" for="roll">
          <span class="lnum">2</span> Roll Number
        </label>
        <input id="roll" class="field-input" type="text" placeholder="Enter your roll number" autocomplete="off">
      </div>
      <button class="btn btn-start" onclick="startQuiz()">▶ &nbsp; Start Quiz</button>
    </div>
  `;

  document.getElementById("name")?.addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("roll")?.focus(); });
  document.getElementById("roll")?.addEventListener("keydown", e => { if (e.key === "Enter") startQuiz(); });
}

/* ────────────────────────────────────────────────
   START QUIZ
──────────────────────────────────────────────── */
async function startQuiz() {
  const name = document.getElementById("name")?.value.trim();
  const roll = document.getElementById("roll")?.value.trim();

  if (!name) { showToast("Please enter your name.", "error"); document.getElementById("name")?.focus(); return; }
  if (!roll) { showToast("Please enter your roll number.", "error"); document.getElementById("roll")?.focus(); return; }

  const btn = document.querySelector(".btn-start");
  if (btn) { btn.classList.add("loading"); btn.disabled = true; }

  State.questions = await STORE.getQuestions();

  if (!State.questions.length) {
    showToast("No questions found. Ask an admin to add some!", "error");
    if (btn) { btn.classList.remove("loading"); btn.disabled = false; }
    return;
  }

  State.player  = { name, roll };
  State.current = 0;
  State.score   = 0;
  State.timings = [];
  State.startTime = Date.now();

  setTimeout(() => showStageQuiz(), 500);
}

/* ────────────────────────────────────────────────
   STAGE: QUIZ
──────────────────────────────────────────────── */
function showStageQuiz() {
  renderQuestion();
}

function renderQuestion() {
  clearTimer();

  const q   = State.questions[State.current];
  const idx = State.current;
  const tot = State.questions.length;
  const pct = (idx / tot * 100).toFixed(1);

  State.answered = false;
  State.timeLeft = CONFIG.timePerQuestion;

  const body = document.getElementById("card-body");
  body.innerHTML = `
    <div id="stage-quiz">

      <!-- Progress -->
      <div class="progress-wrap">
        <div class="progress-meta">
          <span class="progress-label">Progress</span>
          <span class="progress-fraction">
            <span class="cur">${idx + 1}</span>
            <span class="sep">/</span>
            <span class="tot">${tot}</span>
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" id="prog-fill" style="width:${pct}%"></div>
        </div>
      </div>

      <!-- Timer + player info -->
      <div class="timer-row">
        <div class="timer-ring" id="timer-ring">
          <svg viewBox="0 0 48 48" width="52" height="52">
            <circle class="track" cx="24" cy="24" r="22"/>
            <circle class="fill"  cx="24" cy="24" r="22" id="timer-arc"/>
          </svg>
          <div class="timer-text" id="timer-text">${CONFIG.timePerQuestion}</div>
        </div>
        <div class="player-info">
          <div class="player-name">${escHtml(State.player.name)}</div>
          <div class="player-roll">Roll: ${escHtml(State.player.roll)}</div>
        </div>
      </div>

      <!-- Question -->
      <div class="question-num">Question ${idx + 1} of ${tot}</div>
      <div class="question-text">${escHtml(q.question)}</div>

      <!-- Options -->
      <div class="options-list" id="options-list">
        ${q.options.map((opt, i) => `
          <button class="opt-btn" data-index="${i}" onclick="chooseAnswer(${i})">
            <span class="opt-letter">${"ABCD"[i]}</span>
            ${escHtml(opt)}
          </button>
        `).join("")}
      </div>

      <!-- Feedback -->
      <div class="feedback-bar" id="feedback-bar"></div>

      <!-- Next -->
      <button class="btn-next" id="btn-next" onclick="nextQuestion()">
        ${idx + 1 < tot ? "Next Question →" : "See Results →"}
      </button>

    </div>
  `;

  // Animate progress fill after DOM settles
  requestAnimationFrame(() => {
    const fill = document.getElementById("prog-fill");
    if (fill) fill.style.width = pct + "%";
  });

  startTimer();
}

/* ────────────────────────────────────────────────
   ANSWER SELECTION
──────────────────────────────────────────────── */
function chooseAnswer(index) {
  if (State.answered) return;
  State.answered = true;
  clearTimer();

  const timeTaken = CONFIG.timePerQuestion - State.timeLeft;
  State.timings.push(timeTaken);

  const q       = State.questions[State.current];
  const correct = q.answer;
  const btns    = document.querySelectorAll(".opt-btn");
  const fb      = document.getElementById("feedback-bar");
  const nextBtn = document.getElementById("btn-next");

  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add("correct");
    else if (i === index && index !== correct) btn.classList.add("wrong");
  });

  if (index === correct) {
    State.score++;
    if (fb) {
      fb.textContent = "✓  Correct answer!";
      fb.className = "feedback-bar show correct";
    }
  } else {
    if (fb) {
      fb.textContent = `✗  Correct answer was: ${q.options[correct]}`;
      fb.className = "feedback-bar show wrong";
    }
  }

  if (nextBtn) {
    nextBtn.classList.add("show");
  }

  // Auto-advance after delay
  if (CONFIG.showFeedback) {
    setTimeout(() => nextQuestion(), CONFIG.feedbackDelay);
  }
}

/* ────────────────────────────────────────────────
   NEXT QUESTION
──────────────────────────────────────────────── */
function nextQuestion() {
  clearTimer();
  State.current++;
  if (State.current >= State.questions.length) {
    showStageResult();
  } else {
    renderQuestion();
  }
}

/* ────────────────────────────────────────────────
   TIMER
──────────────────────────────────────────────── */
function startTimer() {
  const FULL = CONFIG.timePerQuestion;
  const circumference = 2 * Math.PI * 22; // r=22 → 138.2

  function tick() {
    State.timeLeft--;
    const arc      = document.getElementById("timer-arc");
    const text     = document.getElementById("timer-text");
    const ring     = document.getElementById("timer-ring");

    if (!arc || !text || !ring) return;

    const pct    = State.timeLeft / FULL;
    const offset = circumference * (1 - pct);
    arc.style.strokeDashoffset = offset;
    text.textContent = State.timeLeft;

    ring.classList.remove("warning", "danger");
    if (State.timeLeft <= 5)       ring.classList.add("danger");
    else if (State.timeLeft <= 10) ring.classList.add("warning");

    if (State.timeLeft <= 0) {
      clearTimer();
      timeOut();
    }
  }

  State.timerHandle = setInterval(tick, 1000);
}

function clearTimer() {
  if (State.timerHandle) {
    clearInterval(State.timerHandle);
    State.timerHandle = null;
  }
}

function timeOut() {
  if (State.answered) return;
  State.answered = true;
  State.timings.push(CONFIG.timePerQuestion);

  const q   = State.questions[State.current];
  const btns = document.querySelectorAll(".opt-btn");
  const fb   = document.getElementById("feedback-bar");
  const next = document.getElementById("btn-next");

  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add("correct");
  });

  if (fb) {
    fb.textContent = `⏱  Time's up! Correct answer: ${q.options[q.answer]}`;
    fb.className = "feedback-bar show wrong";
  }
  if (next) next.classList.add("show");

  showToast("Time's up!", "error");
  setTimeout(() => nextQuestion(), 1500);
}

/* ────────────────────────────────────────────────
   SUBMIT QUIZ (manual submit button support)
──────────────────────────────────────────────── */
function submitQuiz() {
  clearTimer();
  showStageResult();
}

/* ────────────────────────────────────────────────
   STAGE: RESULT
──────────────────────────────────────────────── */
function showStageResult() {
  clearTimer();

  const total   = State.questions.length;
  const score   = State.score;
  const wrong   = total - score;
  const pct     = Math.round((score / total) * 100);
  const avgTime = State.timings.length
    ? (State.timings.reduce((a,b)=>a+b,0) / State.timings.length).toFixed(1)
    : "—";

  // Save result
  STORE.saveResult({
    name:      State.player.name,
    roll:      State.player.roll,
    score,
    total,
    pct,
    avgTime,
    timestamp: Date.now(),
  });

  const grade =
    pct === 100 ? { label: "Perfect Score! 🌟",  color: "var(--electric)" } :
    pct >= 80   ? { label: "Excellent! 🔥",       color: "var(--green)" }   :
    pct >= 60   ? { label: "Good Job! 👍",         color: "var(--indigo-light)" } :
    pct >= 40   ? { label: "Keep Practising! 💪", color: "var(--amber)" }   :
                  { label: "Try Again!",           color: "var(--red)" };

  const circumference = 2 * Math.PI * 52; // r=52 → 326.7
  const offset        = circumference * (1 - pct / 100);

  const body = document.getElementById("card-body");
  body.innerHTML = `
    <div id="stage-result">
      <div class="result-hero">

        <div class="result-circle">
          <svg viewBox="0 0 120 120" width="130" height="130">
            <circle class="r-track" cx="60" cy="60" r="52"/>
            <circle class="r-fill"  cx="60" cy="60" r="52"
              id="r-arc"
              style="stroke:${grade.color}; transform:rotate(-90deg); transform-origin:60px 60px;"
            />
          </svg>
          <div class="result-inner">
            <span class="result-score-big" style="color:${grade.color}" id="score-counter">0</span>
            <span class="result-score-sub">out of ${total}</span>
          </div>
        </div>

        <h3 class="result-title">${grade.label}</h3>
        <p class="result-subtitle">${escHtml(State.player.name)} &nbsp;·&nbsp; Roll ${escHtml(State.player.roll)}</p>

        <div class="result-stats">
          <div class="rstat green">
            <div class="rstat-val">${score}</div>
            <div class="rstat-label">Correct</div>
          </div>
          <div class="rstat red">
            <div class="rstat-val">${wrong}</div>
            <div class="rstat-label">Wrong</div>
          </div>
          <div class="rstat amber">
            <div class="rstat-val">${pct}%</div>
            <div class="rstat-label">Score</div>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn btn-retry" onclick="retryQuiz()">↺ &nbsp; Try Again</button>
          <button class="btn btn-home"  onclick="location.href='index.html'">← Home</button>
        </div>

      </div>
    </div>
  `;

  // Animate arc
  requestAnimationFrame(() => {
    setTimeout(() => {
      const arc = document.getElementById("r-arc");
      if (arc) arc.style.strokeDashoffset = offset;
    }, 100);
  });

  // Animate score counter
  animateCount("score-counter", 0, score, 900);

  // Confetti for passing scores
  if (pct >= 60) launchConfetti(pct);
}

/* ────────────────────────────────────────────────
   RETRY
──────────────────────────────────────────────── */
async function retryQuiz() {
  State.current  = 0;
  State.score    = 0;
  State.timings  = [];
  State.startTime = Date.now();
  State.questions = await STORE.getQuestions();
  if (!State.questions.length) { showToast("No questions available!", "error"); showStageRegister(); return; }
  renderQuestion();
}

/* ────────────────────────────────────────────────
   CONFETTI
──────────────────────────────────────────────── */
function launchConfetti(pct) {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#5b6ef5","#38d9f5","#3ddc84","#ffb830","#ff4f6b","#ffffff"];
  const count  = pct >= 80 ? 140 : 80;

  const pieces = Array.from({ length: count }, () => ({
    x:   Math.random() * canvas.width,
    y:   -Math.random() * canvas.height * 0.5,
    w:   Math.random() * 8 + 4,
    h:   Math.random() * 5 + 3,
    r:   Math.random() * Math.PI * 2,
    vx:  (Math.random() - 0.5) * 3,
    vy:  Math.random() * 4 + 2,
    vr:  (Math.random() - 0.5) * 0.15,
    c:   colors[Math.floor(Math.random() * colors.length)],
    a:   1,
  }));

  let rafId;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.r  += p.vr;
      p.vy += 0.1; // gravity
      if (p.y < canvas.height + 20) { alive = true; p.a = Math.max(0, 1 - p.y / (canvas.height * 1.1)); }
      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.fillStyle   = p.c;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive) { rafId = requestAnimationFrame(draw); }
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  if (rafId) cancelAnimationFrame(rafId);
  draw();
}

/* ────────────────────────────────────────────────
   RIPPLE
──────────────────────────────────────────────── */
document.addEventListener("click", e => {
  const btn = e.target.closest(".btn, .opt-btn, .btn-next");
  if (!btn || btn.disabled) return;
  const r   = btn.getBoundingClientRect();
  const sz  = Math.max(r.width, r.height);
  const rip = document.createElement("span");
  rip.style.cssText = `
    position:absolute;width:${sz}px;height:${sz}px;
    left:${e.clientX-r.left-sz/2}px;top:${e.clientY-r.top-sz/2}px;
    border-radius:50%;background:rgba(255,255,255,0.15);
    transform:scale(0);animation:_rpl 0.55s ease-out forwards;pointer-events:none;
  `;
  if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
  btn.style.overflow = "hidden";
  btn.appendChild(rip);
  rip.addEventListener("animationend", () => rip.remove());
});

(function injectKF() {
  const s = document.createElement("style");
  s.textContent = `@keyframes _rpl { to { transform:scale(2.5); opacity:0; } }`;
  document.head.appendChild(s);
})();

/* ────────────────────────────────────────────────
   UTILITIES
──────────────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function animateCount(id, from, to, dur) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(from + (to - from) * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* ────────────────────────────────────────────────
   EXPOSE GLOBALS & BOOT
──────────────────────────────────────────────── */
window.startQuiz    = startQuiz;
window.chooseAnswer = chooseAnswer;
window.nextQuestion = nextQuestion;
window.submitQuiz   = submitQuiz;
window.retryQuiz    = retryQuiz;
window.showToast    = showToast;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", buildShell);
} else {
  buildShell();
}