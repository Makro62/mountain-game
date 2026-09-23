/**
 * Ghost run: rekam breadcrumb posisi selama pendakian (maks ±1200 titik,
 * tiap ~0,5 dtk), simpan best-run ke localStorage terpisah dari save game,
 * dan sediakan data untuk replay translucent berikutnya.
 *
 * Desain kecocokan ghost (dokumentasi):
 * - Mode standar: ghost tampil jika ghost.mode === "standar" (dunia/checkpoint
 *   selalu sama, hanya loot/cuaca yang berubah seed → jalur tetap valid).
 * - Mode harian: ghost tampil hanya jika ghost.seed === seed run sekarang
 *   (seed harian sama persis = replay yang adil; beda hari = beda layout).
 */

export const GHOST_KEY = "mountain-game-ghost";

const MAX_POINTS = 1200;
const RECORD_INTERVAL = 0.5;

export interface GhostSave {
  seed: number;
  mode: "standar" | "harian";
  timeMs: number;
  edelweiss: number;
  /** Flat [tDetik, x, y, z, ...] ter-round 1 desimal. */
  points: number[];
}

let buffer: number[] = [];
let elapsed = 0;
let sinceLast = RECORD_INTERVAL;

export function ghostReset(): void {
  buffer = [];
  elapsed = 0;
  sinceLast = RECORD_INTERVAL;
}

export function ghostRecord(dt: number, x: number, y: number, z: number): void {
  elapsed += dt;
  sinceLast += dt;
  if (sinceLast < RECORD_INTERVAL) return;
  sinceLast = 0;
  buffer.push(
    Math.round(elapsed * 10) / 10,
    Math.round(x * 10) / 10,
    Math.round(y * 10) / 10,
    Math.round(z * 10) / 10
  );
  if (buffer.length > MAX_POINTS * 4) {
    const drop = Math.floor(buffer.length / 8) * 4;
    buffer.splice(0, drop);
  }
}

export function ghostPoints(): number[] {
  return [...buffer];
}

export function ghostPointCount(): number {
  return buffer.length;
}

/** Jarak tempuh perkiraan (m) dari breadcrumb yang terekam. */
export function ghostDistance(): number {
  let d = 0;
  for (let i = 4; i < buffer.length; i += 4) {
    const dx = buffer[i + 1] - buffer[i - 3];
    const dy = buffer[i + 2] - buffer[i - 2];
    const dz = buffer[i + 3] - buffer[i - 1];
    d += Math.hypot(dx, dy, dz);
  }
  return d;
}

export function loadGhost(): GhostSave | null {
  try {
    const raw = localStorage.getItem(GHOST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GhostSave;
    if (!parsed || !Array.isArray(parsed.points) || parsed.points.length < 8) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Simpan buffer sebagai ghost bila lebih cepat dari ghost tersimpan. */
export function saveGhostIfBest(meta: { seed: number; mode: "standar" | "harian"; timeMs: number; edelweiss: number }): boolean {
  if (buffer.length < 8) return false;
  const existing = loadGhost();
  if (existing && existing.timeMs <= meta.timeMs) return false;
  const save: GhostSave = { ...meta, points: ghostPoints() };
  try {
    localStorage.setItem(GHOST_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearGhost(): void {
  try {
    localStorage.removeItem(GHOST_KEY);
  } catch {
    /* abaikan */
  }
}

/** Posisi ghost pada waktu t (detik) — interpolasi linear antar breadcrumb. */
export function ghostPosAt(points: number[], t: number): [number, number, number] | null {
  if (points.length < 4) return null;
  if (t <= points[0]) return [points[1], points[2], points[3]];
  const last = points.length - 4;
  if (t >= points[last]) return [points[last + 1], points[last + 2], points[last + 3]];
  for (let i = 0; i < last; i += 4) {
    const t0 = points[i];
    const t1 = points[i + 4];
    if (t >= t0 && t <= t1) {
      const u = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return [
        points[i + 1] + (points[i + 5] - points[i + 1]) * u,
        points[i + 2] + (points[i + 6] - points[i + 2]) * u,
        points[i + 3] + (points[i + 7] - points[i + 3]) * u,
      ];
    }
  }
  return [points[1], points[2], points[3]];
}
