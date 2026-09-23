import { beforeEach, describe, expect, it } from "vitest";
import { useMountainStore } from "../store";
import { NOTES, SNOW_LINE } from "../terrain";

function fresh(over: Partial<Record<string, unknown>> = {}): void {
  useMountainStore.getState().startExpedition("standar");
  useMountainStore.setState({ weatherTimer: 9999, startedAt: 1, ...over } as never);
}

beforeEach(() => fresh());

describe("item baru — efek pasif di tick", () => {
  it("Tali Panjat: penalti curam 1.6 → 1.3", () => {
    fresh({ playerPos: [0, 10, 100], weather: "cerah" });
    useMountainStore.getState().tick(0.1, true, false, true);
    const withoutRope = useMountainStore.getState().stamina;

    fresh({
      playerPos: [0, 10, 100],
      weather: "cerah",
      inventory: { ...useMountainStore.getState().inventory, tali: 1 },
    });
    useMountainStore.getState().tick(0.1, true, false, true);
    const withRope = useMountainStore.getState().stamina;

    expect(withoutRope).toBeCloseTo(100 - 1.2 * 1.6 * 0.1, 5);
    expect(withRope).toBeCloseTo(100 - 1.2 * 1.3 * 0.1, 5);
    expect(withRope).toBeGreaterThan(withoutRope);
  });

  it("Termos: drain suhu ×0.7", () => {
    fresh({ playerPos: [0, 10, 100], weather: "cerah", timeOfDay: 0.25 });
    useMountainStore.getState().tick(0.1, false, false, false);
    const without = useMountainStore.getState().suhu;

    fresh({
      playerPos: [0, 10, 100],
      weather: "cerah",
      timeOfDay: 0.25,
      inventory: { ...useMountainStore.getState().inventory, termos: 2 },
    });
    useMountainStore.getState().tick(0.1, false, false, false);
    const withThermos = useMountainStore.getState().suhu;

    expect(without).toBeCloseTo(100 - 0.4 * 0.1, 5);
    expect(withThermos).toBeCloseTo(100 - 0.4 * 0.7 * 0.1, 5);
    expect(withThermos).toBeGreaterThan(without);
  });

  it("Termos juga menurunkan dingin salju", () => {
    fresh({
      playerPos: [0, SNOW_LINE + 5, 100],
      weather: "cerah",
      timeOfDay: 0.25,
      inventory: { ...useMountainStore.getState().inventory, termos: 1 },
    });
    useMountainStore.getState().tick(0.1, false, false, false);
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - 0.4 * 1.3 * 2 * 0.7 * 0.1, 5);
  });
});

describe("item baru — useItem", () => {
  it("Tali/Kompas/Termos: tidak dikonsumsi (passif), tampilkan info", () => {
    for (const item of ["tali", "kompas", "termos"] as const) {
      useMountainStore.setState({ inventory: { ...useMountainStore.getState().inventory, [item]: 3 } });
      useMountainStore.getState().useItem(item);
      expect(useMountainStore.getState().inventory[item]).toBe(3);
    }
    expect(useMountainStore.getState().message).toContain("Termos");
  });

  it("item pasif tanpa kepemilikan → pesan habis", () => {
    useMountainStore.setState({ inventory: { ...useMountainStore.getState().inventory, tali: 0 } });
    useMountainStore.getState().useItem("tali");
    expect(useMountainStore.getState().message).toContain("Item habis");
  });

  it("Peluit Distres: +25 semua stat, konsumsi, sekali per run", () => {
    useMountainStore.setState({
      stamina: 40,
      suhu: 40,
      oksigen: 40,
      inventory: { ...useMountainStore.getState().inventory, peluit: 2 },
    });
    useMountainStore.getState().useItem("peluit");
    let s = useMountainStore.getState();
    expect(s.stamina).toBe(65);
    expect(s.suhu).toBe(65);
    expect(s.oksigen).toBe(65);
    expect(s.inventory.peluit).toBe(1);
    expect(s.distressUsed).toBe(true);
    expect(s.itemsUsed.peluit).toBe(1);

    useMountainStore.getState().useItem("peluit");
    s = useMountainStore.getState();
    expect(s.stamina).toBe(65);
    expect(s.inventory.peluit).toBe(1);
    expect(s.message).toContain("sekali");
  });

  it("Peluit men-saturasi di 100", () => {
    useMountainStore.setState({
      stamina: 90,
      suhu: 95,
      oksigen: 80,
      inventory: { ...useMountainStore.getState().inventory, peluit: 1 },
    });
    useMountainStore.getState().useItem("peluit");
    const s = useMountainStore.getState();
    expect(s.stamina).toBe(100);
    expect(s.suhu).toBe(100);
    expect(s.oksigen).toBe(100);
  });
});

describe("catatan lore", () => {
  it("readNote: buka modal + catat notesRead sekali", () => {
    useMountainStore.getState().readNote("n1");
    let s = useMountainStore.getState();
    expect(s.openNote).toBe("n1");
    expect(s.notesRead).toEqual(["n1"]);

    useMountainStore.getState().closeNote();
    expect(useMountainStore.getState().openNote).toBeNull();

    useMountainStore.getState().readNote("n1");
    s = useMountainStore.getState();
    expect(s.notesRead).toEqual(["n1"]);
  });

  it("baca semua 5 catatan → counter penuh", () => {
    for (const n of NOTES) {
      useMountainStore.getState().readNote(n.id);
      useMountainStore.getState().closeNote();
    }
    expect(useMountainStore.getState().notesRead).toHaveLength(NOTES.length);
  });

  it("saat modal terbuka, tick & useItem diblokir", () => {
    useMountainStore.getState().readNote(NOTES[0].id);
    useMountainStore.setState({ stamina: 50, suhu: 50 });
    useMountainStore.getState().tick(0.1, true, true, true);
    useMountainStore.getState().useItem("bekal");
    const s = useMountainStore.getState();
    expect(s.stamina).toBe(50);
    expect(s.inventory.bekal).toBe(s.inventory.bekal);
    useMountainStore.getState().closeNote();
  });

  it("readNote hanya saat playing", () => {
    useMountainStore.setState({ screen: "paused" });
    useMountainStore.getState().readNote("n2");
    expect(useMountainStore.getState().openNote).toBeNull();
  });
});

describe("foto satwa", () => {
  it("takePhoto: +5 stamina, skor naik, flash time terisi", () => {
    useMountainStore.setState({ stamina: 50, photoFlashAt: 0 });
    useMountainStore.getState().takePhoto("deer-0");
    const s = useMountainStore.getState();
    expect(s.stamina).toBe(55);
    expect(s.photoScore).toBe(1);
    expect(s.photosTaken).toEqual(["deer-0"]);
    expect(s.photoFlashAt).toBeGreaterThan(0);
    expect(s.message).toContain("diabadikan");
  });

  it("satu satwa hanya bisa difoto sekali per run", () => {
    useMountainStore.getState().takePhoto("deer-0");
    useMountainStore.getState().takePhoto("deer-0");
    const s = useMountainStore.getState();
    expect(s.photoScore).toBe(1);
    expect(s.photosTaken).toEqual(["deer-0"]);
    expect(s.message).toContain("Sudah difoto");
  });

  it("satwa berbeda menambah skor", () => {
    useMountainStore.getState().takePhoto("deer-0");
    useMountainStore.getState().takePhoto("bird-1");
    expect(useMountainStore.getState().photoScore).toBe(2);
  });

  it("takePhoto hanya saat playing & tanpa modal", () => {
    useMountainStore.setState({ screen: "menu" });
    useMountainStore.getState().takePhoto("deer-0");
    expect(useMountainStore.getState().photoScore).toBe(0);
    useMountainStore.setState({ screen: "playing" });
    useMountainStore.getState().readNote(NOTES[0].id);
    useMountainStore.getState().takePhoto("deer-0");
    expect(useMountainStore.getState().photoScore).toBe(0);
    useMountainStore.getState().closeNote();
  });
});

describe("toggle ghost & banner checkpoint", () => {
  it("toggleGhost membalik boolean (persist user pref)", () => {
    expect(useMountainStore.getState().ghostEnabled).toBe(true);
    useMountainStore.getState().toggleGhost();
    expect(useMountainStore.getState().ghostEnabled).toBe(false);
    useMountainStore.getState().toggleGhost();
    expect(useMountainStore.getState().ghostEnabled).toBe(true);
  });

  it("checkpoint non-puncak mengisi banner celebrate", () => {
    useMountainStore.setState({ banner: "", bannerAt: 0 });
    useMountainStore.getState().unlockCheckpoint(1);
    expect(useMountainStore.getState().banner).toContain("CHECKPOINT:");
    expect(useMountainStore.getState().banner).toContain("Pos 1");
    expect(useMountainStore.getState().bannerAt).toBeGreaterThan(0);
  });

  it("puncak tidak mengisi banner checkpoint (layar menang)", () => {
    useMountainStore.getState().unlockCheckpoint(4);
    expect(useMountainStore.getState().screen).toBe("won");
    expect(useMountainStore.getState().banner).toBe("");
  });
});
