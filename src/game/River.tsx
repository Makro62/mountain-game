import { useMemo, useRef } from "react";
import { useShadows } from "./modelKit";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BRIDGE, getBaseHeight, getHeight, riverCenterX } from "./terrain";

const RIVER_Z_MIN = -60;
const RIVER_Z_MAX = 192;
const WATER_HALF = 2.75;

/** Pita air mengikuti garis sungai, menempel di atas parit ukiran. */
function WaterSurface() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const time = useRef(0);

  const geometry = useMemo(() => {
    const step = 4;
    const rows: number[] = [];
    for (let z = RIVER_Z_MIN; z <= RIVER_Z_MAX; z += step) rows.push(z);
    const positions = new Float32Array(rows.length * 2 * 3);
    const index: number[] = [];
    rows.forEach((z, r) => {
      const cx = riverCenterX(z);
      // Di bawah tepi parit & dek jembatan (tidak merendam jembatan)
      const y = getBaseHeight(cx, z) - 1.2;
      positions.set([cx - WATER_HALF, y, z], r * 6);
      positions.set([cx + WATER_HALF, y, z], r * 6 + 3);
      if (r > 0) {
        const a = (r - 1) * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame((_, rawDt) => {
    time.current += Math.min(rawDt, 0.1);
    if (mat.current) {
      mat.current.opacity = 0.68 + Math.sin(time.current * 2) * 0.07;
    }
  });

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={mat}
        color="#0ea5e9"
        transparent
        opacity={0.7}
        roughness={0.08}
        metalness={0.1}
        envMapIntensity={1.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Buih putih yang mengalir ke selatan. */
function Foam() {
  const N = 22;
  const refs = useRef<Array<THREE.Mesh | null>>([]);
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        s: (i / N) * (RIVER_Z_MAX - RIVER_Z_MIN),
        ox: ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 2.0,
        speed: 2.5 + ((i * 7) % 3) * 0.5,
      })),
    []
  );
  const time = useRef(0);

  useFrame((_, rawDt) => {
    time.current += Math.min(rawDt, 0.1);
    const span = RIVER_Z_MAX - RIVER_Z_MIN;
    seeds.forEach((f, i) => {
      const m = refs.current[i];
      if (!m) return;
      const z = RIVER_Z_MIN + ((f.s + time.current * f.speed) % span);
      const cx = riverCenterX(z);
      m.position.set(cx + f.ox, getBaseHeight(cx, z) - 1.1, z);
    });
  });

  return (
    <group>
      {seeds.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.8, 0.4]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Jembatan kayu di titik jalur memotong sungai. */
function Bridge() {
  const deckY = getHeight(BRIDGE.x, BRIDGE.z);
  const group = useRef<THREE.Group>(null);
  const planks = useMemo(() => Array.from({ length: 7 }, (_, i) => -3.15 + i * 1.05), []);
  useShadows(group, true);
  return (
    <group ref={group} position={[BRIDGE.x, deckY, BRIDGE.z]}>
      {planks.map((x, i) => (
        <mesh key={i} position={[x, 0.06, 0]}>
          <boxGeometry args={[1.0, 0.12, 2.6]} />
          <meshStandardMaterial color="#92400e" roughness={0.9} />
        </mesh>
      ))}
      {/* Gelagar bawah */}
      {[-1.0, 1.0].map((z, i) => (
        <mesh key={`g${i}`} position={[0, -0.1, z]}>
          <boxGeometry args={[7.4, 0.18, 0.24]} />
          <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>
      ))}
      {/* Tiang + rel */}
      {[-3.4, 3.4].map((x) =>
        [-1.2, 1.2].map((z, j) => (
          <mesh key={`${x}${j}`} position={[x, 0.55, z]}>
            <boxGeometry args={[0.18, 1.1, 0.18]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
        ))
      )}
      {[-1.2, 1.2].map((z, i) => (
        <mesh key={`r${i}`} position={[0, 1.05, z]}>
          <boxGeometry args={[7.4, 0.12, 0.12]} />
          <meshStandardMaterial color="#92400e" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function River() {
  return (
    <group>
      <WaterSurface />
      <Foam />
      <Bridge />
    </group>
  );
}
