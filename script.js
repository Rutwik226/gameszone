/* ═══════════════════════════════════════════════════════════════
   GAME HUB  –  Shell / Cup Game
   Cups rendered on <canvas>. Swaps use a bezier arc so one cup
   visibly swoops OVER the other, exactly like the classic game.
═══════════════════════════════════════════════════════════════ */

/* ── Global UI state ──────────────────────────────────────────── */
let username     = "";
let swapDuration = 900;   // ms per swap (set by difficulty)

/* ── Screen helpers ───────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.add('hidden'); s.classList.remove('active');
  });
  const el = document.getElementById(id);
  el.classList.remove('hidden'); el.classList.add('active');
}
function setPhase(txt) { document.getElementById('phaseLabel').textContent = txt; }
function setResult(txt, cls) {
  const r = document.getElementById('result');
  r.textContent = txt; r.className = 'result-msg' + (cls ? ' ' + cls : '');
}

/* ── Start / menu ─────────────────────────────────────────────── */
function startGame() {
  username = document.getElementById('username').value.trim();
  if (!username) { alert('Please enter your name!'); return; }
  document.getElementById('welcomeTag').textContent = '👋 ' + username;
  showScreen('menuScreen');
  sendToGoogleForm(username);
}
function openCupGame() { showScreen('gameScreen'); initGame(); }
function backToMenu()  { stopGame(); showScreen('menuScreen'); }
function setDiff(btn) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  swapDuration = parseInt(btn.dataset.speed);
}
function setupGame() { initGame(); }

/* ════════════════════════════════════════════════════════════════
   CANVAS ENGINE
════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

/* layout constants (recalculated in initGame) */
let CW, CH, CUP_W, CUP_H, GAP, FLOOR_Y, N;
const BALL_R = 14;

/* cup objects: { x, y, hasBall } */
let cups          = [];
let ballCupIdx    = 0;
let showBall      = false;   // whether ball is visible
let gamePhase     = 'idle';  // idle | reveal | shuffle | guess | done
let animating     = false;

/* animation queue */
let swapQueue     = [];
let currentSwap   = null;
let swapStartTime = null;

/* hover / click */
let hoverCup = -1;

let rafId = null;

/* ── Init ─────────────────────────────────────────────────────── */
function initGame() {
  stopGame();
  setResult('', '');

  N = parseInt(document.getElementById('cupCount').value);

  /* size canvas to fit */
  const maxW   = Math.min(window.innerWidth - 48, 640);
  CUP_W  = Math.min(100, Math.floor((maxW - 40) / N - 20));
  CUP_H  = Math.round(CUP_W * 1.15);
  GAP    = Math.round(CUP_W * 0.45);
  CW     = N * CUP_W + (N - 1) * GAP + 40;
  CH     = CUP_H + BALL_R * 2 + 60;
  FLOOR_Y = CUP_H + 20;

  canvas.width  = CW;
  canvas.height = CH;

  /* build cups centred */
  const startX = (CW - (N * CUP_W + (N - 1) * GAP)) / 2;
  cups = [];
  for (let i = 0; i < N; i++) {
    cups.push({ x: startX + i * (CUP_W + GAP), y: 0, hasBall: false });
  }
  ballCupIdx = Math.floor(Math.random() * N);
  cups[ballCupIdx].hasBall = true;

  /* reveal phase: show ball for 1.4 s */
  gamePhase = 'reveal';
  showBall  = true;
  setPhase('Remember where the ball is!');

  rafId = requestAnimationFrame(loop);

  setTimeout(() => {
    showBall  = false;
    gamePhase = 'shuffle';
    setPhase('Shuffling…');
    buildSwapQueue();
    runNextSwap();
  }, 1400);
}

function stopGame() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  animating    = false;
  currentSwap  = null;
  swapQueue    = [];
  gamePhase    = 'idle';
}

/* ── Swap queue builder ───────────────────────────────────────── */
function buildSwapQueue() {
  const moves = swapDuration >= 800 ? 8 : swapDuration >= 400 ? 14 : 22;
  swapQueue = [];
  let lastA = -1, lastB = -1;
  for (let m = 0; m < moves; m++) {
    let a, b, tries = 0;
    do {
      a = Math.floor(Math.random() * N);
      b = Math.floor(Math.random() * N);
      tries++;
    } while (a === b || (tries < 8 && a === lastA && b === lastB));
    swapQueue.push([a, b]);
    lastA = a; lastB = b;
  }
}

function runNextSwap() {
  if (swapQueue.length === 0) {
    gamePhase = 'guess';
    setPhase('Which cup hides the ball?');
    return;
  }
  const [a, b] = swapQueue.shift();
  startSwapAnim(a, b, () => {
    setTimeout(runNextSwap, swapDuration * 0.08);
  });
}

/* ── Arc swap animation ───────────────────────────────────────── */
/*
  Cup A arcs OVER by going up (negative y) while sliding sideways.
  Cup B slides under by going slightly down then back.
  We use a parametric t in [0,1].
*/
function startSwapAnim(idxA, idxB, onDone) {
  const cupA = cups[idxA];
  const cupB = cups[idxB];

  const ax0 = cupA.x, ay0 = cupA.y;
  const bx0 = cupB.x, by0 = cupB.y;
  const ax1 = bx0,    ay1 = by0;   // A's destination
  const bx1 = ax0,    by1 = ay0;   // B's destination

  const arcHeight = CUP_H * 1.1;   // how high the upper cup lifts

  animating    = true;
  currentSwap  = {
    idxA, idxB,
    ax0, ay0, ax1, ay1,
    bx0, by0, bx1, by1,
    arcHeight,
    duration: swapDuration,
    onDone
  };
  swapStartTime = performance.now();
}

function tickSwap(now) {
  if (!currentSwap) return;
  const s = currentSwap;
  let t = (now - swapStartTime) / s.duration;
  if (t >= 1) { t = 1; }

  const ease = t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* Cup A arcs over (upward arc) */
  cups[s.idxA].x = lerp(s.ax0, s.ax1, ease);
  cups[s.idxA].y = lerp(s.ay0, s.ay1, ease) - Math.sin(Math.PI * t) * s.arcHeight;

  /* Cup B slides under (slight dip) */
  cups[s.idxB].x = lerp(s.bx0, s.bx1, ease);
  cups[s.idxB].y = lerp(s.by0, s.by1, ease) + Math.sin(Math.PI * t) * (s.arcHeight * 0.12);

  if (t >= 1) {
    /* snap to exact final positions */
    cups[s.idxA].x = s.ax1; cups[s.idxA].y = s.ay1;
    cups[s.idxB].x = s.bx1; cups[s.idxB].y = s.by1;

    /* swap hasBall */
    const hA = cups[s.idxA].hasBall;
    cups[s.idxA].hasBall = cups[s.idxB].hasBall;
    cups[s.idxB].hasBall = hA;

    /* update ballCupIdx */
    if (ballCupIdx === s.idxA) ballCupIdx = s.idxB;
    else if (ballCupIdx === s.idxB) ballCupIdx = s.idxA;

    animating   = false;
    currentSwap = null;
    s.onDone && s.onDone();
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

/* ── Click handling ───────────────────────────────────────────── */
canvas.addEventListener('click', e => {
  if (gamePhase !== 'guess') return;
  const rect = canvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const hit  = hitTest(mx, my);
  if (hit < 0) return;

  gamePhase = 'done';
  showBall  = true;
  setPhase('');

  if (hit === ballCupIdx) {
    setResult('🎉 Correct! You found it!', 'win');
  } else {
    setResult('💀 Wrong! Better luck next time.', 'loss');
  }
});

canvas.addEventListener('mousemove', e => {
  if (gamePhase !== 'guess') { hoverCup = -1; return; }
  const rect = canvas.getBoundingClientRect();
  hoverCup = hitTest(e.clientX - rect.left, e.clientY - rect.top);
  canvas.style.cursor = hoverCup >= 0 ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => { hoverCup = -1; });

function hitTest(mx, my) {
  for (let i = 0; i < cups.length; i++) {
    const c = cups[i];
    if (mx >= c.x && mx <= c.x + CUP_W && my >= c.y && my <= c.y + CUP_H) return i;
  }
  return -1;
}

/* ── Draw loop ────────────────────────────────────────────────── */
function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (animating && currentSwap) tickSwap(now);
  draw();
}

function draw() {
  ctx.clearRect(0, 0, CW, CH);

  /* floor line */
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + CUP_H);
  ctx.lineTo(CW, FLOOR_Y + CUP_H);
  ctx.stroke();

  /* sort cups so arcing cup (highest, most negative y) draws on top */
  const order = [...cups.keys()].sort((a, b) => cups[b].y - cups[a].y);

  /* draw balls first (behind cups) */
  for (let i = 0; i < cups.length; i++) {
    if (showBall && cups[i].hasBall) {
      drawBall(cups[i]);
    }
  }

  /* draw cups */
  for (const i of order) {
    drawCup(cups[i], i === hoverCup);
  }
}

/* ── Cup renderer ─────────────────────────────────────────────── */
function drawCup(cup, hover) {
  const x = cup.x, y = cup.y;
  const w = CUP_W, h = CUP_H;

  ctx.save();
  ctx.translate(x, y);

  /* shadow */
  ctx.shadowColor   = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur    = 18;
  ctx.shadowOffsetY = 8;

  /* body trapezoid — wide at top, narrow at bottom */
  const topW  = w;
  const botW  = w * 0.62;
  const rimH  = h * 0.10;
  const bodyH = h * 0.72;
  const stemH = h * 0.10;
  const baseH = h * 0.08;

  const topL  = 0;
  const topR  = topW;
  const botL  = (topW - botW) / 2;
  const botR  = botL + botW;

  /* main body gradient */
  const grad = ctx.createLinearGradient(0, 0, topW, 0);
  grad.addColorStop(0,    hover ? '#ff6b5b' : '#c0392b');
  grad.addColorStop(0.35, hover ? '#ff8a7a' : '#e74c3c');
  grad.addColorStop(0.65, hover ? '#ff6b5b' : '#c0392b');
  grad.addColorStop(1,    hover ? '#cc3020' : '#962d22');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(topL, rimH);
  ctx.lineTo(topR, rimH);
  ctx.lineTo(botR, rimH + bodyH);
  ctx.lineTo(botL, rimH + bodyH);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';

  /* rim */
  const rimGrad = ctx.createLinearGradient(0, 0, topW, 0);
  rimGrad.addColorStop(0,   '#8b1c10');
  rimGrad.addColorStop(0.5, '#d63031');
  rimGrad.addColorStop(1,   '#8b1c10');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.roundRect(topL - 2, 0, topW + 4, rimH + 3, [5, 5, 2, 2]);
  ctx.fill();

  /* stem */
  const stemL = botL + (botW - botW * 0.45) / 2;
  const stemW = botW * 0.45;
  ctx.fillStyle = '#a93226';
  ctx.fillRect(stemL, rimH + bodyH, stemW, stemH);

  /* base */
  const baseW = botW * 1.1;
  const baseL = (topW - baseW) / 2;
  ctx.fillStyle = '#922b21';
  ctx.beginPath();
  ctx.roundRect(baseL, rimH + bodyH + stemH, baseW, baseH, 4);
  ctx.fill();

  /* shine highlight */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topL + topW * 0.15, rimH + 4);
  ctx.lineTo(topL + topW * 0.28, rimH + 4);
  ctx.lineTo(botL + botW * 0.22, rimH + bodyH - 8);
  ctx.lineTo(botL + botW * 0.10, rimH + bodyH - 8);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/* ── Ball renderer ────────────────────────────────────────────── */
function drawBall(cup) {
  const cx = cup.x + CUP_W / 2;
  const cy = cup.y + CUP_H + BALL_R * 0.4;

  /* glow */
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, BALL_R * 2);
  glow.addColorStop(0,   'rgba(245,197,24,0.45)');
  glow.addColorStop(1,   'rgba(245,197,24,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, BALL_R * 2, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  /* ball */
  const ballGrad = ctx.createRadialGradient(cx - BALL_R * 0.3, cy - BALL_R * 0.3, 1, cx, cy, BALL_R);
  ballGrad.addColorStop(0,   '#fff176');
  ballGrad.addColorStop(0.4, '#f5c518');
  ballGrad.addColorStop(1,   '#b8860b');
  ctx.beginPath();
  ctx.arc(cx, cy, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();
}

/* ── Touch support ────────────────────────────────────────────── */
canvas.addEventListener('touchstart', e => {
  if (gamePhase !== 'guess') return;
  e.preventDefault();
  const rect  = canvas.getBoundingClientRect();
  const touch = e.changedTouches[0];
  const mx    = (touch.clientX - rect.left) * (canvas.width / rect.width);
  const my    = (touch.clientY - rect.top)  * (canvas.height / rect.height);
  const hit   = hitTest(mx, my);
  if (hit < 0) return;

  gamePhase = 'done';
  showBall  = true;
  setPhase('');

  if (hit === ballCupIdx) {
    setResult('🎉 Correct! You found it!', 'win');
  } else {
    setResult('💀 Wrong! Better luck next time.', 'loss');
  }
}, { passive: false });

/* ── Google Form ──────────────────────────────────────────────── */
function sendToGoogleForm(name) {
  fetch('https://docs.google.com/forms/d/e/1FAIpQLSeDmuyrMLvlbYN_hFrcTvwISmRWOsi9oH0PdIiRq-H6YGKh7A/formResponse', {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `entry.1512615533=${encodeURIComponent(name)}`
  });
}
