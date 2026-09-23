import { describe, expect, it } from "vitest";
import {
  CHECKPOINTS,
  EDELWEISS,
  LOOT_SPOTS,
  NOTES,
  TRAIL,
  WORLD_BOUND,
  getHeight,
  getRiverDepth,
  distToTrail,
} from "../terrain";

describe("getHeight — deterministik & bentuk dunia", () => {
  it("deterministik: pemanggilan berulang identik", () => {
    const pts: Array<[number, number]> = [
      [0, 150],
      [0, -150],
      [37.5, -12.3],
      [-80, 40],
      [120, -90],
    ];
    for (const [x, z] of pts) {
      expect(getHeight(x, z)).toBe(getHeight(x, z));
    }
  });

  it("selalu ≥ 0", () => {
    for (let x = -190; x <= 190; x += 47) {
      for (let z = -190; z <= 190; z += 43) {
        expect(getHeight(x, z)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("puncak (0,-150) lebih tinggi dari basecamp (0,150)", () => {
    const peak = getHeight(0, -150);
    const base = getHeight(0, 150);
    expect(peak).toBeGreaterThan(base + 30);
  });

  it("ketinggian checkpoint berprogresi naik", () => {
    const hs = CHECKPOINTS.map((cp) => getHeight(cp.x, cp.z));
    for (let i = 1; i < hs.length; i++) {
      expect(hs[i]).toBeGreaterThan(hs[i - 1]);
    }
  });

  it("alur sungai lebih rendah dari tepi di sekitar z=45 (di luar jembatan)", () => {
    const z = 90;
    const cx = (z - 45) * 0.35 + 6 * Math.sin(z * 0.025) - 6 * Math.sin(45 * 0.025);
    expect(getRiverDepth(cx, z)).toBeGreaterThan(0.5);
    expect(getHeight(cx, z)).toBeLessThan(getHeight(cx + 20, z));
  });
});

describe("CHECKPOINTS", () => {
  it("berurutan menaik dari basecamp ke puncak", () => {
    expect(CHECKPOINTS[0].id).toBe("basecamp");
    expect(CHECKPOINTS[CHECKPOINTS.length - 1].id).toBe("puncak");
    expect(CHECKPOINTS).toHaveLength(5);
  });

  it("semua di dalam world bound + radius wajar", () => {
    for (const cp of CHECKPOINTS) {
      expect(Math.abs(cp.x)).toBeLessThanOrEqual(WORLD_BOUND);
      expect(Math.abs(cp.z)).toBeLessThanOrEqual(WORLD_BOUND);
      expect(cp.radius).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("TRAIL", () => {
  it("semua waypoint dalam batas dunia", () => {
    for (const [x, z] of TRAIL) {
      expect(Math.abs(x)).toBeLessThanOrEqual(WORLD_BOUND);
      expect(Math.abs(z)).toBeLessThanOrEqual(WORLD_BOUND);
    }
  });

  it("mulai di basecamp & berakhir di puncak", () => {
    expect(TRAIL[0]).toEqual([CHECKPOINTS[0].x, CHECKPOINTS[0].z]);
    const last = TRAIL[TRAIL.length - 1];
    expect(last).toEqual([CHECKPOINTS[CHECKPOINTS.length - 1].x, CHECKPOINTS[CHECKPOINTS.length - 1].z]);
  });

  it("melewati tiap checkpoint (jarak < radius)", () => {
    for (const cp of CHECKPOINTS) {
      const minDist = Math.min(...TRAIL.map(([x, z]) => Math.hypot(x - cp.x, z - cp.z)));
      expect(minDist).toBeLessThanOrEqual(cp.radius);
    }
  });
});

describe("LOOT_SPOTS", () => {
  const LEGACY = new Set(["bekal", "jaket", "p3k", "oksigen"]);
  const NEW = new Set(["tali", "kompas", "termos", "peluit"]);

  it("id unik & item valid", () => {
    const ids = new Set<string>();
    for (const l of LOOT_SPOTS) {
      expect(ids.has(l.id)).toBe(false);
      ids.add(l.id);
      expect(LEGACY.has(l.item) || NEW.has(l.item)).toBe(true);
    }
  });

  it("di dalam batas dunia & dekat jalur (jangkau pemain)", () => {
    for (const l of LOOT_SPOTS) {
      expect(Math.abs(l.x)).toBeLessThanOrEqual(WORLD_BOUND);
      expect(Math.abs(l.z)).toBeLessThanOrEqual(WORLD_BOUND);
      expect(distToTrail(l.x, l.z)).toBeLessThan(15);
    }
  });

  it("setiap item legacy minimal tersedia 1 spot", () => {
    for (const item of ["bekal", "jaket", "p3k", "oksigen"]) {
      expect(LOOT_SPOTS.some((l) => l.item === item)).toBe(true);
    }
  });

  it("item baru tersedia di terrain", () => {
    for (const item of ["tali", "kompas", "termos", "peluit"]) {
      expect(LOOT_SPOTS.some((l) => l.item === item)).toBe(true);
    }
  });
});

describe("EDELWEISS & NOTES", () => {
  it("12 edelweiss id unik di dalam bound", () => {
    expect(EDELWEISS).toHaveLength(12);
    const ids = new Set(EDELWEISS.map((e) => e.id));
    expect(ids.size).toBe(12);
    for (const e of EDELWEISS) {
      expect(Math.abs(e.x)).toBeLessThanOrEqual(WORLD_BOUND);
      expect(Math.abs(e.z)).toBeLessThanOrEqual(WORLD_BOUND);
    }
  });

  it("5 catatan lore id unik, teks non-kosong, di dalam bound", () => {
    expect(NOTES).toHaveLength(5);
    const ids = new Set(NOTES.map((n) => n.id));
    expect(ids.size).toBe(5);
    for (const n of NOTES) {
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.text.length).toBeGreaterThan(20);
      expect(Math.abs(n.x)).toBeLessThanOrEqual(WORLD_BOUND);
      expect(Math.abs(n.z)).toBeLessThanOrEqual(WORLD_BOUND);
      expect(distToTrail(n.x, n.z)).toBeLessThan(25);
    }
  });
});
