import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  BRIDGE,
  CHECKPOINTS,
  EDELWEISS,
  FORKS,
  getHeight,
  getRiverDepth,
  JUMP_SPEED,
  LOOT_SPOTS,
  NOTES,
  PICKUP_RADIUS,
  SNOW_LINE,
  SPRINT_SPEED,
  WALK_SPEED,
  clampWorld,
  getSlope,
} from "./terrain";
import { BLOCK, PLACEABLE_BLOCKS, getVoxelTop, topBlockType } from "./voxel";
import { useMountainStore } from "./store";
import { playerState } from "./playerRef";
import { playCheckpoint, playLose, playNote, playPickup, playShutter, playStep, playTent, playWin, updateWind, type Surface } from "./audio";
import { activeLootIds } from "./expedition";
import { ghostRecord } from "./ghost";
import { photoTargets } from "./Animals";
import { PROP_COLLIDERS } from "./colliders";

const STORMINESS: Record<string, number> = { cerah: 0, kabut: 0.3, hujan: 0.7, badai: 1 };
const CAM_DIST = 6.5;
const GRAVITY = 12;
const ACCEL = 14;
const DECEL = 12;
const PLAYER_RADIUS = 0.35;
const DECK_TOP_OFFSET = 0.12;

function surfaceAt(x: number, z: number, eyeY: number): Surface {
  if (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 5) return "wood";
  if (getRiverDepth(x, z) > 0.25) return "water";
  if (eyeY > SNOW_LINE) return "snow";
  const t = topBlockType(x, z);
  if (t === "stone" || t === "riverbed") return "rock";
  return "grass";
}

export function Player() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const keys = useRef<Set<string>>(new Set());
  /** Posisi KAKI karakter (logika fisika, Y quantize voxel). */
  const feet = useRef(new THREE.Vector3(0, 0, 150));
  const velY = useRef(0);
  const grounded = useRef(true);
  const vel = useRef(new THREE.Vector2());
  const dispY = useRef(0);
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
  const seed = useMountainStore((s) => s.seed);
  const activeLoot = useMemo(() => new Set(activeLootIds(seed)), [seed]);

  // Init dari save (store menyimpan posisi MATA → kaki = mata - 1.7, snap ke voxel)
  useEffect(() => {
    const st0 = useMountainStore.getState();
    const p = st0.playerPos;
    const snapped = getVoxelTop(p[0], p[2], st0.edits);
    feet.current.set(p[0], Math.max(p[1] - 1.7, snapped), p[2]);
    playerState.pos.copy(feet.current);
    playerState.faceYaw = Math.PI;
    playerState.moving = false;
    playerState.speed = 0;
    playerState.grounded = true;
    playerState.lean = 0;
    vel.current.set(0, 0);
    velY.current = 0;
    grounded.current = true;
    dispY.current = feet.current.y;
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
      if (st.openNote) {
        if (e.code === "KeyE" || e.code === "Escape") st.closeNote();
        return;
      }
      if (st.screen === "playing" && ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      keys.current.add(e.code);
      if (st.screen !== "playing") return;
      if (e.code === "Digit1") st.useItem("bekal");
      if (e.code === "Digit2") st.useItem("jaket");
      if (e.code === "Digit3") st.useItem("p3k");
      if (e.code === "Digit4") st.useItem("oksigen");
      if (e.code === "KeyQ") st.useItem("tali");
      if (e.code === "KeyR") st.useItem("kompas");
      if (e.code === "KeyT") st.useItem("termos");
      if (e.code === "KeyG") st.useItem("peluit");
      if (e.code === "Digit5") st.setSelectedBlock(PLACEABLE_BLOCKS[0]);
      if (e.code === "Digit6") st.setSelectedBlock(PLACEABLE_BLOCKS[1]);
      if (e.code === "Digit7") st.setSelectedBlock(PLACEABLE_BLOCKS[2]);
      if (e.code === "Digit8") st.setSelectedBlock(PLACEABLE_BLOCKS[3]);
      if (e.code === "Digit9") st.setSelectedBlock(PLACEABLE_BLOCKS[4]);
      if (e.code === "KeyV") {
        st.toggleBuildMode();
        st.showMessage(st.buildMode ? "⛏️ Mode build MATI." : "🧱 Mode build NYALA: klik kiri hancurkan, kanan pasang.");
      }
      if (e.code === "KeyF") {
        const p = st.playerPos;
        let best: (typeof photoTargets)[number] | null = null;
        let bestD = 6;
        for (const t of photoTargets) {
          const horiz = Math.hypot(t.x - p[0], t.z - p[2]);
          const vert = Math.abs(t.y - p[1]);
          if (horiz < 6 && vert < 8 && horiz < bestD) {
            best = t;
            bestD = horiz;
          }
        }
        if (best) {
          if (!st.photosTaken.includes(best.id)) playShutter();
          st.takePhoto(best.id);
        } else {
          st.showMessage("📷 Tidak ada satwa dalam jarak foto (horizontal ≤6 m, beda tinggi <8 m). Cari rusa di zona rendah.");
        }
      }
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
        // Catatan lore terdekat
        const note = NOTES.find(
          (n) => !st.openNote && Math.hypot(st.playerPos[0] - n.x, st.playerPos[2] - n.z) < PICKUP_RADIUS + 1
        );
        if (note) {
          const fresh = !st.notesRead.includes(note.id);
          st.readNote(note.id);
          if (fresh) playNote();
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
    if (st.openNote) return;
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
    let mx = 0;
    let mz = 0;
    if (moving) {
      mx = -sin * fwd + cos * strafe;
      mz = -cos * fwd - sin * strafe;
      const ilen = Math.hypot(mx, mz) || 1;
      mx /= ilen;
      mz /= ilen;
    }

    const prevX = feet.current.x;
    const prevZ = feet.current.z;
    // Salju dalam memperlambat gerak (acuan mata, sama seperti store)
    const eyeY = feet.current.y + 1.7;
    const snowSlow = eyeY > SNOW_LINE ? 0.85 : 1;
    const slope = getSlope(prevX, prevZ);
    const steep = slope > 0.55;
    const wading = getRiverDepth(prevX, prevZ) > 0.25;
    let targetSpeed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * snowSlow;
    if (grounded.current && steep) targetSpeed *= 0.5;
    if (wading) targetSpeed *= 0.6;

    // Horizontal velocity dengan akselerasi & gesekan (bukan snap input per frame)
    if (moving) {
      const tvx = mx * targetSpeed;
      const tvz = mz * targetSpeed;
      const rate = ACCEL * dt;
      vel.current.x += Math.max(-rate, Math.min(rate, tvx - vel.current.x));
      vel.current.y += Math.max(-rate, Math.min(rate, tvz - vel.current.y));
    } else {
      const sp = vel.current.length();
      if (sp > 1e-4) {
        const drop = Math.min(sp, DECEL * dt);
        vel.current.x -= (vel.current.x / sp) * drop;
        vel.current.y -= (vel.current.y / sp) * drop;
      } else {
        vel.current.set(0, 0);
      }
    }
    let hspeed = vel.current.length();
    if (moving && hspeed > targetSpeed && hspeed > 0) {
      vel.current.multiplyScalar(targetSpeed / hspeed);
      hspeed = targetSpeed;
    }

    // Collision: dinding voxel tiap frame (termasuk airborne) + auto-step satu blok
    const STEP_MAX = BLOCK + 0.3;
    const blocked = (x: number, z: number): boolean => {
      const rise = getVoxelTop(x, z, st.edits) - feet.current.y;
      return grounded.current ? rise > STEP_MAX : rise > 0.02;
    };
    let px = clampWorld(prevX + vel.current.x * dt);
    let pz = clampWorld(prevZ + vel.current.y * dt);
    if (blocked(px, pz)) {
      const okX = !blocked(px, prevZ);
      const okZ = !blocked(prevX, pz);
      if (okX && !okZ) {
        pz = prevZ;
      } else if (!okX && okZ) {
        px = prevX;
      } else if (okX && okZ) {
        if (Math.abs(vel.current.x) >= Math.abs(vel.current.y)) pz = prevZ;
        else px = prevX;
      } else {
        px = prevX;
        pz = prevZ;
      }
    }

    // Collider prop statis (pohon/batu/tenda/api/rambu) — dorong keluar horizontal
    for (const c of PROP_COLLIDERS) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const rr = c.r + PLAYER_RADIUS;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          px = c.x + (dx / d) * rr;
          pz = c.z + (dz / d) * rr;
        } else {
          px = c.x + rr;
        }
      }
    }
    px = clampWorld(px);
    pz = clampWorld(pz);

    // Vertikal: auto-step hanya saat grounded; lompat pakai JUMP_SPEED;
    // turun dari tepi = busur gravitasi (bukan snap Y)
    const rawGround = getVoxelTop(px, pz, st.edits);
    const onDeck = Math.abs(px - BRIDGE.x) <= 4 && Math.abs(pz - BRIDGE.z) <= 1.6;
    const ground = rawGround + (onDeck ? DECK_TOP_OFFSET : 0);
    if (grounded.current) {
      if (k.has("Space") && st.stamina > 5) {
        velY.current = JUMP_SPEED;
        grounded.current = false;
      } else if (ground < feet.current.y - 0.05) {
        grounded.current = false;
      } else {
        velY.current = 0;
        feet.current.y = ground;
      }
    }
    if (!grounded.current) {
      velY.current -= GRAVITY * dt;
      const ny = feet.current.y + velY.current * dt;
      if (ny <= ground) {
        if (velY.current <= 0) {
          feet.current.y = ground;
          velY.current = 0;
          grounded.current = true;
        } else {
          feet.current.y = Math.max(ny, ground);
        }
      } else {
        feet.current.y = ny;
      }
    }
    feet.current.x = px;
    feet.current.z = pz;

    // Y visual di-lerp: langkah blok ±2 m tidak menghentak model/kamera
    if (Math.abs(feet.current.y - dispY.current) > 5) dispY.current = feet.current.y;
    else dispY.current += (feet.current.y - dispY.current) * (1 - Math.exp(-12 * dt));

    // Peringatan sekali saat memasuki zona salju (acuan mata, sama seperti store)
    const eyeNow = feet.current.y + 1.7;
    if (eyeNow > SNOW_LINE && !snowAnnounced.current) {
      snowAnnounced.current = true;
      st.showMessage("❄️ Memasuki zona salju! Jaga suhu tubuh, cari edelweiss.");
    } else if (eyeNow <= SNOW_LINE - 3) {
      snowAnnounced.current = false;
    }

    // Share ke visual Hiker (Y mulus; fisika tetap memakai feet logika)
    playerState.pos.set(px, dispY.current, pz);
    playerState.speed = hspeed;
    playerState.moving = hspeed > 0.3;
    playerState.grounded = grounded.current;
    if (hspeed > 0.3) playerState.faceYaw = Math.atan2(vel.current.x, vel.current.y);

    // Lean badan mengikuti gradasi tanjakan di bawah kaki (clamp ±0.35)
    const faceX = Math.sin(playerState.faceYaw);
    const faceZ = Math.cos(playerState.faceYaw);
    const le = 0.8;
    const grade = (getHeight(px + faceX * le, pz + faceZ * le) - getHeight(px - faceX * le, pz - faceZ * le)) / (2 * le);
    playerState.lean = grounded.current ? Math.max(-0.35, Math.min(0.35, Math.atan(grade))) : 0;

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

    // Kamera follow di belakang karakter (Y visual mulus = dispY)
    const cp = Math.cos(pitch.current);
    const sp = Math.sin(pitch.current);
    const tx = px;
    const ty = dispY.current + 1.6;
    const tz = pz;
    const csin = Math.sin(yaw.current);
    const ccos = Math.cos(yaw.current);
    const cx = tx + csin * cp * CAM_DIST;
    const cz = tz + ccos * cp * CAM_DIST;
    const cy = Math.max(ty + 1.6 - sp * CAM_DIST, getVoxelTop(cx, cz, st.edits) + 0.6);
    camTarget.current.set(cx, cy, cz);
    camera.position.lerp(camTarget.current, 1 - Math.exp(-12 * dt));
    camera.lookAt(tx, ty + sp * 2.5, tz);

    // Survival tick
    st.tick(dt, moving, sprinting, steep);

    // Rekam breadcrumb ghost run (tiap ~0,5 dtk, ditangani di ghost.ts)
    ghostRecord(dt, px, feet.current.y, pz);

    // Checkpoint & loot (loot mengikuti seed ekspedisi aktif)
    const cur = useMountainStore.getState();
    CHECKPOINTS.forEach((cpt, i) => {
      if (i <= cur.checkpointIndex) return;
      const d = Math.hypot(px - cpt.x, pz - cpt.z);
      if (d < cpt.radius) cur.unlockCheckpoint(i);
    });
    LOOT_SPOTS.forEach((l) => {
      if (!activeLoot.has(l.id)) return;
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

    if (playerState.moving && grounded.current) playStep(surfaceAt(px, pz, eyeNow));
    const storm = STORMINESS[cur.weather] ?? 0;
    updateWind(eyeNow, storm);

    // Mirror ke store 10 Hz (posisi MATA agar save lama tetap kompatibel)
    syncTimer.current += dt;
    if (syncTimer.current > 0.1) {
      syncTimer.current = 0;
      cur.setPlayerPos([px, eyeNow, pz]);
    }
  });

  return null;
}
