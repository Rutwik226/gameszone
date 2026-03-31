/* ── State ─────────────────────────────────────────────────── */
let username   = "";
let correctIndex = 0;    // index in cupWraps[] that hides the ball
let cupWraps   = [];     // array of .cup-wrap elements (in DOM order)
let selectedSpeed = 1000; // ms between swaps (set by difficulty pill)
let shuffling  = false;
let guessAllowed = false;

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
  // auto-setup a fresh game on open
  setupGame();
}

function backToMenu() {
  shuffling = false;
  showScreen("menuScreen");
}

/* ── Difficulty ────────────────────────────────────────────── */
function setDiff(btn) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  selectedSpeed = parseInt(btn.dataset.speed);
}

/* ── Game Setup ────────────────────────────────────────────── */
function setupGame() {
  if (shuffling) return;

  resetResult();

  const count     = parseInt(document.getElementById("cupCount").value);
  const container = document.getElementById("cupsContainer");
  container.innerHTML = "";
  cupWraps = [];

  correctIndex = Math.floor(Math.random() * count);

  for (let i = 0; i < count; i++) {
    const wrap = document.createElement("div");
    wrap.className = "cup-wrap";
    wrap.dataset.index = i;
    wrap.onclick = () => guess(i);

    // Cup SVG (a proper cup / goblet shape)
    wrap.innerHTML = `
      <svg class="cup-svg" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg">
        <!-- rim -->
        <rect x="8" y="10" width="84" height="10" rx="5"
              fill="#c0392b" stroke="#922b21" stroke-width="1.5"/>
        <!-- body -->
        <path d="M 16 20 L 26 95 L 74 95 L 84 20 Z"
              fill="#e74c3c" stroke="#922b21" stroke-width="1.5"/>
        <!-- base stem -->
        <rect x="36" y="95" width="28" height="8" rx="3"
              fill="#c0392b" stroke="#922b21" stroke-width="1.5"/>
        <!-- foot -->
        <rect x="26" y="103" width="48" height="7" rx="4"
              fill="#c0392b" stroke="#922b21" stroke-width="1.5"/>
        <!-- shine -->
        <path d="M 22 25 Q 28 55 24 85" stroke="rgba(255,255,255,0.18)"
              stroke-width="4" fill="none" stroke-linecap="round"/>
      </svg>`;

    // Ball (only under the correct cup)
    if (i === correctIndex) {
      const ball = document.createElement("div");
      ball.className = "ball";
      ball.id = "theBall";
      wrap.appendChild(ball);
    }

    container.appendChild(wrap);
    cupWraps.push(wrap);
  }

  guessAllowed = false;

  // Show ball briefly then shuffle
  setTimeout(() => {
    hideBall();
    shuffleAnimation();
  }, 800);
}

/* ── Ball visibility ───────────────────────────────────────── */
function hideBall() {
  const b = document.getElementById("theBall");
  if (b) b.classList.add("hidden-ball");
}
function showBall() {
  const b = document.getElementById("theBall");
  if (b) b.classList.remove("hidden-ball");
}

/* ── Shuffle ───────────────────────────────────────────────── */
function shuffleAnimation() {
  shuffling   = true;
  guessAllowed = false;

  const totalMoves = 14;
  let   moves      = 0;

  // We track a logical mapping: logicalPos[i] = which cupWrap index is at position i
  // Simpler: swap the actual DOM elements' flex order
  // Initialize order values
  cupWraps.forEach((w, i) => { w.style.order = i; w.style.transition = `order 0s`; });

  const interval = setInterval(() => {
    // Pick two distinct random cup indices
    let a, b;
    do { a = Math.floor(Math.random() * cupWraps.length);
         b = Math.floor(Math.random() * cupWraps.length); } while (a === b);

    // Swap their flex order
    const oa = parseInt(cupWraps[a].style.order);
    const ob = parseInt(cupWraps[b].style.order);
    cupWraps[a].style.order = ob;
    cupWraps[b].style.order = oa;

    // Track correctIndex: if we swapped a or b, update correctIndex
    if (correctIndex === a) correctIndex = b;
    else if (correctIndex === b) correctIndex = a;

    moves++;
    if (moves >= totalMoves) {
      clearInterval(interval);
      shuffling    = false;
      guessAllowed = true;
    }
  }, selectedSpeed);
}

/* ── Guess ─────────────────────────────────────────────────── */
function guess(index) {
  if (!guessAllowed) return;
  guessAllowed = false;

  showBall();

  const result = document.getElementById("result");

  if (index === correctIndex) {
    result.textContent = "🎉 Correct! You found it!";
    result.className   = "result-msg win";
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
