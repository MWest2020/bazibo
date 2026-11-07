// The game itself: state, input, physics and drawing on one canvas.
// The board uses fixed logical coordinates (W x H) that are scaled to fit the screen.
import * as G from './grid.js';
import { COLORS, getSprite, clearSprites, drawBubble } from './bubble-art.js';
import * as sfx from './audio.js';

export const R = 25;
export const COLS = 8;
export const W = COLS * 2 * R; // 400
export const H = 760;
const TAU = Math.PI * 2;
const ROW_H = R * G.SQRT3;
const LID = 12; // ceiling plate height before it drops
const SHOOTER = { x: W / 2, y: H - 86 };
const NEXT = { x: W / 2 - 96, y: H - 52 };
const DEADLINE = H - 168;
const SPEED = 1150; // logical px per second
const HIT = 2 * R * 0.84; // touching distance; a bit forgiving so shots slip through gaps
const MIN_ANGLE = (9 * Math.PI) / 180;
const GRAVITY = 2100;
const FLOOR = H - 4;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (p) => 1 - (1 - p) ** 3;

export class Game {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this._raf = 0;
    this._last = performance.now();
    this._frame = this._frame.bind(this);
    this.phase = 'idle';
    this._paused = false;
    this._active = false;
    this.idle = 0;
    this.hintDone = true;
    this.effects = [];
    this.falling = [];
    this.time = 0;
    this.shake = 0;
    this.recoil = 0;
    this.aim = { active: false, hover: false, angle: Math.PI / 2 };
    this.grid = G.makeGrid([], COLS);
    this._bind();
    this.resize();
  }

  // The animation loop only runs while the game screen is shown and not paused (battery).
  get active() {
    return this._active;
  }

  set active(v) {
    this._active = !!v;
    this._wake();
  }

  get paused() {
    return this._paused;
  }

  set paused(v) {
    this._paused = !!v;
    this._wake();
  }

  _wake() {
    if (this._raf || !this._active) return;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  /** Is the animation loop scheduled? (for tests) */
  get running() {
    return this._raf !== 0;
  }

  // ---------- lifecycle ----------

  start(level) {
    this.level = level;
    this.grid = G.makeGrid(level.rows, COLS);
    this.drops = 0;
    this.lidY = this.gridTop;
    this.misses = 0;
    this.missesPerDrop = level.missesPerDrop || 6;
    this.shots = 0;
    this.score = 0;
    this.effects.length = 0;
    this.falling.length = 0;
    this.shot = null;
    this.settle = null;
    this.endTimer = 0;
    this.result = null;
    this.current = this.pickColor();
    this.next = this.pickColor();
    this.aim.active = false;
    this.aim.angle = Math.PI / 2;
    this.idle = 0;
    this.hintT = 0;
    // first level: show how to aim until the first shot
    this.hintDone = level.id !== 1;
    this.paused = false;
    this.active = true;
    this.phase = 'aim';
    this.hooks.onScore?.(0);
  }

  get gridTop() {
    return LID + (this.drops || 0) * ROW_H;
  }

  pickColor() {
    const cs = G.colorsPresent(this.grid);
    return cs.length ? cs[Math.floor(Math.random() * cs.length)] : 0;
  }

  swap() {
    if (this.phase !== 'aim') return;
    [this.current, this.next] = [this.next, this.current];
    sfx.click();
    this.effects.push({ type: 'swap', t: 0, dur: 0.25 });
  }

  // ---------- input ----------

  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this._down(e));
    c.addEventListener('pointermove', (e) => this._move(e));
    c.addEventListener('pointerup', (e) => this._up(e));
    c.addEventListener('pointercancel', () => (this.aim.active = false));
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.aim.hover = false;
    });
    window.addEventListener('resize', () => this.resize());
  }

  _toLogical(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * W) / rect.width, y: ((e.clientY - rect.top) * H) / rect.height };
  }

  _down(e) {
    sfx.unlock();
    if (this.phase !== 'aim' || this.paused) return;
    e.preventDefault();
    this.idle = 0;
    const p = this._toLogical(e);
    if (Math.hypot(p.x - NEXT.x, p.y - NEXT.y) < R * 1.7) {
      this.swap();
      return;
    }
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.aim.active = true;
    this._setAim(p);
  }

  _move(e) {
    if (this.phase !== 'aim' || this.paused) return;
    const p = this._toLogical(e);
    if (e.pointerType === 'mouse') this.aim.hover = p.y < SHOOTER.y;
    if (this.aim.active || this.aim.hover) this.idle = 0;
    if (this.aim.active || e.pointerType === 'mouse') this._setAim(p);
  }

  _up(e) {
    if (!this.aim.active) return;
    this.aim.active = false;
    const p = this._toLogical(e);
    if (p.y < SHOOTER.y - R * 0.5 && this.phase === 'aim' && !this.paused) this.fire();
  }

  _setAim(p) {
    let a = Math.atan2(SHOOTER.y - p.y, p.x - SHOOTER.x);
    if (a < 0) a = p.x < SHOOTER.x ? Math.PI - MIN_ANGLE : MIN_ANGLE;
    this.aim.angle = clamp(a, MIN_ANGLE, Math.PI - MIN_ANGLE);
  }

  /** Fire at an angle (radians, PI/2 = straight up). Also used by tests. */
  fire(angle = this.aim.angle) {
    if (this.phase !== 'aim') return false;
    this.aim.angle = clamp(angle, MIN_ANGLE, Math.PI - MIN_ANGLE);
    const a = this.aim.angle;
    // plan the whole path now, with the same trace the guide draws, so the bubble always lands
    // in the cell the ghost circle showed
    const plan = G.planShot(this.grid, SHOOTER.x, SHOOTER.y, a, { R, width: W, gridTop: this.gridTop, hitDist: HIT });
    this.shot = { x: SHOOTER.x, y: SHOOTER.y, color: this.current, plan, dist: 0, seg: 1 };
    this.hintDone = true;
    this.current = null;
    this.phase = 'flying';
    this.shots++;
    this.recoil = 1;
    sfx.shoot();
    return true;
  }

  // ---------- simulation ----------

  _frame(now) {
    this._raf = 0;
    const dt = Math.min(0.033, Math.max(0, (now - this._last) / 1000));
    this._last = now;
    if (!this._active) return;
    if (!this._paused) this.update(dt);
    this.render();
    // behind the win or "Bijna!" card nothing moves once the effects are done: stop too
    const settled = (this.phase === 'won' || this.phase === 'lost') && this.endTimer <= 0 && !this.effects.length && !this.falling.length;
    if (!this._paused && !settled) this._raf = requestAnimationFrame(this._frame);
  }

  /** Show the "drag up and let go" hand? On level 1 before the first shot, or after a long wait. */
  get hinting() {
    return this.phase === 'aim' && !this.aim.active && !this.aim.hover && !this.paused && (!this.hintDone || this.idle > 9);
  }

  update(dt) {
    this.time += dt;
    if (this.phase === 'aim' && !this.aim.active) this.idle += dt;
    if (this.hinting) this.hintT += dt;
    else this.hintT = 0;
    this.lidY += (this.gridTop - this.lidY) * Math.min(1, dt * 9);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.shake = Math.max(0, this.shake - dt);
    if (this.settle) {
      this.settle.t += dt;
      if (this.settle.t > 0.25) this.settle = null;
    }
    if (this.phase === 'flying' && this.shot) this._fly(dt);
    this._updateEffects(dt);
    this._updateFalling(dt);
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        if (this.phase === 'won') this.hooks.onWin?.(this.result);
        else this.hooks.onLose?.(this.result);
      }
    }
  }

  _fly(dt) {
    const s = this.shot;
    s.dist += SPEED * dt;
    const p = G.pointAlong(s.plan.points, s.dist);
    // every point between the start and the end of the path is a wall bounce
    for (; s.seg < p.seg; s.seg++) sfx.tick();
    s.x = p.x;
    s.y = p.y;
    if (p.done) this._land();
  }

  _land() {
    const s = this.shot;
    this.shot = null;
    const top = this.gridTop;
    const { r, c } = s.plan.cell;
    G.set(this.grid, r, c, s.color);
    this.settle = { r, c, t: 0 };
    const matches = G.findMatches(this.grid, r, c);
    let popped = 0;
    if (matches.length >= 3) {
      const o = G.cellCenter(r, c, R);
      matches.sort((a, b) => {
        const pa = G.cellCenter(a[0], a[1], R);
        const pb = G.cellCenter(b[0], b[1], R);
        return Math.hypot(pa.x - o.x, pa.y - o.y) - Math.hypot(pb.x - o.x, pb.y - o.y);
      });
      matches.forEach(([mr, mc], i) => {
        const p = G.cellCenter(mr, mc, R);
        this._spawnPop(p.x, p.y + top, this.grid.cells[mr][mc], i * 0.055, i, 1);
      });
      G.removeCells(this.grid, matches);
      popped = matches.length;
      const floating = G.findFloating(this.grid);
      floating.forEach(([fr, fc], i) => {
        const p = G.cellCenter(fr, fc, R);
        this._spawnFall(p.x, p.y + top, this.grid.cells[fr][fc], popped * 0.055 + i * 0.02);
      });
      G.removeCells(this.grid, floating);
      const gained = popped * 10 + floating.length * 20 + floating.length ** 2 * 5;
      this.score += gained;
      this.effects.push({ type: 'text', x: o.x, y: o.y + top, text: `+${gained}`, t: 0, dur: 1 });
      this.hooks.onScore?.(this.score);
    } else {
      sfx.stick();
      this.misses++;
    }

    if (G.count(this.grid) === 0) return this._end('won');
    if (!popped && this.misses >= this.missesPerDrop) {
      this.misses = 0;
      this.drops++;
      this.shake = 0.35;
      sfx.lid();
    }
    if (this._crossed()) return this._end('lost');

    const present = G.colorsPresent(this.grid);
    this.current = present.includes(this.next) ? this.next : this.pickColor();
    this.next = this.pickColor();
    this.phase = 'aim';
  }

  _crossed() {
    const low = G.lowestRow(this.grid);
    if (low < 0) return false;
    return this.gridTop + R + low * ROW_H + R > DEADLINE;
  }

  /** How close the lowest bubble is to the line, 0 (far) .. 1 (touching). */
  _danger() {
    const low = G.lowestRow(this.grid);
    if (low < 0) return 0;
    const bottom = this.gridTop + 2 * R + low * ROW_H;
    return clamp(1 - (DEADLINE - bottom) / (ROW_H * 1.5), 0, 1);
  }

  _end(result) {
    this.phase = result;
    this.aim.active = false;
    if (result === 'won') {
      const stars = G.starsFor(this.shots, this.level.par);
      this.score += stars * 100;
      this.hooks.onScore?.(this.score);
      this.result = { stars, score: this.score, shots: this.shots };
      this.endTimer = 1.1;
      setTimeout(() => sfx.win(), 450);
    } else {
      // everything gently tumbles down, then the friendly "try again" card
      this.grid.cells.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v === null) return;
          const p = G.cellCenter(r, c, R);
          this._spawnFall(p.x, p.y + this.gridTop, v, Math.random() * 0.3, true);
        }),
      );
      this.grid = G.makeGrid([], COLS);
      this.result = { stars: 0, score: this.score, shots: this.shots };
      this.endTimer = 1.4;
      sfx.lose();
    }
  }

  _spawnPop(x, y, color, delay, i, vol, gap = 0.03) {
    this.effects.push({ type: 'pop', x, y, color, t: -delay, dur: 0.3, i, vol, gap, sounded: false });
  }

  /** `quiet`: the tumble after losing, where only a few soft pops should be heard. */
  _spawnFall(x, y, color, delay = 0, quiet = false) {
    this.falling.push({ x, y, color, vx: rand(-90, 90), vy: rand(-160, -40), wait: delay, bounces: 0, quiet });
  }

  _updateEffects(dt) {
    const list = this.effects;
    for (let k = list.length - 1; k >= 0; k--) {
      const e = list[k];
      e.t += dt;
      if (e.type === 'pop' && !e.sounded && e.t >= 0) {
        e.sounded = true;
        sfx.pop(e.i, e.vol, e.gap);
        const col = COLORS[e.color];
        const n = 7;
        for (let j = 0; j < n; j++) {
          const a = (j / n) * TAU + rand(-0.3, 0.3);
          const sp = rand(160, 320);
          list.push({ type: 'drop', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, r: rand(2.5, 5), col, t: 0, dur: rand(0.4, 0.65) });
        }
      }
      if (e.type === 'drop') {
        e.vy += 900 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
      if (e.t > e.dur) list.splice(k, 1);
    }
  }

  _updateFalling(dt) {
    const list = this.falling;
    for (let k = list.length - 1; k >= 0; k--) {
      const b = list[k];
      if (b.wait > 0) {
        b.wait -= dt;
        continue;
      }
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const wb = G.bounceX(b.x, b.vx, R, W - R);
      b.x = wb.x;
      b.vx = wb.vx;
      if (b.y + R > FLOOR && b.vy > 0) {
        b.y = FLOOR - R;
        b.vy = -b.vy * 0.5;
        b.vx *= 0.8;
        b.bounces++;
        if (b.bounces === 1 && !b.quiet) sfx.bounce();
        if (b.bounces >= 2) {
          // pop it after the second bounce: children like popping
          const i = 3 + Math.floor(Math.random() * 4);
          if (b.quiet) this._spawnPop(b.x, b.y, b.color, 0, i, 0.35, 0.16);
          else this._spawnPop(b.x, b.y, b.color, 0, i, 0.6, 0.06);
          list.splice(k, 1);
        }
      }
    }
  }

  // ---------- drawing ----------

  resize() {
    const stage = this.canvas.parentElement;
    const pad = stage ? getComputedStyle(stage) : null;
    const rw = stage ? stage.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight) : 0;
    const rh = stage ? stage.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom) : 0;
    if (!rw || !rh) return;
    const scale = Math.min(rw / W, rh / H);
    const cssW = Math.floor(W * scale);
    const cssH = Math.floor(H * scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    // lets the CSS keep pause and mute next to the board on wide screens
    stage.parentElement?.style.setProperty('--board-w', `${cssW}px`);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.k = this.canvas.width / W;
    clearSprites();
    this.bg = makeBackground(this.k);
    if (this._active && !this._raf) this.render(); // resizing clears the canvas
  }

  _sprite(ctx, color, x, y, scale = 1, alpha = 1) {
    const spr = getSprite(color, R * this.k);
    const s = (spr.width / this.k) * scale;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(spr, x - s / 2, y - s / 2, s, s);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  render() {
    const ctx = this.ctx;
    if (!this.k) return;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.drawImage(this.bg, 0, 0, W, H);
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(this.time * 70) * this.shake * 8, 0);

    this._drawLid(ctx);
    this._drawDeadline(ctx);

    // board
    const top = this.lidY;
    this.grid.cells.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v === null) return;
        const p = G.cellCenter(r, c, R);
        let s = 1 + 0.018 * Math.sin(this.time * 2.2 + r * 0.9 + c * 1.7);
        if (this.settle && this.settle.r === r && this.settle.c === c) s *= 1 + 0.14 * Math.sin((this.settle.t / 0.25) * Math.PI);
        this._sprite(ctx, v, p.x, p.y + top, s);
      }),
    );

    const hint = this.hinting ? this._hintPose() : null;
    if (this.phase === 'aim' && (this.aim.active || this.aim.hover || (hint && hint.press)) && this.current !== null) this._drawGuide(ctx, hint ? hint.alpha : 1);
    this._drawShooter(ctx);
    if (this.shot) this._sprite(ctx, this.shot.color, this.shot.x, this.shot.y);

    for (const b of this.falling) this._sprite(ctx, b.color, b.x, b.y);
    for (const e of this.effects) this._drawEffect(ctx, e);
    if (hint) this._drawHint(ctx, hint);
    ctx.restore();
  }

  _shownAngle() {
    return this.hinting ? this._hintPose().angle : this.aim.angle;
  }

  /** Where the demo hand is in its 2.6 s loop: press near the launcher, drag up, let go. */
  _hintPose() {
    const T = 2.6;
    const t = this.hintT % T;
    const fadeIn = clamp(this.hintT / 0.4, 0, 1);
    const sweep = Math.sin((Math.floor(this.hintT / T) % 2 ? -1 : 1) * 0.5); // left, then right
    const start = { x: SHOOTER.x, y: SHOOTER.y - 50 };
    const end = { x: SHOOTER.x + sweep * 150, y: SHOOTER.y - 230 };
    let p;
    let press = true;
    let alpha = fadeIn;
    if (t < 0.35) {
      p = 0;
      press = t > 0.2;
    } else if (t < 1.6) p = easeOut((t - 0.35) / 1.25);
    else {
      p = 1;
      press = false;
      alpha *= 1 - clamp((t - 1.9) / 0.5, 0, 1);
    }
    const x = start.x + (end.x - start.x) * p;
    const y = start.y + (end.y - start.y) * p;
    const angle = clamp(Math.atan2(SHOOTER.y - y, x - SHOOTER.x), MIN_ANGLE, Math.PI - MIN_ANGLE);
    return { x, y, press, alpha, angle, released: t >= 1.6 ? clamp((t - 1.6) / 0.4, 0, 1) : 0 };
  }

  _drawHint(ctx, h) {
    ctx.save();
    ctx.globalAlpha = h.alpha;
    // the words, for the grown-up reading along
    ctx.font = '800 22px ui-rounded, "Nunito", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'Sleep omhoog en laat los!';
    const tw = ctx.measureText(text).width + 36;
    const ty = DEADLINE - 44;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - tw / 2, ty - 22, tw, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#3B2FA8';
    ctx.fillText(text, W / 2, ty + 1);
    // touch ripple under the finger
    if (h.press || h.released) {
      const k = h.released;
      ctx.strokeStyle = 'rgba(91,75,219,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 14 + k * 26 + (h.press ? 2 * Math.sin(this.time * 10) : 0), 0, TAU);
      ctx.globalAlpha = h.alpha * (1 - k);
      ctx.stroke();
      ctx.globalAlpha = h.alpha;
    }
    // a simple pointing hand; the fingertip is at (x, y)
    const lift = h.press ? 0 : 8;
    ctx.translate(h.x + 6, h.y + 4 - lift);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#3B2FA8';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.roundRect(-8, 0, 16, 40, 8); // index finger
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-14, 26, 40, 38, 14); // palm with folded fingers
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-24, 34, 18, 12, 6); // thumb
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 38);
    ctx.lineTo(20, 38);
    ctx.moveTo(8, 48);
    ctx.lineTo(20, 48);
    ctx.stroke();
    ctx.restore();
  }

  _drawLid(ctx) {
    const y = this.lidY - 3;
    const g = ctx.createLinearGradient(0, 0, 0, y);
    g.addColorStop(0, '#3B2FA8');
    g.addColorStop(1, '#6B5CF0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(W, -20);
    ctx.lineTo(W, y);
    const n = 16;
    for (let i = n; i >= 0; i--) {
      const x = (i / n) * W;
      ctx.quadraticCurveTo(x + W / n / 2, y + 7, x, y);
    }
    ctx.closePath();
    ctx.fill();
    // little rivet dots on the plate once it has dropped
    if (this.drops > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let d = 0; d < this.drops; d++) {
        const yy = LID + d * ROW_H + ROW_H / 2;
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.arc(25 + i * 50, yy, 3, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  _drawDeadline(ctx) {
    const d = this._danger();
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.lineWidth = 3;
    const pulse = d > 0 ? 0.5 + 0.5 * Math.sin(this.time * 8) : 0;
    ctx.strokeStyle = d > 0 ? `rgba(235, 70, 90, ${0.35 + 0.45 * pulse * d})` : 'rgba(91, 75, 219, 0.22)';
    ctx.beginPath();
    ctx.moveTo(8, DEADLINE);
    ctx.lineTo(W - 8, DEADLINE);
    ctx.stroke();
    ctx.restore();
  }

  _drawGuide(ctx, alpha = 1) {
    const tr = G.traceGuide(this.grid, SHOOTER.x, SHOOTER.y, this._shownAngle(), {
      R,
      width: W,
      gridTop: this.gridTop,
      maxBounces: 1,
      hitDist: HIT,
    });
    const pts = tr.points;
    const gap = 17;
    let offset = (this.time * 60) % gap;
    let along = 0;
    const col = COLORS[this.current];
    ctx.save();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = offset; d < len; d += gap) {
        const total = along + d;
        if (total < 44) continue; // skip the part inside the launcher
        const x = a.x + ((b.x - a.x) * d) / len;
        const y = a.y + ((b.y - a.y) * d) / len;
        const fade = clamp(1 - total / 900, 0.25, 1);
        ctx.globalAlpha = fade * alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 4.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = col.base;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, TAU);
        ctx.fill();
      }
      offset = (offset - len) % gap;
      if (offset < 0) offset += gap;
      along += len;
    }
    ctx.restore();
    if (tr.hit === 'bubble' || tr.hit === 'ceiling') {
      const cell = G.snapCell(this.grid, tr.end.x, tr.end.y - this.gridTop, R);
      const p = G.cellCenter(cell.r, cell.c, R);
      ctx.save();
      ctx.globalAlpha = 0.75 * alpha;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = col.dark;
      ctx.beginPath();
      ctx.arc(p.x, p.y + this.gridTop, R - 2, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawShooter(ctx) {
    const { x, y } = SHOOTER;
    // platform
    ctx.save();
    ctx.shadowColor = 'rgba(40,30,120,0.25)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    const pg = ctx.createLinearGradient(0, y - 10, 0, H);
    pg.addColorStop(0, '#FFFFFF');
    pg.addColorStop(1, '#D9D2FF');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(x, y + 44, 64, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // barrel
    const a = this._shownAngle();
    const back = this.recoil * 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-a);
    const bg = ctx.createLinearGradient(0, -14, 0, 14);
    bg.addColorStop(0, '#8A7DFF');
    bg.addColorStop(1, '#4A3CC9');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(-back, -13, 62, 26, 13);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(10 - back, -9, 44, 6, 3);
    ctx.fill();
    ctx.restore();

    // ring around the loaded bubble
    ctx.fillStyle = '#5B4BDB';
    ctx.beginPath();
    ctx.arc(x, y, R + 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ECE8FF';
    ctx.beginPath();
    ctx.arc(x, y, R + 3, 0, TAU);
    ctx.fill();
    if (this.current !== null && this.current !== undefined && this.phase === 'aim') this._sprite(ctx, this.current, x, y);

    // next bubble with a swap hint
    const swapP = this.effects.find((e) => e.type === 'swap');
    const sw = swapP ? 1 + 0.2 * Math.sin((swapP.t / swapP.dur) * Math.PI) : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(NEXT.x, NEXT.y, R * 0.82 + 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(91,75,219,0.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = this.time * 8;
    ctx.stroke();
    ctx.setLineDash([]);
    if (this.next !== null && this.phase !== 'won' && this.phase !== 'lost') this._sprite(ctx, this.next, NEXT.x, NEXT.y, 0.78 * sw);
    // little circular arrows between next and current
    ctx.save();
    ctx.strokeStyle = '#5B4BDB';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const mx = (NEXT.x + x) / 2 - 6;
    const my = NEXT.y - 4;
    ctx.beginPath();
    ctx.arc(mx, my, 9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx + 9 * Math.cos(Math.PI * 1.9) - 4, my + 9 * Math.sin(Math.PI * 1.9) - 3);
    ctx.lineTo(mx + 9 * Math.cos(Math.PI * 1.9), my + 9 * Math.sin(Math.PI * 1.9));
    ctx.lineTo(mx + 9 * Math.cos(Math.PI * 1.9) + 1, my + 9 * Math.sin(Math.PI * 1.9) - 5);
    ctx.stroke();
    ctx.restore();

    // misses left before the ceiling drops
    const left = this.missesPerDrop - this.misses;
    const startX = x + 62;
    for (let i = 0; i < this.missesPerDrop; i++) {
      const cx = startX + (i % 3) * 18;
      const cy = H - 64 + Math.floor(i / 3) * 18;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, TAU);
      if (i < left) {
        ctx.fillStyle = left <= 1 ? '#EB465A' : '#5B4BDB';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(91,75,219,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    // a tiny picture next to the dots: "when these run out, the ceiling comes down"
    const ix = startX + 66;
    const iy = H - 72;
    const warn = left <= 2 ? 0.5 + 0.5 * Math.sin(this.time * 8) : 0;
    const col = warn ? `rgb(${Math.round(91 + 144 * warn)}, ${Math.round(75 - 5 * warn)}, ${Math.round(219 - 129 * warn)})` : '#5B4BDB';
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(ix - 15, iy, 30, 8, 3);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const ay = iy + 14 + warn * 3;
    ctx.beginPath();
    ctx.moveTo(ix, ay);
    ctx.lineTo(ix, ay + 14);
    ctx.moveTo(ix - 7, ay + 7);
    ctx.lineTo(ix, ay + 14);
    ctx.lineTo(ix + 7, ay + 7);
    ctx.stroke();
    ctx.restore();
  }

  _drawEffect(ctx, e) {
    if (e.type === 'pop') {
      if (e.t < 0) {
        this._sprite(ctx, e.color, e.x, e.y);
        return;
      }
      const p = clamp(e.t / e.dur, 0, 1);
      this._sprite(ctx, e.color, e.x, e.y, 1 + 0.4 * easeOut(p), 1 - p);
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.strokeStyle = COLORS[e.color].light;
      ctx.lineWidth = 4 * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * (1 + 0.9 * easeOut(p)), 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (e.type === 'drop') {
      const p = e.t / e.dur;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = e.col.base;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.3, e.r * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (e.type === 'text') {
      const p = e.t / e.dur;
      ctx.save();
      ctx.globalAlpha = 1 - p * p;
      ctx.font = '800 26px ui-rounded, "Nunito", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#5B4BDB';
      const y = e.y - 40 * easeOut(p);
      ctx.strokeText(e.text, e.x, y);
      ctx.fillText(e.text, e.x, y);
      ctx.restore();
    }
  }

  // ---------- for tests and debugging ----------

  snapshot() {
    return {
      phase: this.phase,
      shots: this.shots,
      score: this.score,
      bubbles: G.count(this.grid),
      drops: this.drops,
      misses: this.misses,
      effects: this.effects.length + this.falling.length,
    };
  }
}

function makeBackground(k) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * k);
  c.height = Math.round(H * k);
  const ctx = c.getContext('2d');
  ctx.scale(k, k);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#D6EEFF');
  g.addColorStop(0.6, '#EFE6FF');
  g.addColorStop(1, '#FFE6F3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // soft bokeh circles (seeded, so the background never jumps)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 16; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 18 + rnd() * 60;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.45)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // soft hill behind the launcher
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 70);
  ctx.bezierCurveTo(W * 0.3, H - 115, W * 0.7, H - 115, W, H - 70);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  return c;
}

export { drawBubble };
