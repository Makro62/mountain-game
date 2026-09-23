import { beforeEach, describe, expect, it } from "vitest";
import {
  GHOST_KEY,
  ghostDistance,
  ghostPointCount,
  ghostPosAt,
  ghostRecord,
  ghostReset,
  loadGhost,
  saveGhostIfBest,
} from "../ghost";
import { useMountainStore } from "../store";

beforeEach(() => {
  ghostReset();
  localStorage.removeItem(GHOST_KEY);
});

describe("ghost recording", () => {
  it("merebut ~0,5 dtk sekali (titik awal + cadence dt)", () => {
    ghostRecord(0.1, 0, 0, 0);
    expect(ghostPointCount()).toBe(4);
    for (let i = 1; i <= 4; i++) ghostRecord(0.1, i, 0, 0);
    expect(ghostPointCount()).toBe(4);
    for (let i = 5; i <= 9; i++) ghostRecord(0.1, i, 0, 0);
    expect(ghostPointCount()).toBe(8);
  });

  it("ghostReset mengosongkan buffer & jarak", () => {
    for (let i = 0; i < 30; i++) ghostRecord(0.1, i * 2, 0, 0);
    expect(ghostDistance()).toBeGreaterThan(0);
    ghostReset();
    expect(ghostPointCount()).toBe(0);
    expect(ghostDistance()).toBe(0);
  });

  it("cap maksimal 1200 titik (4800 number)", () => {
    for (let i = 0; i < 2000; i++) ghostRecord(1, i, 0, 0);
    expect(ghostPointCount()).toBeLessThanOrEqual(1200 * 4);
    expect(ghostPointCount() % 4).toBe(0);
  });

  it("jarak dihitung dari seluruh segmen breadcrumb", () => {
    for (let i = 0; i < 30; i++) ghostRecord(0.1, i, 0, 0);
    const d = ghostDistance();
    expect(d).toBeGreaterThan(0);
  });
});

describe("save & load ghost", () => {
  it("buffer kosong tidak disimpan", () => {
    expect(saveGhostIfBest({ seed: 1, mode: "standar", timeMs: 1000, edelweiss: 0 })).toBe(false);
    expect(loadGhost()).toBeNull();
  });

  it("disimpan bila lebih cepat dari ghost lama", () => {
    for (let i = 0; i < 30; i++) ghostRecord(0.1, i, 1, 0);
    expect(saveGhostIfBest({ seed: 42, mode: "standar", timeMs: 50000, edelweiss: 3 })).toBe(true);
    const g = loadGhost();
    expect(g).not.toBeNull();
    expect(g?.seed).toBe(42);
    expect(g?.timeMs).toBe(50000);
    expect(g?.edelweiss).toBe(3);
    expect(g?.points.length).toBeGreaterThanOrEqual(4);

    ghostReset();
    for (let i = 0; i < 30; i++) ghostRecord(0.1, i, 1, 0);
    expect(saveGhostIfBest({ seed: 43, mode: "standar", timeMs: 90000, edelweiss: 5 })).toBe(false);
    expect(loadGhost()?.seed).toBe(42);

    ghostReset();
    for (let i = 0; i < 30; i++) ghostRecord(0.1, i, 1, 0);
    expect(saveGhostIfBest({ seed: 44, mode: "standar", timeMs: 10000, edelweiss: 1 })).toBe(true);
    expect(loadGhost()?.seed).toBe(44);
  });

  it("JSON rusak → loadGhost null (tidak crash)", () => {
    localStorage.setItem(GHOST_KEY, "not-json{");
    expect(loadGhost()).toBeNull();
    localStorage.setItem(GHOST_KEY, JSON.stringify({ points: [1] }));
    expect(loadGhost()).toBeNull();
  });
});

describe("ghostPosAt — interpolasi", () => {
  const pts = [0, 0, 0, 0, 2, 10, 5, -10, 4, 20, 5, -20];

  it("sebelum titik pertama → posisi awal", () => {
    expect(ghostPosAt(pts, -1)).toEqual([0, 0, 0]);
  });

  it("setelah titik terakhir → posisi akhir", () => {
    expect(ghostPosAt(pts, 99)).toEqual([20, 5, -20]);
  });

  it("di tengah segmen → interpolasi linear", () => {
    const p = ghostPosAt(pts, 1);
    expect(p?.[0]).toBeCloseTo(5, 5);
    expect(p?.[2]).toBeCloseTo(-5, 5);
  });

  it("buffer kosong → null", () => {
    expect(ghostPosAt([], 1)).toBeNull();
  });
});

describe("ghost tersimpan saat menang (integrasi store)", () => {
  beforeEach(() => {
    useMountainStore.getState().startExpedition("standar");
  });

  it("unlockCheckpoint puncak menyimpan best ghost dari buffer rekaman", () => {
    for (let i = 0; i < 40; i++) ghostRecord(0.1, i, 2, 0);
    useMountainStore.setState({ startedAt: Date.now() - 60000 });
    useMountainStore.getState().unlockCheckpoint(4);
    expect(useMountainStore.getState().screen).toBe("won");
    const g = loadGhost();
    expect(g).not.toBeNull();
    expect(g?.mode).toBe("standar");
    expect(g?.points.length).toBeGreaterThan(0);
  });
});
