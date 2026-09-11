import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMountainStore } from "./store";

/**
 * Bulatan matahari / bulan yang terlihat di langit.
 * Mengikuti sudut yang SAMA dengan SkyRig (timeOfDay) sehingga
 * terbit-tenggelam selaras dengan pencahayaan — tanpa aset luar.
 */
export function Sun() {
  const sun = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);

  const haloTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, "rgba(255, 240, 180, 0.9)");
      grad.addColorStop(0.35, "rgba(255, 220, 120, 0.35)");
      grad.addColorStop(1, "rgba(255, 220, 120, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }, []);

  useFrame(() => {
    const t = useMountainStore.getState().timeOfDay;
    const ang = t * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(ang) * 100, Math.max(5, Math.sin(ang) * 60 + 20), -60).normalize();
    const isDay = Math.sin(ang) * 60 + 20 > 2;
    if (sun.current) {
      sun.current.position.copy(dir).multiplyScalar(700);
      sun.current.visible = isDay;
    }
    if (halo.current) {
      halo.current.position.copy(dir).multiplyScalar(690);
      halo.current.visible = isDay;
    }
    if (moon.current) {
      moon.current.position.copy(dir).multiplyScalar(-650);
      moon.current.visible = !isDay;
    }
  });

  return (
    <group>
      <mesh ref={sun}>
        <sphereGeometry args={[16, 16, 16]} />
        <meshBasicMaterial color="#ffd34d" fog={false} />
      </mesh>
      <sprite ref={halo} scale={[150, 150, 1]}>
        <spriteMaterial map={haloTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <mesh ref={moon}>
        <sphereGeometry args={[11, 16, 16]} />
        <meshBasicMaterial color="#e2e8f0" fog={false} />
      </mesh>
    </group>
  );
}
