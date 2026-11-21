// Visualizador 2D de partida: campo, 22 jogadores e bola animados.
// O placar real vem do motor; a animação é a "transmissão" do jogo.

import { FORMATIONS } from './data.js';

const W = 1000;
const H = 620;
const PAD = 34;
const MATCH_SECONDS = 78; // duração em segundos a 1x para os 90 minutos

function slotsFor(formationKey) {
  const lines = (FORMATIONS[formationKey] || FORMATIONS['4-4-2']).lines;
  const out = [{ x: 0.055, y: 0.5 }];
  const xs = lines.length === 3 ? [0.26, 0.52, 0.79] : [0.28, 0.76];
  lines.forEach((count, li) => {
    for (let i = 0; i < count; i++) {
      out.push({ x: xs[li], y: (i + 1) / (count + 1) });
    }
  });
  return out;
}

function groupIndex(position, lines) {
  if (position === 'GOL') return 0;
  if (position === 'ZAG' || position === 'LAT') return 1;
  if (position === 'VOL' || position === 'MEI') return 1 + lines[0];
  return 1 + lines.reduce((sum, n) => sum + n, 0) - lines[lines.length - 1];
}

export function createViewer(canvas, data, hooks = {}) {
  const ctx = canvas.getContext('2d');
  const homeSlots = slotsFor(data.formationHome);
  const awaySlots = slotsFor(data.formationAway);
  const players = [];

  const mySide = data.playerHome ? 'home' : 'away';
  const myLines = (FORMATIONS[data.playerHome ? data.formationHome : data.formationAway] || FORMATIONS['4-4-2']).lines;
  const youSlotIdx = groupIndex(data.playerPosition, myLines);

  function buildPlayers(side, slots, formationMirror) {
    slots.forEach((slot, i) => {
      let x = slot.x;
      let y = slot.y;
      if (formationMirror) { x = 1 - x; y = 1 - y; }
      players.push({
        side,
        slot: slot,
        x, y,
        tx: x, ty: y,
        isYou: side === mySide && i === youSlotIdx,
      });
    });
  }
  buildPlayers('home', homeSlots, false);
  buildPlayers('away', awaySlots, true);

  const ball = { x: 0.5, y: 0.5, owner: null, flight: null };
  const homeGK = players.find((p) => p.side === 'home' && p.slot === homeSlots[0]);
  const awayGK = players.find((p) => p.side === 'away' && p.slot === awaySlots[0]);
  ball.owner = { side: 'home', player: homeGK };

  let raf = 0;
  let last = 0;
  let running = true;
  let speed = 1;
  let minute = 0;
  let eventIdx = 0;
  let finished = false;
  let actionTimer = 1.4;
  let scoreHome = 0;
  let scoreAway = 0;
  const events = [...data.events].sort((a, b) => a.minute - b.minute);

  const px = (nx) => PAD + nx * (W - PAD * 2);
  const py = (ny) => PAD + ny * (H - PAD * 2);

  function emitScore() {
    if (hooks.onScore) hooks.onScore(scoreHome, scoreAway);
  }

  function triggerEvent(ev) {
    if (ev.type === 'goal') {
      if (ev.side === 'home') scoreHome++;
      else if (ev.side === 'away') scoreAway++;
      emitScore();
      if (hooks.onGoal) hooks.onGoal(ev);
    }
    if (hooks.onEvent) hooks.onEvent(ev);
  }

  function chooseOwner(side) {
    const list = players.filter((p) => p.side === side);
    return list[Math.floor(Math.random() * list.length)];
  }

  function pickTarget(owner) {
    const attacking = owner.side === 'home' ? 1 : -1;
    const progress = (p) => (owner.side === 'home' ? p.x : 1 - p.x);
    const mates = players.filter((p) => p.side === owner.side && p !== owner);
    const ahead = mates.filter((p) => progress(p) > progress(owner) - 0.03);
    const pool = ahead.length ? ahead : mates;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function startFlight(x, y, dur, nextOwner) {
    ball.flight = { x0: ball.x, y0: ball.y, x1: x, y1: y, t: 0, dur, nextOwner };
  }

  function updateBall(dt) {
    if (ball.flight) {
      const f = ball.flight;
      f.t += dt * speed;
      const k = Math.min(1, f.t / f.dur);
      ball.x = f.x0 + (f.x1 - f.x0) * k;
      ball.y = f.y0 + (f.y1 - f.y0) * k;
      if (k >= 1) {
        if (f.nextOwner) ball.owner = f.nextOwner;
        ball.flight = null;
        actionTimer = 0.9 + Math.random() * 1.1;
      }
      return;
    }

    const owner = ball.owner && ball.owner.player;
    if (owner) {
      ball.x = owner.x;
      ball.y = owner.y;
    }

    if (!running) return;
    actionTimer -= dt * speed;
    if (actionTimer > 0) return;
    actionTimer = 1.0 + Math.random() * 1.4;

    if (!owner) {
      ball.owner = { side: 'home', player: homeGK };
      return;
    }

    const progress = owner.side === 'home' ? owner.x : 1 - owner.x;
    const r = Math.random();

    if (progress > 0.74 && r < 0.45) {
      // finalização (a defesa sempre evita o gol na animação; o placar vem do motor)
      const targetX = owner.side === 'home' ? 0.99 : 0.01;
      startFlight(targetX, 0.5 + (Math.random() - 0.5) * 0.24, 0.55, null);
      setTimeout(() => {
        const gk = owner.side === 'home' ? awayGK : homeGK;
        ball.owner = { side: gk.side, player: gk };
      }, 620 / speed);
      return;
    }

    if (r < 0.72) {
      const target = pickTarget(owner);
      const intercept = Math.random() < 0.16;
      if (intercept) {
        const opp = players.filter((p) => p.side !== owner.side);
        const nearest = opp.reduce((best, p) => {
          const d = Math.hypot(p.x - target.x, p.y - target.y);
          return d < best.d ? { d, p } : best;
        }, { d: Infinity, p: opp[0] }).p;
        startFlight(nearest.x, nearest.y, 0.35, { side: nearest.side, player: nearest });
      } else {
        startFlight(target.x, target.y, 0.32, { side: target.side, player: target });
      }
      return;
    }

    // condução
    const dir = owner.side === 'home' ? 1 : -1;
    owner.tx = Math.min(0.92, Math.max(0.08, owner.x + dir * 0.05));
    owner.ty = Math.min(0.9, Math.max(0.1, owner.y + (Math.random() - 0.5) * 0.1));
  }

  function updatePlayers(dt) {
    for (const p of players) {
      const base = p.slot;
      let bx = base.x;
      let by = base.y;
      if (p.side === 'away') { bx = 1 - bx; by = 1 - by; }
      const pullX = (ball.x - bx) * 0.16;
      const pullY = (ball.y - by) * 0.16;
      p.tx = bx + pullX;
      p.ty = by + pullY;
      const k = Math.min(1, dt * 2.4 * speed);
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
    }
  }

  function drawPitch() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d3a24');
    grad.addColorStop(1, '#082a19');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // faixas
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      if (i % 2) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      const x = PAD + (i * (W - PAD * 2)) / stripes;
      ctx.fillRect(x, PAD, (W - PAD * 2) / stripes, H - PAD * 2);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(PAD, PAD, W - PAD * 2, H - PAD * 2);

    // linha e círculo central
    ctx.beginPath();
    ctx.moveTo(W / 2, PAD);
    ctx.lineTo(W / 2, H - PAD);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    const boxH = 250;
    const boxW = 130;
    // áreas
    ctx.strokeRect(PAD, (H - boxH) / 2, boxW, boxH);
    ctx.strokeRect(W - PAD - boxW, (H - boxH) / 2, boxW, boxH);
    // pequenas áreas
    const gH = 110;
    const gW = 48;
    ctx.strokeRect(PAD, (H - gH) / 2, gW, gH);
    ctx.strokeRect(W - PAD - gW, (H - gH) / 2, gW, gH);
    // gols
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(PAD - 12, (H - 74) / 2, 12, 74);
    ctx.fillRect(W - PAD, (H - 74) / 2, 12, 74);
  }

  function drawPlayers() {
    for (const p of players) {
      const x = px(p.x);
      const y = py(p.y);
      const isHome = p.side === 'home';
      ctx.beginPath();
      ctx.arc(x, y, p.isYou ? 12 : 9, 0, Math.PI * 2);
      ctx.fillStyle = isHome ? '#3f8cff' : '#ff5c68';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();

      if (p.isYou) {
        ctx.beginPath();
        ctx.arc(x, y, 17, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffc94a';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#ffc94a';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('você', x, y - 24);
      }
    }
  }

  function drawBall() {
    const x = px(ball.x);
    const y = py(ball.y);
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function draw() {
    drawPitch();
    drawPlayers();
    drawBall();
  }

  function finish() {
    if (finished) return;
    finished = true;
    minute = 90;
    while (eventIdx < events.length) triggerEvent(events[eventIdx++]);
    if (hooks.onClock) hooks.onClock(90);
    if (hooks.onFinish) hooks.onFinish();
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;

    if (running && !finished) {
      minute += dt * speed * (90 / MATCH_SECONDS);
      if (minute > 90) minute = 90;
      if (hooks.onClock) hooks.onClock(Math.min(90, Math.floor(minute)));
      while (eventIdx < events.length && events[eventIdx].minute <= minute) {
        triggerEvent(events[eventIdx++]);
      }
      if (minute >= 90) finish();
    }

    updatePlayers(dt);
    updateBall(dt);
    draw();
  }

  emitScore();
  if (hooks.onClock) hooks.onClock(0);
  raf = requestAnimationFrame(frame);

  return {
    setSpeed(v) { speed = v; },
    getSpeed() { return speed; },
    togglePause() {
      running = !running;
      return running;
    },
    isRunning() { return running; },
    skip() {
      while (eventIdx < events.length && events[eventIdx].minute <= 90) {
        triggerEvent(events[eventIdx++]);
      }
      finish();
    },
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
    },
  };
}
