import * as THREE from "three";

/**
 * Status pemain yang di-share per-frame (60fps) antara logika (Player)
 * dan visual (Hiker) tanpa memicu re-render React.
 * `pos` = posisi KAKI karakter (bukan mata seperti store.playerPos).
 */
export const playerState = {
  pos: new THREE.Vector3(0, 0, 150),
  /** Arah hadap karakter (radian, 0 = +Z). Diupdate saat bergerak. */
  faceYaw: Math.PI,
  moving: false,
  /** Kecepatan horizontal (m/s) — dipakai stride kaki Hiker. */
  speed: 0,
  /** True bila menempel tanah (pose lompat & auto-step). */
  grounded: true,
  /** Lean badan mengikuti kemiringan tanjakan (radian, clamp ±0.35). */
  lean: 0,
};
