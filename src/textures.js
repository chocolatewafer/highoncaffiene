// Canvas-made textures: no image files to download.
import * as THREE from 'three';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
};

// small value noise for grain patterns
function makeNoise(seed = 1) {
  const p = new Uint8Array(512);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const perm = [...Array(256).keys()].sort(() => rnd() - 0.5);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const h = (x, y) => p[(p[x & 255] + y) & 511] / 255;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export function woodTexture() {
  const W = 2048, H = 1024;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  const n = makeNoise(7), n2 = makeNoise(13);
  const planks = 5;
  for (let y = 0; y < H; y++) {
    const plank = Math.floor((y / H) * planks);
    const py = (y / H) * planks - plank;
    const shift = plank * 731.7;
    const tint = 0.86 + n2(plank * 3.1, 0.5) * 0.28;
    for (let x = 0; x < W; x++) {
      const wx = x + shift;
      const warp = n(wx * 0.004, y * 0.02) * 9 + n(wx * 0.02, y * 0.08) * 1.5;
      const grain = Math.sin((py * 34 + warp) * Math.PI);
      const fine = n2(wx * 0.6, y * 0.05);
      let v = 0.55 + grain * 0.16 + (fine - 0.5) * 0.22;
      v *= tint;
      if (py < 0.006 || py > 0.994) v *= 0.35; // plank seam
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, 92 * v + 10);
      img.data[i + 1] = Math.min(255, 52 * v + 5);
      img.data[i + 2] = Math.min(255, 30 * v + 3);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function plasterTexture(name) {
  const W = 4096, H = 1600;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  const n = makeNoise(3), n2 = makeNoise(9);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = 0.75 + (n(x * 0.004, y * 0.004) - 0.5) * 0.35 + (n2(x * 0.06, y * 0.06) - 0.5) * 0.12;
      const i = (y * W + x) * 4;
      img.data[i] = 44 * v; img.data[i + 1] = 30 * v; img.data[i + 2] = 22 * v; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // painted name, slightly worn
  g.save();
  g.font = `600 ${H * 0.36}px "Schibsted Grotesk", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(214,170,120,0.28)';
  g.fillText(name, W / 2, H * 0.66);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.5})`;
    g.fillRect(Math.random() * W, Math.random() * H, Math.random() * 6 + 1, Math.random() * 3 + 1);
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// gauge face: values 0..max over a 270° sweep starting lower-left
export function dialTexture({ max, step, label, red = null, sub = 'BAR' }) {
  const S = 512;
  const [c, g] = canvas(S, S);
  const cx = S / 2, cy = S / 2, R = S * 0.46;
  const grd = g.createRadialGradient(cx, cy * 0.8, 10, cx, cy, R * 1.1);
  grd.addColorStop(0, '#f6efe2');
  grd.addColorStop(1, '#d8cbb5');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  const ang = (v) => a0 + (v / max) * sweep;
  if (red) {
    g.strokeStyle = '#b8401a';
    g.lineWidth = 16;
    g.beginPath();
    g.arc(cx, cy, R * 0.83, ang(red[0]), ang(red[1]));
    g.stroke();
  }
  g.strokeStyle = '#2a1a12';
  g.fillStyle = '#2a1a12';
  for (let v = 0; v <= max + 1e-6; v += step / 5) {
    const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    const a = ang(v);
    const r1 = R * (major ? 0.74 : 0.8), r2 = R * 0.9;
    g.lineWidth = major ? 5 : 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    g.stroke();
    if (major) {
      g.font = '600 34px "Geist Mono", ui-monospace, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(Math.round(v)), cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6);
    }
  }
  g.font = '700 30px "Schibsted Grotesk", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(label, cx, cy + R * 0.42);
  g.font = '500 22px "Geist Mono", monospace';
  g.fillStyle = '#7a5a40';
  g.fillText(sub, cx, cy + R * 0.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // glTF uv convention
  t.anisotropy = 8;
  return t;
}

// crema seen from above: hazel centre, darker tiger-striped ring, a pale lip where it climbs the cup,
// marbled with fine bubbles. Drawn in polar coordinates with warped noise so it swirls like the real thing.
export function cremaTexture() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  const n1 = makeNoise(5), n2 = makeNoise(17), n3 = makeNoise(29);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = [
    [0.0, [196, 146, 92]],
    [0.45, [176, 118, 66]],
    [0.72, [140, 84, 42]],
    [0.88, [92, 50, 22]],
    [0.955, [120, 72, 36]],
    [1.0, [168, 118, 72]],
  ];
  const col = (t) => {
    for (let i = 0; i < ramp.length - 1; i++) {
      const [a, ca] = ramp[i], [b, cb] = ramp[i + 1];
      if (t <= b) {
        const k = (t - a) / (b - a);
        return [lerp(ca[0], cb[0], k), lerp(ca[1], cb[1], k), lerp(ca[2], cb[2], k)];
      }
    }
    return ramp[ramp.length - 1][1];
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x / S - 0.5) * 2, dy = (y / S - 0.5) * 2;
      const r = Math.sqrt(dx * dx + dy * dy);
      const a = Math.atan2(dy, dx);
      // domain-warped swirl
      const wx = n1(dx * 3 + 10, dy * 3) * 2, wy = n1(dx * 3, dy * 3 + 20) * 2;
      const swirl = n2(dx * 5 + wx, dy * 5 + wy);
      // tiger flecks: thin radial streaks, strongest in the outer ring
      const streak = n3(a * 40, r * 6);
      let t = r + (swirl - 0.5) * 0.18;
      t = Math.min(1, Math.max(0, t));
      let [R, G, B] = col(t);
      const tiger = Math.max(0, streak - 0.55) * 2.2 * smooth(0.45, 0.9, r);
      R *= 1 - tiger * 0.35; G *= 1 - tiger * 0.42; B *= 1 - tiger * 0.5;
      const marble = (n2(dx * 14 + wx * 2, dy * 14 + wy * 2) - 0.5) * 26;
      R += marble; G += marble * 0.8; B += marble * 0.55;
      const i = (y * S + x) * 4;
      img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // micro bubbles: tiny light rims with dark middles, denser near the edge
  for (let i = 0; i < 2600; i++) {
    const r = Math.pow(Math.random(), 0.6) * 0.48 * S, a = Math.random() * Math.PI * 2;
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    const s = Math.random() < 0.92 ? 0.6 + Math.random() * 1.2 : 2 + Math.random() * 2.5;
    g.fillStyle = `rgba(235,200,150,${0.25 + Math.random() * 0.25})`;
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(70,35,12,0.45)';
    g.beginPath(); g.arc(x + s * 0.15, y + s * 0.15, s * 0.55, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.anisotropy = 8;
  return t;
}
function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function softDot(ring = false) {
  const S = 128;
  const [c, g] = canvas(S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  if (ring) {
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.82, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.92, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function puffTexture() {
  const S = 256;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  const n = makeNoise(21);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x / S - 0.5, dy = y / S - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const f = n(x * 0.035, y * 0.035) * 0.6 + n(x * 0.09, y * 0.09) * 0.4;
      const a = Math.max(0, 1 - d) ** 1.6 * (0.4 + f * 0.9);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}
