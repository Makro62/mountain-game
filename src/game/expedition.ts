/**
 * Mode Ekspedisi: seed deterministik (mulberry32 dari modelKit) yang
 * memodulasi loot opsional, cuaca awal, dan modifier rasa — CHECKPOINTS
 * dan jalur utama TIDAK pernah diubah agar run tetap bisa dimenangkan.
 */

import { mulberry32 } from "./modelKit";
import { LOOT_SPOTS, type ItemId } from "./terrain";
import type { Weather } from "./store";

export type GameMode = "standar" | "harian";

export interface ExpeditionPlan {
  activeLoot: string[];
  startWeather: Weather;
  modifiers: string[];
}

const BASE_WEATHERS: Weather[] = ["cerah", "cerah", "cerah", "kabut", "hujan", "badai"];

const MODIFIER_POOL = ["Kabut Tebal", "Badai Sore", "Jalur Lembap", "Langit Terbuka"] as const;

/** FNV-1a 32-bit — hash string seed harian jadi uint32. */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** String seed harian (waktu lokal): "2026-09-23". */
export function dailySeedString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Kode seed untuk HUD: "#A3F2" (16 bit rendah, hex kapital). */
export function seedCode(seed: number): string {
  return `#${(seed & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

/** Seed acak untuk Ekspedisi Standar (tidak pernah 0 = penanda save lama). */
export function randomSeed(): number {
  return ((Math.random() * 0xffffffff) >>> 0) || 1;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pool cuaca dengan bias dari modifier. */
export function weatherPoolFor(modifiers: string[]): Weather[] {
  const pool = [...BASE_WEATHERS];
  if (modifiers.includes("Kabut Tebal")) pool.push("kabut", "kabut");
  if (modifiers.includes("Badai Sore")) pool.push("badai", "badai");
  if (modifiers.includes("Jalur Lembap")) pool.push("hujan", "hujan");
  if (modifiers.includes("Langit Terbuka")) pool.push("cerah", "cerah", "cerah");
  return pool;
}

/** Loot aktif untuk seed. seed === 0 (save lama) = semua loot tampil. */
export function activeLootIds(seed: number): string[] {
  if (seed === 0) return LOOT_SPOTS.map((l) => l.id);
  const rand = mulberry32(seed);
  const count = 7 + Math.floor(rand() * 3);
  const picked = new Set(shuffle(LOOT_SPOTS, rand).slice(0, count).map((l) => l.id));

  const cores: ItemId[] = ["bekal", "p3k", "oksigen"];
  for (const core of cores) {
    const has = LOOT_SPOTS.some((l) => picked.has(l.id) && l.item === core);
    if (has) continue;
    const candidates = shuffle(
      LOOT_SPOTS.filter((l) => l.item === core),
      rand
    );
    if (candidates[0]) picked.add(candidates[0].id);
  }
  return LOOT_SPOTS.filter((l) => picked.has(l.id)).map((l) => l.id);
}

/** Roll rencana ekspedisi dari seed (deterministik). */
export function rollExpedition(seed: number): ExpeditionPlan {
  if (seed === 0) {
    return { activeLoot: LOOT_SPOTS.map((l) => l.id), startWeather: "cerah", modifiers: [] };
  }
  const rand = mulberry32(seed);
  const count = rand() < 0.5 ? 1 : 2;
  const modifiers = shuffle([...MODIFIER_POOL], rand).slice(0, count);
  const pool = weatherPoolFor(modifiers);
  const startWeather = pool[Math.floor(rand() * pool.length)];
  return { activeLoot: activeLootIds(seed), startWeather, modifiers };
}
