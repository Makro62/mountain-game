import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EDELWEISS, WORLD_BOUND, distToTrail, getHeight, riverCenterX } from "./terrain";
import { blockTopNatural, getVoxelTop } from "./voxel";
import { mulberry32 } from "./modelKit";
import { useMountainStore } from "./store";

/** Padang bunga warna-warni di zona rendah (hiasan). */
export function MeadowFlowers() {
  const edits = useMountainStore((s) => s.edits);
  const spots = useMemo(() => {
    const rand = mulberry32(99);
    const out: Array<{ x: number; y: number; z: number; s: number; c: number }> = [];
    const palette = [0xef4444, 0xfacc15, 0xc084fc, 0xf9a8d4, 0xffffff, 0xfb923c];
    for (let i = 0; i < 900 && out.length < 320; i++) {
      const x = (rand() * 2 - 1) * (WORLD_BOUND - 5);
      const z = (rand() * 2 - 1) * (WORLD_BOUND - 5);
      if (distToTrail(x, z) < 2.5) continue;
      if (Math.abs(x - riverCenterX(z)) < 6) continue;
      const h = getHeight(x, z);
      if (h > 20) continue;
      out.push({ x, y: blockTopNatural(x, z), z, s: 0.7 + rand() * 0.7, c: palette[Math.floor(rand() * palette.length)] });
    }
    return out.map((s) => ({ ...s, y: getVoxelTop(s.x, s.z, edits) }));
  }, [edits]);

  const { stems, heads } = useMemo(() => {
    const stemMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, 0.5, 0.08),
      new THREE.MeshStandardMaterial({ color: "#15803d", roughness: 1 }),
      Math.max(1, spots.length)
    );
    const headMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
      Math.max(1, spots.length)
    );
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      dummy.position.set(s.x, s.y + 0.25 * s.s, s.z);
      dummy.scale.setScalar(s.s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      stemMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s.x, s.y + 0.52 * s.s, s.z);
      dummy.updateMatrix();
      headMesh.setMatrixAt(i, dummy.matrix);
      headMesh.setColorAt(i, col.setHex(s.c));
    });
    stemMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
    stemMesh.castShadow = true;
    return { stems: stemMesh, heads: headMesh };
  }, [spots]);

  useEffect(() => {
    return () => {
      stems.dispose();
      heads.dispose();
      (stems.material as THREE.Material).dispose();
      (heads.material as THREE.Material).dispose();
    };
  }, [stems, heads]);

  if (spots.length === 0) return null;
  return (
    <group>
      <primitive object={stems} />
      <primitive object={heads} />
    </group>
  );
}

function EdelweissFlower({ x, z, y, taken }: { x: number; z: number; y: number; taken: boolean }) {
  if (taken) return null;
  return (
    <group position={[x, y, z]}>
      {/* Batang */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#4d7c0f" roughness={1} />
      </mesh>
      {/* Daun */}
      {[-0.2, 0.2].map((a, i) => (
        <mesh key={i} position={[Math.sin(a) * 0.15, 0.18, 0]} rotation={[0, 0, a]}>
          <boxGeometry args={[0.22, 0.04, 0.08]} />
          <meshStandardMaterial color="#65a30d" roughness={1} />
        </mesh>
      ))}
      {/* Kelopak putih berlapis */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.16, 0.44, Math.sin(a) * 0.16]} rotation={[0.5, 0, -a]}>
            <boxGeometry args={[0.16, 0.03, 0.09]} />
            <meshStandardMaterial color="#f8fafc" emissive="#e2e8f0" emissiveIntensity={0.35} roughness={0.8} />
          </mesh>
        );
      })}
      {/* Tengah kuning */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.14, 0.14, 0.14]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.5} />
      </mesh>
      {/* Penanda kilau agar terlihat dari jauh */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color="#fefce8" emissive="#fef08a" emissiveIntensity={1.4} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/** Edelweiss kolektibel di zona salju (12 titik). */
export function EdelweissPatch() {
  const taken = useMountainStore((s) => s.edelweiss);
  const edits = useMountainStore((s) => s.edits);
  return (
    <group>
      {EDELWEISS.map((e) => (
        <EdelweissFlower key={e.id} x={e.x} z={e.z} y={getVoxelTop(e.x, e.z, edits)} taken={taken.includes(e.id)} />
      ))}
    </group>
  );
}
