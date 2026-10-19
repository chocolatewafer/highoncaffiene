// Synthesised café sound: room hum, pump buzz, pour trickle, steam hiss. No audio files.
export function createSound() {
  let ctx = null, master, pumpGain, pourGain, steamGain, roomGain, on = false;

  function noiseBuffer(c, seconds = 2, brown = false) {
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return b;
  }
  function loopNoise(brown) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, 3, brown);
    s.loop = true;
    s.start();
    return s;
  }

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    roomGain = ctx.createGain();
    roomGain.gain.value = 0.22;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    loopNoise(true).connect(lp).connect(roomGain).connect(master);

    // vibratory pump: low buzz
    pumpGain = ctx.createGain();
    pumpGain.gain.value = 0;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o1.frequency.value = 50;
    o2.type = 'square'; o2.frequency.value = 100;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 240;
    o1.connect(pf); o2.connect(g2).connect(pf);
    pf.connect(pumpGain).connect(master);
    o1.start(); o2.start();

    // pour: band-passed noise
    pourGain = ctx.createGain();
    pourGain.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9;
    loopNoise(false).connect(bp).connect(pourGain).connect(master);

    // steam: bright hiss
    steamGain = ctx.createGain();
    steamGain.gain.value = 0;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
    loopNoise(false).connect(hp).connect(steamGain).connect(master);
  }

  const set = (g, v, tc = 0.08) => g && g.gain.setTargetAtTime(v, ctx.currentTime, tc);

  return {
    get on() { return on; },
    enable() {
      if (!ctx) init();
      ctx.resume();
      on = true;
      set(master, 0.7, 0.6);
    },
    disable() {
      on = false;
      if (ctx) set(master, 0, 0.3);
    },
    toggle() { on ? this.disable() : this.enable(); return on; },
    // flow 0..1 while the shot pulls, steam 0..1
    update({ pump = 0, pour = 0, steam = 0 }) {
      if (!ctx || !on) return;
      set(pumpGain, pump * 0.09);
      set(pourGain, pour * (0.05 + Math.random() * 0.03), 0.05);
      set(steamGain, steam * 0.07, 0.05);
    },
  };
}
