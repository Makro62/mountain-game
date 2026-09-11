import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  CHECKPOINTS,
  EDELWEISS,
  FORKS,
  JUMP_SPEED,
  LOOT_SPOTS,
  PICKUP_RADIUS,
  SNOW_LINE,
  SPRINT_SPEED,
  WALK_SPEED,
  clampWorld,
  getHeight,
  getSlope,
} from "./terrain";
import { useMountainStore } from "./store";
import { playerState } from "./playerRef";
import { playCheckpoint, playLose, playPickup, playStep, playTent, playWin, updateWind } from "./audio";

const STORMINESS: Record<string, number> = { cerah: 0, kabut: 0.3, hujan: 0.7, badai: 1 };
const CAM_DIST = 6.5;

export function Player() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const keys = useRef<Set<string>>(new Set());
  /** Posisi KAKI karakter. */
  const feet = useRef(new THREE.Vector3(0, 0, 150));
  const velY = useRef(0);
  const jumpH = useRef(0);
  /** Yaw kamera/orbit (0 = kamera di selatan, karakter menghadap utara). */
  const yaw = useRef(0);
  const pitch = useRef(0.08);
  const lastMouse = useRef(0);
  const camTarget = useRef(new THREE.Vector3());
  const syncTimer = useRef(0);
  const snowAnnounced = useRef(false);
  const forkMsg = useRef<{ name: string | null; at: number }>({ name: null, at: 0 });
  const prevCheckpoint = useRef(0);
  const prevScreen = useRef("playing");

  // Init dari save (store menyimpan posisi MATA → kaki = mata - 1.7)
  useEffect(() => {
    const p = useMountainStore.getState().playerPos;
    feet.current.set(p[0], p[1] - 1.7, p[2]);
    playerState.pos.copy(feet.current);
    playerState.faceYaw = Math.PI;
    playerState.moving = false;
    yaw.current = 0;
    pitch.current = 0.08;
    camera.position.set(p[0], p[1] + 3, p[2] + CAM_DIST);
    camera.lookAt(p[0], p[1], p[2]);
    prevCheckpoint.current = useMountainStore.getState().checkpointIndex;
    prevScreen.current = useMountainStore.getState().screen;
  }, [camera]);

  // Input keyboard (WASD + panah)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const st = useMountainStore.getState();
      if (st.screen === "playing" && ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      keys.current.add(e.code);
      if (st.screen !== "playing") return;
      if (e.code === "Digit1") st.useItem("bekal");
      if (e.code === "Digit2") st.useItem("jaket");
      if (e.code === "Digit3") st.useItem("p3k");
      if (e.code === "Digit4") st.useItem("oksigen");
      if (e.code === "KeyE") {
        // Petik edelweiss terdekat dulu
        const ed = EDELWEISS.find(
          (w) =>
            !st.edelweiss.includes(w.id) &&
            Math.hypot(st.playerPos[0] - w.x, st.playerPos[2] - w.z) < PICKUP_RADIUS + 0.5
        );
        if (ed) {
          st.collectEdelweiss(ed.id);
          playPickup();
          return;
        }
        const p = st.playerPos;
        const near = CHECKPOINTS.some((cp) => {
          const d = Math.hypot(p[0] - cp.x, p[2] - cp.z);
          return d < cp.radius + 2;
        });
        if (near) {
          st.buildTent();
          playTent();
        } else {
          st.showMessage("Harus di area pos untuk mendirikan tenda.");
        }
      }
      if (e.code === "Escape") st.pause();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  // Mouse-look saat pointer terkunci (orbit kamera third-person)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      if (useMountainStore.getState().screen !== "playing") return;
      lastMouse.current = performance.now();
      yaw.current -= e.movementX * 0.0025;
      pitch.current = Math.max(-0.45, Math.min(0.9, pitch.current - e.movementY * 0.0022));
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [gl]);

  // Klik kanvas = kunci pointer
  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      if (useMountainStore.getState().screen === "playing") {
        try {
          (el as HTMLCanvasElement).requestPointerLock();
        } catch {
          /* abaikan */
        }
      }
    };
    // Lepas pointer (Esc/Alt-Tab) saat main = pause otomatis
    const onLockChange = () => {
      if (document.pointerLockElement !== el && useMountainStore.getState().screen === "playing") {
        useMountainStore.getState().pause();
      }
    };
    el.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      el.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, [gl]);

  useFrame((_state, rawDelta) => {
    const st = useMountainStore.getState();
    if (st.screen !== "playing") return;
    const dt = Math.min(rawDelta, 0.1);

    // Efek transisi checkpoint / menang / kalah
    const screenNow: string = st.screen;
    if (st.checkpointIndex !== prevCheckpoint.current) {
      prevCheckpoint.current = st.checkpointIndex;
      const cp = CHECKPOINTS[st.checkpointIndex];
      if (cp && cp.id === "puncak") playWin();
      else playCheckpoint();
    }
    if (screenNow !== prevScreen.current) {
      prevScreen.current = screenNow;
      if (screenNow === "lost") playLose();
      if (screenNow === "won") playWin();
    }

    const k = keys.current;
    const fwd =
      (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const strafe =
      (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const moving = fwd !== 0 || strafe !== 0;
    const sprinting = (k.has("ShiftLeft") || k.has("ShiftRight")) && moving && st.stamina > 1;

    // Arah dunia dari yaw kamera: maju = (-sin, -cos), kanan = (cos, -sin)
    const sin = Math.sin(yaw.current);
    const cos = Math.cos(yaw.current);
    // Salju dalam memperlambat gerak (acuan mata, sama seperti store)
    const snowSlow = feet.current.y + 1.7 > SNOW_LINE ? 0.85 : 1;
    const speed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * snowSlow;

    let mx = 0;
    let mz = 0;
    if (moving) {
      mx = -sin * fwd + cos * strafe;
      mz = -cos * fwd - sin * strafe;
      const len = Math.hypot(mx, mz) || 1;
      mx = (mx / len) * speed * dt;
      mz = (mz / len) * speed * dt;
    }

    const px = clampWorld(feet.current.x + mx);
    const pz = clampWorld(feet.current.z + mz);
    const slope = getSlope(px, pz);
    const steep = slope > 0.55;

    // Lompat + gravitasi (offset dari tanah)
    const ground = getHeight(px, pz);
    const grounded = jumpH.current <= 0;
    if (k.has("Space") && grounded && st.stamina > 5) {
      velY.current = JUMP_SPEED;
    }
    velY.current -= 12 * dt;
    jumpH.current += velY.current * dt;
    if (jumpH.current <= 0) {
      jumpH.current = 0;
      velY.current = 0;
    }
    const feetY = ground + jumpH.current;
    feet.current.set(px, feetY, pz);

    // Peringatan sekali saat memasuki zona salju
    if (feetY > SNOW_LINE && !snowAnnounced.current) {
      snowAnnounced.current = true;
      st.showMessage("❄️ Memasuki zona salju! Jaga suhu tubuh, cari edelweiss.");
    } else if (feetY <= SNOW_LINE - 3) {
      snowAnnounced.current = false;
    }

    // Share ke visual Hiker
    playerState.pos.copy(feet.current);
    playerState.moving = moving;
    if (moving) playerState.faceYaw = Math.atan2(mx, mz);

    // Kamera otomatis membuntuti arah jalan bila mouse diam >1,5 dtk.
    // HANYA saat maju murni (tanpa strafe) agar tidak melawan pemain,
    // dan berhenti total (snap) saat selisih < 1° agar tidak muter terus.
    // Catatan: forward kamera = (-sin yaw, -cos yaw), jadi yaw target =
    // atan2(-mx, -mz) — BUKAN atan2(mx, mz) (itu untuk model yg menghadap +Z).
    if (fwd > 0 && strafe === 0 && performance.now() - lastMouse.current > 1500) {
      const target = Math.atan2(-mx, -mz);
      let diff = (target - yaw.current) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      yaw.current = Math.abs(diff) < 0.02 ? target : yaw.current + diff * Math.min(1, dt * 1.1);
    }

    // Kamera follow di belakang karakter
    const cp = Math.cos(pitch.current);
    const sp = Math.sin(pitch.current);
    const tx = px;
    const ty = feetY + 1.6;
    const tz = pz;
    const csin = Math.sin(yaw.current);
    const ccos = Math.cos(yaw.current);
    const cx = tx + csin * cp * CAM_DIST;
    const cz = tz + ccos * cp * CAM_DIST;
    const cy = Math.max(ty + 1.6 - sp * CAM_DIST, getHeight(cx, cz) + 0.6);
    camTarget.current.set(cx, cy, cz);
    camera.position.lerp(camTarget.current, 1 - Math.exp(-12 * dt));
    camera.lookAt(tx, ty + sp * 2.5, tz);

    // Survival tick
    st.tick(dt, moving, sprinting, steep);

    // Checkpoint & loot
    const cur = useMountainStore.getState();
    CHECKPOINTS.forEach((cpt, i) => {
      if (i <= cur.checkpointIndex) return;
      const d = Math.hypot(px - cpt.x, pz - cpt.z);
      if (d < cpt.radius) cur.unlockCheckpoint(i);
    });
    LOOT_SPOTS.forEach((l) => {
      if (cur.collectedLoot.includes(l.id)) return;
      const d = Math.hypot(px - l.x, pz - l.z);
      if (d < PICKUP_RADIUS) {
        cur.collectLoot(l.id, l.item);
        playPickup();
      }
    });

    // Pemandu persimpangan (sekali per simpang per 20 detik)
    const nowMs = performance.now();
    for (const f of FORKS) {
      if (Math.hypot(px - f.x, pz - f.z) < 13) {
        if (forkMsg.current.name !== f.name || nowMs - forkMsg.current.at > 20000) {
          forkMsg.current = { name: f.name, at: nowMs };
          cur.showMessage(`🪧 ${f.name}: hijau = ${f.main} • oranye = ${f.alt}!`);
        }
        break;
      }
    }

    if (moving && grounded) playStep();
    const storm = STORMINESS[cur.weather] ?? 0;
    updateWind(feetY + 1.7, storm);

    // Mirror ke store 10 Hz (posisi MATA agar save lama tetap kompatibel)
    syncTimer.current += dt;
    if (syncTimer.current > 0.1) {
      syncTimer.current = 0;
      cur.setPlayerPos([px, feetY + 1.7, pz]);
    }
  });

  return null;
}
