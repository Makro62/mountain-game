import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CHECKPOINTS, SNOW_LINE, getHeight, type ItemId } from "./terrain";

export type Screen = "menu" | "playing" | "paused" | "won" | "lost";
export type Weather = "cerah" | "kabut" | "hujan" | "badai";

export interface Inventory {
  bekal: number;
  jaket: number;
  p3k: number;
  oksigen: number;
}

interface MountainState {
  screen: Screen;
  stamina: number;
  suhu: number;
  oksigen: number;
  inventory: Inventory;
  checkpointIndex: number;
  playerPos: [number, number, number];
  collectedLoot: string[];
  edelweiss: string[];
  itemsUsed: Partial<Record<ItemId, number>>;
  weather: Weather;
  weatherTimer: number;
  timeOfDay: number; // 0..1 (0=pagi, 0.5=malam)
  startedAt: number | null;
  endedAt: number | null;
  message: string;
  messageAt: number;
  muted: boolean;

  startNew: () => void;
  continueGame: () => void;
  pause: () => void;
  resume: () => void;
  toMenu: () => void;
  resetSave: () => void;
  toggleMute: () => void;
  showMessage: (msg: string) => void;
  tick: (dt: number, moving: boolean, sprinting: boolean, steep: boolean) => void;
  useItem: (item: ItemId) => void;
  addItem: (item: ItemId) => void;
  collectLoot: (id: string, item: ItemId) => void;
  collectEdelweiss: (id: string) => void;
  takeHit: (stam: number, suhu: number, label: string) => void;
  unlockCheckpoint: (index: number) => void;
  setPlayerPos: (pos: [number, number, number]) => void;
  buildTent: () => void;
}

const DEFAULT_INVENTORY: Inventory = { bekal: 1, jaket: 0, p3k: 0, oksigen: 0 };
const SPAWN: [number, number, number] = [0, 0, 150];

function spawnY(): number {
  return getHeight(SPAWN[0], SPAWN[2]) + 1.7;
}

const WEATHERS: Weather[] = ["cerah", "cerah", "cerah", "kabut", "hujan", "badai"];

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export const useMountainStore = create<MountainState>()(
  persist(
    (set, get) => ({
      screen: "menu",
      stamina: 100,
      suhu: 100,
      oksigen: 100,
      inventory: { ...DEFAULT_INVENTORY },
      checkpointIndex: 0,
      playerPos: [SPAWN[0], spawnY(), SPAWN[2]],
      collectedLoot: [],
      edelweiss: [],
      itemsUsed: {},
      weather: "cerah",
      weatherTimer: 40,
      timeOfDay: 0.25,
      startedAt: null,
      endedAt: null,
      message: "",
      messageAt: 0,
      muted: false,

      startNew: () =>
        set({
          screen: "playing",
          stamina: 100,
          suhu: 100,
          oksigen: 100,
          inventory: { ...DEFAULT_INVENTORY },
          checkpointIndex: 0,
          playerPos: [SPAWN[0], spawnY(), SPAWN[2]],
          collectedLoot: [],
          edelweiss: [],
          itemsUsed: {},
          weather: "cerah",
          weatherTimer: 40,
          timeOfDay: 0.25,
          startedAt: Date.now(),
          endedAt: null,
          message: "Selamat mendaki! Ikuti penanda merah, cek minimap untuk jalur.",
          messageAt: Date.now(),
        }),

      continueGame: () => {
        const s = get();
        // Jepret ke pos terakhir (save lama dari jalur lurus tetap valid)
        const cp = CHECKPOINTS[s.checkpointIndex] ?? CHECKPOINTS[0];
        set({
          screen: "playing",
          playerPos: [cp.x, getHeight(cp.x, cp.z) + 1.7, cp.z],
          startedAt: s.startedAt ?? Date.now(),
          endedAt: null,
          message: `Lanjutkan dari ${cp.name}!`,
          messageAt: Date.now(),
        });
      },

      pause: () => set({ screen: "paused" }),
      resume: () => set({ screen: "playing" }),
      toMenu: () => set({ screen: "menu" }),

      resetSave: () => {
        set({
          screen: "menu",
          stamina: 100,
          suhu: 100,
          oksigen: 100,
          inventory: { ...DEFAULT_INVENTORY },
          checkpointIndex: 0,
          playerPos: [SPAWN[0], spawnY(), SPAWN[2]],
          collectedLoot: [],
          edelweiss: [],
          itemsUsed: {},
          weather: "cerah",
          weatherTimer: 40,
          timeOfDay: 0.25,
          startedAt: null,
          endedAt: null,
          message: "",
          messageAt: 0,
        });
      },

      toggleMute: () => set((s) => ({ muted: !s.muted })),

      showMessage: (msg) => set({ message: msg, messageAt: Date.now() }),

      tick: (dt, moving, sprinting, steep) => {
        const s = get();
        if (s.screen !== "playing") return;
        const step = Math.min(dt, 0.1);

        // Siklus cuaca & waktu
        let weather = s.weather;
        let weatherTimer = s.weatherTimer - step;
        if (weatherTimer <= 0) {
          weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
          weatherTimer = 40;
        }
        const timeOfDay = (s.timeOfDay + step / 240) % 1;
        const isNight = timeOfDay > 0.55 && timeOfDay < 0.95;

        const altitude = s.playerPos[1];
        let stamina = s.stamina;
        let suhu = s.suhu;
        let oks = s.oksigen;

        // Stamina
        const inSnow = altitude > SNOW_LINE;
        if (moving) {
          let drain = sprinting ? 2.5 : 1.2;
          if (steep) drain *= 1.6;
          if (weather === "hujan") drain *= 1.2;
          if (weather === "badai") drain *= 1.4;
          if (inSnow) drain *= 1.2;
          if (oks <= 0) drain *= 5;
          stamina -= drain * step;
        } else {
          stamina += 3 * step;
        }

        // Suhu
        let cold = 0.4;
        if (weather === "hujan") cold *= 1.4;
        if (weather === "badai") cold *= 1.8;
        if (isNight) cold *= 1.5;
        if (altitude > 35) cold *= 1.3;
        if (inSnow) cold *= 2;
        if (weather === "kabut") cold *= 1.1;
        suhu -= cold * step;

        // Oksigen
        if (altitude > 50) oks -= 0.8 * step;
        else if (altitude > 35) oks -= 0.3 * step;
        else oks += 1.5 * step;
        if (weather === "kabut") oks -= 0.2 * step;

        stamina = clamp100(stamina);
        suhu = clamp100(suhu);
        oks = clamp100(oks);

        const patch: Partial<MountainState> = {
          stamina,
          suhu,
          oksigen: oks,
          weather,
          weatherTimer,
          timeOfDay,
        };

        if (stamina <= 0 || suhu <= 0) {
          patch.screen = "lost";
          patch.endedAt = Date.now();
          patch.message =
            stamina <= 0 ? "Stamina habis — tim evakuasi menjemputmu." : "Hipotermia! Suhu tubuh mencapai 0.";
          patch.messageAt = Date.now();
        }

        set(patch);
      },

      useItem: (item) => {
        const s = get();
        if (s.screen !== "playing") return;
        if (s.inventory[item] <= 0) {
          set({ message: "Item habis! Cari loot di jalur.", messageAt: Date.now() });
          return;
        }
        const inv = { ...s.inventory, [item]: s.inventory[item] - 1 };
        let { stamina, suhu, oksigen } = s;
        let msg: string;
        if (item === "bekal") {
          stamina = clamp100(stamina + 30);
          msg = "🍙 Bekal dimakan (+30 stamina)";
        } else if (item === "jaket") {
          suhu = clamp100(suhu + 30);
          msg = "🧥 Jaket dipakai (+30 suhu)";
        } else if (item === "p3k") {
          stamina = clamp100(stamina + 40);
          suhu = clamp100(suhu + 40);
          msg = "🩹 P3K digunakan (+40 stamina & suhu)";
        } else {
          oksigen = clamp100(oksigen + 50);
          msg = "🫁 Oksigen dihirup (+50 oksigen)";
        }
        const itemsUsed = { ...s.itemsUsed, [item]: (s.itemsUsed[item] || 0) + 1 };
        set({ inventory: inv, stamina, suhu, oksigen, message: msg, messageAt: Date.now(), itemsUsed });
      },

      addItem: (item) =>
        set((s) => ({
          inventory: { ...s.inventory, [item]: Math.min(5, s.inventory[item] + 1) },
        })),

      collectLoot: (id, item) => {
        const s = get();
        if (s.collectedLoot.includes(id)) return;
        s.addItem(item);
        set({
          collectedLoot: [...s.collectedLoot, id],
          message: `Mengambil ${item}! (slot ${s.inventory[item] + 1})`,
          messageAt: Date.now(),
        });
      },

      collectEdelweiss: (id) => {
        const s = get();
        if (s.collectedLoot.includes(id) || s.edelweiss.includes(id)) return;
        set({
          edelweiss: [...s.edelweiss, id],
          stamina: clamp100(s.stamina + 5),
          message: `🌸 Edelweiss dipetik! (${s.edelweiss.length + 1}/12, +5 stamina)`,
          messageAt: Date.now(),
        });
      },

      takeHit: (stam, suhuDmg, label) => {
        const s = get();
        if (s.screen !== "playing") return;
        const stamina = clamp100(s.stamina - stam);
        const suhu = clamp100(s.suhu - suhuDmg);
        const dead = stamina <= 0 || suhu <= 0;
        set({
          stamina,
          suhu,
          screen: dead ? "lost" : s.screen,
          endedAt: dead ? Date.now() : s.endedAt,
          message: dead ? "🪨 Tertimpa batu! Tim evakuasi menjemputmu." : label,
          messageAt: Date.now(),
        });
      },

      unlockCheckpoint: (index) => {
        const s = get();
        if (index <= s.checkpointIndex) return;
        if (index >= CHECKPOINTS.length) return;
        const cp = CHECKPOINTS[index];
        const isPeak = cp.id === "puncak";
        set({
          checkpointIndex: index,
          screen: isPeak ? "won" : s.screen,
          endedAt: isPeak ? Date.now() : s.endedAt,
          message: isPeak ? "🏔️ PUNCAK! Kamu berhasil!" : `⛺ Tiba di ${cp.name} — progress tersimpan.`,
          messageAt: Date.now(),
        });
      },

      setPlayerPos: (pos) => set({ playerPos: pos }),

      buildTent: () => {
        const s = get();
        const cp = CHECKPOINTS[s.checkpointIndex];
        set({
          message: `⛺ Tenda didirikan di ${cp.name}. Istirahat... (+10 stamina & suhu)`,
          messageAt: Date.now(),
          stamina: clamp100(s.stamina + 10),
          suhu: clamp100(s.suhu + 10),
        });
      },
    }),
    {
      name: "mountain-game-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        stamina: s.stamina,
        suhu: s.suhu,
        oksigen: s.oksigen,
        inventory: s.inventory,
        checkpointIndex: s.checkpointIndex,
        playerPos: s.playerPos,
        collectedLoot: s.collectedLoot,
        edelweiss: s.edelweiss,
        itemsUsed: s.itemsUsed,
        weather: s.weather,
        timeOfDay: s.timeOfDay,
        startedAt: s.startedAt,
      }),
    }
  )
);

export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
