import { beforeEach, describe, expect, it } from "vitest";
import { useMountainStore } from "../store";
import { CHECKPOINTS } from "../terrain";

function fresh(over: Partial<Record<string, unknown>> = {}): void {
  useMountainStore.getState().startNew();
  useMountainStore.setState({ startedAt: 1, ...over } as never);
}

beforeEach(() => fresh());

describe("checkpoint & menang", () => {
  it("unlock checkpoint biasa: naik index, tetap playing", () => {
    useMountainStore.getState().unlockCheckpoint(1);
    const s = useMountainStore.getState();
    expect(s.checkpointIndex).toBe(1);
    expect(s.screen).toBe("playing");
    expect(s.message).toContain(CHECKPOINTS[1].name);
  });

  it("checkpoint mundur / duplikat diabaikan", () => {
    useMountainStore.getState().unlockCheckpoint(2);
    useMountainStore.getState().unlockCheckpoint(1);
    expect(useMountainStore.getState().checkpointIndex).toBe(2);
  });

  it("index di luar bounds diabaikan", () => {
    useMountainStore.getState().unlockCheckpoint(CHECKPOINTS.length);
    expect(useMountainStore.getState().checkpointIndex).toBe(0);
    expect(useMountainStore.getState().screen).toBe("playing");
  });

  it("puncak → won + endedAt terisi", () => {
    useMountainStore.setState({ startedAt: 1000 });
    useMountainStore.getState().unlockCheckpoint(CHECKPOINTS.length - 1);
    const s = useMountainStore.getState();
    expect(s.screen).toBe("won");
    expect(s.endedAt).not.toBeNull();
    expect(s.message).toContain("PUNCAK");
  });

  it("checkpoint terakhir bertipe puncak (asumsi data terrain)", () => {
    expect(CHECKPOINTS[CHECKPOINTS.length - 1].id).toBe("puncak");
  });
});

describe("kalah (evakuasi)", () => {
  it("stamina 0 saat tick → lost", () => {
    fresh({ stamina: 0.05, oksigen: 50, playerPos: [0, 10, 100], weather: "cerah", weatherTimer: 9999 });
    useMountainStore.getState().tick(0.1, true, false, false);
    const s = useMountainStore.getState();
    expect(s.screen).toBe("lost");
    expect(s.stamina).toBe(0);
    expect(s.message).toContain("Stamina habis");
    expect(s.endedAt).not.toBeNull();
  });

  it("suhu 0 saat tick → lost (hipotermia)", () => {
    fresh({ suhu: 0.02, stamina: 100, playerPos: [0, 10, 100], weather: "cerah", weatherTimer: 9999, timeOfDay: 0.25 });
    useMountainStore.getState().tick(0.1, false, false, false);
    const s = useMountainStore.getState();
    expect(s.screen).toBe("lost");
    expect(s.suhu).toBe(0);
    expect(s.message).toContain("Hipotermia");
  });

  it("takeHit mematikan → lost", () => {
    fresh({ stamina: 10, suhu: 10 });
    useMountainStore.getState().takeHit(12, 8, "tes");
    const s = useMountainStore.getState();
    expect(s.screen).toBe("lost");
    expect(s.stamina).toBe(0);
  });

  it("takeHit tidak mematikan → tetap playing + label pesan", () => {
    fresh({ stamina: 80, suhu: 80 });
    useMountainStore.getState().takeHit(12, 8, "🪨 Tertimpa batu jatuh!");
    const s = useMountainStore.getState();
    expect(s.screen).toBe("playing");
    expect(s.stamina).toBe(68);
    expect(s.suhu).toBe(72);
    expect(s.message).toContain("Tertimpa");
  });

  it("tick saat bukan playing → no-op", () => {
    useMountainStore.setState({ screen: "won", stamina: 50 });
    useMountainStore.getState().tick(0.1, true, true, true);
    expect(useMountainStore.getState().stamina).toBe(50);
  });
});

describe("collectLoot / collectEdelweiss", () => {
  it("loot hanya sekali", () => {
    useMountainStore.getState().collectLoot("l1", "bekal");
    const first = useMountainStore.getState().inventory.bekal;
    useMountainStore.getState().collectLoot("l1", "bekal");
    expect(useMountainStore.getState().inventory.bekal).toBe(first);
    expect(useMountainStore.getState().collectedLoot).toContain("l1");
  });

  it("edelweiss: +5 stamina, tidak dobel, hitung /12", () => {
    fresh({ stamina: 50 });
    useMountainStore.getState().collectEdelweiss("e1");
    const s = useMountainStore.getState();
    expect(s.stamina).toBe(55);
    expect(s.edelweiss).toContain("e1");
    useMountainStore.getState().collectEdelweiss("e1");
    expect(s.stamina).toBe(55);
    expect(s.edelweiss.filter((e) => e === "e1")).toHaveLength(1);
  });
});
