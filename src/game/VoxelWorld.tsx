import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  BLOCK,
  blockKey,
  blockTint,
  blockToWorld,
  getVoxelTop,
  topBlockType,
  waterLevelY,
  worldToBlock,
  type BlockType,
} from "./voxel";
import { WORLD_BOUND, getRiverDepth } from "./terrain";
import { useMountainStore } from "./store";
import { playBreak, playPlace } from "./audio";

const GROUND_TYPES: BlockType[] = ["grass", "dirt", "stone", "snow", "sand", "riverbed"];
const REACH = 9;

interface Col {
  bx: number;
  bz: number;
  top: number;
  type: BlockType;
}

/** Dunia voxel stepped ala Minecraft: 1 kolom = 1 blok atas + 1 pengisi. */
export function VoxelWorld() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const edits = useMountainStore((s) => s.edits);
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState<[number, number, number] | null>(null);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const center = useMemo(() => new THREE.Vector2(0, 0), []);
  const throttle = useRef(0);

  // --- Bangun kolom sekali per perubahan edits ---
  const { columns, waters } = useMemo(() => {
    const cols: Col[] = [];
    const wts: Array<{ x: number; y: number; z: number }> = [];
    const half = Math.floor(WORLD_BOUND / BLOCK);
    for (let bx = -half; bx <= half; bx++) {
      for (let bz = -half; bz <= half; bz++) {
        const [x, z] = blockToWorld(bx, bz);
        const top = getVoxelTop(x, z, edits);
        const type = topBlockType(x, z);
        cols.push({ bx, bz, top, type });
        if (getRiverDepth(x, z) > 0.4) {
          wts.push({ x, y: waterLevelY(x, z), z });
        }
      }
    }
    return { columns: cols, waters: wts };
  }, [edits]);

  // --- InstancedMesh per tipe blok ---
  const meshes = useMemo(() => {
    const geo = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);
    const dummy = new THREE.Object3D();
    const out: THREE.InstancedMesh[] = [];
    const byType = new Map<BlockType, Col[]>();
    for (const c of columns) {
      if (!byType.has(c.type)) byType.set(c.type, []);
      byType.get(c.type)!.push(c);
    }
    // Tiap kolom: blok atas + 4 blok pengisi di bawahnya (tebing terlihat padat)
    for (const t of GROUND_TYPES) {
      const list = byType.get(t) ?? [];
      if (list.length === 0) continue;
      const count = list.length * 5;
      const mat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
      const m = new THREE.InstancedMesh(geo.clone(), mat, count);
      let i = 0;
      for (const c of list) {
        const [x, z] = blockToWorld(c.bx, c.bz);
        dummy.position.set(x, c.top - BLOCK / 2, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        m.setColorAt(i, blockTint(c.type, c.bx, c.bz));
        i++;
        for (let layer = 1; layer <= 4; layer++) {
          dummy.position.set(x, c.top - BLOCK * (layer + 0.5), z);
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
          m.setColorAt(i, blockTint(c.top > 28 ? "stone" : "dirt", c.bx, c.bz + 999));
          i++;
        }
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.receiveShadow = true;
      out.push(m);
    }
    // Air: kotak pipih transparan
    if (waters.length > 0) {
      const wgeo = new THREE.BoxGeometry(BLOCK, 0.35, BLOCK);
      const wmat = new THREE.MeshLambertMaterial({ color: "#2f9fe0", transparent: true, opacity: 0.75 });
      const wm = new THREE.InstancedMesh(wgeo, wmat, waters.length);
      waters.forEach((w, i) => {
        dummy.position.set(w.x, w.y, w.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        wm.setMatrixAt(i, dummy.matrix);
      });
      wm.instanceMatrix.needsUpdate = true;
      out.push(wm);
    }
    return out;
  }, [columns, waters]);

  useEffect(() => {
    return () => {
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        m.dispose();
      });
    };
  }, [meshes]);

  // --- Hover highlight (throttle raycast dari tengah layar) ---
  useFrame(() => {
    throttle.current -= 0.016;
    if (throttle.current > 0 || !group.current) return;
    throttle.current = 0.15;
    const st = useMountainStore.getState();
    if (st.screen !== "playing" || !st.buildMode) {
      if (hover) setHover(null);
      return;
    }
    ray.setFromCamera(center, camera);
    ray.far = REACH;
    const hits = ray.intersectObjects(group.current.children, false);
    if (hits.length > 0) {
      const p = hits[0].point;
      const [bx, bz] = worldToBlock(p.x - 0.01 * Math.sign(p.x), p.z);
      const [cx, cz] = blockToWorld(bx, bz);
      const top = getVoxelTop(cx, cz, useMountainStore.getState().edits);
      setHover((h) => (h && h[0] === cx && h[1] === top && h[2] === cz ? h : [cx, top, cz]));
    } else if (hover) {
      setHover(null);
    }
  });

  // --- Klik kiri hancurkan, klik kanan pasang (saat pointer terkunci) ---
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const st = useMountainStore.getState();
      if (st.screen !== "playing" || !st.buildMode) return;
      if (document.pointerLockElement !== gl.domElement) return;
      if (e.button !== 0 && e.button !== 2) return;
      ray.setFromCamera(center, camera);
      ray.far = REACH;
      if (!group.current) return;
      const hits = ray.intersectObjects(group.current.children, false);
      if (hits.length === 0) return;
      const hit = hits[0];
      if (e.button === 0) {
        const [bx, bz] = worldToBlock(hit.point.x, hit.point.z);
        st.breakBlockAt(bx, bz);
        playBreak();
      } else {
        const n = hit.face?.normal ?? new THREE.Vector3(0, 1, 0);
        const tx = hit.point.x + n.x * BLOCK * 0.6;
        const tz = hit.point.z + n.z * BLOCK * 0.6;
        const [bx, bz] = worldToBlock(tx, tz);
        st.placeBlockAt(bx, bz);
        playPlace();
      }
    };
    const onCtx = (e: Event) => e.preventDefault();
    gl.domElement.addEventListener("mousedown", onDown);
    gl.domElement.addEventListener("contextmenu", onCtx);
    return () => {
      gl.domElement.removeEventListener("mousedown", onDown);
      gl.domElement.removeEventListener("contextmenu", onCtx);
    };
  }, [gl, ray, center, camera]);

  return (
    <group ref={group}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {hover && (
        <mesh position={[hover[0], hover[1] - BLOCK / 2 + 0.02, hover[2]]}>
          <boxGeometry args={[BLOCK + 0.06, BLOCK + 0.06, BLOCK + 0.06]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

/** Helper untuk logika lain: kunci kolom dari posisi dunia. */
export function columnKeyAt(x: number, z: number): string {
  const [bx, bz] = worldToBlock(x, z);
  return blockKey(bx, bz);
}
