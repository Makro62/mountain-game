import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMountainStore } from "../store";
import { BLOCK } from "../voxel";

const SAVE_KEY = "mountain-game-storage";

function readSaved(): { state: Record<string, unknown>; version?: number } {
  const raw = localStorage.getItem(SAVE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string);
}

beforeEach(() => {
  localStorage.clear();
  useMountainStore.getState().startNew();
});

describe("partialize — field kritis ikut tersimpan", () => {
  it("persist berisi field survival + dunia", () => {
    const { state } = readSaved();
    const critical = [
      "stamina",
      "suhu",
      "oksigen",
      "inventory",
      "checkpointIndex",
      "playerPos",
      "collectedLoot",
      "edelweiss",
      "itemsUsed",
      "weather",
      "timeOfDay",
      "startedAt",
      "edits",
      "selectedBlock",
    ];
    for (const k of critical) {
      expect(state, `missing ${k}`).toHaveProperty(k);
    }
  });

  it("field transient tidak ikut tersimpan", () => {
    const { state } = readSaved();
    expect(state).not.toHaveProperty("screen");
    expect(state).not.toHaveProperty("message");
    expect(state).not.toHaveProperty("openNote");
    expect(state).not.toHaveProperty("banner");
  });

  it("field ekspedisi/ghost/catatan ikut tersimpan", () => {
    const { state } = readSaved();
    for (const k of ["mode", "seed", "modifiers", "notesRead", "photoScore", "photosTaken", "ghostEnabled", "distressUsed"]) {
      expect(state, `missing ${k}`).toHaveProperty(k);
    }
  });

  it("save tertulis ulang setelah aksi", () => {
    useMountainStore.getState().unlockCheckpoint(1);
    const { state } = readSaved();
    expect(state.checkpointIndex).toBe(1);
  });
});

describe("kompatibilitas save lama (tanpa field baru)", () => {
  it("JSON lama → field baru dapat default aman", async () => {
    vi.resetModules();
    const oldSave = {
      state: {
        stamina: 55,
        suhu: 70,
        oksigen: 80,
        inventory: { bekal: 2, jaket: 1, p3k: 0, oksigen: 1 },
        checkpointIndex: 2,
        playerPos: [-26, 14, 12],
        collectedLoot: ["l1"],
        edelweiss: ["e1"],
        itemsUsed: { bekal: 1 },
        weather: "hujan",
        timeOfDay: 0.4,
        startedAt: 12345,
        edits: { "0,0": { dh: 2 } },
        selectedBlock: "dirt",
      },
      version: 0,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(oldSave));

    const mod = await import("../store");
    const s = mod.useMountainStore.getState();

    expect(s.stamina).toBe(55);
    expect(s.inventory.bekal).toBe(2);
    expect(s.checkpointIndex).toBe(2);
    expect(s.edits["0,0"]).toEqual({ dh: 2 });

    expect(s.inventory.tali).toBe(0);
    expect(s.inventory.kompas).toBe(0);
    expect(s.inventory.termos).toBe(0);
    expect(s.inventory.peluit).toBe(0);
    expect(s.mode).toBe("standar");
    expect(typeof s.seed).toBe("number");
    expect(s.notesRead).toEqual([]);
    expect(s.photoScore).toBe(0);
    expect(s.ghostEnabled).toBe(true);
    expect(s.distressUsed).toBe(false);
  });
});

describe("voxel edit bounds", () => {
  beforeEach(() => {
    useMountainStore.setState({ screen: "playing", edits: {}, selectedBlock: "stone" });
  });

  it("gali tidak turun di bawah −3 blok (−6 m)", () => {
    for (let i = 0; i < 20; i++) useMountainStore.getState().breakBlockAt(0, 0);
    expect(useMountainStore.getState().edits["0,0"]?.dh).toBe(-BLOCK * 3);
  });

  it("pasang tidak naik di atas +4 blok (+8 m)", () => {
    for (let i = 0; i < 20; i++) useMountainStore.getState().placeBlockAt(5, -3);
    const e = useMountainStore.getState().edits["5,-3"];
    expect(e?.dh).toBe(BLOCK * 4);
    expect(e?.type).toBe("stone");
  });

  it("edit di luar playing → diabaikan", () => {
    useMountainStore.setState({ screen: "paused" });
    useMountainStore.getState().placeBlockAt(1, 1);
    expect(useMountainStore.getState().edits["1,1"]).toBeUndefined();
  });

  it("type default mengikuti selectedBlock (dirt)", () => {
    useMountainStore.setState({ selectedBlock: "dirt" });
    useMountainStore.getState().placeBlockAt(2, 2);
    expect(useMountainStore.getState().edits["2,2"]?.type).toBe("dirt");
  });
});
