import { beforeEach, describe, expect, it } from "vitest";
import { useMountainStore } from "../store";
import { SNOW_LINE } from "../terrain";

const STEP = 0.1;

function fresh(over: Partial<Record<string, unknown>> = {}): void {
  useMountainStore.getState().startNew();
  useMountainStore.setState({
    weatherTimer: 9999,
    startedAt: 1,
    ...over,
  } as never);
}

beforeEach(() => {
  fresh();
});

describe("tick — stamina drain", () => {
  it("jalan (walk) di cuaca cerah dataran: 1.2/s", () => {
    fresh({ playerPos: [0, 10, 100], weather: "cerah" });
    useMountainStore.getState().tick(STEP, true, false, false);
    expect(useMountainStore.getState().stamina).toBeCloseTo(100 - 1.2 * STEP, 5);
  });

  it("sprint: 2.5/s", () => {
    fresh({ playerPos: [0, 10, 100], weather: "cerah" });
    useMountainStore.getState().tick(STEP, true, true, false);
    expect(useMountainStore.getState().stamina).toBeCloseTo(100 - 2.5 * STEP, 5);
  });

  it("tanjakan curam: ×1.6", () => {
    fresh({ playerPos: [0, 10, 100], weather: "cerah" });
    useMountainStore.getState().tick(STEP, true, false, true);
    expect(useMountainStore.getState().stamina).toBeCloseTo(100 - 1.2 * 1.6 * STEP, 5);
  });

  it("hujan ×1.2, badai ×1.4, salju ×1.2", () => {
    fresh({ playerPos: [0, 10, 100], weather: "hujan" });
    useMountainStore.getState().tick(STEP, true, false, false);
    expect(useMountainStore.getState().stamina).toBeCloseTo(100 - 1.2 * 1.2 * STEP, 5);

    fresh({ playerPos: [0, 10, 100], weather: "badai" });
    useMountainStore.getState().tick(STEP, true, false, false);
    expect(useMountainStore.getState().stamina).toBeCloseTo(100 - 1.2 * 1.4 * STEP, 5);

    fresh({ playerPos: [0, SNOW_LINE + 5, 100], weather: "cerah" });
    useMountainStore.getState().tick(STEP, true, false, false);
    expect(useMountainStore.getState().stamina).toBeCloseTo(100 - 1.2 * 1.2 * STEP, 5);
  });

  it("oksigen 0: drain ×5", () => {
    fresh({ playerPos: [0, 10, 100], weather: "cerah", oksigen: 0 });
    useMountainStore.getState().tick(STEP, true, false, false);
    expect(useMountainStore.getState().stamina).toBeCloseTo(100 - 1.2 * 5 * STEP, 5);
  });

  it("kombinasi penuh: sprint + curam + badai + salju + oks 0", () => {
    fresh({ playerPos: [0, SNOW_LINE + 5, 100], weather: "badai", oksigen: 0 });
    useMountainStore.getState().tick(STEP, true, true, true);
    const expected = 2.5 * 1.6 * 1.4 * 1.2 * 5 * STEP;
    expect(useMountainStore.getState().stamina).toBeCloseTo(100 - expected, 5);
  });

  it("diam (idle): regen +3/s dari bawah 100", () => {
    fresh({ stamina: 50, weather: "cerah", playerPos: [0, 10, 100] });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().stamina).toBeCloseTo(50 + 3 * STEP, 5);
  });

  it("stamina di-clamp maksimal 100", () => {
    fresh({ stamina: 99.9, weather: "cerah", playerPos: [0, 10, 100] });
    useMountainStore.getState().tick(0.1, false, false, false);
    expect(useMountainStore.getState().stamina).toBe(100);
  });
});

describe("tick — suhu", () => {
  it("cerah siang di dataran: cold 0.4/s", () => {
    fresh({ playerPos: [0, 10, 100], weather: "cerah", timeOfDay: 0.25 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - 0.4 * STEP, 5);
  });

  it("hujan ×1.4, badai ×1.8, kabut ×1.1", () => {
    fresh({ playerPos: [0, 10, 100], weather: "hujan", timeOfDay: 0.25 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - 0.4 * 1.4 * STEP, 5);

    fresh({ playerPos: [0, 10, 100], weather: "badai", timeOfDay: 0.25 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - 0.4 * 1.8 * STEP, 5);

    fresh({ playerPos: [0, 10, 100], weather: "kabut", timeOfDay: 0.25 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - 0.4 * 1.1 * STEP, 5);
  });

  it("malam ×1.5 (timeOfDay 0.7)", () => {
    fresh({ playerPos: [0, 10, 100], weather: "cerah", timeOfDay: 0.7 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - 0.4 * 1.5 * STEP, 5);
  });

  it("di atas 35 mdpl ×1.3, di zona salju (di atas 35 juga) ×2", () => {
    fresh({ playerPos: [0, 36, 100], weather: "cerah", timeOfDay: 0.25 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - 0.4 * 1.3 * STEP, 5);

    fresh({ playerPos: [0, SNOW_LINE + 2, 100], weather: "cerah", timeOfDay: 0.25 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - 0.4 * 1.3 * 2 * STEP, 5);
  });

  it("kombinasi: badai + malam + salju + alt > 35", () => {
    fresh({ playerPos: [0, SNOW_LINE + 5, 100], weather: "badai", timeOfDay: 0.7 });
    useMountainStore.getState().tick(STEP, false, false, false);
    const expected = 0.4 * 1.8 * 1.5 * 1.3 * 2 * STEP;
    expect(useMountainStore.getState().suhu).toBeCloseTo(100 - expected, 5);
  });
});

describe("tick — oksigen per band altitude", () => {
  it("di atas 50 mdpl: −0.8/s", () => {
    fresh({ playerPos: [0, 51, 100], weather: "cerah" });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().oksigen).toBeCloseTo(100 - 0.8 * STEP, 5);
  });

  it("35–50 mdpl: −0.3/s (tepat 50 tidak dihitung band atas)", () => {
    fresh({ playerPos: [0, 50, 100], weather: "cerah" });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().oksigen).toBeCloseTo(100 - 0.3 * STEP, 5);

    fresh({ playerPos: [0, 36, 100], weather: "cerah" });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().oksigen).toBeCloseTo(100 - 0.3 * STEP, 5);
  });

  it("di bawah 35 mdpl: +1.5/s", () => {
    fresh({ playerPos: [0, 20, 100], weather: "cerah", oksigen: 50 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().oksigen).toBeCloseTo(50 + 1.5 * STEP, 5);
  });

  it("kabut: tambahan −0.2/s", () => {
    fresh({ playerPos: [0, 20, 100], weather: "kabut", oksigen: 50 });
    useMountainStore.getState().tick(STEP, false, false, false);
    expect(useMountainStore.getState().oksigen).toBeCloseTo(50 + (1.5 - 0.2) * STEP, 5);
  });

  it("oksigen di-clamp 0..100", () => {
    fresh({ playerPos: [0, 51, 100], weather: "cerah", oksigen: 0.05 });
    useMountainStore.getState().tick(1, false, false, false);
    expect(useMountainStore.getState().oksigen).toBe(0);
  });
});
