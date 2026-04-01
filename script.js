/* ═══════════════════════════════════════════════════════
   GAME HUB – Shell / Cup Game
   Canvas-based. Cups arc OVER each other on swap.
═══════════════════════════════════════════════════════ */

let username     = "";
let swapDuration = 900;

/* ── Screen helpers ─────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.add('hidden'); s.classList.remove('active');
  });
  const el = document.getElementById(id);
  el.classList.remove('hidden'); el.classList.add('active');
}
function setPhase(txt) {
  const el = document.getElementById('phaseLabel');
  if (el) el.textContent = txt;
}
function setResult(txt, cls) {
  const r = document.getElementById('result');
  r.textContent = txt;
  r.className = 'result-msg' + (cls ? ' ' + cls : '');
}

/* ── Nav ────────────────────────────────────────────── */
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

/* ═══════════════════════════════════════════════════════
   CANVAS ENGINE
═══════════════════════════════════════════════════════ */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let N = 3;
let CUP_W, CUP_H, GAP, SLOT_W;   // layout
const BALL_R  = 13;
const PAD_X   = 30;
const PAD_TOP = 20;
const PAD_BOT = 50;  // room for ball below cup

/* Each cup: { slotX (resting x), x (animated x), y (animated y), hasBall } */
let cups      = [];
let ballCupIdx = 0;
let showBall   = false;
let gamePhase  = 'idle';
let hoverIdx   = -1;
let rafId      = null;

/* Swap animation */
let swapping   = false;
let swap       = null;   // { idxA, idxB, t, duration }
let swapQueue  = [];
let swapTimer  = null;

/* ── Init ───────────────────────────────────────────── */
function initGame() {
  stopGame();
  setResult('', '');

  N = parseInt(document.getElementById('cupCount').value);

  /* sizing */
  const avail = Math.min(window.innerWidth - 48, 600);
  CUP_W = Math.max(60, Math.floor((avail - PAD_X * 2) / N * 0.72));
  CUP_H = Math.round(CUP_W * 1.25);
  GAP   = Math.floor((avail - PAD_X * 2 - CUP_W * N) / (N - 1 || 1));
  GAP   = Math.max(GAP, 20);
  SLOT_W = CUP_W + GAP;

  const totalW = PAD_X * 2 + CUP_W * N + GAP * (N - 1);
  const totalH = PAD_TOP + CUP_H + BALL_R * 2 + PAD_BOT;

  canvas.width  = totalW;
  canvas.height = totalH;

  /* build cups */
  cups = [];
  for (let i = 0; i < N; i++) {
    const sx = PAD_X + i * SLOT_W;
    cups.push({ slot: i, x: sx, y: PAD_TOP, hasBall: false });
  }

  ballCupIdx = Math.floor(Math.random() * N);
  cups[ballCupIdx].hasBall = true;

  showBall  = true;
  gamePhase = 'reveal';
  setPhase('🟡 Remember the ball!');

  rafId = requestAnimationFrame(loop);

  setTimeout(() => {
    showBall  = false;
    gamePhase = 'shuffle';
    setPhase('Shuffling…');
    buildQueue();
    runNextSwap();
  }, 1400);
}

function stopGame() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (swapTimer) { clearTimeout(swapTimer); swapTimer = null; }
  swapping  = false;
  swap      = null;
  swapQueue = [];
  gamePhase = 'idle';
  hoverIdx  = -1;
}

/* ── Queue ──────────────────────────────────────────── */
function buildQueue() {
  const total = swapDuration >= 800 ? 8 : swapDuration >= 400 ? 14 : 22;
  swapQueue = [];
  let pA = -1, pB = -1;
  for (let m = 0; m < total; m++) {
    let a, b, t = 0;
    do { a = Math.floor(Math.random() * N); b = Math.floor(Math.random() * N); t++; }
    while (a === b || (t < 8 && a === pA && b === pB));
    swapQueue.push([a, b]);
    pA = a; pB = b;
  }
}

function runNextSwap() {
  if (!swapQueue.length) {
    gamePhase = 'guess';
    setPhase('👆 Pick a cup!');
    return;
  }
  const [a, b] = swapQueue.shift();
  beginSwap(a, b);
}

/* ── Arc swap ───────────────────────────────────────── */
function beginSwap(idxA, idxB) {
  const ca = cups[idxA], cb = cups[idxB];
  swapping = true;
  swap = {
    idxA, idxB,
    ax0: ca.x, ay0: ca.y,
    bx0: cb.x, by0: cb.y,
    ax1: cb.x, ay1: cb.y,
    bx1: ca.x, by1: ca.y,
    duration: swapDuration,
    startTime: performance.now()
  };
}

function tickSwap(now) {
  if (!swap) return;
  const s  = swap;
  let raw  = (now - s.startTime) / s.duration;
  if (raw > 1) raw = 1;

  /* ease in-out cubic */
  const t = raw < 0.5 ? 4*raw*raw*raw : 1 - Math.pow(-2*raw+2,3)/2;

  const arcH = CUP_H * 1.05;

  /* A lifts over */
  cups[s.idxA].x = lerp(s.ax0, s.ax1, t);
  cups[s.idxA].y = lerp(s.ay0, s.ay1, t) - Math.sin(Math.PI * raw) * arcH;

  /* B slides under (slight dip) */
  cups[s.idxB].x = lerp(s.bx0, s.bx1, t);
  cups[s.idxB].y = lerp(s.by0, s.by1, t) + Math.sin(Math.PI * raw) * (arcH * 0.10);

  if (raw >= 1) {
    /* snap */
    cups[s.idxA].x = s.ax1; cups[s.idxA].y = s.ay1;
    cups[s.idxB].x = s.bx1; cups[s.idxB].y = s.by1;

    /* swap hasBall */
    const h = cups[s.idxA].hasBall;
    cups[s.idxA].hasBall = cups[s.idxB].hasBall;
    cups[s.idxB].hasBall = h;
    if (ballCupIdx === s.idxA)      ballCupIdx = s.idxB;
    else if (ballCupIdx === s.idxB) ballCupIdx = s.idxA;

    swapping = false;
    swap     = null;
    /* pause briefly then next swap */
    swapTimer = setTimeout(runNextSwap, swapDuration * 0.06);
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

/* ── Render loop ────────────────────────────────────── */
function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (swapping && swap) tickSwap(now);
  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /* draw balls behind cups */
  if (showBall) {
    for (const c of cups) {
      if (c.hasBall) drawBall(c);
    }
  }

  /* sort: cups higher up (lower y) drawn last = on top */
  const order = [...Array(N).keys()].sort((a, b) => cups[b].y - cups[a].y);
  for (const i of order) drawCup(cups[i], i === hoverIdx);
}

/* ── Cup shape ──────────────────────────────────────── */
function drawCup(cup, hover) {
  const x = cup.x, y = cup.y;
  const w = CUP_W, h = CUP_H;

  /* proportions */
  const rimH  = h * 0.09;
  const bodyH = h * 0.70;
  const stemH = h * 0.11;
  const baseH = h * 0.10;

  const topLeft  = x;
  const topRight = x + w;
  const botLeft  = x + w * 0.19;
  const botRight = x + w * 0.81;
  const bodyTop  = y + rimH;
  const bodyBot  = bodyTop + bodyH;
  const stemTop  = bodyBot;
  const stemBot  = stemTop + stemH;
  const baseTop  = stemBot;
  const baseBot  = baseTop + baseH;
  const stemL    = x + w * 0.38;
  const stemR    = x + w * 0.62;
  const baseL    = x + w * 0.10;
  const baseR    = x + w * 0.90;

  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur    = 14;
  ctx.shadowOffsetY = 6;

  /* body gradient */
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  if (hover) {
    g.addColorStop(0,    '#d93025');
    g.addColorStop(0.3,  '#ff6b5b');
    g.addColorStop(0.7,  '#ff6b5b');
    g.addColorStop(1,    '#d93025');
  } else {
    g.addColorStop(0,    '#8b1c10');
    g.addColorStop(0.3,  '#e74c3c');
    g.addColorStop(0.7,  '#e74c3c');
    g.addColorStop(1,    '#8b1c10');
  }

  /* body trapezoid */
  ctx.beginPath();
  ctx.moveTo(topLeft,  bodyTop);
  ctx.lineTo(topRight, bodyTop);
  ctx.lineTo(botRight, bodyBot);
  ctx.lineTo(botLeft,  bodyBot);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  /* rim */
  ctx.beginPath();
  ctx.rect(topLeft - 3, y, w + 6, rimH + 2);
  ctx.fillStyle = hover ? '#e84040' : '#c0392b';
  ctx.fill();

  /* rim top highlight */
  ctx.beginPath();
  ctx.rect(topLeft - 3, y, w + 6, 3);
  ctx.fillStyle = hover ? '#ff8080' : '#e05050';
  ctx.fill();

  /* stem */
  ctx.beginPath();
  ctx.rect(stemL, stemTop, stemR - stemL, stemH);
  ctx.fillStyle = '#922b21';
  ctx.fill();

  /* base */
  ctx.beginPath();
  ctx.rect(baseL, baseTop, baseR - baseL, baseH);
  ctx.fillStyle = hover ? '#c0392b' : '#a93226';
  ctx.fill();

  /* shine */
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(topLeft + w * 0.15, bodyTop + 4);
  ctx.lineTo(topLeft + w * 0.28, bodyTop + 4);
  ctx.lineTo(botLeft  + (botRight - botLeft) * 0.22, bodyBot - 6);
  ctx.lineTo(botLeft  + (botRight - botLeft) * 0.08, bodyBot - 6);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/* ── Ball ───────────────────────────────────────────── */
function drawBall(cup) {
  const cx = cup.x + CUP_W / 2;
  const cy = cup.y + CUP_H + BALL_R + 4;

  /* outer glow */
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, BALL_R * 2.2);
  glow.addColorStop(0, 'rgba(245,197,24,0.5)');
  glow.addColorStop(1, 'rgba(245,197,24,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, BALL_R * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  /* ball */
  const ball = ctx.createRadialGradient(cx - BALL_R*0.3, cy - BALL_R*0.3, 1, cx, cy, BALL_R);
  ball.addColorStop(0,   '#fff176');
  ball.addColorStop(0.45,'#f5c518');
  ball.addColorStop(1,   '#9a6b00');
  ctx.beginPath();
  ctx.arc(cx, cy, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = ball;
  ctx.fill();
}

/* ── Hit test ───────────────────────────────────────── */
function hitTest(mx, my) {
  for (let i = 0; i < cups.length; i++) {
    const c = cups[i];
    if (mx >= c.x && mx <= c.x + CUP_W &&
        my >= c.y && my <= c.y + CUP_H) return i;
  }
  return -1;
}

/* ── Interaction ────────────────────────────────────── */
canvas.addEventListener('mousemove', e => {
  if (gamePhase !== 'guess') { hoverIdx = -1; return; }
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / r.width;
  const scaleY = canvas.height / r.height;
  hoverIdx = hitTest((e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY);
  canvas.style.cursor = hoverIdx >= 0 ? 'pointer' : 'default';
});

canvas.addEventListener('mouseleave', () => { hoverIdx = -1; });

function handlePick(mx, my) {
  if (gamePhase !== 'guess') return;
  const hit = hitTest(mx, my);
  if (hit < 0) return;
  gamePhase = 'done';
  showBall  = true;
  setPhase('');
  hoverIdx  = -1;
  if (hit === ballCupIdx) {
    setResult('🎉 Correct! You found it!', 'win');
  } else {
    setResult('💀 Wrong! Better luck next time.', 'loss');
  }
}

canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / r.width;
  const scaleY = canvas.height / r.height;
  handlePick((e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY);
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const r     = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / r.width;
  const scaleY = canvas.height / r.height;
  const t     = e.changedTouches[0];
  handlePick((t.clientX - r.left) * scaleX, (t.clientY - r.top) * scaleY);
}, { passive: false });

/* ── Google Form ────────────────────────────────────── */
function sendToGoogleForm(name) {
  fetch('https://docs.google.com/forms/d/e/1FAIpQLSeDmuyrMLvlbYN_hFrcTvwISmRWOsi9oH0PdIiRq-H6YGKh7A/formResponse', {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `entry.1512615533=${encodeURIComponent(name)}`
  });
}
