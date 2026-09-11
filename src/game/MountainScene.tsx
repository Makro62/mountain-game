import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CHECKPOINTS, FORKS, LOOT_SPOTS, SHORTCUT_A, SHORTCUT_B, SNOW_LINE, WORLD_SIZE, distToTrail, getHeight, getRiverDepth, getSlope, trailMarkerPoints, type LootSpot } from "./terrain";
import { sharedMat, useShadows } from "./modelKit";
import { useMountainStore } from "./store";
import { playerState } from "./playerRef";
import { Player } from "./Player";
import { Hiker } from "./Hiker";
import { Trees, Birches, Shrubs, Rocks, GrassTufts } from "./Trees";
import { Birds, DeerHerd } from "./Animals";
import { River } from "./River";
import { Sun } from "./Sun";
import { Clouds } from "./Clouds";
import { Snowfall, Footprints } from "./Snowfall";
import { Rockfall } from "./Rockfall";
import { MeadowFlowers, EdelweissPatch } from "./Flowers";

const ITEM_COLORS: Record<string, string> = {
  bekal: "#fbbf24",
  jaket: "#38bdf8",
  p3k: "#f87171",
  oksigen: "#4ade80",
};

function TerrainMesh() {
  const geometry = useMemo(() => {
    const segs = 160;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color("#3f6212");
    const cRock = new THREE.Color("#78716c");
    const cSnow = new THREE.Color("#f8fafc");
    const cSand = new THREE.Color("#a8a29e");
    const cRiverbed = new THREE.Color("#44403c");
    const cPath = new THREE.Color("#8a6f4d");
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = getHeight(x, z);
      pos.setY(i, h);
      if (h > 48) tmp.copy(cSnow);
      else if (h > 28) tmp.copy(cRock).lerp(cSnow, (h - 28) / 20);
      else if (h > 10) tmp.copy(cGrass).lerp(cRock, (h - 10) / 18);
      else tmp.copy(cSand).lerp(cGrass, Math.max(0, h / 10));
      // Tebing curam = batu walau rendah
      const sl = getSlope(x, z);
      if (sl > 0.55 && h <= 48) tmp.lerp(cRock, Math.min(0.8, (sl - 0.55) * 1.5));
      // Dasar sungai lebih gelap (basah)
      const rd = getRiverDepth(x, z);
      if (rd > 0.05) tmp.lerp(cRiverbed, Math.min(0.7, rd * 0.4));
      // Tanah jalur pendakian (terlihat berkelok dari jauh)
      const td = distToTrail(x, z);
      if (td < 2.4) tmp.lerp(cPath, 0.75 * (1 - td / 2.4));
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}

function SkyRig() {
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const timeOfDay = useMountainStore((s) => s.timeOfDay);
  const weather = useMountainStore((s) => s.weather);

  useEffect(() => {
    if (dirRef.current) dirRef.current.target = target;
  }, [target]);

  useFrame(({ scene }) => {
    const sunAngle = timeOfDay * Math.PI * 2;
    const elevation = Math.sin(sunAngle) * 60 + 20;
    const isNight = timeOfDay > 0.55 && timeOfDay < 0.95;
    const p = useMountainStore.getState().playerPos;
    if (dirRef.current) {
      // Matahari mengikuti pemain: kotak bayangan ±60 m selalu di sekitar aksi
      const sunDir = new THREE.Vector3(Math.cos(sunAngle) * 100, Math.max(5, elevation), -60).normalize();
      dirRef.current.position.set(p[0] + sunDir.x * 90, p[1] + sunDir.y * 90, p[2] + sunDir.z * 90);
      target.position.set(p[0], p[1], p[2]);
      target.updateMatrixWorld();
      dirRef.current.intensity = isNight ? 0.25 : weather === "badai" ? 0.7 : 1.6;
    }
    if (scene.fog instanceof THREE.Fog) {
      if (weather === "kabut") {
        scene.fog.near = 8;
        scene.fog.far = 60;
      } else if (weather === "hujan" || weather === "badai") {
        scene.fog.near = 20;
        scene.fog.far = 140;
      } else {
        scene.fog.near = 40;
        scene.fog.far = 320;
      }
      // Zona salju: jarak pandang menyempit + nuansa dingin
      const alt = useMountainStore.getState().playerPos[1];
      if (alt > SNOW_LINE) {
        scene.fog.near = Math.min(scene.fog.near, 12);
        scene.fog.far = Math.min(scene.fog.far, 120);
      }
      scene.fog.color.set(isNight ? "#0b1120" : weather === "badai" ? "#334155" : "#bfdbfe");
    }
    scene.background = new THREE.Color(isNight ? "#020617" : weather === "badai" ? "#475569" : "#87ceeb");
  });

  const sunPos: [number, number, number] = [
    Math.cos(timeOfDay * Math.PI * 2) * 100,
    40,
    -60,
  ];

  return (
    <>
      <hemisphereLight args={["#bfdbfe", "#365314", 0.7]} />
      <directionalLight
        ref={dirRef}
        position={sunPos}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={10}
        shadow-camera-far={250}
        shadow-bias={-0.0008}
        shadow-normalBias={2}
      />
      <primitive object={target} />
      <Sky sunPosition={sunPos} turbidity={8} rayleigh={2} />
      <fog attach="fog" args={["#bfdbfe", 40, 320]} />
    </>
  );
}

/** PBR environment prosedural (RoomEnvironment, tanpa download) untuk pantulan air/salju. */
function EnvSetup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.5;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Bendera yang berkibar tertiup angin. */
function WavingFlag({ color, position }: { color: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * 6);
  useFrame((_, rawDt) => {
    t.current += Math.min(rawDt, 0.1);
    if (ref.current) {
      ref.current.rotation.y = Math.sin(t.current * 3) * 0.3;
      ref.current.scale.x = 1 + Math.sin(t.current * 5) * 0.06;
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[1.8, 1, 0.05]} />
      <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.8} />
    </mesh>
  );
}

/** Satu unit tenda camp: groundsheet, atap A-frame, entrance, tiang, tali pancang, peti. */
function Camp({ position, reached }: { position: [number, number, number]; reached: boolean }) {
  const fabric = reached ? "#ea580c" : "#64748b";
  return (
    <group position={position}>
      {/* Alas */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[2.6, 0.06, 2.4]} />
        <meshStandardMaterial color="#292524" roughness={1} />
      </mesh>
      {/* Dua panel atap */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 1.05, s * 1.0]} rotation={[s * 0.8, 0, 0]} castShadow>
          <boxGeometry args={[2.6, 0.08, 2.3]} />
          <meshStandardMaterial color={fabric} roughness={0.9} />
        </mesh>
      ))}
      {/* Entrance gelap di sisi depan */}
      <mesh position={[0, 0.65, 1.52]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[1.4, 1.2, 0.06]} />
        <meshStandardMaterial color="#1c1917" roughness={1} />
      </mesh>
      {/* Bubungan + tiang ujung */}
      <mesh position={[0, 2.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 3.2, 7]} />
        <meshStandardMaterial color="#5b3a1e" roughness={0.9} />
      </mesh>
      {[-1.45, 1.45].map((x, i) => (
        <mesh key={i} position={[x, 1.0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.0, 7]} />
          <meshStandardMaterial color="#5b3a1e" roughness={0.9} />
        </mesh>
      ))}
      {/* Tali pancang ke patok */}
      {[
        [-1.3, 1.9, -1.9, 2.6],
        [1.3, 1.9, 1.9, 2.6],
        [-1.3, -1.9, -1.9, -2.6],
        [1.3, -1.9, 1.9, -2.6],
      ].map(([x1, z1, x2, z2], i) => (
        <group key={i}>
          <mesh position={[(x1 + x2) / 2, 0.35, (z1 + z2) / 2]} rotation={[z2 > z1 ? -0.5 : 0.5, 0, x2 > x1 ? 0.4 : -0.4]}>
            <cylinderGeometry args={[0.02, 0.02, 1.7, 5]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.9} />
          </mesh>
          <mesh position={[x2, 0.1, z2]}>
            <boxGeometry args={[0.12, 0.2, 0.12]} />
            <meshStandardMaterial color="#44403c" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* Peti perbekalan + matras gulung */}
      <mesh position={[1.9, 0.25, 1.5]} castShadow>
        <boxGeometry args={[0.7, 0.5, 0.5]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[1.9, 0.62, 1.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 0.72, 8]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Api unggun: ring batu, kayu, api emissive + cahaya flicker (menyala jika pos tercapai). */
function Campfire({ position, lit }: { position: [number, number, number]; lit: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 10);
  const stones = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return [Math.cos(a) * 0.75, Math.sin(a) * 0.75] as [number, number];
      }),
    []
  );

  useFrame((_, rawDt) => {
    t.current += Math.min(rawDt, 0.1);
    const d = Math.hypot(playerState.pos.x - position[0], playerState.pos.z - position[2]);
    if (light.current) {
      light.current.intensity =
        lit && d < 70 ? 7 + Math.sin(t.current * 11) * 1.8 + Math.sin(t.current * 23) * 1.2 : 0;
    }
    if (flame.current) {
      flame.current.visible = lit;
      flame.current.scale.set(
        1 + Math.sin(t.current * 13) * 0.1,
        1 + Math.sin(t.current * 17) * 0.2,
        1 + Math.sin(t.current * 13) * 0.1
      );
    }
  });

  return (
    <group position={position}>
      {stones.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]} castShadow>
          <dodecahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color="#78716c" roughness={1} />
        </mesh>
      ))}
      {/* Kayu bakar rebah */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3]} rotation={[Math.PI / 2, 0, a]}>
            <cylinderGeometry args={[0.09, 0.11, 0.9, 7]} />
            <meshStandardMaterial color="#451a03" roughness={1} />
          </mesh>
        );
      })}
      {/* Api + bara */}
      <group ref={flame}>
        <mesh position={[0, 0.55, 0]}>
          <coneGeometry args={[0.32, 0.85, 8]} />
          <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={2.2} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <coneGeometry args={[0.16, 0.55, 8]} />
          <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={3} />
        </mesh>
      </group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.4, 0.45, 0.12, 10]} />
        <meshStandardMaterial color="#1c1917" emissive="#7c2d12" emissiveIntensity={lit ? 0.8 : 0} />
      </mesh>
      <pointLight ref={light} position={[0, 1.4, 0]} color="#fb923c" distance={20} decay={2} />
      {/* Bangku batang */}
      <mesh position={[2.1, 0.25, 0.4]} rotation={[Math.PI / 2, 0, 0.15]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 2.2, 9]} />
        <meshStandardMaterial color="#5b3a1e" roughness={1} />
      </mesh>
      {[-0.7, 0.7].map((z, i) => (
        <mesh key={i} position={[2.1, 0.12, 0.4 + z]}>
          <boxGeometry args={[0.5, 0.24, 0.3]} />
          <meshStandardMaterial color="#44403c" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Loot melayang + berputar agar terlihat sebagai pickup. */
function LootMesh({ l }: { l: LootSpot }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * 6);
  const y = getHeight(l.x, l.z) + 1;
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    t.current += dt;
    if (ref.current) {
      ref.current.position.y = y + Math.sin(t.current * 2) * 0.15;
      ref.current.rotation.y += dt * 1.2;
    }
  });
  const c = ITEM_COLORS[l.item] ?? "#fff";
  return (
    <mesh ref={ref} position={[l.x, y, l.z]} material={sharedMat(c, 0.6, { emissive: c, emissiveIntensity: 0.5 })} castShadow>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
    </mesh>
  );
}

/** Rambu dengan mata panah menunjuk rute aman (hijau) & pintas (oranye). */
function SignPost({ f }: { f: (typeof FORKS)[number] }) {
  const y = getHeight(f.x, f.z);
  // Panah (+X lokal) diarahkan ke target: rot.y = atan2(-dz, dx)
  const mainYaw = Math.atan2(-(f.mainZ - f.z), f.mainX - f.x);
  const altYaw = Math.atan2(-(f.altZ - f.z), f.altX - f.x);
  const boards = [
    { yaw: mainYaw, y: 1.8, color: "#22c55e" },
    { yaw: altYaw, y: 1.3, color: "#fb923c" },
  ];
  return (
    <group position={[f.x, y, f.z]}>
      <mesh position={[0, 1.1, 0]} material={sharedMat("#5b3a1e")}>
        <cylinderGeometry args={[0.09, 0.09, 2.2]} />
      </mesh>
      {boards.map((b, i) => (
        <group key={i} position={[0, b.y, 0]} rotation={[0, b.yaw, 0]}>
          <mesh position={[0.8, 0, 0]} material={sharedMat(b.color, 0.8)}>
            <boxGeometry args={[1.5, 0.4, 0.08]} />
          </mesh>
          <mesh position={[1.65, 0, 0]} rotation={[0, 0, -Math.PI / 2]} material={sharedMat(b.color, 0.8)}>
            <coneGeometry args={[0.24, 0.4, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Props() {
  const collected = useMountainStore((s) => s.collectedLoot);
  const checkpointIndex = useMountainStore((s) => s.checkpointIndex);
  const group = useRef<THREE.Group>(null);

  useShadows(group);

  return (
    <group ref={group}>
      {/* Camp + api unggun + bendera di tiap checkpoint */}
      {CHECKPOINTS.map((cp, i) => {
        const y = getHeight(cp.x, cp.z);
        const reached = i <= checkpointIndex;
        const fx = cp.x - 3.5;
        const fz = cp.z + 1.5;
        return (
          <group key={cp.id}>
            <Camp position={[cp.x + 3.5, y, cp.z]} reached={reached} />
            {cp.id === "basecamp" && <Camp position={[cp.x - 5, getHeight(cp.x - 5, cp.z + 3), cp.z + 3]} reached={reached} />}
            <Campfire position={[fx, getHeight(fx, fz), fz]} lit={reached} />
            {/* Gapura basecamp */}
            {cp.id === "basecamp" && (
              <group position={[cp.x, getHeight(cp.x, cp.z + 10), cp.z + 10]}>
                {[-2.2, 2.2].map((x, k) => (
                  <mesh key={k} position={[x, 1.5, 0]} castShadow>
                    <cylinderGeometry args={[0.14, 0.16, 3.0, 8]} />
                    <meshStandardMaterial color="#5b3a1e" roughness={0.9} />
                  </mesh>
                ))}
                <mesh position={[0, 3.0, 0]} castShadow>
                  <boxGeometry args={[5.2, 0.28, 0.28]} />
                  <meshStandardMaterial color="#5b3a1e" roughness={0.9} />
                </mesh>
                <mesh position={[0, 2.2, 0]}>
                  <boxGeometry args={[2.4, 0.8, 0.1]} />
                  <meshStandardMaterial color="#92400e" roughness={0.9} />
                </mesh>
              </group>
            )}
            {/* tiang bendera */}
            <mesh position={[cp.x, y + 2.5, cp.z]}>
              <cylinderGeometry args={[0.08, 0.08, 5]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
            </mesh>
            <WavingFlag color={cp.id === "puncak" ? "#ef4444" : "#22c55e"} position={[cp.x + 0.9, y + 4.2, cp.z]} />
          </group>
        );
      })}
      {/* Loot mengambang */}
      {LOOT_SPOTS.filter((l) => !collected.includes(l.id)).map((l) => (
        <LootMesh key={l.id} l={l} />
      ))}
      {/* Penanda jalur utama: oktahedron merah mengikuti kelokan */}
      {trailMarkerPoints(18).map(([mx, mz], i) => {
        const y = getHeight(mx, mz) + 0.4;
        return (
          <mesh key={i} position={[mx + 2.2, y, mz]} material={sharedMat("#ef4444", 0.6, { emissive: "#ef4444", emissiveIntensity: 0.6 })}>
            <octahedronGeometry args={[0.3]} />
          </mesh>
        );
      })}
      {/* Penanda pintasan: oktahedron oranye */}
      {[SHORTCUT_A, SHORTCUT_B].map((path, pi) =>
        path.map(([sx, sz], i) => (
          <mesh key={`${pi}-${i}`} position={[sx - 2.2, getHeight(sx, sz) + 0.4, sz]} material={sharedMat("#fb923c", 0.6, { emissive: "#fb923c", emissiveIntensity: 0.6 })}>
            <octahedronGeometry args={[0.26]} />
          </mesh>
        ))
      )}
      {/* Rambu berpanah di persimpangan */}
      {FORKS.map((f) => (
        <SignPost key={f.name} f={f} />
      ))}
    </group>
  );
}

export function MountainScene() {
  return (
    <Canvas
      shadows
      camera={{ fov: 75, near: 0.1, far: 800, position: [0, 10, 162] }}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    >
      <EnvSetup />
      <SkyRig />
      <Sun />
      <Clouds />
      <TerrainMesh />
      <River />
      <Trees />
      <Birches />
      <Shrubs />
      <Rocks />
      <GrassTufts />
      <MeadowFlowers />
      <EdelweissPatch />
      <Birds />
      <DeerHerd />
      <Snowfall />
      <Footprints />
      <Rockfall />
      <Props />
      <Player />
      <Hiker />
    </Canvas>
  );
}
