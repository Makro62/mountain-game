import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lerpAngle, sharedMat, useShadows } from "./modelKit";
import { playerState } from "./playerRef";

/**
 * Avatar pendaki low-poly prosedural (tanpa aset unduhan).
 * Proporsi anatomis, menghadap +Z lokal.
 */
export function Hiker() {
  const root = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const time = useRef(0);

  useShadows(root);

  useFrame((_, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    time.current += dt;

    g.position.copy(playerState.pos);
    g.rotation.y = lerpAngle(g.rotation.y, playerState.faceYaw, Math.min(1, dt * 10));

    if (playerState.moving) phase.current += dt * 9;
    const swing = playerState.moving ? Math.sin(phase.current) * 0.55 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.7;
    if (armR.current) armR.current.rotation.x = swing * 0.7;
    // Condong badan ke depan saat jalan + napas idle
    if (inner.current) {
      inner.current.position.y = playerState.moving
        ? Math.abs(Math.cos(phase.current)) * 0.05
        : Math.sin(time.current * 2) * 0.02;
      inner.current.rotation.x += ((playerState.moving ? 0.08 : 0) - inner.current.rotation.x) * Math.min(1, dt * 5);
    }
  });

  return (
    <group ref={root}>
      <group ref={inner}>
        {/* Kaki: paha kapsul + pelindung lutut + sepatu + sol */}
        {[
          { ref: legL, x: -0.15 },
          { ref: legR, x: 0.15 },
        ].map(({ ref, x }, i) => (
          <group key={i} ref={ref} position={[x, 0.85, 0]}>
            <mesh position={[0, -0.3, 0]} material={sharedMat("#1f2937")}>
              <boxGeometry args={[0.22, 0.65, 0.24]} />
            </mesh>
            <mesh position={[0, -0.42, 0.1]} material={sharedMat("#0c0a09")}>
              <boxGeometry args={[0.16, 0.14, 0.06]} />
            </mesh>
            <mesh position={[0, -0.72, 0.05]} material={sharedMat("#451a03")}>
              <boxGeometry args={[0.22, 0.18, 0.36]} />
            </mesh>
            <mesh position={[0, -0.8, 0.04]} material={sharedMat("#1c1917")}>
              <boxGeometry args={[0.2, 0.05, 0.34]} />
            </mesh>
          </group>
        ))}
        {/* Torso jaket + resleting + tali dada */}
        <mesh position={[0, 1.2, 0]} material={sharedMat("#f97316", 0.75)}>
          <boxGeometry args={[0.55, 0.75, 0.35]} />
        </mesh>
        <mesh position={[0, 1.2, 0.26]} material={sharedMat("#7c2d12", 0.8)}>
          <boxGeometry args={[0.05, 0.55, 0.02]} />
        </mesh>
        <mesh position={[0, 1.32, 0.245]} material={sharedMat("#431407", 0.8)}>
          <boxGeometry args={[0.3, 0.05, 0.02]} />
        </mesh>
        {/* Tali carrier di bahu */}
        {[-0.16, 0.16].map((x, i) => (
          <mesh key={i} position={[x, 1.3, 0.2]} rotation={[0.15, 0, 0]} material={sharedMat("#14532d")}>
            <boxGeometry args={[0.09, 0.5, 0.04]} />
          </mesh>
        ))}
        {/* Carrier + saku samping + matras */}
        <mesh position={[0, 1.22, -0.36]} material={sharedMat("#16a34a")}>
          <boxGeometry args={[0.44, 0.58, 0.26]} />
        </mesh>
        {[-0.26, 0.26].map((x, i) => (
          <mesh key={i} position={[x, 1.1, -0.36]} material={sharedMat("#15803d")}>
            <boxGeometry args={[0.1, 0.3, 0.2]} />
          </mesh>
        ))}
        <mesh position={[0, 1.22, -0.36]} material={sharedMat("#0ea5e9")}>
          <boxGeometry args={[0.46, 0.12, 0.28]} />
        </mesh>
        <mesh position={[0, 1.58, -0.36]} material={sharedMat("#0ea5e9")}>
          <boxGeometry args={[0.46, 0.18, 0.18]} />
        </mesh>
        {/* Lengan kapsul + sarung tangan */}
        {[
          { ref: armL, x: -0.4 },
          { ref: armR, x: 0.4 },
        ].map(({ ref, x }, i) => (
          <group key={i} ref={ref} position={[x, 1.44, 0]}>
            <mesh position={[0, -0.26, 0]} material={sharedMat("#c2410c", 0.8)}>
              <boxGeometry args={[0.17, 0.55, 0.19]} />
            </mesh>
            <mesh position={[0, -0.58, 0]} material={sharedMat("#292524")}>
              <boxGeometry args={[0.16, 0.16, 0.16]} />
            </mesh>
            {x > 0 && (
              <mesh position={[0, -0.6, 0.15]} rotation={[0.25, 0, 0]} material={sharedMat("#a8a29e", 0.5, { metalness: 0.4 })}>
                <boxGeometry args={[0.06, 1.1, 0.06]} />
              </mesh>
            )}
          </group>
        ))}
        {/* Tudung jaket terlipat di leher */}
        <mesh position={[0, 1.52, -0.2]} rotation={[0.4, 0, 0]} material={sharedMat("#c2410c", 0.85)}>
          <boxGeometry args={[0.4, 0.14, 0.14]} />
        </mesh>
        {/* Kepala kotak + kupluk + pom + headlamp */}
        <mesh position={[0, 1.74, 0.01]} material={sharedMat("#fcd9b8", 0.65)}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
        </mesh>
        <mesh position={[0, 1.97, -0.01]} material={sharedMat("#b91c1c", 0.85)}>
          <boxGeometry args={[0.44, 0.14, 0.44]} />
        </mesh>
        <mesh position={[0, 2.06, -0.01]} material={sharedMat("#dc2626", 0.85)}>
          <boxGeometry args={[0.4, 0.12, 0.4]} />
        </mesh>
        <mesh position={[0, 2.16, -0.01]} material={sharedMat("#fecaca", 0.8)}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
        </mesh>
        <mesh position={[0, 1.78, 0.2]} material={sharedMat("#fef9c3", 0.5, { emissive: "#fde047", emissiveIntensity: 1.2 })}>
          <boxGeometry args={[0.1, 0.07, 0.05]} />
        </mesh>
        <pointLight position={[0, 1.9, 0.8]} intensity={2.5} distance={9} color="#fef9c3" />
      </group>
    </group>
  );
}
