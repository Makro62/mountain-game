import { useEffect, type RefObject } from "react";
import * as THREE from "three";

/**
 * Kit bersama untuk model prosedural:
 * - lerpAngle: lerp sudut dengan wrap-around (sebelumnya diduplikasi di Hiker & Animals)
 * - mulberry32: RNG deterministik (sebelumnya diduplikasi di Trees & Flowers)
 * - useShadows: aktifkan castShadow ke seluruh mesh dalam grup
 * - sharedMat: cache material per warna agar tidak ratusan instance duplikat
 */

/** Lerp sudut dengan wrap-around [-PI, PI]. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** RNG deterministik agar scatter alam sama setiap dibuka. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nyalakan castShadow untuk semua mesh di dalam grup ref. */
export function useShadows(ref: RefObject<THREE.Object3D | null>, receive = false): void {
  useEffect(() => {
    ref.current?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        if (receive) m.receiveShadow = true;
      }
    });
  }, [ref, receive]);
}

interface MatExtra {
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  side?: THREE.Side;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Material bersama per kombinasi warna — hemat instance & state change GPU. */
export function sharedMat(
  color: string,
  roughness = 0.9,
  extra?: MatExtra
): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${extra?.emissive}|${extra?.emissiveIntensity}|${extra?.metalness}|${extra?.side}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: extra?.metalness ?? 0,
      emissive: extra?.emissive ?? "#000000",
      emissiveIntensity: extra?.emissiveIntensity ?? 1,
      side: extra?.side ?? THREE.FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
}
