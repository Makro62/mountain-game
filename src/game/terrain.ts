/**
 * Satu sumber data terrain + jalur + checkpoint + loot + alam.
 * Fungsi getHeight dipakai BERSAMA oleh visual (MountainScene),
 * collision pemain (Player), dan flora/fauna agar tidak meleset.
 */

export const WORLD_SIZE = 400;
export const WORLD_BOUND = 195;
export const WALK_SPEED = 4;
export const SPRINT_SPEED = 7;
export const JUMP_SPEED = 5;
export const PICKUP_RADIUS = 3;
/** Batas ketinggian hutan (pohon & rusa hanya di bawah ini). */
export const TREE_LINE = 26;
/** Zona salju: hujan salju + dingin ekstra + gerak melambat di atas ini. */
export const SNOW_LINE = 40;
/** Titik jembatan kayu tempat jalur memotong sungai. */
export const BRIDGE = { x: 0, z: 45 };

export interface Checkpoint {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
}

export const CHECKPOINTS: Checkpoint[] = [
  { id: "basecamp", name: "Basecamp", x: 0, z: 150, radius: 10 },
  { id: "pos1", name: "Pos 1 — Kaki", x: 2, z: 86, radius: 9 },
  { id: "pos2", name: "Pos 2 — Hutan", x: -26, z: 12, radius: 9 },
  { id: "pos3", name: "Pos 3 — Batu", x: 6, z: -70, radius: 9 },
  { id: "puncak", name: "Puncak Nusantara", x: 0, z: -150, radius: 10 },
];

/**
 * Jalur utama: zigzag naik (switchbacks), bukan garis lurus.
 * Basecamp → berkelok sisi barat → jembatan → sisi timur → puncak.
 */
export const TRAIL: Array<[number, number]> = [
  [0, 150],
  [14, 124],
  [-10, 104],
  [2, 86],
  [-4, 66],
  [-7, 54],
  [0, 45],
  [-20, 32],
  [-26, 12],
  [-12, -4],
  [6, -18],
  [24, -32],
  [30, -50],
  [14, -64],
  [6, -70],
  [-8, -88],
  [-22, -106],
  [-10, -126],
  [0, -150],
];

/** Pintasan A: memotong kelokan barat (curam, arungi tepi kali). */
export const SHORTCUT_A: Array<[number, number]> = [
  [-4, 66],
  [-13, 48],
  [-20, 32],
];

/** Pintasan B: langsung ke Pos 3 (sangat curam, boros stamina). */
export const SHORTCUT_B: Array<[number, number]> = [
  [6, -18],
  [11, -42],
  [10, -66],
];

/** Persimpangan: papan penunjuk + pesan pemandu + target arah panah. */
export const FORKS = [
  { x: -3, z: 69, name: "Simpang A", main: "jalur aman berkelok", alt: "pintasan curam", mainX: -7, mainZ: 54, altX: -13, altZ: 48 },
  { x: 7, z: -15, name: "Simpang B", main: "jalur aman berkelok", alt: "pintasan ke Pos 3", mainX: 24, mainZ: -32, altX: 11, altZ: -42 },
];

export type ItemId = "bekal" | "jaket" | "p3k" | "oksigen" | "tali" | "kompas" | "termos" | "peluit";

export interface LootSpot {
  id: string;
  item: ItemId;
  x: number;
  z: number;
}

export const LOOT_SPOTS: LootSpot[] = [
  { id: "l1", item: "bekal", x: 10, z: 128 },
  { id: "l2", item: "bekal", x: -14, z: 100 },
  { id: "l3", item: "p3k", x: 0, z: 70 },
  { id: "l4", item: "bekal", x: -13, z: 28 },
  { id: "l5", item: "jaket", x: -14, z: 2 },
  { id: "l6", item: "p3k", x: 12, z: -24 },
  { id: "l7", item: "bekal", x: 11, z: -52 },
  { id: "l8", item: "oksigen", x: 10, z: -75 },
  { id: "l9", item: "oksigen", x: -19, z: -108 },
  { id: "l10", item: "p3k", x: -13, z: -124 },
  { id: "l11", item: "kompas", x: -8, z: 96 },
  { id: "l12", item: "tali", x: -11, z: 50 },
  { id: "l13", item: "termos", x: 8, z: -30 },
  { id: "l14", item: "peluit", x: 4, z: -72 },
  { id: "l15", item: "tali", x: 11, z: -42 },
  { id: "l16", item: "kompas", x: -16, z: -110 },
];

export interface LoreNote {
  id: string;
  title: string;
  text: string;
  x: number;
  z: number;
}

/** Catatan jurnal ekspedisi yang bisa dibaca (interaksi E). */
export const NOTES: LoreNote[] = [
  {
    id: "n1",
    title: "Buku Tamu Basecamp",
    text:
      "Hari ke-3 di Gunung Nusantara. Kabut pagi tebal sekali, tapi porter sudah membawa semua perbekalan ke Pos 1. Pak Karna bilang: \"Jangan pernah menyalakan api unggun sebelum hujan reda.\" Semoga jalur utama tidak longsor seperti tahun lalu. — Ratih, ketua tim",
    x: -4,
    z: 147,
  },
  {
    id: "n2",
    title: "Surat dari Pos 1",
    text:
      "Kalau kamu menemukan kertas ini, berarti kamu sudah melewati gapura. Simpan tenaga — tanjakan setelah jembatan jauh lebih curam dari yang terlihat. Aku meninggalkan sebungkus nasi cadangan di bawah batu merah. Jangan lupa minum. — Dimas",
    x: 5,
    z: 83,
  },
  {
    id: "n3",
    title: "Catatan di Jembatan Kayu",
    text:
      "Air sungai sedang deras. Lewati jembatan satu per satu, jangan berhenti di tengah. Di sisi timur ada pintasan oranye — hemat waktu tapi menguras napas. Pilih sesuai sisa staminamu. Pemandu kita, Pak Harun",
    x: 3,
    z: 44,
  },
  {
    id: "n4",
    title: "Jurnal Pos 3 — Zona Batu",
    text:
      "Badai sore tadi membuat tiga batu jatuh di atas tenda. Kami pindah ke sisi utara. Kalau langit menggelap dan guruh mulai bunyi, JANGAN diam di area terbuka. Edelweiss mulai terlihat di kejauhan — puncak sudah tidak jauh. — Sari, dokter tim",
    x: 9,
    z: -66,
  },
  {
    id: "n5",
    title: "Terakhir Sebelum Puncak",
    text:
      "Tulisanku gemetar karena dingin. Di depan sana garis salju putih membentang, dan di tengahnya bunga edelweiss mekar. Berapa pun hasilku hari ini, gunung ini sudah mengajarkan satu hal: napas panjang, langkah pendek. Sampai jumpa di puncak. — Ratih",
    x: -12,
    z: -104,
  },
];

/** Edelweiss langka di zona salju (kolektibel via tombol E). */
export const EDELWEISS: Array<{ id: string; x: number; z: number }> = [
  { id: "e1", x: -45.1, z: -136.1 },
  { id: "e2", x: 38.2, z: -169.7 },
  { id: "e3", x: -48.4, z: -152.4 },
  { id: "e4", x: 18.0, z: -108.7 },
  { id: "e5", x: 29.6, z: -130.1 },
  { id: "e6", x: 49.2, z: -118.5 },
  { id: "e7", x: -8.3, z: -172.4 },
  { id: "e8", x: 65.0, z: -157.3 },
  { id: "e9", x: -24.3, z: -154.4 },
  { id: "e10", x: 42.1, z: -141.9 },
  { id: "e11", x: 22.5, z: -182.4 },
  { id: "e12", x: 6.1, z: -183.6 },
];

/** Garis tengah sungai: mengalir dari utara ke selatan, memotong jalur di z=45. */
export function riverCenterX(z: number): number {
  return (z - 45) * 0.35 + 6 * Math.sin(z * 0.025) - 6 * Math.sin(45 * 0.025);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Kedalaman ukiran sungai (m). 0 = tidak ada sungai di titik ini. */
export function getRiverDepth(x: number, z: number): number {
  const d = Math.abs(x - riverCenterX(z));
  if (d > 8) return 0;
  const channel = 2.2 * (Math.cos((d / 8) * Math.PI) * 0.5 + 0.5);
  // Sungai hanya ada di bawah lereng atas (memudar menuju puncak)
  const fade = Math.max(0, Math.min(1, (z + 120) / 60));
  // Ratakan di area jembatan agar bisa dilewati
  const bd = Math.hypot(x - BRIDGE.x, z - BRIDGE.z);
  const bridgeMask = smoothstep(4, 8, bd);
  return channel * fade * bridgeMask;
}

/** Ketinggian dasar TANPA ukiran sungai (untuk permukaan air & dek jembatan). */
export function getBaseHeight(x: number, z: number): number {
  const dx = x - 0;
  const dz = z + 150;
  const distPeak = Math.sqrt(dx * dx + dz * dz);
  // Kerucut gunung utama: 62 m di puncak, melandai ke radius ~220
  const mountain = Math.max(0, 62 * (1 - distPeak / 220));
  const shaped = Math.pow(Math.max(0, mountain) / 62, 1.25) * 62;
  // Bukit kecil deterministik + detail kerikil
  const hills =
    Math.sin(x * 0.05) * Math.cos(z * 0.045) * 2.2 +
    Math.sin(x * 0.013 + 1.7) * Math.cos(z * 0.017 - 0.6) * 4.0 +
    Math.sin(x * 0.11 + 0.3) * Math.cos(z * 0.09 - 0.2) * 0.5;
  // Lembah landai di selatan (basecamp)
  const southLift = Math.max(0, (z - 60) / 140) * -3;
  return Math.max(0, shaped + hills + southLift + 2);
}

/** Ketinggian gunung: puncak di utara (z=-150), rolling hills deterministik. */
export function getHeight(x: number, z: number): number {
  return Math.max(0, getBaseHeight(x, z) - getRiverDepth(x, z));
}

/** Kemiringan (untuk drain stamina nanjak). */
export function getSlope(x: number, z: number): number {
  const e = 0.6;
  const hx = getHeight(x + e, z) - getHeight(x - e, z);
  const hz = getHeight(x, z + e) - getHeight(x, z - e);
  return Math.sqrt(hx * hx + hz * hz) / (2 * e);
}

function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

const ALL_PATHS = [TRAIL, SHORTCUT_A, SHORTCUT_B];

/** Jarak ke jalur terdekat (utama/pintasan). Untuk warna tanah & steril flora. */
export function distToTrail(x: number, z: number): number {
  let best = Infinity;
  for (const path of ALL_PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      const d = distToSeg(x, z, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Titik-titik penanda di sepanjang jalur utama tiap ~jarak meter. */
export function trailMarkerPoints(every = 18): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  let acc = 0;
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [ax, az] = TRAIL[i];
    const [bx, bz] = TRAIL[i + 1];
    const segLen = Math.hypot(bx - ax, bz - az);
    let d = every - acc;
    while (d < segLen) {
      const t = d / segLen;
      pts.push([ax + (bx - ax) * t, az + (bz - az) * t]);
      d += every;
    }
    acc = (acc + segLen) % every;
  }
  return pts;
}

export function clampWorld(v: number): number {
  return Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, v));
}
