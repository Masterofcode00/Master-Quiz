/* ============================================================
   QUIZ COMPETITION — script.js
   Handles: starfield, animations, quiz logic, admin dashboard
   ============================================================ */

"use strict";

/* ────────────────────────────────────────────────
   1. STARFIELD CANVAS ANIMATION
──────────────────────────────────────────────── */
(function initStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) {
    // Inject canvas if not present
    const c = document.createElement("canvas");
    c.id = "starfield";
    document.body.prepend(c);
  }

  const cvs = document.getElementById("starfield");
  const ctx = cvs.getContext("2d");

  let W, H, stars = [], shootingStars = [];

  function resize() {
    W = cvs.width  = window.innerWidth;
    H = cvs.height = window.innerHeight;
  }

  function createStar() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.2,
      alpha: Math.random() * 0.7 + 0.1,
      speed: Math.random() * 0.3 + 0.05,
      twinkle: Math.random() * 0.02 + 0.004,
      dir: Math.random() > 0.5 ? 1 : -1,
    };
  }

  function createShootingStar() {
    return {
      x: Math.random() * W * 0.7,
      y: Math.random() * H * 0.4,
      len: Math.random() * 120 + 60,
      speed: Math.random() * 8 + 5,
      alpha: 1,
      angle: Math.PI / 6 + (Math.random() * 0.2 - 0.1),
      life: 1,
    };
  }

  function initStars() {
    stars = Array.from({ length: 180 }, createStar);
  }

  function drawStars() {
    ctx.clearRect(0, 0, W, H);

    // Stars
    for (const s of stars) {
      s.alpha += s.twinkle * s.dir;
      if (s.alpha >= 0.9 || s.alpha <= 0.05) s.dir *= -1;

      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "#e8f4ff";
      ctx.shadowBlur = s.r > 1 ? 6 : 0;
      ctx.shadowColor = "#00f5ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Shooting stars
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i];
      ss.x += Math.cos(ss.angle) * ss.speed;
      ss.y += Math.sin(ss.angle) * ss.speed;
      ss.life -= 0.025;
      ss.alpha = ss.life;

      if (ss.life <= 0) { shootingStars.splice(i, 1); continue; }

      const grd = ctx.createLinearGradient(
        ss.x, ss.y,
        ss.x - Math.cos(ss.angle) * ss.len,
        ss.y - Math.sin(ss.angle) * ss.len
      );
      grd.addColorStop(0, `rgba(0,245,255,${ss.alpha})`);
      grd.addColorStop(1, "transparent");

      ctx.save();
      ctx.globalAlpha = ss.alpha;
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - Math.cos(ss.angle) * ss.len, ss.y - Math.sin(ss.angle) * ss.len);
      ctx.stroke();
      ctx.restore();
    }
  }

  function spawnShootingStars() {
    if (Math.random() < 0.008) {
      shootingStars.push(createShootingStar());
    }
  }

  function loop() {
    drawStars();
    spawnShootingStars();
    requestAnimationFrame(loop);
  }

  resize();
  initStars();
  window.addEventListener("resize", () => { resize(); initStars(); });
  loop();
})();


/* ────────────────────────────────────────────────
   2. CORNER DECORATIONS
──────────────────────────────────────────────── */
(function addCorners() {
  ["tl","tr","bl","br"].forEach(pos => {
    const d = document.createElement("div");
    d.className = `corner-deco ${pos}`;
    document.body.appendChild(d);
  });
})();


/* ────────────────────────────────────────────────
   3. H1 GLOW TEXT — set data-text attr
──────────────────────────────────────────────── */
document.querySelectorAll("h1").forEach(el => {
  el.setAttribute("data-text", el.textContent);
});


/* ────────────────────────────────────────────────
   4. TOAST NOTIFICATION SYSTEM
──────────────────────────────────────────────── */
let toastTimer;

function showToast(message, type = "info") {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;

  clearTimeout(toastTimer);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });
  });

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}


/* ────────────────────────────────────────────────
   5. API STORE — Questions & Results
──────────────────────────────────────────────── */
const STORE = {
  async getQuestions() {
    try {
      const res = await fetch('/api/questions');
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  },
  async saveResult(result) {
    try {
      await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
    } catch {}
  },
  async getResults() {
    try {
      const res = await fetch('/api/results');
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  },
};


/* ────────────────────────────────────────────────
   6. ADMIN DASHBOARD — addQuestion()
──────────────────────────────────────────────── */
function addQuestion() {
  const question = document.getElementById("question")?.value.trim();
  const op1      = document.getElementById("op1")?.value.trim();
  const op2      = document.getElementById("op2")?.value.trim();
  const op3      = document.getElementById("op3")?.value.trim();
  const op4      = document.getElementById("op4")?.value.trim();
  const answer   = document.getElementById("answer")?.value.trim();

  if (!question || !op1 || !op2 || !op3 || !op4 || answer === "") {
    showToast("⚠ Please fill in all fields.", "error");
    return;
  }

  const answerNum = parseInt(answer, 10);
  if (isNaN(answerNum) || answerNum < 0 || answerNum > 3) {
    showToast("⚠ Answer must be a number between 0 and 3.", "error");
    return;
  }

  const qObj = {
    id: Date.now(),
    question,
    options: [op1, op2, op3, op4],
    answer: answerNum,
  };

  const questions = STORE.getQuestions();
  questions.push(qObj);
  STORE.saveQuestions(questions);

  // Clear fields with ripple animation
  ["question","op1","op2","op3","op4","answer"].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = "";
    el.style.transition = `border-color 0.2s ${i * 0.06}s`;
    el.style.borderColor = "var(--neon-green)";
    setTimeout(() => { el.style.borderColor = ""; }, 800 + i * 60);
  });

  // Update question count badge
  updateQuestionBadge();

  showToast(`✓ Question #${questions.length} added!`, "success");
}


function updateQuestionBadge() {
  const h3s = document.querySelectorAll("h3");
  if (!h3s.length) return;
  const addH3 = h3s[0];
  let badge = addH3.querySelector(".q-count");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "q-count";
    addH3.appendChild(badge);
  }
  badge.textContent = STORE.getQuestions().length;
  badge.style.animation = "none";
  badge.offsetHeight; // reflow
  badge.style.animation = "pop 0.3s cubic-bezier(0.34,1.56,0.64,1) both";
}


/* ────────────────────────────────────────────────
   7. ADMIN DASHBOARD — loadResults()
──────────────────────────────────────────────── */
async function loadResults() {
  const container = document.getElementById("results");
  if (!container) return;

  const btn = document.querySelector(".btn.submit");
  if (btn) {
    btn.innerHTML = `<span class="spinner"></span> Loading...`;
    btn.disabled = true;
  }

  const results = await STORE.getResults();

  if (btn) {
    btn.innerHTML = "Show Results";
    btn.disabled = false;
  }

  if (!results.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--text-dim);font-family:var(--font-mono);font-size:0.8rem;letter-spacing:0.15em;">
        NO RESULTS ON RECORD
      </div>`;
    return;
  }

  // Sort by score descending
  const sorted = [...results].sort((a, b) => (b.pct || b.score || 0) - (a.pct || a.score || 0));
  const medals = ["🥇","🥈","🥉"];

  container.innerHTML = sorted.map((r, i) => `
    <div class="result-card" style="animation-delay:${i * 0.07}s">
      <span class="rank">${medals[i] || `#${i + 1}`}</span>
      <span class="name">${escapeHtml(r.name || "Anonymous")}</span>
      <span class="score">${r.score}/${r.total}</span>
      <span style="color:var(--text-dim);font-size:0.75rem;">${r.timestamp ? new Date(r.timestamp).toLocaleDateString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : ""}</span>
    </div>
  `).join("");

  showToast(`Loaded ${results.length} result${results.length > 1 ? "s" : ""}.`, "info");
}


/* ────────────────────────────────────────────────
   8. QUIZ ENGINE (used by quiz.html)
──────────────────────────────────────────────── */
const Quiz = (() => {
  let questions = [];
  let current   = 0;
  let score     = 0;
  let playerName = "";
  let answered  = false;

  async function start(name) {
    questions  = await STORE.getQuestions();
    current    = 0;
    score      = 0;
    playerName = name || "Anonymous";
    answered   = false;

    if (!questions.length) {
      showToast("No questions found. Ask an admin to add some!", "error");
      return;
    }

    renderQuestion();
  }

  function renderQuestion() {
    const qWrap = document.getElementById("question-wrap");
    if (!qWrap) return;

    if (current >= questions.length) {
      showResult();
      return;
    }

    answered = false;
    const q = questions[current];
    const progress = ((current / questions.length) * 100).toFixed(1);

    qWrap.style.opacity = "0";
    qWrap.style.transform = "translateY(20px)";

    setTimeout(() => {
      qWrap.innerHTML = `
        <div class="q-progress-bar">
          <div class="q-progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="q-counter">Question ${current + 1} <span>/ ${questions.length}</span></div>
        <div class="q-text">${escapeHtml(q.question)}</div>
        <div class="q-options">
          ${q.options.map((opt, i) => `
            <button class="q-opt" data-index="${i}" onclick="Quiz.choose(${i})">
              <span class="q-opt-label">${String.fromCharCode(65 + i)}</span>
              ${escapeHtml(opt)}
            </button>
          `).join("")}
        </div>
        <button class="btn q-next" onclick="Quiz.next()" style="display:none;">
          ${current + 1 < questions.length ? "Next Question →" : "See Results →"}
        </button>
      `;

      qWrap.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      qWrap.style.opacity = "1";
      qWrap.style.transform = "translateY(0)";
    }, 200);
  }

  function choose(index) {
    if (answered) return;
    answered = true;

    const q       = questions[current];
    const correct = q.answer;
    const opts    = document.querySelectorAll(".q-opt");

    opts.forEach((btn, i) => {
      btn.disabled = true;
      if (i === correct) {
        btn.classList.add("correct");
      } else if (i === index && index !== correct) {
        btn.classList.add("wrong");
      }
    });

    if (index === correct) {
      score++;
      showToast("✓ Correct!", "success");
    } else {
      showToast(`✗ Correct answer was: ${q.options[correct]}`, "error");
    }

    const nextBtn = document.querySelector(".q-next");
    if (nextBtn) {
      nextBtn.style.display = "block";
      nextBtn.style.animation = "inputReveal 0.3s ease-out both";
    }
  }

  function next() {
    current++;
    renderQuestion();
  }

  function showResult() {
    const qWrap = document.getElementById("question-wrap");
    if (!qWrap) return;

    const pct = Math.round((score / questions.length) * 100);

    // Save result
    STORE.saveResult({
      name: playerName,
      score,
      total: questions.length,
      pct,
      timestamp: Date.now(),
    });

    const msg =
      pct === 100 ? "PERFECT SCORE! 🌟" :
      pct >= 80   ? "Excellent work! 🔥" :
      pct >= 60   ? "Good effort! 👍" :
      pct >= 40   ? "Keep practising! 💪" :
                    "Better luck next time!";

    qWrap.style.opacity = "0";
    setTimeout(() => {
      qWrap.innerHTML = `
        <div class="result-screen">
          <div class="result-score">${score}<span>/${questions.length}</span></div>
          <div class="result-pct">${pct}%</div>
          <div class="result-msg">${msg}</div>
          <button class="btn" onclick="location.reload()">Play Again</button>
          <button class="btn admin" onclick="location.href='index.html'" style="margin-top:0.8rem;">Home</button>
        </div>
      `;
      qWrap.style.transition = "opacity 0.5s ease";
      qWrap.style.opacity = "1";

      // Confetti burst
      if (pct >= 60) launchConfetti();
    }, 200);
  }

  return { start, choose, next };
})();


/* ────────────────────────────────────────────────
   9. CONFETTI
──────────────────────────────────────────────── */
function launchConfetti() {
  const colors = ["#00f5ff","#ff00c8","#ffd700","#00ff88","#ffffff"];
  for (let i = 0; i < 80; i++) {
    setTimeout(() => {
      const el = document.createElement("div");
      const size = Math.random() * 8 + 4;
      el.style.cssText = `
        position:fixed;
        top:-10px;
        left:${Math.random() * 100}vw;
        width:${size}px;
        height:${size}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
        opacity:1;
        z-index:9999;
        pointer-events:none;
        transform:rotate(${Math.random()*360}deg);
        animation: confettiFall ${Math.random()*1.5+1}s ease-in forwards;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }, i * 30);
  }

  // Inject keyframes once
  if (!document.getElementById("confetti-kf")) {
    const style = document.createElement("style");
    style.id = "confetti-kf";
    style.textContent = `
      @keyframes confettiFall {
        to {
          top: 105vh;
          transform: rotate(${Math.random()*720}deg) translateX(${Math.random()*100-50}px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}


/* ────────────────────────────────────────────────
   10. QUIZ PAGE INIT (quiz.html setup)
──────────────────────────────────────────────── */
(function initQuizPage() {
  const wrap = document.getElementById("question-wrap");
  if (!wrap) return;

  // Show name input screen first
  wrap.innerHTML = `
    <div class="q-intro">
      <p class="tagline">Enter your callsign to begin</p>
      <input id="player-name" placeholder="Your Name" maxlength="30" autofocus>
      <button class="btn" onclick="
        const name = document.getElementById('player-name').value.trim();
        if (!name) { showToast('Please enter your name.', 'error'); return; }
        Quiz.start(name);
      ">Launch Quiz 🚀</button>
    </div>
  `;

  const nameInput = document.getElementById("player-name");
  if (nameInput) {
    nameInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const name = nameInput.value.trim();
        if (!name) { showToast("Please enter your name.", "error"); return; }
        Quiz.start(name);
      }
    });
  }
})();


/* ────────────────────────────────────────────────
   11. DASHBOARD PAGE INIT
──────────────────────────────────────────────── */
(function initDashboard() {
  if (!document.getElementById("question")) return;

  // Add question count badge on load
  updateQuestionBadge();

  // Add tagline if missing
  const container = document.querySelector(".container");
  const h2 = document.querySelector("h2");
  if (h2 && container && !document.querySelector(".tagline")) {
    const tag = document.createElement("p");
    tag.className = "tagline";
    tag.textContent = "Control Panel";
    h2.after(tag);
  }

  // Allow Enter on last input to submit
  const answerInput = document.getElementById("answer");
  if (answerInput) {
    answerInput.addEventListener("keydown", e => {
      if (e.key === "Enter") addQuestion();
    });
  }
})();


/* ────────────────────────────────────────────────
   12. INDEX PAGE INIT
──────────────────────────────────────────────── */
(function initIndexPage() {
  const h1 = document.querySelector("h1");
  if (!h1) return;

  // Add tagline
  const container = document.querySelector(".container");
  if (!document.querySelector(".tagline")) {
    const tag = document.createElement("p");
    tag.className = "tagline";
    tag.textContent = "Test Your Knowledge";
    h1.after(tag);
  }

  // Add pulse rings behind main area
  const pulsesWrap = document.createElement("div");
  pulsesWrap.style.cssText = "position:fixed;top:50%;left:50%;pointer-events:none;z-index:1;";
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement("div");
    ring.className = "pulse-ring";
    pulsesWrap.appendChild(ring);
  }
  document.body.appendChild(pulsesWrap);
})();


/* ────────────────────────────────────────────────
   13. BUTTON RIPPLE EFFECT
──────────────────────────────────────────────── */
document.addEventListener("click", function(e) {
  const btn = e.target.closest(".btn");
  if (!btn) return;

  const ripple = document.createElement("span");
  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  const x      = e.clientX - rect.left - size / 2;
  const y      = e.clientY - rect.top  - size / 2;

  ripple.style.cssText = `
    position:absolute;
    width:${size}px;
    height:${size}px;
    left:${x}px;
    top:${y}px;
    border-radius:50%;
    background:rgba(255,255,255,0.2);
    transform:scale(0);
    animation: rippleAnim 0.6s ease-out forwards;
    pointer-events:none;
  `;
  btn.style.position = "relative";
  btn.style.overflow = "hidden";
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

// Inject ripple keyframes
(function() {
  const s = document.createElement("style");
  s.textContent = `
    @keyframes rippleAnim {
      to { transform: scale(2.5); opacity: 0; }
    }
    /* Quiz-specific styles */
    .q-progress-bar {
      height: 3px;
      background: rgba(255,255,255,0.05);
      border-radius: 2px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    .q-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta));
      border-radius: 2px;
      transition: width 0.5s cubic-bezier(0.23,1,0.32,1);
    }
    .q-counter {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
      letter-spacing: 0.2em;
      margin-bottom: 1.2rem;
    }
    .q-counter span { color: var(--neon-cyan); }
    .q-text {
      font-family: var(--font-body);
      font-size: 1.25rem;
      font-weight: 600;
      line-height: 1.5;
      color: var(--text-primary);
      margin-bottom: 1.5rem;
    }
    .q-options { display: flex; flex-direction: column; gap: 0.7rem; margin-bottom: 1.2rem; }
    .q-opt {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      width: 100%;
      padding: 0.85rem 1.1rem;
      font-family: var(--font-body);
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-primary);
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(0,245,255,0.12);
      border-radius: var(--radius);
      cursor: pointer;
      text-align: left;
      transition: border-color 0.2s, background 0.2s, transform 0.15s;
    }
    .q-opt:hover:not(:disabled) {
      border-color: rgba(0,245,255,0.4);
      background: rgba(0,245,255,0.06);
      transform: translateX(4px);
    }
    .q-opt-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px; height: 26px;
      background: rgba(0,245,255,0.1);
      border-radius: 50%;
      font-family: var(--font-display);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--neon-cyan);
      flex-shrink: 0;
    }
    .q-opt.correct {
      border-color: var(--neon-green) !important;
      background: rgba(0,255,136,0.08) !important;
      box-shadow: 0 0 15px rgba(0,255,136,0.2);
    }
    .q-opt.correct .q-opt-label { background: var(--neon-green); color: var(--bg-deep); }
    .q-opt.wrong {
      border-color: var(--neon-magenta) !important;
      background: rgba(255,0,200,0.08) !important;
      box-shadow: 0 0 15px rgba(255,0,200,0.2);
    }
    .q-opt.wrong .q-opt-label { background: var(--neon-magenta); color: var(--bg-deep); }
    .q-next { margin-top: 0.5rem; }
    .result-screen { text-align: center; padding: 1rem 0; }
    .result-score {
      font-family: var(--font-display);
      font-size: 5rem;
      font-weight: 900;
      color: var(--neon-cyan);
      text-shadow: 0 0 40px rgba(0,245,255,0.5);
      line-height: 1;
      margin-bottom: 0.3rem;
      animation: titleEntrance 0.8s ease-out both;
    }
    .result-score span { font-size: 2rem; color: var(--text-dim); }
    .result-pct {
      font-family: var(--font-mono);
      font-size: 1.2rem;
      color: var(--neon-gold);
      margin-bottom: 1rem;
    }
    .result-msg {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2rem;
    }
    .q-intro { text-align: center; }
    .q-intro input { text-align: center; font-size: 1.1rem; margin-bottom: 1.2rem; }
  `;
  document.head.appendChild(s);
})();


/* ────────────────────────────────────────────────
   14. UTILITIES
──────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

// Expose globals needed by inline HTML onclick attributes
window.addQuestion  = addQuestion;
window.loadResults  = loadResults;
window.Quiz         = Quiz;
window.showToast    = showToast;
window.launchConfetti = launchConfetti;