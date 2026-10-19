// Line-art panels for the work cards and the wireframe cup (crox-style drawings, coffee colours).
const CREAM = 'rgba(241,230,214,0.85)';
const FAINT = 'rgba(241,230,214,0.18)';
const CARAMEL = '#e2742b';
const CREMA = '#d9a35f';

function grid(g, w, h, step = 28) {
  g.fillStyle = 'rgba(241,230,214,0.13)';
  for (let x = step / 2; x < w; x += step) for (let y = step / 2; y < h; y += step) g.fillRect(x, y, 1, 1);
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function label(g, txt, x, y, color = CREAM, size = 10) {
  g.font = `500 ${size}px "Geist Mono", monospace`;
  g.fillStyle = color;
  g.fillText(txt, x, y);
}

const DRAW = {
  phone(g, w, h, t) {
    const cx = w / 2, cy = h / 2 + 6, ph = Math.min(h * 0.72, 260), pw = ph * 0.5;
    for (let i = 4; i >= 0; i--) {
      g.setLineDash(i ? [3, 5] : []);
      g.lineDashOffset = -t * 20 * (i % 2 ? 1 : -1);
      g.strokeStyle = i ? FAINT : CREAM;
      rr(g, cx - pw / 2 - i * 16, cy - ph / 2 - i * 16, pw + i * 32, ph + i * 32, 22 + i * 10);
      g.stroke();
    }
    g.setLineDash([]);
    // screen rows
    for (let i = 0; i < 6; i++) {
      const y = cy - ph / 2 + 40 + i * 30;
      const k = (Math.sin(t * 2 - i * 0.6) + 1) / 2;
      g.fillStyle = i === 1 ? CARAMEL : `rgba(241,230,214,${0.15 + k * 0.25})`;
      g.fillRect(cx - pw / 2 + 16, y, (pw - 32) * (i === 1 ? 0.55 : 0.4 + ((i * 37) % 50) / 100), 8);
    }
    g.strokeStyle = CREAM;
    rr(g, cx - 18, cy + ph / 2 - 22, 36, 5, 3);
    g.stroke();
    const lx = Math.min(cx + pw / 2 + 44, w - 100);
    label(g, 'PLAY STORE ✓', lx, cy - 40, CREMA);
    label(g, 'APP STORE ✓', lx, cy - 20, CREMA);
    label(g, 'ANDROID / iOS', Math.max(14, cx - pw / 2 - 150), h - 18);
  },
  pipe(g, w, h, t) {
    const names = ['CODEX', 'CLAUDE', 'GROK', 'GEMINI'];
    const stages = ['CODE', 'PR', 'REVIEW', 'MERGE', 'TEST', 'DEPLOY', 'STORE'];
    const x0 = w * 0.12, x1 = w * 0.88;
    const ys = names.map((_, i) => h * 0.22 + i * h * 0.13);
    const midY = h * 0.78;
    names.forEach((n, i) => {
      g.strokeStyle = FAINT;
      g.setLineDash([4, 6]);
      g.lineDashOffset = -t * 40;
      g.beginPath();
      g.moveTo(x0 + 70, ys[i]);
      g.bezierCurveTo(w * 0.45, ys[i], w * 0.35, midY, w * 0.5, midY);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = CREAM;
      g.strokeRect(x0, ys[i] - 12, 70, 24);
      label(g, n, x0 + 9, ys[i] + 4);
      const k = (t * 0.35 + i * 0.25) % 1;
      const px = x0 + 70 + (w * 0.5 - x0 - 70) * k;
      const py = ys[i] + (midY - ys[i]) * (k * k * (3 - 2 * k));
      g.fillStyle = CARAMEL;
      g.beginPath();
      g.arc(px, py, 3, 0, Math.PI * 2);
      g.fill();
    });
    const sw = (x1 - w * 0.5) / stages.length;
    stages.forEach((s, i) => {
      const x = w * 0.5 + i * sw;
      const on = Math.floor((t * 1.2) % stages.length) === i;
      g.fillStyle = on ? CARAMEL : 'transparent';
      g.strokeStyle = on ? CARAMEL : CREAM;
      g.fillRect(x + 2, midY - 14, sw - 4, 28);
      g.strokeRect(x + 2, midY - 14, sw - 4, 28);
      g.save();
      g.translate(x + sw / 2, midY - 26);
      g.rotate(-Math.PI / 2);
      label(g, s, 0, 4, on ? CARAMEL : 'rgba(241,230,214,0.6)', 9);
      g.restore();
    });
  },
  chat(g, w, h, t) {
    const cx = w / 2, cy = h / 2;
    const bub = (x, y, bw, bh, me, txt) => {
      g.strokeStyle = me ? CARAMEL : CREAM;
      rr(g, x, y, bw, bh, 14);
      g.stroke();
      label(g, txt, x + 14, y + bh / 2 + 4, me ? CARAMEL : CREAM);
    };
    bub(cx - 150, cy - 70, 200, 36, false, 'when is the next jab due?');
    bub(cx - 40, cy - 20, 190, 36, true, 'Bruno: 14 Nov · rabies');
    const dots = Math.floor(t * 3) % 4;
    g.strokeStyle = FAINT;
    rr(g, cx - 150, cy + 30, 70, 30, 14);
    g.stroke();
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i < dots ? CREAM : FAINT;
      g.beginPath();
      g.arc(cx - 132 + i * 16, cy + 45, 3, 0, Math.PI * 2);
      g.fill();
    }
    label(g, 'RAG + RULES', 20, h - 20, CREMA);
  },
  portal(g, w, h, t) {
    const n = 14, bw = (w * 0.7) / n, x0 = w * 0.15, base = h * 0.78;
    g.strokeStyle = FAINT;
    g.beginPath();
    g.moveTo(x0, base);
    g.lineTo(x0 + w * 0.7, base);
    g.stroke();
    for (let i = 0; i < n; i++) {
      const v = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(i * 0.9 + t * 1.1)) * (0.4 + (i / n) * 0.6);
      g.fillStyle = i === n - 1 ? CARAMEL : 'rgba(241,230,214,0.22)';
      g.fillRect(x0 + i * bw + 3, base - v * h * 0.5, bw - 6, v * h * 0.5);
    }
    g.strokeStyle = CREMA;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const v = 0.3 + 0.5 * (i / n) + Math.sin(i + t) * 0.04;
      const x = x0 + i * bw + bw / 2, y = base - v * h * 0.55;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    label(g, 'PARTNERS', x0, h * 0.18);
    label(g, '+ METRICS', x0 + 90, h * 0.18, CREMA);
  },
  route(g, w, h, t) {
    const nodes = [
      [0.15, 0.5, 'COMPLAINT'],
      [0.42, 0.3, 'READ'],
      [0.42, 0.7, 'SORT'],
      [0.68, 0.5, 'ROUTE'],
      [0.88, 0.5, 'RESOLVED'],
    ];
    const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]];
    edges.forEach(([a, b], i) => {
      const A = nodes[a], B = nodes[b];
      g.strokeStyle = FAINT;
      g.setLineDash([3, 5]);
      g.lineDashOffset = -t * 30;
      g.beginPath();
      g.moveTo(A[0] * w, A[1] * h);
      g.lineTo(B[0] * w, B[1] * h);
      g.stroke();
      g.setLineDash([]);
      const k = (t * 0.5 + i * 0.2) % 1;
      g.fillStyle = CARAMEL;
      g.fillRect(A[0] * w + (B[0] - A[0]) * w * k - 2, A[1] * h + (B[1] - A[1]) * h * k - 2, 4, 4);
    });
    nodes.forEach(([x, y, n], i) => {
      g.fillStyle = '#140c08';
      g.strokeStyle = i === 4 ? CARAMEL : CREAM;
      g.fillRect(x * w - 40, y * h - 13, 80, 26);
      g.strokeRect(x * w - 40, y * h - 13, 80, 26);
      g.textAlign = 'center';
      label(g, n, x * w, y * h + 4, i === 4 ? CARAMEL : CREAM, 9);
      g.textAlign = 'left';
    });
  },
  ledger(g, w, h, t) {
    const rows = ['UPI  −₹240  CHAI', 'HDFC −₹1,200  RENT', 'eSewa −Rs 450  MOMO', 'UPI  −₹90   AUTO', 'SBI  +₹42,000 SALARY'];
    rows.forEach((r, i) => {
      const y = h * 0.2 + i * 30;
      const k = Math.min(1, Math.max(0, (t * 0.6 - i * 0.18) % 1.6));
      g.strokeStyle = FAINT;
      g.strokeRect(w * 0.1, y - 14, w * 0.42, 22);
      label(g, 'SMS', w * 0.1 + 8, y + 1, 'rgba(241,230,214,0.45)', 9);
      g.save();
      g.globalAlpha = k;
      label(g, r, w * 0.56, y + 1, i === 4 ? CREMA : CREAM, 10);
      g.restore();
      g.strokeStyle = 'rgba(226,116,43,' + k * 0.8 + ')';
      g.beginPath();
      g.moveTo(w * 0.52, y - 3);
      g.lineTo(w * 0.55, y - 3);
      g.stroke();
    });
    label(g, 'NO ACCOUNT · NO SERVER', w * 0.1, h - 22, CREMA);
  },
  text(g, w, h, t) {
    for (let i = 0; i < 9; i++) {
      const y = h * 0.18 + i * 22;
      let x = w * 0.1;
      const words = 5 + (i * 3) % 4;
      for (let j = 0; j < words; j++) {
        const ww = 18 + ((i * 7 + j * 13) % 40);
        const ai = (i * 5 + j * 3) % 7 === 0;
        const scan = Math.abs(((t * 0.25) % 1) * h - y) < 30;
        g.fillStyle = ai ? (scan ? CARAMEL : 'rgba(226,116,43,0.55)') : 'rgba(241,230,214,0.25)';
        g.fillRect(x, y, ww, 7);
        x += ww + 8;
        if (x > w * 0.85) break;
      }
    }
    const sy = ((t * 0.25) % 1) * h;
    g.strokeStyle = CREMA;
    g.beginPath();
    g.moveTo(0, sy);
    g.lineTo(w, sy);
    g.stroke();
    label(g, 'P(AI) = 0.93', w - 110, h - 20, CARAMEL);
  },
  plate(g, w, h, t) {
    const pw = Math.min(w * 0.6, 260), ph = pw * 0.36, x = (w - pw) / 2, y = (h - ph) / 2;
    g.strokeStyle = CREAM;
    rr(g, x, y, pw, ph, 8);
    g.stroke();
    g.font = `600 ${ph * 0.45}px "Schibsted Grotesk", sans-serif`;
    g.fillStyle = CREAM;
    g.textAlign = 'center';
    g.fillText('BA 2 PA 4417', w / 2, y + ph * 0.64);
    g.textAlign = 'left';
    const sx = x + ((t * 0.5) % 1) * pw;
    g.strokeStyle = CARAMEL;
    g.beginPath();
    g.moveTo(sx, y - 14);
    g.lineTo(sx, y + ph + 14);
    g.stroke();
    for (const [cx, cy] of [[x - 12, y - 12], [x + pw + 12, y - 12], [x - 12, y + ph + 12], [x + pw + 12, y + ph + 12]]) {
      g.strokeStyle = CREMA;
      g.beginPath();
      g.moveTo(cx + (cx < w / 2 ? 0 : 0), cy);
      g.lineTo(cx + (cx < w / 2 ? 12 : -12), cy);
      g.moveTo(cx, cy);
      g.lineTo(cx, cy + (cy < h / 2 ? 12 : -12));
      g.stroke();
    }
    label(g, 'IN 09:41 · OUT 11:02 · ₨ 60', x, y + ph + 40, CREMA);
  },
  robot(g, w, h, t) {
    const fx = w * 0.12, fy = h * 0.18, fw = w * 0.76, fh = h * 0.64;
    g.strokeStyle = FAINT;
    g.strokeRect(fx, fy, fw, fh);
    g.beginPath();
    g.moveTo(w / 2, fy);
    g.lineTo(w / 2, fy + fh);
    g.stroke();
    g.beginPath();
    g.arc(w / 2, h / 2, fh * 0.18, 0, Math.PI * 2);
    g.stroke();
    g.strokeRect(fx, h / 2 - fh * 0.18, 18, fh * 0.36);
    g.strokeRect(fx + fw - 18, h / 2 - fh * 0.18, 18, fh * 0.36);
    const bx = w / 2 + Math.sin(t * 0.9) * fw * 0.36, by = h / 2 + Math.sin(t * 1.7) * fh * 0.32;
    const robots = [[w / 2 - fw * 0.25 + Math.sin(t) * 20, h / 2 + Math.cos(t * 0.8) * 40], [w / 2 + fw * 0.25 + Math.cos(t * 0.7) * 20, h / 2 + Math.sin(t * 1.1) * 40]];
    robots.forEach(([rx, ry], i) => {
      g.strokeStyle = i ? CREMA : CREAM;
      g.save();
      g.translate(rx, ry);
      g.rotate(Math.atan2(by - ry, bx - rx));
      g.strokeRect(-12, -12, 24, 24);
      g.beginPath();
      g.moveTo(12, -6);
      g.lineTo(18, -6);
      g.moveTo(12, 6);
      g.lineTo(18, 6);
      g.stroke();
      g.restore();
    });
    g.fillStyle = CARAMEL;
    g.beginPath();
    g.arc(bx, by, 5, 0, Math.PI * 2);
    g.fill();
    label(g, 'LOCUS · YANTRA', fx, fy + fh + 22, CREMA);
  },
};

export function mountCardArt(canvas, kind) {
  const g = canvas.getContext('2d');
  let w = 0, h = 0, hover = false, visible = false, t = Math.random() * 10, raf = 0, last = 0;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    const d = Math.min(devicePixelRatio, 2);
    w = r.width; h = r.height;
    canvas.width = w * d; canvas.height = h * d;
    g.setTransform(d, 0, 0, d, 0, 0);
  };
  const draw = () => {
    g.clearRect(0, 0, w, h);
    grid(g, w, h);
    g.lineWidth = 1;
    DRAW[kind](g, w, h, t);
  };
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    t += dt * (hover ? 1 : 0.35);
    draw();
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  new ResizeObserver(() => { size(); draw(); }).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }).observe(canvas);
  canvas.closest('.card').addEventListener('pointerenter', () => (hover = true));
  canvas.closest('.card').addEventListener('pointerleave', () => (hover = false));
}

// rotating dashed wireframe of the espresso cup and saucer
export function mountWireCup(canvas) {
  const g = canvas.getContext('2d');
  const cup = [[0.0, 0.0], [0.62, 0.0], [0.8, 0.12], [0.94, 0.5], [1.0, 0.95], [1.04, 1.08]];
  const saucer = [[0, -0.12], [1.05, -0.12], [1.42, -0.03], [1.5, 0.03]];
  const rings = [];
  const ring = (prof, seg = 48) => {
    prof.forEach(([r, y]) => {
      const pts = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      rings.push(pts);
    });
    for (let m = 0; m < 12; m++) {
      const a = (m / 12) * Math.PI * 2;
      rings.push(prof.map(([r, y]) => [Math.cos(a) * r, y, Math.sin(a) * r]));
    }
  };
  ring(cup);
  ring(saucer);
  const handle = [];
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI / 2 + (i / 20) * Math.PI;
    handle.push([1.02 + Math.cos(a) * 0.38, 0.62 + Math.sin(a) * 0.3, 0]);
  }
  rings.push(handle);
  let w = 0, h = 0, t = 0, visible = false;
  const size = () => {
    const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2);
    w = r.width; h = r.height;
    canvas.width = w * d; canvas.height = h * d;
    g.setTransform(d, 0, 0, d, 0, 0);
  };
  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  const loop = () => {
    requestAnimationFrame(loop);
    if (!visible) return;
    t += 0.006;
    g.clearRect(0, 0, w, h);
    // grid
    g.strokeStyle = 'rgba(241,230,214,0.07)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const s = Math.min(w, h) * 0.3, ca = Math.cos(t), sa = Math.sin(t), tilt = 0.3, ct = Math.cos(tilt), st = Math.sin(tilt);
    const proj = ([x, y, z]) => {
      const X = x * ca - z * sa, Z = x * sa + z * ca;
      const Y = y * ct - Z * st, Z2 = y * st + Z * ct;
      const k = 3.2 / (3.2 + Z2);
      return [w / 2 + X * s * k, h * 0.7 - Y * s * k, Z2];
    };
    rings.forEach((pts, i) => {
      g.setLineDash(i % 3 ? [4, 4] : []);
      g.strokeStyle = i % 5 === 0 ? 'rgba(217,163,95,0.85)' : 'rgba(241,230,214,0.6)';
      g.beginPath();
      pts.forEach((p, j) => {
        const [x, y] = proj(p);
        j ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
    });
    g.setLineDash([]);
    // steam lines
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = `rgba(226,116,43,${0.5 - k * 0.12})`;
      g.beginPath();
      for (let i = 0; i <= 30; i++) {
        const y = 1.25 + i * 0.045;
        const x = (k - 1) * 0.3 + Math.sin(i * 0.35 + t * 6 + k) * 0.08;
        const [px, py] = proj([x, y, 0]);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
  };
  loop();
}
