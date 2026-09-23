import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  BRIDGE,
  CHECKPOINTS,
  LOOT_SPOTS,
  SNOW_LINE,
  TREE_LINE,
  WORLD_BOUND,
  distToTrail,
  getHeight,
  riverCenterX,
} from "./terrain";
import { mulberry32 } from "./modelKit";
import { blockTopNatural, getVoxelTop, type VoxelEdits } from "./voxel";
import { useMountainStore } from "./store";

interface Spot {
  x: number;
  y: number;
  z: number;
  s: number;
  rot: number;
  tint: number;
}

function nearTrailOrCamp(x: number, z: number, trailHalf: number): boolean {
  if (Math.abs(x - riverCenterX(z)) < 9) return true;
  if (distToTrail(x, z) < trailHalf) return true;
  for (const cp of CHECKPOINTS) {
    if (Math.hypot(x - cp.x, z - cp.z) < cp.radius + 5) return true;
  }
  if (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 9) return true;
  for (const l of LOOT_SPOTS) {
    if (Math.hypot(x - l.x, z - l.z) < 2.5) return true;
  }
  return false;
}

function scatter(count: number, seed: number, accept: (x: number, z: number) => boolean): Spot[] {
  const rand = mulberry32(seed);
  const out: Spot[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rand() * 2 - 1) * (WORLD_BOUND - 5);
    const z = (rand() * 2 - 1) * (WORLD_BOUND - 5);
    if (!accept(x, z)) continue;
    out.push({ x, y: blockTopNatural(x, z), z, s: 0.7 + rand() * 0.7, rot: rand() * Math.PI * 2, tint: rand() });
  }
  return out;
}

/** Semai statis deterministik (dipakai juga collider pemain). */
export const TREE_SPOTS = scatter(700, 7, (x, z) => !nearTrailOrCamp(x, z, 5) && getHeight(x, z) < TREE_LINE);
export const ROCK_SPOTS = scatter(300, 21, (x, z) => {
  if (distToTrail(x, z) < 4) return false;
  for (const cp of CHECKPOINTS) {
    if (Math.hypot(x - cp.x, z - cp.z) < cp.radius + 3) return false;
  }
  if (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 8) return false;
  return getHeight(x, z) < 58;
});
const BIRCH_SPOTS = scatter(220, 63, (x, z) => !nearTrailOrCamp(x, z, 5) && getHeight(x, z) < 12);
const SHRUB_SPOTS = scatter(500, 77, (x, z) => {
  if (nearTrailOrCamp(x, z, 3.5)) return false;
  const h = getHeight(x, z);
  return h > 8 && h < 30;
});
const GRASS_SPOTS = scatter(800, 42, (x, z) => !nearTrailOrCamp(x, z, 3) && getHeight(x, z) < TREE_LINE);

/** Re-ground Y ke permukaan voxel terkini (mengikuti edit gali/pasang pemain). */
function reground(spots: Spot[], edits: VoxelEdits): Spot[] {
  return spots.map((s) => ({ ...s, y: getVoxelTop(s.x, s.z, edits) }));
}

type Placer = (m: THREE.InstancedMesh, s: Spot, dummy: THREE.Object3D, i: number) => void;

/** Bangun 1 InstancedMesh statis dari daftar spot. */
function useInstanced(
  spots: Spot[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  place: Placer,
  tint?: (m: THREE.InstancedMesh, s: Spot, i: number) => void
): THREE.InstancedMesh | null {
  const mesh = useMemo(() => {
    if (spots.length === 0) return null;
    const m = new THREE.InstancedMesh(geometry, material, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach((s, i) => {
      place(m, s, dummy, i);
      m.setMatrixAt(i, dummy.matrix);
      if (tint) tint(m, s, i);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);
  useEffect(() => () => {
    mesh?.geometry.dispose();
    (mesh?.material as THREE.Material | undefined)?.dispose();
    mesh?.dispose();
  }, [mesh]);
  return mesh;
}

const dummyColor = new THREE.Color();

function placeAt(yOff: number): Placer {
  return (_m, s, dummy, i) => {
    dummy.position.set(s.x, s.y + yOff * s.s, s.z);
    dummy.scale.setScalar(s.s);
    dummy.rotation.set(0, s.rot, 0);
    dummy.updateMatrix();
    void i;
  };
}

/** Putar offset lokal mengikuti yaw pohon. */
function yawOff(ox: number, oz: number, rot: number): [number, number] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [ox * c + oz * s, -ox * s + oz * c];
}

/** Pucat salju untuk pinus tinggi (0 di bawah → 1 menuju SNOW_LINE). */
function snowPallor(y: number): number {
  return Math.max(0, Math.min(1, (y - 16) / (SNOW_LINE - 16)));
}

function pineTint(baseH: number, baseS: number, baseL: number) {
  return (m: THREE.InstancedMesh, s: Spot, i: number) => {
    const p = snowPallor(s.y);
    m.setColorAt(
      i,
      dummyColor.setHSL(
        baseH + s.tint * 0.03,
        baseS * (1 - p * 0.55),
        baseL + s.tint * 0.06 + p * 0.28
      )
    );
  };
}

/** Hutan pinus: akar, batang, 4 tajuk berlapis, pucuk. */
export function Trees() {
  const edits = useMountainStore((s) => s.edits);
  const spots = useMemo(() => reground(TREE_SPOTS, edits), [edits]);

  const roots = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(0.7, 0.5, 0.7), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
    placeAt(0.25),
    (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.06, 0.4, 0.14 + s.tint * 0.06))
  );
  const trunks = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(0.5, 2.4, 0.5), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
    placeAt(1.2),
    (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.07, 0.42, 0.16 + s.tint * 0.07))
  );

  const layers: Array<{ r: number; h: number; y: number }> = [
    { r: 1.9, h: 2.6, y: 3.0 },
    { r: 1.5, h: 2.3, y: 4.1 },
    { r: 1.1, h: 2.0, y: 5.1 },
    { r: 0.7, h: 1.7, y: 6.0 },
  ];
  const layerMeshes = layers.map((L, li) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInstanced(
      spots,
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useMemo(() => new THREE.BoxGeometry(L.r * 2, L.h * 0.8, L.r * 2), [L.r, L.h]),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
      (m, s, dummy, i) => {
        dummy.position.set(s.x, s.y + L.y * s.s, s.z);
        dummy.scale.setScalar(s.s);
        dummy.rotation.set(0, s.rot + li * 0.8, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      },
      pineTint(0.29, 0.5, 0.2)
    )
  );
  const spike = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(0.4, 1.1, 0.4), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
    placeAt(6.9),
    pineTint(0.3, 0.5, 0.24)
  );

  if (!roots || !trunks || !spike || layerMeshes.some((m) => !m)) return null;
  return (
    <group>
      <primitive object={roots} />
      <primitive object={trunks} />
      {layerMeshes.map((m, i) => (
        <primitive key={i} object={m!} />
      ))}
      <primitive object={spike} />
    </group>
  );
}

/** Birch putih bercabang di zona rendah. */
export function Birches() {
  const edits = useMountainStore((s) => s.edits);
  const spots = useMemo(() => reground(BIRCH_SPOTS, edits), [edits]);
  const trunks = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(0.4, 2.8, 0.4), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }), []),
    placeAt(1.4),
    (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.1, 0.08 + s.tint * 0.05, 0.82 + s.tint * 0.08))
  );
  // Dua dahan miring keluar (offset mengikuti yaw pohon)
  const branches = [-1, 1].map((side) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInstanced(
      spots,
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useMemo(() => new THREE.BoxGeometry(0.14, 1.7, 0.14), []),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }), []),
      (m, s, dummy, i) => {
        const [ox, oz] = yawOff(side * 0.62, 0, s.rot);
        dummy.position.set(s.x + ox * s.s, s.y + 2.6 * s.s, s.z + oz * s.s);
        dummy.scale.setScalar(s.s);
        dummy.rotation.set(0, s.rot, -side * 0.65);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      },
      (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.09, 0.2, 0.3 + s.tint * 0.1))
    )
  );
  const crownMain = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(2.2, 2.4, 2.2), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
    (m, s, dummy, i) => {
      dummy.position.set(s.x, s.y + 3.9 * s.s, s.z);
      dummy.scale.set(s.s, s.s * 1.15, s.s);
      dummy.rotation.set(0, s.rot, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    },
    (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.24 + s.tint * 0.05, 0.55, 0.3 + s.tint * 0.1))
  );
  const crownSide = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(1.5, 1.5, 1.5), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
    (m, s, dummy, i) => {
      const [ox, oz] = yawOff(0.85, 0.35, s.rot);
      dummy.position.set(s.x + ox * s.s, s.y + 3.2 * s.s, s.z + oz * s.s);
      dummy.scale.setScalar(s.s);
      dummy.rotation.set(0, s.rot * 1.3, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    },
    (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.22 + s.tint * 0.06, 0.6, 0.32 + s.tint * 0.1))
  );

  if (!trunks || !crownMain || !crownSide || branches.some((b) => !b)) return null;
  return (
    <group>
      <primitive object={trunks} />
      {branches.map((b, i) => (
        <primitive key={i} object={b!} />
      ))}
      <primitive object={crownMain} />
      <primitive object={crownSide} />
    </group>
  );
}

/** Semak belukar zona menengah. */
export function Shrubs() {
  const edits = useMountainStore((s) => s.edits);
  const spots = useMemo(() => reground(SHRUB_SPOTS, edits), [edits]);
  const shrubs = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(0.9, 0.6, 0.9), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
    (m, s, dummy, i) => {
      dummy.position.set(s.x, s.y + 0.28 * s.s, s.z);
      dummy.scale.set(s.s * 1.2, s.s * 0.65, s.s * 1.2);
      dummy.rotation.set(0, s.rot, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    },
    (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.26 + s.tint * 0.05, 0.5, 0.22 + s.tint * 0.09))
  );
  if (!shrubs) return null;
  return <primitive object={shrubs} />;
}

/** Batu-batu gunung (zona batu & lereng). */
export function Rocks() {
  const edits = useMountainStore((s) => s.edits);
  const spots = useMemo(() => reground(ROCK_SPOTS, edits), [edits]);
  const rocks = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(1.2, 0.9, 1.2), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
    (m, s, dummy, i) => {
      dummy.position.set(s.x, s.y + 0.2 * s.s, s.z);
      dummy.scale.set(s.s, s.s * 0.7, s.s);
      dummy.rotation.set(s.rot, s.rot * 1.7, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    },
    (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.08, 0.05 + s.tint * 0.05, 0.35 + s.tint * 0.2))
  );
  if (!rocks) return null;
  return <primitive object={rocks} />;
}

/** Rerumputan pendek di zona hijau. */
export function GrassTufts() {
  const edits = useMountainStore((s) => s.edits);
  const spots = useMemo(() => reground(GRASS_SPOTS, edits), [edits]);
  const grass = useInstanced(
    spots,
    useMemo(() => new THREE.BoxGeometry(0.28, 0.75, 0.28), []),
    useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), []),
    placeAt(0.3),
    (m, s, i) => m.setColorAt(i, dummyColor.setHSL(0.22 + s.tint * 0.06, 0.6, 0.3 + s.tint * 0.12))
  );
  if (!grass) return null;
  return <primitive object={grass} />;
}
