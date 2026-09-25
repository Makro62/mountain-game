/**
 * Audio prosedural 100% lokal — tanpa file eksternal.
 * Angin + SFX disintesis via Web Audio API.
 */

let ctx: AudioContext | null = null;
let windGain: GainNode | null = null;
let windFilter: BiquadFilterNode | null = null;
let lastStep = 0;
/** Cache mute — di-sync dari store supaya tidak parse localStorage tiap frame. */
let mutedFlag: boolean | undefined;

export function syncMute(v: boolean): void {
  mutedFlag = v;
}

function ensureCtx(): AudioContext | null {
  try {
    if (ctx) {
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      return ctx;
    }
    const AC = window.AudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

function muted(): boolean {
  if (mutedFlag !== undefined) return mutedFlag;
  try {
    const raw = localStorage.getItem("mountain-game-storage");
    const parsed = raw ? (JSON.parse(raw) as { state?: { muted?: boolean } }) : null;
    mutedFlag = parsed?.state?.muted === true;
  } catch {
    mutedFlag = false;
  }
  return mutedFlag;
}

function tone(freqFrom: number, freqTo: number, dur: number, type: OscillatorType, gain = 0.15, when = 0): void {
  const ac = ensureCtx();
  if (!ac || muted()) return;
  try {
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    /* abaikan */
  }
}

export type Surface = "grass" | "snow" | "rock" | "wood" | "water";

interface SurfaceParams {
  dur: number;
  cutoff: number;
  type: BiquadFilterType;
  gain: number;
  q: number;
}

const SURFACE_PARAMS: Record<Surface, SurfaceParams> = {
  grass: { dur: 0.12, cutoff: 500, type: "lowpass", gain: 0.12, q: 0.7 },
  snow: { dur: 0.16, cutoff: 1400, type: "lowpass", gain: 0.09, q: 0.5 },
  rock: { dur: 0.08, cutoff: 2200, type: "bandpass", gain: 0.13, q: 1.2 },
  wood: { dur: 0.1, cutoff: 350, type: "bandpass", gain: 0.16, q: 4 },
  water: { dur: 0.18, cutoff: 900, type: "lowpass", gain: 0.1, q: 0.6 },
};

export function playStep(surface: Surface = "grass"): void {
  const now = performance.now();
  if (now - lastStep < 350) return;
  lastStep = now;
  const ac = ensureCtx();
  if (!ac || muted()) return;
  try {
    const p = SURFACE_PARAMS[surface];
    const buffer = ac.createBuffer(1, ac.sampleRate * p.dur, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const f = ac.createBiquadFilter();
    f.type = p.type;
    f.frequency.value = p.cutoff;
    f.Q.value = p.q;
    const g = ac.createGain();
    g.gain.value = p.gain;
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
    if (surface === "wood") tone(180, 90, 0.08, "sine", 0.06);
    if (surface === "water") tone(520, 260, 0.14, "sine", 0.05);
  } catch {
    /* abaikan */
  }
}

export function playPickup(): void {
  tone(660, 880, 0.15, "sine", 0.15);
  tone(880, 1320, 0.15, "sine", 0.12, 0.08);
}

export function playCheckpoint(): void {
  tone(523, 523, 0.2, "triangle", 0.16);
  tone(659, 659, 0.2, "triangle", 0.16, 0.12);
  tone(784, 784, 0.3, "triangle", 0.16, 0.24);
}

export function playWin(): void {
  tone(523, 523, 0.2, "triangle", 0.18);
  tone(659, 659, 0.2, "triangle", 0.18, 0.15);
  tone(784, 784, 0.2, "triangle", 0.18, 0.3);
  tone(1047, 1047, 0.5, "triangle", 0.18, 0.45);
}

export function playLose(): void {
  tone(300, 150, 0.6, "sawtooth", 0.12);
}

export function playRock(): void {
  tone(160, 55, 0.35, "sawtooth", 0.22);
  tone(90, 40, 0.4, "square", 0.1, 0.05);
}

export function playTent(): void {
  tone(400, 600, 0.2, "sine", 0.14);
}

/** Guntur badai: ledakan noise pendek + guncangan frekuensi rendah. */
export function playThunder(): void {
  const ac = ensureCtx();
  if (!ac || muted()) return;
  try {
    const dur = 0.25;
    const buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 400;
    const g = ac.createGain();
    g.gain.value = 0.35;
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
    const dur2 = 1.4;
    const buffer2 = ac.createBuffer(1, ac.sampleRate * dur2, ac.sampleRate);
    const data2 = buffer2.getChannelData(0);
    for (let i = 0; i < data2.length; i++) data2[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data2.length, 2.5);
    const src2 = ac.createBufferSource();
    src2.buffer = buffer2;
    const f2 = ac.createBiquadFilter();
    f2.type = "lowpass";
    f2.frequency.value = 120;
    const g2 = ac.createGain();
    g2.gain.value = 0.3;
    src2.connect(f2).connect(g2).connect(ac.destination);
    src2.start(0.12);
  } catch {
    /* abaikan */
  }
  tone(70, 40, 1.2, "sine", 0.1, 0.1);
}

/** Catatan lore dibaca: chime halus seperti halaman dibalik. */
export function playNote(): void {
  tone(740, 660, 0.12, "sine", 0.1);
  tone(988, 880, 0.18, "sine", 0.08, 0.1);
}

/** Rana kamera: klik pendek dua nada + noise. */
export function playShutter(): void {
  tone(1800, 900, 0.04, "square", 0.06);
  tone(1200, 700, 0.05, "square", 0.05, 0.06);
  const ac = ensureCtx();
  if (!ac || muted()) return;
  try {
    const dur = 0.03;
    const buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain();
    g.gain.value = 0.12;
    src.connect(g).connect(ac.destination);
    src.start(0.05);
  } catch {
    /* abaikan */
  }
}

/** Bunyi blok dihancurkan: noise kasar pendek (ala gali tanah MC). */
export function playBreak(): void {
  const ac = ensureCtx();
  if (!ac || muted()) return;
  try {
    const dur = 0.14;
    const buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const g = ac.createGain();
    g.gain.value = 0.2;
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
  } catch {
    /* abaikan */
  }
  tone(220, 90, 0.12, "square", 0.08);
}

/** Bunyi blok dipasang: klik kotak pendek. */
export function playPlace(): void {
  tone(300, 180, 0.09, "square", 0.12);
  tone(450, 300, 0.07, "square", 0.07, 0.04);
}

/** Loop angin — gain diatur per frame dari ketinggian & cuaca. */
export function updateWind(altitude: number, storminess: number): void {
  if (muted()) {
    if (windGain) windGain.gain.value = 0;
    return;
  }
  const ac = ensureCtx();
  if (!ac) return;
  try {
    if (!windGain || !windFilter) {
      const len = ac.sampleRate * 2;
      const buffer = ac.createBuffer(1, len, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      windFilter = ac.createBiquadFilter();
      windFilter.type = "lowpass";
      windFilter.frequency.value = 500;
      windGain = ac.createGain();
      windGain.gain.value = 0.0;
      src.connect(windFilter).connect(windGain).connect(ac.destination);
      src.start();
    }
    const target = Math.min(0.2, 0.02 + altitude / 60 * 0.08 + storminess * 0.1);
    windGain.gain.setTargetAtTime(target, ac.currentTime, 0.5);
  } catch {
    /* abaikan */
  }
}

/** Matikan loop angin (pause/menu) — gain di-ramp ke 0. */
export function stopWind(): void {
  if (!windGain) return;
  try {
    if (ctx) windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    else windGain.gain.value = 0;
  } catch {
    windGain.gain.value = 0;
  }
}
