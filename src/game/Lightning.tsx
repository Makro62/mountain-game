import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMountainStore } from "./store";
import { playThunder } from "./audio";

const MIN_GAP = 4;
const MAX_GAP = 9;
const FLASH_TIME = 0.4;
const BOLT_SEGS = 10;

/** Petir badai: kilat acak + guntur + tandai store agar HUD bisa flash. */
export function Lightning() {
  const light = useRef<THREE.DirectionalLight>(null);
  const bolt = useRef<THREE.LineSegments>(null);
  const timer = useRef(2 + Math.random() * 4);
  const flashT = useRef(0);

  const boltGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BOLT_SEGS * 2 * 3), 3));
    return geo;
  }, []);

  const rebuildBolt = () => {
    const st = useMountainStore.getState();
    const p = st.playerPos;
    const arr = (boltGeo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    let x = p[0] + (Math.random() * 2 - 1) * 30;
    let z = p[2] + (Math.random() * 2 - 1) * 30;
    let y = 70;
    for (let i = 0; i < BOLT_SEGS; i++) {
      const ny = y - 70 / BOLT_SEGS;
      const nx = i === BOLT_SEGS - 1 ? x : x + (Math.random() * 2 - 1) * 3;
      const nz = i === BOLT_SEGS - 1 ? z : z + (Math.random() * 2 - 1) * 3;
      arr[i * 6] = x;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 2] = z;
      arr[i * 6 + 3] = nx;
      arr[i * 6 + 4] = ny;
      arr[i * 6 + 5] = nz;
      x = nx;
      z = nz;
      y = ny;
    }
    (boltGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  };

  useFrame((_, rawDt) => {
    const st = useMountainStore.getState();
    const danger = st.screen === "playing" && !st.openNote && st.weather === "badai";
    const dt = Math.min(rawDt, 0.1);

    if (danger) {
      timer.current -= dt;
      if (timer.current <= 0) {
        timer.current = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
        flashT.current = FLASH_TIME;
        rebuildBolt();
        playThunder();
        useMountainStore.setState({ lightningAt: Date.now() });
      }
    } else {
      timer.current = Math.max(timer.current, 2);
    }

    if (flashT.current > 0) {
      flashT.current = Math.max(0, flashT.current - dt);
      const phase = flashT.current / FLASH_TIME;
      const strobe = phase > 0.6 ? 1 : phase > 0.35 ? 0.25 : phase > 0.15 ? 1 : 0.1;
      if (light.current) light.current.intensity = 4 * strobe * (phase * 0.8 + 0.2);
      if (bolt.current) {
        bolt.current.visible = strobe >= 1;
        const mat = bolt.current.material as THREE.LineBasicMaterial;
        mat.opacity = 0.9 * strobe;
      }
    } else {
      if (light.current) light.current.intensity = 0;
      if (bolt.current) bolt.current.visible = false;
    }
  });

  return (
    <>
      <directionalLight ref={light} position={[40, 90, 20]} color="#e2e8f0" intensity={0} />
      <lineSegments ref={bolt} geometry={boltGeo} visible={false}>
        <lineBasicMaterial color="#e2e8f0" transparent opacity={0.9} />
      </lineSegments>
    </>
  );
}
