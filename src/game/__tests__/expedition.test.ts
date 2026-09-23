import { beforeEach, describe, expect, it } from "vitest";
import {
  activeLootIds,
  dailySeedString,
  hashSeed,
  randomSeed,
  rollExpedition,
  seedCode,
  weatherPoolFor,
} from "../expedition";
import { LOOT_SPOTS } from "../terrain";
import { useMountainStore } from "../store";

describe("seed algorithm", () => {
  it("hashSeed deterministik & berbeda untuk string beda", () => {
    expect(hashSeed("2026-09-23")).toBe(hashSeed("2026-09-23"));
    expect(hashSeed("2026-09-23")).not.toBe(hashSeed("2026-09-24"));
    expect(hashSeed("2026-09-23")).toBeGreaterThanOrEqual(0);
  });

  it("dailySeedString format YYYY-MM-DD", () => {
    expect(dailySeedString(new Date(2026, 8, 23))).toBe("2026-09-23");
    expect(dailySeedString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("seedCode format #XXXX hex kapital", () => {
    expect(seedCode(0)).toBe("#0000");
    expect(seedCode(0xa3f2)).toBe("#A3F2");
    expect(seedCode(0x12345678)).toBe("#5678");
  });

  it("randomSeed tidak pernah 0", () => {
    for (let i = 0; i < 50; i++) expect(randomSeed()).not.toBe(0);
  });
});

describe("activeLootIds", () => {
  const LEGACY = new Set(["bekal", "jaket", "p3k", "oksigen"]);
  const NEW = new Set(["tali", "kompas", "termos", "peluit"]);

  it("seed 0 (save lama) = semua loot aktif", () => {
    expect(activeLootIds(0)).toHaveLength(LOOT_SPOTS.length);
  });

  it("deterministik per seed & subset dari LOOT_SPOTS", () => {
    const a = activeLootIds(12345);
    const b = activeLootIds(12345);
    expect(a).toEqual(b);
    const all = new Set(LOOT_SPOTS.map((l) => l.id));
    for (const id of a) expect(all.has(id)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(7);
    expect(a.length).toBeLessThanOrEqual(LOOT_SPOTS.length);
  });

  it("item inti (bekal/p3k/oksigen) selalu tersedia → run tetap menang", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const ids = new Set(activeLootIds(seed));
      const spots = LOOT_SPOTS.filter((l) => ids.has(l.id));
      for (const core of ["bekal", "p3k", "oksigen"]) {
        expect(spots.some((l) => l.item === core), `seed ${seed} missing ${core}`).toBe(true);
      }
      for (const l of spots) {
        expect(LEGACY.has(l.item) || NEW.has(l.item)).toBe(true);
      }
    }
  });

  it("seed beda umumnya menghasilkan subset beda (replayability)", () => {
    const diffs = Array.from({ length: 20 }, (_, i) => {
      const a = activeLootIds(1000 + i).join(",");
      const b = activeLootIds(2000 + i).join(",");
      return a !== b;
    });
    expect(diffs.filter(Boolean).length).toBeGreaterThan(15);
  });
});

describe("rollExpedition", () => {
  it("deterministik: modifier + cuaca awal sama per seed", () => {
    const p1 = rollExpedition(777);
    const p2 = rollExpedition(777);
    expect(p1.modifiers).toEqual(p2.modifiers);
    expect(p1.startWeather).toBe(p2.startWeather);
    expect(p1.activeLoot).toEqual(p2.activeLoot);
  });

  it("1–2 modifier dari pool yang dikenal", () => {
    const known = new Set(["Kabut Tebal", "Badai Sore", "Jalur Lembap", "Langit Terbuka"]);
    for (let seed = 1; seed <= 30; seed++) {
      const plan = rollExpedition(seed);
      expect(plan.modifiers.length).toBeGreaterThanOrEqual(1);
      expect(plan.modifiers.length).toBeLessThanOrEqual(2);
      for (const m of plan.modifiers) expect(known.has(m)).toBe(true);
    }
  });

  it("cuaca awal valid & ter-bias modifier", () => {
    const weathers = new Set(["cerah", "kabut", "hujan", "badai"]);
    for (let seed = 1; seed <= 30; seed++) {
      expect(weathers.has(rollExpedition(seed).startWeather)).toBe(true);
    }
    expect(rollExpedition(0).startWeather).toBe("cerah");
    expect(rollExpedition(0).modifiers).toEqual([]);
  });

  it("weatherPoolFor menambah bias sesuai modifier", () => {
    expect(weatherPoolFor([])).not.toContain(undefined);
    const fog = weatherPoolFor(["Kabut Tebal"]);
    expect(fog.filter((w) => w === "kabut").length).toBeGreaterThan(1);
    const storm = weatherPoolFor(["Badai Sore"]);
    expect(storm.filter((w) => w === "badai").length).toBeGreaterThan(1);
    const dry = weatherPoolFor(["Langit Terbuka"]);
    expect(dry.filter((w) => w === "cerah").length).toBeGreaterThan(3);
  });
});

describe("store — startExpedition", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("harian: seed = hash tanggal, replays sama di hari yang sama", () => {
    useMountainStore.getState().startExpedition("harian");
    const s1 = useMountainStore.getState();
    expect(s1.mode).toBe("harian");
    expect(s1.seed).toBe(hashSeed(dailySeedString()));
    expect(s1.screen).toBe("playing");
    expect(s1.seed).not.toBe(0);

    useMountainStore.getState().startExpedition("harian");
    const s2 = useMountainStore.getState();
    expect(s2.seed).toBe(s1.seed);
    expect(s2.modifiers).toEqual(s1.modifiers);
    expect(s2.weather).toBe(s1.weather);
  });

  it("standar: seed acak ≠ 0, run berikutnya umumnya beda", () => {
    useMountainStore.getState().startExpedition("standar");
    const a = useMountainStore.getState().seed;
    expect(a).not.toBe(0);
    useMountainStore.getState().startExpedition("standar");
    const b = useMountainStore.getState().seed;
    expect(b).not.toBe(0);
    expect(b).not.toBe(a);
  });

  it("startNew mempertahankan seed ekspedisi (restart run sama)", () => {
    useMountainStore.getState().startExpedition("standar");
    const seed = useMountainStore.getState().seed;
    const mods = useMountainStore.getState().modifiers;
    useMountainStore.getState().startNew();
    expect(useMountainStore.getState().seed).toBe(seed);
    expect(useMountainStore.getState().modifiers).toEqual(mods);
    expect(useMountainStore.getState().checkpointIndex).toBe(0);
    expect(useMountainStore.getState().screen).toBe("playing");
  });

  it("run baru mereset progres catatan/foto/peluit", () => {
    useMountainStore.getState().startExpedition("standar");
    useMountainStore.setState({ notesRead: ["n1"], photoScore: 3, photosTaken: ["deer-0"], distressUsed: true });
    useMountainStore.getState().startNew();
    const s = useMountainStore.getState();
    expect(s.notesRead).toEqual([]);
    expect(s.photoScore).toBe(0);
    expect(s.photosTaken).toEqual([]);
    expect(s.distressUsed).toBe(false);
  });
});
