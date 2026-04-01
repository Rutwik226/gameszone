/* ── State ─────────────────────────────────────────────────── */
let username      = "";
let selectedSpeed = 1000;   // ms per swap (Easy=1000, Med=500, Hard=200)
let shuffling     = false;
let guessAllowed  = false;

// cups[i] = { el, slot }  — el is the DOM node, slot is its current visual position
let cups = [];
let ballCupIndex = 0;   // which cups[] index currently holds the ball

/* ── Helpers ───────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('active');
  });
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.add('active');
}

/* ── Start / Menu ──────────────────────────────────────────── */
function startGame() {
  username = document.getElementById("username").value.trim();
  if (!username) { alert("Please enter your name!"); return; }
  document.getElementById("welcomeTag").textContent = "👋 " + username;
  showScreen("menuScreen");
  sendToGoogleForm(username);
}

function openCupGame() {
  showScreen("gameScreen");
  resetResult();
  buildCups();
}

function backToMenu() {
  shuffling    = false;
  guessAllowed = false;
  showScreen("menuScreen");
}

/* ── Difficulty pills ───────────────────────────────────────── */
function setDiff(btn) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  selectedSpeed = parseInt(btn.dataset.speed);
}

/* ── Called by ▶ Start button ───────────────────────────────── */
function setupGame() { buildCups(); }

/* ─────────────────────────────────────────────────────────────
   BUILD CUPS
───────────────────────────────────────────────────────────── */
function buildCups() {
  if (shuffling) return;

  resetResult();
  guessAllowed = false;

  const count     = parseInt(document.getElementById("cupCount").value);
  const container = document.getElementById("cupsContainer");

  const CUP_W = 90;
  const GAP   = 36;
  const STEP  = CUP_W + GAP;
  const totalW = count * CUP_W + (count - 1) * GAP;

  container.style.position = "relative";
  container.style.width    = totalW + "px";
  container.style.height   = "170px";
  container.innerHTML      = "";
  cups = [];

  ballCupIndex = Math.floor(Math.random() * count);

  for (let i = 0; i < count; i++) {
    const wrap = document.createElement("div");
    wrap.className = "cup-wrap";
    wrap.style.cssText = `
      position: absolute;
      top: 0;
      left: ${i * STEP}px;
      width: ${CUP_W}px;
      cursor: pointer;
      transition: left ${Math.round(selectedSpeed * 0.85)}ms cubic-bezier(.4,0,.2,1);
    `;

    wrap.innerHTML = `
      <svg class="cup-svg" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="10" width="84" height="10" rx="5" fill="#c0392b" stroke="#922b21" stroke-width="1.5"/>
        <path d="M 16 20 L 26 95 L 74 95 L 84 20 Z" fill="#e74c3c" stroke="#922b21" stroke-width="1.5"/>
        <rect x="36" y="95" width="28" height="8" rx="3" fill="#c0392b" stroke="#922b21" stroke-width="1.5"/>
        <rect x="26" y="103" width="48" height="7" rx="4" fill="#c0392b" stroke="#922b21" stroke-width="1.5"/>
        <path d="M 22 25 Q 28 55 24 85" stroke="rgba(255,255,255,0.18)" stroke-width="4" fill="none" stroke-linecap="round"/>
      </svg>`;

    if (i === ballCupIndex) {
      const ball = document.createElement("div");
      ball.className = "ball";
      ball.id = "theBall";
      wrap.appendChild(ball);
    }

    // Click = guess whichever cup this is
    const capturedI = i;
    wrap.addEventListener('click', () => {
      if (!guessAllowed) return;
      guessAllowed = false;
      const isCorrect = (capturedI === ballCupIndex);
      handleGuess(isCorrect, wrap);
    });

    container.appendChild(wrap);
    cups.push({ el: wrap, slot: i });
  }

  // Phase 1: show ball for 1.2 s, then hide + shuffle
  setTimeout(() => {
    hideBall();
    startShuffle(STEP, count);
  }, 1200);
}

/* ─────────────────────────────────────────────────────────────
   SHUFFLE — slide cups by animating their `left` CSS property
───────────────────────────────────────────────────────────── */
function startShuffle(STEP, count) {
  shuffling    = true;
  guessAllowed = false;

  // More moves at higher speed so the game stays challenging
  const totalMoves = selectedSpeed >= 800 ? 8
                   : selectedSpeed >= 400 ? 14
                   : 22;

  let moves = 0;
  let lastA = -1, lastB = -1;

  // Sync transition speed on all cups
  cups.forEach(c => {
    c.el.style.transition = `left ${Math.round(selectedSpeed * 0.85)}ms cubic-bezier(.4,0,.2,1)`;
  });

  function doSwap() {
    if (!shuffling) return;

    // Pick two distinct indices, avoid repeating the exact same pair
    let a, b;
    let tries = 0;
    do {
      a = Math.floor(Math.random() * count);
      b = Math.floor(Math.random() * count);
      tries++;
    } while (a === b || (tries < 10 && a === lastA && b === lastB));
    lastA = a; lastB = b;

    // Swap visual slots
    const slotA = cups[a].slot;
    const slotB = cups[b].slot;
    cups[a].slot = slotB;
    cups[b].slot = slotA;

    // Animate to new positions
    cups[a].el.style.left = slotB * STEP + "px";
    cups[b].el.style.left = slotA * STEP + "px";

    // Track which cup array index has the ball
    // (ballCupIndex never changes — the ball travels with its cup element)
    // No tracking needed: the ball DOM node is always inside cups[ballCupIndex].el

    moves++;
    if (moves < totalMoves) {
      setTimeout(doSwap, selectedSpeed);
    } else {
      setTimeout(() => {
        shuffling    = false;
        guessAllowed = true;
      }, Math.round(selectedSpeed * 0.9));
    }
  }

  doSwap();
}

/* ── Ball visibility ───────────────────────────────────────── */
function hideBall() {
  const b = document.getElementById("theBall");
  if (b) b.style.opacity = "0";
}
function showBall() {
  const b = document.getElementById("theBall");
  if (b) b.style.opacity = "1";
}

/* ── Guess result ───────────────────────────────────────────── */
function handleGuess(correct, clickedWrap) {
  showBall();
  const result = document.getElementById("result");
  if (correct) {
    result.textContent = "🎉 Correct! You found it!";
    result.className   = "result-msg win";
    clickedWrap.style.transform = "scale(1.12)";
    setTimeout(() => { clickedWrap.style.transform = ""; }, 400);
  } else {
    result.textContent = "💀 Wrong! Better luck next time.";
    result.className   = "result-msg loss";
  }
}

function resetResult() {
  const r = document.getElementById("result");
  if (r) { r.textContent = ""; r.className = "result-msg"; }
}

/* ── Google Form ───────────────────────────────────────────── */
function sendToGoogleForm(name) {
  fetch("https://docs.google.com/forms/d/e/1FAIpQLSeDmuyrMLvlbYN_hFrcTvwISmRWOsi9oH0PdIiRq-H6YGKh7A/formResponse", {
    method: "POST",
    mode:   "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    `entry.1512615533=${encodeURIComponent(name)}`
  });
}
