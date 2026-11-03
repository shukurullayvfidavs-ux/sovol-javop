const $   = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
 
// 10 ta barmoq uchun 10 ta rang (hue) va ularning nomlari
const HUES  = [350, 28, 52, 140, 172, 198, 225, 265, 300, 330];
const NAMES = ['Qizil', 'To‘q sariq', 'Sariq', 'Yashil', 'Zangori', 'Havorang', 'Ko‘k', 'Binafsha', 'Liloviy', 'Pushti'];
 
// Rang to‘plamlari: to‘yinganlik (s), yorqinlik (l) va fon
const LOOKS = {
  Neon:   { s: 95, l: 58, bg: '#0b0a1a' },
  Shirin: { s: 80, l: 74, bg: '#1a1030' },
  Chuqur: { s: 85, l: 46, bg: '#06121a' }
};
 
const cfg = { delay: 5, winners: 1, vib: true, size: 1, vol: 0.5, look: 'Neon', bg: '#0b0a1a' };
 
// Rang: i-barmoqning rangi (a = shaffoflik, dl = yorqinlikka qo‘shimcha)
const col = (i, a = 1, dl = 0) => `hsla(${HUES[i]},${LOOKS[cfg.look].s}%,${LOOKS[cfg.look].l + dl}%,${a})`;
 
/* =====================================================================
   2. HOLAT (o‘yin qaysi bosqichda)
   ===================================================================== */
// phase: intro -> wait (barmoq kutilmoqda) -> spin (tanlanmoqda) -> result (natija)
let phase = 'intro';
const fingers = new Map();       // id -> { id, x, y, ci, sticky, born, r, win, lose }
let winners = [], hi = null;     // tanlanganlar va aylanish paytida yoritilgan doira
let lastChange = performance.now(), lastSec = -1, count = null;
 
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = randInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
function randInt(n) { return crypto.getRandomValues(new Uint32Array(1))[0] % n; }   // halol tasodifiy son
 
/* =====================================================================
   3. EKRAN
   ===================================================================== */
const cv = $('cv'), ctx = cv.getContext('2d');
let W, H, DPR;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 3);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize);
resize();
 
// Brauzer o‘zining ishorаlarini (zoom, scroll, menyu) qilmasin
document.addEventListener('touchmove', e => { if (!e.target.closest('#panel')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
 
/* =====================================================================
   4. BARMOQLAR (bosish, surish, olish)
   ===================================================================== */
const freeColor = () => {
  const used = new Set([...fingers.values()].map(f => f.ci));
  for (let i = 0; i < 10; i++) if (!used.has(i)) return i;
  return -1;
};
const touched = () => { lastChange = performance.now(); lastSec = -1; };   // o‘zgarish bo‘lsa sanash qaytadan boshlanadi
 
function addFinger(id, x, y, sticky) {
  const ci = freeColor();
  if (ci < 0) return;                                    // 10 tadan ortiq bo‘lmaydi
  fingers.set(id, { id, x, y, ci, sticky, born: performance.now(), r: 0, win: false, lose: false });
  touched(); buzz(15); sfxTick(8);
}
function removeFinger(id) { if (fingers.delete(id)) touched(); }
 
cv.addEventListener('pointerdown', e => {
  unlockAudio();
  if (phase !== 'wait') return;
  e.preventDefault();
  if (e.pointerType === 'mouse') {                       // kompyuter: bosib doira qo‘yish/olib tashlash
    const hit = [...fingers.values()].find(f => Math.hypot(f.x - e.clientX, f.y - e.clientY) < f.r);
    if (hit) removeFinger(hit.id); else addFinger('m' + Date.now(), e.clientX, e.clientY, true);
    return;
  }
  addFinger(e.pointerId, e.clientX, e.clientY, false);
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') return;
  const f = fingers.get(e.pointerId);
  if (f) { f.x = e.clientX; f.y = e.clientY; }
  else if (phase === 'wait' && e.pressure > 0) addFinger(e.pointerId, e.clientX, e.clientY, false);
});
const lift = e => { unlockAudio(); if (e.pointerType !== 'mouse' && phase === 'wait') removeFinger(e.pointerId); };
cv.addEventListener('pointerup', lift);
cv.addEventListener('pointercancel', lift);
 
/* =====================================================================
   5. O‘YIN MANTIQI: sanash -> aylanish -> tanlash -> savol
   ===================================================================== */
let lastStatus = '';
function setStatus(t) { if (t !== lastStatus) { $('status').textContent = t; lastStatus = t; } }
 
function updateGame() {
  if (phase !== 'wait') return;
  const n = fingers.size;
  count = null;
  if (n === 0) setStatus('Hamma bitta barmog‘ini ekranga qo‘ysin');
  else if (n === 1) setStatus('Yana kamida bitta barmoq kerak');
  else {
    count = cfg.delay - (performance.now() - lastChange) / 1000;
    setStatus(`${n} kishi bor. Barmoqlarni olmang!`);
    const sec = Math.ceil(count);
    if (sec !== lastSec) { lastSec = sec; if (sec > 0) sfxTick(cfg.delay - sec); }
    if (count <= 0) startSpin();
  }
}
 
function startSpin() {
  phase = 'spin'; count = null; setStatus('Tanlanmoqda...');
  const list = [...fingers.values()];
  winners = shuffle([...list]).slice(0, Math.min(cfg.winners, list.length - 1));   // g‘oliblar oldindan tanlanadi
 
  // Yoritgich doiralar bo‘ylab sekinlashib aylanadi
  let idx = randInt(list.length), step = 0, wait = 70;
  const total = 16 + randInt(6);
  (function next() {
    hi = list[idx++ % list.length];
    sfxTick(10 + step % 5); buzz(8);
    if (++step < total) { wait *= 1.12; setTimeout(next, wait); }
    else setTimeout(reveal, wait + 250);
  })();
}
 
function reveal() {
  phase = 'result'; hi = null; setStatus('');
  fingers.forEach(f => { f.win = winners.includes(f); f.lose = !f.win; });
  winners.forEach(f => confetti(f.x, f.y, f.ci));
  flash = 1; flashCi = winners[0].ci;
  sfxWin(); buzz([80, 60, 220]);
  setTimeout(showCard, 900);
}
 
function showCard() {
  const who = $('who');
  who.textContent = winners.length > 1 ? 'Tanlanganlar:' : 'Tanlandi:';
  winners.forEach(f => {
    const s = document.createElement('span');
    s.innerHTML = `<i class="dot" style="background:${col(f.ci)}"></i>`;
    s.append(NAMES[f.ci]);
    who.append(s);
  });
  $('task').textContent = winners.length > 1 ? 'Endi savollarga javob bering!' : 'Endi savolga javob ber!';
  $('card').style.setProperty('--win', col(winners[0].ci));
  $('card').classList.add('show');
}
 
function resetGame() {
  $('card').classList.remove('show');
  fingers.clear(); winners = []; hi = null;
  phase = 'wait'; touched();
}
$('againBtn').onclick = resetGame;
 
$('startBtn').onclick = () => {
  musicReady = true;
  unlockAudio();
  $('intro').classList.add('gone');
  phase = 'wait'; touched();
};
 
const bits  = [];                                     // uchqunlar va konfetti
const stars = Array.from({ length: 80 }, () => ({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(.6, 1.8), p: rnd(0, 6.28) }));
let flash = 0, flashCi = 0, spot = 0, T = 0, last = performance.now();
 
const easeOutBack = t => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
 
function spark(f) {
  const a = rnd(0, 6.283);
  bits.push({ x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 10,
              life: rnd(.5, 1), ci: f.ci, s: rnd(1.5, 3.5), conf: false });
}
function confetti(x, y, ci) {
  for (let i = 0; i < 140; i++) {
    const a = rnd(0, 6.283), sp = rnd(180, 760);
    bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 250, life: rnd(1.6, 3),
                ci: Math.random() < .5 ? ci : randInt(10), s: rnd(5, 11), rot: rnd(0, 6), vr: rnd(-9, 9), conf: true });
  }
}
 
function drawFinger(f, now, dt) {
  const base = Math.min(86, Math.max(44, Math.min(W, H) * .13)) * cfg.size;     // telefonda barmoq ostida qolmasligi uchun katta
  let target = base, alpha = 1;
  if (phase === 'spin') { if (hi === f) target = base * 1.3; else alpha = .6; }
  if (f.win)  target = base * (1.9 + .1 * Math.sin(now / 180));
  if (f.lose) { target = base * .38; alpha = .35; }
 
  const age = (now - f.born) / 1000;
  const pop = age < .4 ? easeOutBack(age / .4) : 1;                 // paydo bo‘lish animatsiyasi
  f.r += (target * pop - f.r) * Math.min(1, dt * 10);
  const { x, y, r } = f;
  if (r < 1) return;
 
  // yorug‘lik (glow)
  ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(x, y, r * .6, x, y, r * 2.6);
  g.addColorStop(0, col(f.ci, .55 * alpha)); g.addColorStop(1, col(f.ci, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.283); ctx.fill();
 
  // doira tanasi (3D ko‘rinish)
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${.8 * alpha})`); g.addColorStop(.35, col(f.ci, alpha)); g.addColorStop(1, col(f.ci, alpha, -14));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
 
  ctx.lineCap = 'round';
  if (phase === 'wait') {
    if (count !== null) {                                            // sanash halqasi to‘lib boradi
      const p = Math.min(1, Math.max(0, 1 - count / cfg.delay));
      ctx.strokeStyle = col(f.ci, .25); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(x, y, r + 18, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = col(f.ci, 1, 10); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(x, y, r + 18, -1.5708, -1.5708 + 6.283 * p); ctx.stroke();
    } else {                                                         // kutish: aylanuvchi nuqtali halqa
      ctx.setLineDash([6, 12]); ctx.lineDashOffset = -now / 30;
      ctx.strokeStyle = col(f.ci, .6); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r + 18, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    }
    if (Math.random() < .5) spark(f);
  }
  if (phase === 'spin' && hi === f) {                                // yoritilgan doira
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, r + 10, 0, 6.283); ctx.stroke();
  }
  if (f.win) {                                                       // g‘olib: oq halqa va to‘lqinlar
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 6.283); ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const t = (now / 1100 + k / 3) % 1;
      ctx.strokeStyle = col(f.ci, (1 - t) * .8); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r * (1 + t * 1.7), 0, 6.283); ctx.stroke();
    }
  }
}
 
function draw(now, dt) {
  // fon
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
 
  // yulduzchalar
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    s.y -= dt * .01; if (s.y < 0) s.y = 1;
    ctx.globalAlpha = .12 + .3 * Math.abs(Math.sin(T + s.p));
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }
 
  // sanash raqami (fonda katta bo‘lib turadi)
  if (count !== null && count > 0) {
    const frac = count - Math.floor(count);
    ctx.globalAlpha = .1 + .12 * frac;
    ctx.font = `700 ${Math.min(W, H) * .6 * (1 + .2 * frac ** 4)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(count), W / 2, H * .48);
  }
  ctx.globalAlpha = 1;
 
  // g‘olib chiqqanda rangli chaqnash
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col(flashCi, flash * .22); ctx.fillRect(0, 0, W, H);
    flash -= dt * 1.2;
  }
 
  // natija chiqqanda fon qorayadi, g‘olib yorqin ko‘rinib turadi
  spot += ((phase === 'result' ? 1 : 0) - spot) * Math.min(1, dt * 4);
  if (spot > .01) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(0,0,0,${spot * .5})`; ctx.fillRect(0, 0, W, H); }
 
  fingers.forEach(f => drawFinger(f, now, dt));
 
  // uchqunlar va konfetti
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.life -= dt;
    if (b.life <= 0) { bits[i] = bits[bits.length - 1]; bits.pop(); continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    ctx.globalAlpha = Math.min(1, b.life / .6);
    if (b.conf) {
      b.vy += 900 * dt; b.vx *= .99; b.rot += b.vr * dt;
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = col(b.ci);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore();
    } else {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col(b.ci);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.s / 2, 0, 6.283); ctx.fill();
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
 
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  updateGame();
  draw(now, dt);
  requestAnimationFrame(frame);
}
 
/* =====================================================================
   7. SOZLAMALAR PANELI
   ===================================================================== */
$('setBtn').onclick = () => $('panel').classList.toggle('hidden');
 
const bind = (id, fn) => $(id).addEventListener('input', e => fn(e.target));
bind('delayR',  t => { cfg.delay   = +t.value; $('delayV').textContent = t.value; touched(); });
bind('winR',    t => { cfg.winners = +t.value; $('winV').textContent   = t.value; });
bind('vibC',    t => cfg.vib = t.checked);
bind('sizeR',   t => cfg.size = +t.value);
bind('cBg',     t => { cfg.bg = t.value; document.body.style.background = t.value; });
bind('volR',    t => setVolume(+t.value));
 
Object.entries(LOOKS).forEach(([name, look]) => {              // tayyor rang to‘plamlari
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => { cfg.look = name; cfg.bg = look.bg; $('cBg').value = look.bg; document.body.style.background = look.bg; };
  $('presets').append(b);
});
 
function buzz(p) { if (cfg.vib && navigator.vibrate) navigator.vibrate(p); }
 
/* =====================================================================
   8. OVOZ VA MUSIQA (hammasi brauzerning o‘zida yaratiladi)
   ===================================================================== */
let ac, musicBus, sfxBus, verb, musicOn = true, seqTimer = null, nextT = 0, step = 0, hatBuf;
const EIGHTH = 60 / 104 / 2;                           // 104 urish/daqiqa — quvnoq sur'at
const CHORDS = [                                       // C - Am - F - G
  { bass: 48, tri: [60, 64, 67] }, { bass: 45, tri: [57, 60, 64] },
  { bass: 41, tri: [53, 57, 60] }, { bass: 43, tri: [55, 59, 62] }
];
const ARP   = [0, 2, 1, 2, 0, 2, 1, 2];                // arpeggio tartibi
const PENTA = [72, 74, 76, 79, 81, 84];                // ohangdor "yulduzcha" notalar
const freq  = m => 440 * 2 ** ((m - 69) / 12);
 
function unlockAudio() {                               // ovoz faqat bosishdan keyin ruxsat etiladi
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? cfg.vol : 0; musicBus.connect(comp);
    sfxBus   = ac.createGain(); sfxBus.gain.value = .9; sfxBus.connect(comp);
 
    verb = ac.createConvolver();                       // yengil aks-sado
    const len = ac.sampleRate * 1.8, buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
    verb.buffer = buf; const vg = ac.createGain(); vg.gain.value = .4; verb.connect(vg); vg.connect(musicBus);
 
    hatBuf = ac.createBuffer(1, ac.sampleRate * .05, ac.sampleRate);   // "hat" shovqini
    const hd = hatBuf.getChannelData(0); for (let i = 0; i < hd.length; i++) hd[i] = (Math.random() * 2 - 1) * (1 - i / hd.length);
  }
  if (ac.state === 'suspended') ac.resume();
  if (musicReady && !seqTimer) startSeq();             // musiqa faqat "Boshlash"dan keyin boshlanadi
}
let musicReady = false;
 
function startSeq() { if (seqTimer) return; nextT = ac.currentTime + .1; step = 0; seqTimer = setInterval(schedule, 200); }
 
function note(m, t, vol, dur, bus, wet) {              // yumshoq "pluck" tovush
  const g = ac.createGain();
  [['triangle', 1, 1], ['sine', 2, .25]].forEach(([type, mul, amp]) => {
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = type; o.frequency.value = freq(m) * mul; og.gain.value = amp;
    o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + .1);
  });
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + .01);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  g.connect(bus); if (wet) g.connect(verb);
}
function kick(t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
  g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .22);
  o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + .25);
}
function hat(t) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = hatBuf; f.type = 'highpass'; f.frequency.value = 7000; g.gain.value = .07;
  s.connect(f); f.connect(g); g.connect(musicBus); s.start(t);
}
function schedule() {                                  // keyingi notalarni oldindan qo‘yib boradi
  while (nextT < ac.currentTime + .8) {
    const idx = step % 8, ch = CHORDS[Math.floor(step / 8) % 4], t = nextT;
    if (idx % 4 === 0) { kick(t); note(ch.bass, t, .3, .5, musicBus, false); }
    if (idx % 2 === 1) hat(t);
    const arp = [ch.tri[0] + 12, ch.tri[1] + 12, ch.tri[2] + 12];
    note(arp[ARP[idx] % 3], t, .16, 1.0, musicBus, true);
    if (Math.random() < .25) note(PENTA[randInt(PENTA.length)], t, .1, 1.6, musicBus, true);
    nextT += EIGHTH; step++;
  }
}
 
function sfxTick(i) { if (ac) note(72 + i * 2, ac.currentTime, .22, .15, sfxBus, false); }          // sanash "tik"
function sfxWin()   { if (ac) [72, 76, 79, 84, 88].forEach((m, k) => note(m, ac.currentTime + k * .09, .28, 1.8, sfxBus, true)); }
 
function setVolume(v) { cfg.vol = v; if (musicBus) musicBus.gain.value = musicOn ? v : 0; }
$('musicBtn').onclick = () => {
  musicOn = !musicOn;
  $('musicBtn').textContent = 'Musiqa: ' + (musicOn ? 'yoqilgan' : 'o‘chirilgan');
  if (musicBus) musicBus.gain.value = musicOn ? cfg.vol : 0;
};
 
/* =====================================================================
   9. ISHGA TUSHIRISH
   ===================================================================== */
requestAnimationFrame(frame);
 