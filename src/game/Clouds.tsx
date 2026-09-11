import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Awan billboard prosedural yang melayang (tekstur kanvas runtime, offline). */
export function Clouds() {
  const group = useRef<THREE.Group>(null);

  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      const puff = (x: number, y: number, r: number, a: number) => {
        const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 128);
      };
      puff(80, 75, 55, 0.9);
      puff(130, 60, 65, 0.95);
      puff(180, 78, 50, 0.85);
      puff(110, 88, 60, 0.7);
    }
    return new THREE.CanvasTexture(c);
  }, []);

  const clouds = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        x: (Math.sin(i * 91.7) * 0.5 + 0.5) * 2 * 190 - 190,
        y: 95 + ((i * 37) % 40),
        z: (Math.cos(i * 47.3) * 0.5 + 0.5) * 2 * 190 - 190,
        s: 70 + ((i * 53) % 50),
        v: 0.8 + ((i * 29) % 10) / 12,
      })),
    []
  );

  // Satu material bersama untuk 10 sprite (hemat program switch)
  const sharedMat = useMemo(() => {
    return new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false,
    });
  }, [tex]);

  useEffect(() => () => {
    sharedMat.dispose();
    tex.dispose();
  }, [sharedMat, tex]);

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
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.s, c.s * 0.45, 1]} material={sharedMat} />
      ))}
    </group>
  );
}
