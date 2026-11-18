// All sound is synthesised with Web Audio — no audio files, no network. Engine hum, police
// siren, gunshots, pickup chimes and a small ambient music loop are built from oscillators and
// filtered noise, and start only after a user gesture (browsers block audio before one).
const MUSIC_NOTES = [110, 130.81, 164.81, 196, 220, 164.81, 130.81, 98]; // A minor walk

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a low-pass, pitched by speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine whose pitch wails between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, seconds, type, volume, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  function startMusic() {
    if (!ctx || musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      musicStep += 1;
      // A soft bass note plus a fifth above it, one step each beat.
      blip(note, 0.9, 'triangle', 0.10);
      blip(note * 1.5, 0.7, 'sine', 0.05, 0.02);
      if (musicStep % 8 === 0) blip(note * 2, 1.4, 'sine', 0.04);
    }, 520);
  }

  return {
    /** Call from any user gesture (click / key) to unlock audio. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine hum follows the driven car's speed (0..1). Call every frame; 0 silences it. */
    setEngine(speed01, on) {
      if (!ctx) return;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    /** Police siren on while any wanted stars are up. */
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    gunshot() {
      if (!ctx || muted) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.12);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    },
    pickup() {
      if (!ctx) return;
      blip(660, 0.12, 'sine', 0.16);
      blip(990, 0.18, 'sine', 0.16, 0.08);
    },
    missionDone() {
      if (!ctx) return;
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.25, 'triangle', 0.14, i * 0.11));
    },
    busted() {
      if (!ctx) return;
      [392, 311, 233].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.10, i * 0.16));
    },
    click() {
      if (!ctx) return;
      blip(1200, 0.05, 'square', 0.06);
    },
    isStarted() {
      return started;
    },
  };
}
