import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getHeight } from "./terrain";
import { useMountainStore } from "./store";
import { playerState } from "./playerRef";
import { playRock } from "./audio";

const N = 12;
const ROCK_ZONE_MIN = 25;
const ROCK_ZONE_MAX = 58;

interface FallingRock {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  hitDone: boolean;
  spin: number;
}

/**
 * Batu jatuh saat badai di zona batu (25–58 mdpl).
 * Kena = -12 stamina & -8 suhu. Murni ancaman area, tanpa state React.
 */
export function Rockfall() {
  const refs = useRef<Array<THREE.Mesh | null>>([]);
  const rocks = useRef<FallingRock[]>(
    Array.from({ length: N }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      age: 0,
      hitDone: false,
      spin: 0,
    }))
  );
  const spawnTimer = useRef(1.5);
  const lastHit = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const st = useMountainStore.getState();
    const p = playerState.pos;
    const eyeY = p.y + 1.7; // acuan mata, sama seperti banner HUD
    const danger =
      st.screen === "playing" &&
      st.weather === "badai" &&
      eyeY > ROCK_ZONE_MIN &&
      eyeY < ROCK_ZONE_MAX;

    if (danger) {
      spawnTimer.current -= dt;
      if (spawnTimer.current <= 0) {
        spawnTimer.current = 1.8 + Math.random() * 1.6;
        const r = rocks.current.find((x) => !x.active);
        if (r) {
          r.active = true;
          r.age = 0;
          r.hitDone = false;
          r.spin = (Math.random() * 2 - 1) * 5;
          r.pos.set(p.x + (Math.random() * 2 - 1) * 14, p.y + 10 + Math.random() * 6, p.z + (Math.random() * 2 - 1) * 14);
          // Arah gelinding = turunan lereng
          const e = 1.5;
          const gx = getHeight(r.pos.x + e, r.pos.z) - getHeight(r.pos.x - e, r.pos.z);
          const gz = getHeight(r.pos.x, r.pos.z + e) - getHeight(r.pos.x, r.pos.z - e);
          const len = Math.hypot(gx, gz) || 1;
          r.vel.set((-gx / len) * 3, -1, (-gz / len) * 3);
        }
      }
    }

    const now = performance.now();
    rocks.current.forEach((r, i) => {
      const m = refs.current[i];
      if (!m) return;
      if (!r.active) {
        m.visible = false;
        return;
      }
      m.visible = true;
      r.age += dt;
      r.vel.y -= 14 * dt;
      r.pos.x += r.vel.x * dt;
      r.pos.y += r.vel.y * dt;
      r.pos.z += r.vel.z * dt;
      const ground = getHeight(r.pos.x, r.pos.z) + 0.5;
      if (r.pos.y <= ground) {
        r.pos.y = ground;
        r.vel.y *= -0.3;
        r.vel.x *= 0.7;
        r.vel.z *= 0.7;
      }
      if (r.age > 7) {
        r.active = false;
        m.visible = false;
        return;
      }
      // Kena pemain? (badan ≈ kaki + 0.9)
      if (!r.hitDone && st.screen === "playing" && now - lastHit.current > 1500) {
        const d = Math.hypot(r.pos.x - p.x, r.pos.y - (p.y + 0.9), r.pos.z - p.z);
        if (d < 1.8) {
          r.hitDone = true;
          lastHit.current = now;
          playRock();
          useMountainStore.getState().takeHit(12, 8, "🪨 Tertimpa batu jatuh! (-12 stamina, -8 suhu)");
        }
      }
      m.position.copy(r.pos);
      m.rotation.x += r.spin * dt;
      m.rotation.z += r.spin * 0.7 * dt;
    });
  });

  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
          castShadow
        >
          <dodecahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color="#57534e" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Banner peringatan saat memasuki kondisi batu jatuh. */
export function rockfallDanger(): boolean {
  const st = useMountainStore.getState();
  const y = st.playerPos[1];
  return st.screen === "playing" && st.weather === "badai" && y > ROCK_ZONE_MIN && y < ROCK_ZONE_MAX;
}
