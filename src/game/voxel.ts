import * as THREE from "three";
import {
  WORLD_BOUND,
  distToTrail,
  getBaseHeight,
  getHeight,
  getRiverDepth,
} from "./terrain";
import { mulberry32 } from "./modelKit";

/**
 * Lapisan voxel ala Minecraft di atas heightmap yang sudah ada.
 * - Dunia dirender sebagai tangga blok (BLOCK = 2 m), bukan lereng smooth.
 * - Fisika/gameplay TETAP memakai fungsi yang sama (getVoxelTop),
 *   jadi checkpoint, loot, dan save lama tetap valid (Y di-snap).
 * - File ini TIDAK boleh import store (hindari circular): edits selalu
 *   dioper sebagai parameter dari Player / VoxelWorld.
 */

export const BLOCK = 2;

/** Blok yang bisa dipasang pemain via hotbar. */
export const PLACEABLE_BLOCKS = ["grass", "dirt", "stone", "planks", "leaves"] as const;
export type BlockType =
  | "grass"
  | "dirt"
  | "stone"
  | "snow"
  | "sand"
  | "log"
  | "leaves"
  | "planks"
  | "water"
  | "riverbed";

export interface VoxelEdit {
  /** Delta tinggi dalam meter (kelipatan BLOCK). Negatif = digali. */
  dh: number;
  /** Warna blok hasil pasangan pemain (untuk place). */
  type?: BlockType;
}

export type VoxelEdits = Record<string, VoxelEdit>;

/** Kunci kolom grid dari posisi dunia. */
export function blockKey(bx: number, bz: number): string {
  return `${bx},${bz}`;
}

export function worldToBlock(x: number, z: number): [number, number] {
  return [Math.floor(x / BLOCK), Math.floor(z / BLOCK)];
}

export function blockToWorld(bx: number, bz: number): [number, number] {
  return [(bx + 0.5) * BLOCK, (bz + 0.5) * BLOCK];
}

/** Tinggi alami ter-quantize (tangga blok) TANPA edit pemain. */
export function blockTopNatural(x: number, z: number): number {
  const h = getHeight(x, z);
  return Math.max(0, Math.floor(h / BLOCK) * BLOCK);
}

/** Tinggi permukaan voxel SETELAH edit pemain (untuk fisika + render). */
export function getVoxelTop(x: number, z: number, edits?: VoxelEdits): number {
  const natural = blockTopNatural(x, z);
  if (!edits) return natural;
  const [bx, bz] = worldToBlock(x, z);
  const e = edits[blockKey(bx, bz)];
  if (!e) return natural;
  return Math.max(0, natural + e.dh);
}

/** Jenis blok permukaan alami (untuk warna instancing). */
export function topBlockType(x: number, z: number): BlockType {
  const h = getHeight(x, z);
  const rd = getRiverDepth(x, z);
  if (rd > 0.4) return "riverbed";
  const td = distToTrail(x, z);
  if (td < 2.4) return "dirt";
  if (h > 48) return "snow";
  if (h > 28) return "stone";
  if (h > 10) return "grass";
  return "sand";
}

/** Y permukaan air sungai (samakan dengan River lama). */
export function waterLevelY(x: number, z: number): number {
  return getBaseHeight(x, z) - 1.2;
}

/** Warna dasar tiap tipe blok (MC-ish, flat). */
export const BLOCK_COLORS: Record<BlockType, string> = {
  grass: "#5fae3f",
  dirt: "#8a5a33",
  stone: "#8d8d8d",
  snow: "#f2f6fa",
  sand: "#d9c48f",
  log: "#6b4a2b",
  leaves: "#2f7d32",
  planks: "#b07a3f",
  water: "#2f9fe0",
  riverbed: "#5b5348",
};

const _c = new THREE.Color();
/** Variasi warna deterministik per kolom agar tidak flat total. */
export function blockTint(type: BlockType, bx: number, bz: number): THREE.Color {
  const rand = mulberry32((bx + 500) * 73856093 ^ (bz + 500) * 19349663);
  const v = (rand() - 0.5) * 0.09;
  _c.set(BLOCK_COLORS[type]);
  _c.offsetHSL(0, 0, v * 0.5);
  return _c.clone();
}

/** Jumlah kolom per sisi untuk loop render. */
export function voxelGridRange(): number[] {
  const half = Math.floor(WORLD_BOUND / BLOCK);
  const out: number[] = [];
  for (let b = -half; b <= half; b++) out.push(b);
  return out;
}
