import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMountainStore } from "./store";
import { ghostPosAt, loadGhost, type GhostSave } from "./ghost";
import { getVoxelTop } from "./voxel";
import { lerpAngle } from "./modelKit";

/** Kelayakan ghost untuk run sekarang (lihat juga ghost.ts untuk desain). */
export function ghostEligible(g: GhostSave | null, mode: string, seed: number): boolean {
  if (!g) return false;
  if (mode === "standar") return g.mode === "standar";
  return g.mode === "harian" && g.seed === seed;
}

/** Rekaman translucent yang mengulang best-run pada posisi elapsed yang sama. */
export function GhostRunner() {
  const screen = useMountainStore((s) => s.screen);
  const mode = useMountainStore((s) => s.mode);
  const seed = useMountainStore((s) => s.seed);
  const ghostEnabled = useMountainStore((s) => s.ghostEnabled);
  const startedAt = useMountainStore((s) => s.startedAt);
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const [ghost, setGhost] = useState<GhostSave | null>(null);

  useEffect(() => {
    elapsed.current = 0;
    setGhost(loadGhost());
  }, [startedAt]);

  const eligible = ghostEligible(ghost, mode, seed) && ghostEnabled;

  useFrame((_, rawDt) => {
    if (!eligible || !ghost || screen !== "playing") return;
    const dt = Math.min(rawDt, 0.1);
    if (useMountainStore.getState().openNote) return;
    elapsed.current += dt;
    const pos = ghostPosAt(ghost.points, elapsed.current);
    if (pos && group.current) {
      group.current.visible = true;
      const gy = Math.max(pos[1], getVoxelTop(pos[0], pos[2]));
      group.current.position.set(pos[0], gy, pos[2]);
      const ahead = ghostPosAt(ghost.points, elapsed.current + 0.2);
      if (ahead) {
        const dx = ahead[0] - pos[0];
        const dz = ahead[2] - pos[2];
        if (dx * dx + dz * dz > 1e-6) {
          const target = Math.atan2(dx, dz);
          group.current.rotation.y = lerpAngle(group.current.rotation.y, target, Math.min(1, dt * 10));
        }
      }
    } else if (group.current) {
      group.current.visible = false;
    }
  });

  if (!eligible) return null;

  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.35, 1.0, 4, 8]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} emissive="#0ea5e9" emissiveIntensity={0.6} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.35} emissive="#bae6fd" emissiveIntensity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}
