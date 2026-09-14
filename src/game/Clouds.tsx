import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Awan kotak-kotak ala Minecraft: gabungan balok putih pipih yang melayang. */
export function Clouds() {
  const group = useRef<THREE.Group>(null);

  const clouds = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        x: (Math.sin(i * 91.7) * 0.5 + 0.5) * 2 * 190 - 190,
        y: 95 + ((i * 37) % 40),
        z: (Math.cos(i * 47.3) * 0.5 + 0.5) * 2 * 190 - 190,
        s: 1 + ((i * 53) % 40) / 40,
        v: 0.8 + ((i * 29) % 10) / 12,
      })),
    []
  );

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    g.children.forEach((child, i) => {
      child.position.x += clouds[i].v * dt;
      if (child.position.x > 210) child.position.x = -210;
    });
  });

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh>
            <boxGeometry args={[22, 3, 10]} />
            <meshLambertMaterial color="#ffffff" transparent opacity={0.88} />
          </mesh>
          <mesh position={[6, 1.5, 2]}>
            <boxGeometry args={[12, 3, 7]} />
            <meshLambertMaterial color="#ffffff" transparent opacity={0.88} />
          </mesh>
          <mesh position={[-7, 1.2, -2]}>
            <boxGeometry args={[10, 2.5, 6]} />
            <meshLambertMaterial color="#f1f5f9" transparent opacity={0.88} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
