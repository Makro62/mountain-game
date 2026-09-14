import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lerpAngle, sharedMat, useShadows } from "./modelKit";
import { clampWorld, riverCenterX } from "./terrain";
import { blockTopNatural } from "./voxel";
import { playerState } from "./playerRef";

/* ---------------- Burung ---------------- */

interface BirdFlock {
  cx: number;
  cy: number;
  cz: number;
  r: number;
  w: number;
  phase: number;
}

const FLOCKS: BirdFlock[] = [
  { cx: 0, cy: 42, cz: 60, r: 25, w: 0.25, phase: 0 },
  { cx: -20, cy: 48, cz: 0, r: 30, w: -0.2, phase: 1.4 },
  { cx: 15, cy: 55, cz: -60, r: 28, w: 0.22, phase: 2.6 },
  { cx: 0, cy: 62, cz: -120, r: 35, w: -0.18, phase: 4.0 },
  { cx: 30, cy: 35, cz: 120, r: 22, w: 0.28, phase: 5.1 },
];

function Bird({ flock }: { flock: BirdFlock }) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  const t = useRef(flock.phase * 10);

  useShadows(root);

  useFrame((_, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    t.current += dt;
    const a = flock.phase + t.current * flock.w;
    g.position.set(
      flock.cx + Math.cos(a) * flock.r,
      flock.cy + Math.sin(t.current * 0.7) * 1.5,
      flock.cz + Math.sin(a) * flock.r
    );
    g.rotation.y = -a + (flock.w < 0 ? Math.PI : 0);
    // Miring masuk tikungan
    g.rotation.z += ((flock.w > 0 ? -0.28 : 0.28) - g.rotation.z) * Math.min(1, dt * 3);
    const flap = Math.sin(t.current * 9) * 0.55;
    if (wingL.current) wingL.current.rotation.z = 0.15 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.15 - flap;
  });

  return (
    <group ref={root}>
      {/* Badan kotak + ekor kipas */}
      <mesh material={sharedMat("#1f2937")}>
        <boxGeometry args={[0.3, 0.28, 0.9]} />
      </mesh>
      <mesh position={[0, 0.02, -0.6]} material={sharedMat("#374151")}>
        <boxGeometry args={[0.3, 0.1, 0.35]} />
      </mesh>
      <mesh ref={wingL} position={[-0.1, 0.08, -0.55]} rotation={[0, 0.5, 0]} material={sharedMat("#374151")}>
        <boxGeometry args={[0.7, 0.05, 1.1]} />
      </mesh>
      <mesh ref={wingR} position={[-0.1, 0.08, 0.55]} rotation={[0, -0.5, 0]} material={sharedMat("#374151")}>
        <boxGeometry args={[0.7, 0.05, 1.1]} />
      </mesh>
    </group>
  );
}

export function Birds() {
  return (
    <group>
      {FLOCKS.map((f, i) => (
        <Bird key={i} flock={f} />
      ))}
    </group>
  );
}

/* ---------------- Rusa ---------------- */

const DEER_ANCHORS: Array<[number, number]> = [
  [-30, 60],
  [35, 115],
  [-35, 0],
  [10, 135],
];

function pickTarget(ax: number, az: number): [number, number] {
  for (let i = 0; i < 8; i++) {
    const tx = clampWorld(ax + (Math.random() * 2 - 1) * 12);
    const tz = clampWorld(az + (Math.random() * 2 - 1) * 12);
    if (Math.abs(tx - riverCenterX(tz)) < 10) continue;
    if (blockTopNatural(tx, tz) > 26) continue;
    return [tx, tz];
  }
  return [ax, az];
}

function Deer({ anchor }: { anchor: [number, number] }) {
  const root = useRef<THREE.Group>(null);
  const legs = useRef<Array<THREE.Group | null>>([]);
  const neck = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Mesh>(null);
  const st = useRef({
    x: anchor[0],
    z: anchor[1],
    tx: anchor[0],
    tz: anchor[1],
    mode: "idle" as "walk" | "idle" | "flee",
    timer: 1 + Math.random() * 3,
    phase: Math.random() * 6,
    yaw: 0,
  });

  const startY = useMemo(() => blockTopNatural(anchor[0], anchor[1]), [anchor]);

  useShadows(root);

  useFrame((_, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    s.timer -= dt;

    // Takut pemain yang mendekat
    const pdx = s.x - playerState.pos.x;
    const pdz = s.z - playerState.pos.z;
    const pdist = Math.hypot(pdx, pdz);
    if (pdist < 8 && s.mode !== "flee") {
      s.mode = "flee";
      s.timer = 1.5;
    }

    let speed = 0;
    if (s.mode === "flee") {
      const len = pdist || 1;
      s.x = clampWorld(s.x + (pdx / len) * 4 * dt);
      s.z = clampWorld(s.z + (pdz / len) * 4 * dt);
      s.yaw = lerpAngle(s.yaw, Math.atan2(pdx, pdz), Math.min(1, dt * 6));
      speed = 4;
      if (s.timer <= 0) {
        s.mode = "idle";
        s.timer = 2 + Math.random() * 3;
      }
    } else if (s.mode === "walk") {
      const dx = s.tx - s.x;
      const dz = s.tz - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        s.mode = "idle";
        s.timer = 2 + Math.random() * 3;
      } else {
        s.x = clampWorld(s.x + (dx / d) * 1.3 * dt);
        s.z = clampWorld(s.z + (dz / d) * 1.3 * dt);
        s.yaw = lerpAngle(s.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5));
        speed = 1.3;
      }
    } else {
      if (s.timer <= 0) {
        const [tx, tz] = pickTarget(anchor[0], anchor[1]);
        s.tx = tx;
        s.tz = tz;
        s.mode = "walk";
      }
    }

    g.position.set(s.x, blockTopNatural(s.x, s.z), s.z);
    g.rotation.y = s.yaw;
    if (speed > 0) s.phase += dt * (speed > 2 ? 11 : 7);
    const swing = speed > 0 ? Math.sin(s.phase) * 0.5 : 0;
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = i % 2 === 0 ? swing : -swing;
    });
    // Menunduk makan saat idle + ekor tegak saat kabur
    if (neck.current) {
      const target = s.mode === "idle" ? 0.55 + Math.sin(s.phase * 0.3) * 0.1 : 0;
      neck.current.rotation.x += (target - neck.current.rotation.x) * Math.min(1, dt * 3);
    }
    if (tail.current) {
      const tailTarget = s.mode === "flee" ? -0.7 : 0.6;
      tail.current.rotation.x += (tailTarget - tail.current.rotation.x) * Math.min(1, dt * 6);
    }
  });

  const setLeg = (i: number) => (el: THREE.Group | null) => {
    legs.current[i] = el;
  };

  return (
    <group ref={root} position={[anchor[0], startY, anchor[1]]}>
      {/* Badan kotak + belang punggung + pantat putih */}
      <mesh position={[0, 0.92, 0]} material={sharedMat("#92400e")}>
        <boxGeometry args={[0.5, 0.5, 1.2]} />
      </mesh>
      <mesh position={[0, 1.18, -0.05]} material={sharedMat("#57534e")}>
        <boxGeometry args={[0.1, 0.05, 0.7]} />
      </mesh>
      <mesh position={[0, 0.82, -0.62]} material={sharedMat("#fef3c7")}>
        <boxGeometry args={[0.34, 0.34, 0.12]} />
      </mesh>
      {/* 4 kaki meruncing + kuku */}
      {[
        [-0.16, 0.8, 0.32],
        [0.16, 0.8, 0.32],
        [-0.16, 0.8, -0.32],
        [0.16, 0.8, -0.32],
      ].map((p, i) => (
        <group key={i} ref={setLeg(i)} position={p as [number, number, number]}>
          <mesh position={[0, -0.38, 0]} material={sharedMat("#78350f")}>
            <boxGeometry args={[0.14, 0.76, 0.14]} />
          </mesh>
          <mesh position={[0, -0.78, 0.02]} material={sharedMat("#292524")}>
            <boxGeometry args={[0.16, 0.12, 0.16]} />
          </mesh>
        </group>
      ))}
      {/* Leher + kepala + moncong + telinga + tanduk bercabang */}
      <group ref={neck} position={[0, 1.05, 0.45]}>
        <mesh position={[0, 0.22, 0.08]} rotation={[-0.3, 0, 0]} material={sharedMat("#92400e")}>
          <boxGeometry args={[0.2, 0.55, 0.2]} />
        </mesh>
        <mesh position={[0, 0.48, 0.2]} material={sharedMat("#92400e")}>
          <boxGeometry args={[0.2, 0.24, 0.38]} />
        </mesh>
        <mesh position={[0, 0.44, 0.42]} material={sharedMat("#57534e")}>
          <boxGeometry args={[0.13, 0.15, 0.16]} />
        </mesh>
        {[-0.11, 0.11].map((x, i) => (
          <mesh key={`ear${i}`} position={[x, 0.62, 0.12]} rotation={[0, 0, x > 0 ? -0.4 : 0.4]} material={sharedMat("#78350f")}>
            <boxGeometry args={[0.1, 0.18, 0.06]} />
          </mesh>
        ))}
        {[-0.07, 0.07].map((x, i) => (
          <group key={`ant${i}`} position={[x, 0.6, 0.15]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}>
            <mesh position={[0, 0.18, 0]} material={sharedMat("#e7e5e4", 0.8)}>
              <boxGeometry args={[0.05, 0.36, 0.05]} />
            </mesh>
            <mesh position={[x > 0 ? 0.05 : -0.05, 0.3, 0]} rotation={[0, 0, x > 0 ? -0.7 : 0.7]} material={sharedMat("#e7e5e4", 0.8)}>
              <boxGeometry args={[0.04, 0.18, 0.04]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Ekor (tegak saat kabur) */}
      <mesh ref={tail} position={[0, 1.0, -0.62]} rotation={[0.6, 0, 0]} material={sharedMat("#fef3c7")}>
        <boxGeometry args={[0.16, 0.28, 0.1]} />
      </mesh>
    </group>
  );
}

export function DeerHerd() {
  return (
    <group>
      {DEER_ANCHORS.map((a, i) => (
        <Deer key={i} anchor={a} />
      ))}
    </group>
  );
}
