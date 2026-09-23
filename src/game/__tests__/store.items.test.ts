import { beforeEach, describe, expect, it } from "vitest";
import { useMountainStore } from "../store";
import type { ItemId } from "../terrain";

function fresh(over: Partial<Record<string, unknown>> = {}): void {
  useMountainStore.getState().startNew();
  useMountainStore.setState({ startedAt: 1, ...over } as never);
}

beforeEach(() => fresh());

describe("useItem — efek item lama", () => {
  it("bekal: +30 stamina & konsumsi 1", () => {
    fresh({ stamina: 50 });
    const before = useMountainStore.getState().inventory.bekal;
    useMountainStore.getState().useItem("bekal");
    const s = useMountainStore.getState();
    expect(s.stamina).toBe(80);
    expect(s.inventory.bekal).toBe(before - 1);
    expect(s.itemsUsed.bekal).toBe(1);
  });

  it("jaket: +30 suhu & konsumsi 1", () => {
    fresh({ suhu: 40 });
    useMountainStore.setState({ inventory: { ...useMountainStore.getState().inventory, jaket: 1 } });
    useMountainStore.getState().useItem("jaket");
    const s = useMountainStore.getState();
    expect(s.suhu).toBe(70);
    expect(s.inventory.jaket).toBe(0);
  });

  it("p3k: +40 stamina & suhu", () => {
    fresh({ stamina: 10, suhu: 10 });
    useMountainStore.setState({ inventory: { ...useMountainStore.getState().inventory, p3k: 1 } });
    useMountainStore.getState().useItem("p3k");
    const s = useMountainStore.getState();
    expect(s.stamina).toBe(50);
    expect(s.suhu).toBe(50);
    expect(s.inventory.p3k).toBe(0);
  });

  it("oksigen: +50 & cap di 100", () => {
    useMountainStore.setState({ inventory: { ...useMountainStore.getState().inventory, oksigen: 2 }, oksigen: 70 });
    useMountainStore.getState().useItem("oksigen");
    expect(useMountainStore.getState().oksigen).toBe(100);

    useMountainStore.setState({ oksigen: 40 });
    useMountainStore.getState().useItem("oksigen");
    expect(useMountainStore.getState().oksigen).toBe(90);
  });

  it("bekal saat stamina penuh tetap terpakai & clamp 100", () => {
    fresh({ stamina: 100 });
    const before = useMountainStore.getState().inventory.bekal;
    useMountainStore.getState().useItem("bekal");
    expect(useMountainStore.getState().stamina).toBe(100);
    expect(useMountainStore.getState().inventory.bekal).toBe(before - 1);
  });

  it("item habis: tidak ada efek, muncul pesan", () => {
    useMountainStore.setState({ inventory: { ...useMountainStore.getState().inventory, jaket: 0 }, suhu: 30 });
    useMountainStore.getState().useItem("jaket");
    const s = useMountainStore.getState();
    expect(s.suhu).toBe(30);
    expect(s.message).toContain("Item habis");
  });

  it("di luar layar playing: no-op", () => {
    useMountainStore.setState({ screen: "menu", stamina: 40 });
    useMountainStore.getState().useItem("bekal");
    expect(useMountainStore.getState().stamina).toBe(40);
  });
});

describe("addItem — cap 5", () => {
  it("menambah tapi maksimal 5", () => {
    for (let i = 0; i < 8; i++) useMountainStore.getState().addItem("p3k");
    expect(useMountainStore.getState().inventory.p3k).toBe(5);
  });

  it("semua jenis item lama punya slot di inventory default", () => {
    const inv = useMountainStore.getState().inventory;
    const legacy: ItemId[] = ["bekal", "jaket", "p3k", "oksigen"];
    for (const id of legacy) {
      expect(typeof inv[id]).toBe("number");
    }
    expect(inv.bekal).toBe(1);
  });
});
