// Kosmos fonu: 3D ulduz sahəsi + [data-orbit] elementinin ətrafında fırlanan işıq axını.
// <body data-space="static"> olduqda animasiya olmur (oxu səhifəsi üçün).
(function () {
  const canvas = document.createElement('canvas');
  canvas.className = 'space';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isStatic = document.body.dataset.space === 'static' || reduceMotion;

  let w = 0, h = 0, dpr = 1;
  let stars = [];
  let flow = [];
  let box = null; // { cx, cy, bx, by, r }
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: -9999, py: -9999 };

  const orbitEl = document.querySelector('[data-orbit]');

  function rand(a, b) { return a + Math.random() * (b - a); }

  // --- Ulduzlar (perspektivli 3D) ---
  function makeStar(z) {
    return { x: rand(-1, 1), y: rand(-1, 1), z: z ?? rand(0.05, 1), tw: rand(0, Math.PI * 2) };
  }

  function drawStars(dt) {
    const f = Math.max(w, h) * 0.5;
    const cx = w / 2 + mouse.x * 18;
    const cy = h / 2 + mouse.y * 18;
    for (const s of stars) {
      if (!isStatic) {
        s.z -= dt * 0.012;
        s.tw += dt * 1.5;
        if (s.z <= 0.03) Object.assign(s, makeStar(1));
      }
      const sx = cx + (s.x / s.z) * f;
      const sy = cy + (s.y / s.z) * f;
      if (sx < -5 || sx > w + 5 || sy < -5 || sy > h + 5) {
        if (!isStatic) Object.assign(s, makeStar(1));
        continue;
      }
      const depth = 1 - s.z;
      const size = 0.35 + depth * 1.5;
      const alpha = (0.25 + depth * 0.75) * (0.75 + 0.25 * Math.sin(s.tw));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Qutu ətrafında axın ---
  // Yumru düzbucaqlıya qədər işarəli məsafə (SDF).
  function sdf(x, y) {
    const qx = Math.abs(x - box.cx) - (box.bx - box.r);
    const qy = Math.abs(y - box.cy) - (box.by - box.r);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - box.r;
  }

  function spawn(p) {
    const m = 170;
    for (let i = 0; i < 30; i++) {
      const x = rand(box.cx - box.bx - m, box.cx + box.bx + m);
      const y = rand(box.cy - box.by - m, box.cy + box.by + m);
      const d = sdf(x, y);
      if (d > 2 && d < m && Math.random() < Math.exp(-d / 32)) {
        p.x = x; p.y = y; p.d0 = d;
        break;
      }
    }
    p.life = 0;
    p.maxLife = rand(1.5, 4.5);
    p.speed = rand(0.5, 1.4);
  }

  function updateBox() {
    if (!orbitEl) { box = null; return; }
    const r = orbitEl.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(orbitEl).borderTopLeftRadius) || 24;
    box = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, bx: r.width / 2, by: r.height / 2, r: Math.min(radius, r.height / 2) };
  }

  function drawFlow(dt) {
    if (!box) return;
    const boost = orbitEl.classList.contains('dragover') || orbitEl.matches(':focus-within') ? 2.2 : 1;
    ctx.lineCap = 'round';
    for (const p of flow) {
      p.life += dt;
      if (p.life > p.maxLife || p.x === undefined) { spawn(p); continue; }

      const d = sdf(p.x, p.y);
      const gx = (sdf(p.x + 1, p.y) - sdf(p.x - 1, p.y)) / 2;
      const gy = (sdf(p.x, p.y + 1) - sdf(p.x, p.y - 1)) / 2;
      const falloff = Math.exp(-Math.max(d, 0) / 70);
      const v = 260 * p.speed * falloff * boost;
      // Tangens boyunca fırlanma + başlanğıc məsafəsində qalmağa çəkən qüvvə
      let vx = -gy * v - gx * (d - p.d0) * 3;
      let vy = gx * v - gy * (d - p.d0) * 3;

      // Siçan yaxınlaşanda zolaqlar kənara itələnir
      const mx = p.x - mouse.px, my = p.y - mouse.py;
      const md2 = mx * mx + my * my;
      if (md2 < 120 * 120) {
        const k = (1 - Math.sqrt(md2) / 120) * 220;
        const md = Math.sqrt(md2) || 1;
        vx += (mx / md) * k;
        vy += (my / md) * k;
      }

      const nx = p.x + vx * dt, ny = p.y + vy * dt;
      const fade = Math.sin(Math.PI * (p.life / p.maxLife));
      const alpha = fade * (0.12 + 0.88 * falloff * falloff);
      const tail = 0.03 + 0.07 * falloff;
      ctx.strokeStyle = `rgba(225,232,255,${alpha})`;
      ctx.lineWidth = 0.5 + falloff * 1.4;
      ctx.beginPath();
      ctx.moveTo(nx - vx * tail, ny - vy * tail);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      p.x = nx; p.y = ny;
      if (sdf(p.x, p.y) < 0) spawn(p); // qutunun içinə düşməsin
    }
  }

  // --- Ölçü və dövr ---
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const starCount = Math.min(900, Math.round((w * h) / (isStatic ? 3500 : 2200)));
    while (stars.length < starCount) stars.push(makeStar());
    stars.length = starCount;

    const flowCount = orbitEl ? Math.min(900, Math.round(w / 1.6)) : 0;
    while (flow.length < flowCount) flow.push({});
    flow.length = flowCount;

    updateBox();
    if (isStatic) frame(0);
  }

  function frame(dt) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    drawStars(dt);
    if (!isStatic) drawFlow(dt);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    updateBox();
    frame(dt);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / w - 0.5) * -2;
    mouse.ty = (e.clientY / h - 0.5) * -2;
    mouse.px = e.clientX;
    mouse.py = e.clientY;
  });
  document.addEventListener('pointerleave', () => { mouse.px = mouse.py = -9999; });

  resize();
  if (!isStatic) requestAnimationFrame((t) => { last = t; loop(t); });
})();
