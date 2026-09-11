import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SNOW_LINE } from "./terrain";
import { playerState } from "./playerRef";

const FLAKES = 1200;
const BOX = 60;

/** Hujan salju di sekitar kamera, aktif & makin lebat mengikuti ketinggian. */
export function Snowfall() {
  const camera = useThree((s) => s.camera);
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);

  const { geometry, speeds } = useMemo(() => {
    const pos = new Float32Array(FLAKES * 3);
    const spd = new Float32Array(FLAKES);
    for (let i = 0; i < FLAKES; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * (BOX / 2);
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * (BOX / 2);
      spd[i] = 3 + Math.random() * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geometry: geo, speeds: spd };
  }, []);

  // Simpan tekstur terpisah agar tidak dibuat ulang
  const flakeTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.6, "rgba(255,255,255,0.7)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    return new THREE.CanvasTexture(c);
  }, []);

  const time = useRef(0);

  useFrame((_, rawDt) => {
    const pts = points.current;
    if (!pts) return;
    const dt = Math.min(rawDt, 0.1);
    time.current += dt;
    const alt = playerState.pos.y + 1.7; // acuan mata, sama seperti store
    const intensity = Math.max(0, Math.min(1, (alt - (SNOW_LINE - 7)) / 15));
    pts.visible = intensity > 0.02;
    if (!pts.visible) return;

    pts.position.set(camera.position.x, camera.position.y - 20, camera.position.z);
    const arr = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const n = Math.floor(FLAKES * (0.25 + intensity * 0.75));
    geometry.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      arr[i * 3 + 1] -= speeds[i] * dt;
      arr[i * 3] += Math.sin(time.current * 1.5 + i) * dt * 1.5 + dt * 1.2;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 40;
        arr[i * 3] = (Math.random() * 2 - 1) * (BOX / 2);
        arr[i * 3 + 2] = (Math.random() * 2 - 1) * (BOX / 2);
      }
      if (arr[i * 3] > BOX / 2) arr[i * 3] = -BOX / 2;
    }
    geometry.attributes.position.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.5 + intensity * 0.4;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={mat}
        size={0.35}
        map={flakeTex}
        transparent
        opacity={0.7}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/** Jejak kaki yang memudar di salju. */
export function Footprints() {
  const N = 40;
  const refs = useRef<Array<THREE.Mesh | null>>([]);
  const prints = useRef<Array<{ x: number; y: number; z: number; age: number }>>([]);
  const last = useRef(new THREE.Vector3(9999, 0, 9999));

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const p = playerState.pos;
    const inSnow = p.y + 1.7 > SNOW_LINE;
    if (inSnow && playerState.moving && last.current.distanceTo(p) > 1.2) {
      last.current.copy(p);
      prints.current.push({ x: p.x, y: p.y + 0.03, z: p.z, age: 0 });
      if (prints.current.length > N) prints.current.shift();
    }
    prints.current.forEach((f, i) => {
      f.age += dt;
      const m = refs.current[i];
      if (!m) return;
      m.position.set(f.x, f.y, f.z);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.45 * (1 - f.age / 9));
      m.visible = mat.opacity > 0.01;
    });
    // Sembunyikan slot tak terpakai
    for (let i = prints.current.length; i < N; i++) {
      const m = refs.current[i];
      if (m) m.visible = false;
    }
  });

  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <circleGeometry args={[0.22, 10]} />
          <meshBasicMaterial color="#cbd5e1" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
