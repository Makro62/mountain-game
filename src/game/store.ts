import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CHECKPOINTS, SNOW_LINE, type ItemId } from "./terrain";
import { BLOCK, blockKey, blockTopNatural, getVoxelTop, type BlockType, type VoxelEdits } from "./voxel";
import { dailySeedString, hashSeed, randomSeed, rollExpedition, seedCode, weatherPoolFor, type GameMode } from "./expedition";
import { ghostReset, saveGhostIfBest } from "./ghost";

export type Screen = "menu" | "playing" | "paused" | "won" | "lost";
export type Weather = "cerah" | "kabut" | "hujan" | "badai";

export interface Inventory {
  bekal: number;
  jaket: number;
  p3k: number;
  oksigen: number;
  tali: number;
  kompas: number;
  termos: number;
  peluit: number;
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
  /** Edit voxel dunia: kunci "bx,bz" -> { dh, type }. Persist agar bangunan tersimpan. */
  edits: VoxelEdits;
  /** Blok terpilih untuk dipasang + mode build ala Minecraft. */
  selectedBlock: BlockType;
  buildMode: boolean;
  /** Mode ekspedisi + seed deterministik (0 = save lama / belum pernah). */
  mode: GameMode;
  seed: number;
  modifiers: string[];
  notesRead: string[];
  openNote: string | null;
  photosTaken: string[];
  photoScore: number;
  photoFlashAt: number;
  distressUsed: boolean;
  ghostEnabled: boolean;
  banner: string;
  bannerAt: number;
  lightningAt: number;

  startNew: () => void;
  startExpedition: (mode: GameMode) => void;
  continueGame: () => void;
  pause: () => void;
  resume: () => void;
  toMenu: () => void;
  resetSave: () => void;
  toggleMute: () => void;
  toggleGhost: () => void;
  showMessage: (msg: string) => void;
  tick: (dt: number, moving: boolean, sprinting: boolean, steep: boolean) => void;
  useItem: (item: ItemId) => void;
  addItem: (item: ItemId) => void;
  collectLoot: (id: string, item: ItemId) => void;
  collectEdelweiss: (id: string) => void;
  readNote: (id: string) => void;
  closeNote: () => void;
  takePhoto: (id: string) => void;
  takeHit: (stam: number, suhu: number, label: string) => void;
  unlockCheckpoint: (index: number) => void;
  setPlayerPos: (pos: [number, number, number]) => void;
  buildTent: () => void;
  setSelectedBlock: (b: BlockType) => void;
  toggleBuildMode: () => void;
  breakBlockAt: (bx: number, bz: number) => void;
  placeBlockAt: (bx: number, bz: number) => void;
}

const DEFAULT_INVENTORY: Inventory = {
  bekal: 1,
  jaket: 0,
  p3k: 0,
  oksigen: 0,
  tali: 0,
  kompas: 0,
  termos: 0,
  peluit: 0,
};
const SPAWN: [number, number, number] = [0, 0, 150];

function spawnY(): number {
  return blockTopNatural(SPAWN[0], SPAWN[2]) + 1.7;
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Field yang di-reset tiap pendakian baru (seed/mode dibiarkan). */
function runDefaults(startedAt: number | null): Partial<MountainState> {
  return {
    stamina: 100,
    suhu: 100,
    oksigen: 100,
    inventory: { ...DEFAULT_INVENTORY },
    checkpointIndex: 0,
    playerPos: [SPAWN[0], spawnY(), SPAWN[2]],
    collectedLoot: [],
    edelweiss: [],
    itemsUsed: {},
    weatherTimer: 40,
    timeOfDay: 0.25,
    startedAt,
    endedAt: null,
    edits: {},
    selectedBlock: "dirt",
    buildMode: true,
    notesRead: [],
    openNote: null,
    photosTaken: [],
    photoScore: 0,
    photoFlashAt: 0,
    distressUsed: false,
    banner: "",
    bannerAt: 0,
    lightningAt: 0,
  };
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
      edits: {},
      selectedBlock: "dirt",
      buildMode: true,
      mode: "standar",
      seed: 0,
      modifiers: [],
      notesRead: [],
      openNote: null,
      photosTaken: [],
      photoScore: 0,
      photoFlashAt: 0,
      distressUsed: false,
      ghostEnabled: true,
      banner: "",
      bannerAt: 0,
      lightningAt: 0,

      startExpedition: (mode) => {
        const seed = mode === "harian" ? hashSeed(dailySeedString()) : randomSeed();
        const plan = rollExpedition(seed);
        ghostReset();
        set({
          screen: "playing",
          mode,
          seed,
          modifiers: plan.modifiers,
          weather: plan.startWeather,
          ...runDefaults(Date.now()),
          message:
            mode === "harian"
              ? `📅 Tantangan Harian ${seedCode(seed)} — layout sama untuk semua pendaki hari ini.`
              : `🥾 Ekspedisi Standar ${seedCode(seed)} — cuaca & loot berbeda tiap run.`,
          messageAt: Date.now(),
        });
      },

      startNew: () => {
        const s = get();
        const plan = rollExpedition(s.seed);
        ghostReset();
        set({
          screen: "playing",
          weather: plan.startWeather,
          ...runDefaults(Date.now()),
          message:
            s.seed === 0
              ? "Selamat mendaki! Ikuti blok merah, klik kiri hancurkan & kanan pasang blok."
              : `Ulangi ekspedisi ${seedCode(s.seed)} — cuaca & loot konsisten.`,
          messageAt: Date.now(),
        });
      },

      continueGame: () => {
        const s = get();
        // Jepret ke pos terakhir (save lama dari jalur lurus tetap valid; Y di-snap ke voxel)
        const cp = CHECKPOINTS[s.checkpointIndex] ?? CHECKPOINTS[0];
        set({
          screen: "playing",
          playerPos: [cp.x, getVoxelTop(cp.x, cp.z, s.edits) + 1.7, cp.z],
          startedAt: s.startedAt ?? Date.now(),
          endedAt: null,
          openNote: null,
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
          ...runDefaults(null),
          weather: "cerah",
          message: "",
          messageAt: 0,
          mode: "standar",
          seed: 0,
          modifiers: [],
        });
      },

      toggleMute: () => set((s) => ({ muted: !s.muted })),
      toggleGhost: () => set((s) => ({ ghostEnabled: !s.ghostEnabled })),

      setSelectedBlock: (b) => set({ selectedBlock: b }),
      toggleBuildMode: () => set((s) => ({ buildMode: !s.buildMode })),

      breakBlockAt: (bx, bz) => {
        const s = get();
        if (s.screen !== "playing") return;
        const key = blockKey(bx, bz);
        const cur = s.edits[key]?.dh ?? 0;
        // Jangan gali lebih dari 3 blok agar tidak jatuh ke void
        const dh = Math.max(-BLOCK * 3, cur - BLOCK);
        if (dh === cur) return;
        set({ edits: { ...s.edits, [key]: { dh } } });
      },

      placeBlockAt: (bx, bz) => {
        const s = get();
        if (s.screen !== "playing") return;
        const key = blockKey(bx, bz);
        const cur = s.edits[key]?.dh ?? 0;
        // Maksimal 4 blok di atas alami (cegah menara ke langit)
        const dh = Math.min(BLOCK * 4, cur + BLOCK);
        if (dh === cur) return;
        set({ edits: { ...s.edits, [key]: { dh, type: s.selectedBlock } } });
      },

      showMessage: (msg) => set({ message: msg, messageAt: Date.now() }),

      tick: (dt, moving, sprinting, steep) => {
        const s = get();
        if (s.screen !== "playing") return;
        if (s.openNote) return;
        const step = Math.min(dt, 0.1);

        // Siklus cuaca & waktu (pool ber-bias modifier ekspedisi)
        let weather = s.weather;
        let weatherTimer = s.weatherTimer - step;
        if (weatherTimer <= 0) {
          const pool = weatherPoolFor(s.modifiers);
          weather = pool[Math.floor(Math.random() * pool.length)];
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
        const hasRope = (s.inventory.tali ?? 0) > 0;
        if (moving) {
          let drain = sprinting ? 2.5 : 1.2;
          if (steep) drain *= hasRope ? 1.3 : 1.6;
          if (weather === "hujan") drain *= 1.2;
          if (weather === "badai") drain *= 1.4;
          if (inSnow) drain *= 1.2;
          if (oks <= 0) drain *= 5;
          stamina -= drain * step;
        } else {
          stamina += 3 * step;
        }

        // Suhu (Termos aktif: drain ×0.7)
        let cold = 0.4;
        if (weather === "hujan") cold *= 1.4;
        if (weather === "badai") cold *= 1.8;
        if (isNight) cold *= 1.5;
        if (altitude > 35) cold *= 1.3;
        if (inSnow) cold *= 2;
        if (weather === "kabut") cold *= 1.1;
        if ((s.inventory.termos ?? 0) > 0) cold *= 0.7;
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
        if (s.openNote) return;
        if ((s.inventory[item] ?? 0) <= 0) {
          set({ message: "Item habis! Cari loot di jalur.", messageAt: Date.now() });
          return;
        }
        if (item === "tali") {
          set({
            message: "🧗 Tali Panjat aktif — penalti tanjakan berkurang setengah selama di inventaris.",
            messageAt: Date.now(),
          });
          return;
        }
        if (item === "kompas") {
          set({
            message: "🧭 Kompas aktif — arah pos berikutnya terlihat di minimap.",
            messageAt: Date.now(),
          });
          return;
        }
        if (item === "termos") {
          set({
            message: "🫖 Termos aktif — suhu tubuh menghangat (drain -30%) selama di inventaris.",
            messageAt: Date.now(),
          });
          return;
        }
        if (item === "peluit") {
          if (s.distressUsed) {
            set({ message: "📯 Peluit hanya boleh dibunyikan sekali per pendakian.", messageAt: Date.now() });
            return;
          }
          const inv = { ...s.inventory, peluit: s.inventory.peluit - 1 };
          const itemsUsed = { ...s.itemsUsed, peluit: (s.itemsUsed.peluit || 0) + 1 };
          set({
            inventory: inv,
            stamina: clamp100(s.stamina + 25),
            suhu: clamp100(s.suhu + 25),
            oksigen: clamp100(s.oksigen + 25),
            distressUsed: true,
            itemsUsed,
            message: "📯 Peluit distres dibunyikan! (+25 stamina, suhu & oksigen)",
            messageAt: Date.now(),
          });
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

      readNote: (id) => {
        const s = get();
        if (s.screen !== "playing" || s.openNote) return;
        set({
          openNote: id,
          notesRead: s.notesRead.includes(id) ? s.notesRead : [...s.notesRead, id],
        });
      },

      closeNote: () => set({ openNote: null }),

      takePhoto: (id) => {
        const s = get();
        if (s.screen !== "playing" || s.openNote) return;
        if (s.photosTaken.includes(id)) {
          set({ message: "📷 Sudah difoto pada pendakian ini.", messageAt: Date.now() });
          return;
        }
        set({
          photosTaken: [...s.photosTaken, id],
          photoScore: s.photoScore + 1,
          stamina: clamp100(s.stamina + 5),
          photoFlashAt: Date.now(),
          message: `📷 Momen diabadikan! (+5 stamina, skor foto ${s.photoScore + 1})`,
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
        if (isPeak) {
          saveGhostIfBest({
            seed: s.seed,
            mode: s.mode,
            timeMs: Date.now() - (s.startedAt ?? Date.now()),
            edelweiss: s.edelweiss.length,
          });
        }
        set({
          checkpointIndex: index,
          screen: isPeak ? "won" : s.screen,
          endedAt: isPeak ? Date.now() : s.endedAt,
          banner: isPeak ? "" : `CHECKPOINT: ${cp.name}`,
          bannerAt: isPeak ? 0 : Date.now(),
          message: isPeak ? "🏔️ PUNCAK! Kamu berhasil!" : `⛳ Tiba di ${cp.name} — progress tersimpan.`,
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
        edits: s.edits,
        selectedBlock: s.selectedBlock,
        muted: s.muted,
        mode: s.mode,
        seed: s.seed,
        modifiers: s.modifiers,
        notesRead: s.notesRead,
        photoScore: s.photoScore,
        photosTaken: s.photosTaken,
        distressUsed: s.distressUsed,
        ghostEnabled: s.ghostEnabled,
      }),
      // Shallow-merge default + deep-merge inventory: save lama tanpa key
      // item baru (tali/kompas/...) tetap dapat default 0, bukan undefined.
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<MountainState>;
        return {
          ...currentState,
          ...p,
          inventory: { ...currentState.inventory, ...(p.inventory ?? {}) },
        };
      },
    }
  )
);

export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Peringkat akhir layar menang (S/A/B/C). */
export function calcRank(timeMs: number, edelweissCount: number, notesCount: number, noteTotal: number): string {
  const min = timeMs / 60000;
  const allNotes = notesCount >= noteTotal;
  if (min < 8 && edelweissCount >= 8) return "S";
  if (min < 12 && edelweissCount >= 5) return "A";
  if (min < 18 || (allNotes && edelweissCount >= 3)) return "B";
  return "C";
}
