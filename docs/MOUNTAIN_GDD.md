---
title: Mountain Game — Game Design Document
version: 1.0 (Code-Accurate target)
last_updated: 2026-09-11
---

# Mountain Game — Game Design Document (GDD)

> **Status**: v1 implementasi — mencerminkan kode aktual di `src/`.
> **Tech Stack**: Vite 5 + React 18 + TypeScript + Three.js r170 (R3F 8 + Drei 9) + Zustand 4 + Tailwind 4 + Web Audio API.

---

## 1. Executive Summary

Mountain Game adalah game pendakian 3D offline single-player. Pemain hiking dari Basecamp → Pos 1-3 → Puncak Gunung Nusantara (terrain prosedural fiktif), mengelola **stamina, suhu tubuh, dan oksigen** di bawah tekanan **cuaca dinamis dan siklus siang/malam**.

Game berjalan sepenuhnya client-side, save di `localStorage` (Zustand persist), tanpa server dan tanpa aset unduhan. Sekali `npm install`, selanjutnya 100% offline (`npm run dev` / `preview`).

---

## 2. Game Overview

| Aspek | Detail |
|-------|--------|
| **Platform** | Web desktop (mouse + keyboard), offline |
| **Genre** | 3D Hiking Survival (ringan) |
| **Target Player** | Casual, penggemar alam |
| **Session Length** | 10–20 menit per pendakian |
| **Save Method** | localStorage via Zustand persist (`mountain-game-storage`) |
| **Kamera** | Third-person follow (pointer-lock orbit) |

### 2.1 Player Progression (per pendakian)

- **Checkpoint**: 5 titik (Basecamp, Pos 1-3, Puncak). Masuk radius = unlock + save.
- **Stats 0–100**: stamina, suhu, oksigen. Salah satu kritis = risiko evakuasi.
- **Inventory**: bekal, jaket, P3K, oksigen (count, max 5 tiap jenis).
- **Win**: capai puncak. **Lose**: stamina 0 atau suhu 0.

### 2.2 XP / Skor

v1 tanpa XP. Skor akhir = waktu tempuh + pos tercapai + sisa stats. Ditampilkan di layar menang/kalah.

---

## 3. Game World & Setting

### 3.1 Navigation

Jalur utama **zigzag (switchbacks)**: 19 waypoint dari basecamp berkelok sisi barat → jembatan sungai → sisi timur → puncak. Tanah jalur diwarnai cokelat di terrain + bola merah tiap ~18 m.

| Rute | Sifat |
|----|----|
| Jalur utama (hijau) | Aman, landai, lebih jauh |
| Pintasan A (oranye) | Memotong kelokan barat, curam, arungi tepi kali |
| Pintasan B (oranye) | Langsung ke Pos 3, sangat curam, boros stamina ×1,6 |

Papan rambu + pesan pemandu di Simpang A (z=69) dan Simpang B (z=-15). Minimap top-down di HUD (jalur, pintasan, sungai, pos, pemain).

| Checkpoint | Pos (x, z) | Radius | Ketinggian ± |
|----|----|----|----|
| Basecamp | (0, 150) | 10 | rendah |
| Pos 1 Kaki | (0, 80) | 9 | rendah |
| Pos 2 Hutan | (-8, 10) | 9 | sedang |
| Pos 3 Batu | (6, -70) | 9 | tinggi |
| Puncak | (0, -150) | 10 | tertinggi |

Satu sumber data di `src/game/terrain.ts` (`CHECKPOINTS`, `LOOT_SPOTS`, `TRAIL`).

Tiap pos berupa camp: tenda A-frame (alas, entrance, bubungan, tali pancang, peti perbekalan) + api unggun (ring batu, kayu, api + cahaya flicker yang menyala jika pos tercapai) + bangku batang + bendera berkibar. Basecamp dobel (2 tenda + gapura kayu).

### 3.2 Terrain

- `getHeight(x, z)`: gunung utama di utara (peak ~60 m) + bukit rolling `sin/cos` deterministik (tanpa seed acak, agar collision = visual).
- Mesh: `PlaneGeometry` 128×128 segmen, vertex colors: rumput → batu → salju berdasar ketinggian + kemiringan.
- Batas dunia: ±195 m; pemain di-clamp.

### 3.3 Cuaca & Waktu

| Cuaca | Efek |
|-------|------|
| ☀️ Cerah | Normal |
| 🌫️ Kabut | Jarak pandang pendek (fog tebal), oksigen -10% |
| 🌧️ Hujan | Suhu -40% lebih cepat, stamina -20% lebih cepat |
| ⛈️ Badai | Seperti hujan + angin kencang (audio), suhu -80% lebih cepat |

Siklus cuaca tiap ~40 detik (weighted random). Siklus siang/malam 240 detik: malam = suhu -50% lebih cepat + pencahayaan redup.

### 3.4 Flora, Fauna & Sungai

- **Hutan pinus** (~350 pohon: akar, batang, 4 tajuk berlapis + pucuk; tajuk memucat salju mengikuti ketinggian), **birch** putih bercabang + 2 tajuk (~150, < 12 mdpl), **semak** (~250, 8–30 mdpl) — semua `InstancedMesh`, steril dari jalur/pos/sungai/loot. Deterministik (seeded RNG).
- **Batu** (~130, zona batu & lereng) + **rerumputan** (~400, zona hijau), semua `InstancedMesh` 1 draw-call.
- **Rusa** (4 ekor): wander di zona rumput, idle menunduk makan, kabur jika pemain < 8 m. **Burung** (5): terbang melingkar + kepak sayap. Murni visual, tanpa sentuh store (`src/game/Animals.tsx`).
- **Sungai**: diukir ke `getHeight` via `getRiverDepth` (lebar ~6 m, dalam 2,2 m, memudar menuju puncak), permukaan air di `getBaseHeight − 1,2` (selalu di bawah dek jembatan) + buih mengalir + **jembatan kayu** di titik jalur memotong sungai (`BRIDGE z=45`, area diratakan).
- **Matahari/bulan**: bulatan + halo (tekstur kanvas runtime, offline) mengikuti sudut `timeOfDay` yang sama dengan pencahayaan; malam = bulan pucat (`src/game/Sun.tsx`).
- **Zona salju** (`SNOW_LINE = 40 mdpl`): hujan salju partikel (~1200 flakes, makin lebat mengikuti ketinggian) + jejak kaki memudar + fog rapat; suhu −2x, gerak ×0,85, stamina +20% drain.
- **Bunga**: padang bunga warna-warni (~320, < 20 mdpl, hiasan) + **edelweiss** (12 titik zona 38–52 mdpl, petik via `E`, +5 stamina, counter di HUD).

---

## 4. Core Gameplay Mechanics

### 4.1 Gerak (third-person hiking)

- Kamera follow di belakang karakter pendaki low-poly (±6.5 m, +3 m).
- WASD + panah relatif yaw kamera; A/D atau ←/→ menggeser kiri-kanan. Kecepatan 6 m/s, sprint (Shift) 10 m/s.
- Mouse (pointer-lock, klik kanvas) memutar orbit kamera + pitch. Karakter otomatis menghadap arah gerak.
- Kamera otomatis membuntuti arah jalan maju bila mouse diam > 1,5 dtk (nonaktif saat mundur/strafe agar tidak melawan pemain).
- Kaki animasi ayunan saat jalan, napas idle saat diam (`src/game/Hiker.tsx`).
- Gravitasi sederhana + lompat kecil (Spasi, 4.5 m/s). Grounded: `y = getHeight + 1.7`.
- Sprint menguras stamina 2x; diam mengisi stamina pelan.

### 4.2 Survival tick (per frame × delta)

- **Stamina**: -1.2/s jalan, -2.5/s sprint/nanjak curam, +3/s diam. Bekal +30.
- **Suhu**: -0.4/s base, pengali cuaca/malam/ketinggian. Jaket +30, P3K +40.
- **Oksigen**: -0.3/s di atas 35 m, -0.8/s di atas 50 m. Tabung +50.
- Kalah saat stamina ≤ 0 atau suhu ≤ 0. Oksigen 0 = stamina -5x (belum langsung kalah).

### 4.3 Interaksi & Item

- Loot auto-pickup radius 3 m (respawn tidak ada di v1).
- Pakai item via HUD atau `1-4`. Efek clamp 0–100. Jumlah pemakaian dilacak (`itemsUsed`) untuk statistik finish.
- `E` di dalam radius pos = dirikan tenda + save + pesan konfirmasi.
- `E` dekat edelweiss = petik (+5 stamina, counter ×/12).

### 4.4 Peringatan stat kritis

- Bar berdenyut + ikon ⚠️ saat stat ≤ 20; pesan sekali per stat ("Stamina kritis!..."), reset saat pulih > 30.

### 4.5 Bahaya batu jatuh

- Aktif saat cuaca **badai** DAN pemain di zona batu (25–58 mdpl): banner merah + boulder jatuh dari lereng tiap ~2–3,5 dtk (pool 12, fisika gelinding sederhana).
- Kena = −12 stamina & −8 suhu + jeda kebal 1,5 dtk; bisa berujung evakuasi via `takeHit`.

### 4.6 Peringkat finish

- Layar menang menampilkan peringkat: **S** (≤12 mnt + ≥8 edelweiss), **A** (≤18 mnt atau ≥8 edelweiss), **B** (finish).

---

## 5. Audio System (prosedural, tanpa file)

`src/game/audio.ts` — singleton Web Audio:

| Sound | Teknik |
|-------|--------|
| langkah | noise burst lowpass 400 Hz, throttle 350 ms |
| pickup | sine arpeggio 660→880 Hz |
| checkpoint | triad 523+659+784 Hz |
| win | fanfare 4-not |
| lose | descending 300→150 Hz |
| angin | looped noise buffer + lowpass, gain ikut ketinggian & badai |

Lazy-init AudioContext saat interaksi pertama. Mute toggle di HUD.

---

## 6. Save / Load & Persistence

- **Key**: `mountain-game-storage`, Zustand `persist` + `partialize` (hanya stats, inventory, checkpointIndex, pos pemain, waktu).
- **State ephemeral TIDAK disimpan**: input keys, pointer-lock, cuaca sesaat.
- **Lanjutkan**: tombol di menu memuat save. **Reset**: hapus key + reset store.
- Checkpoint = save otomatis.

---

## 7. Technical Architecture

### 7.1 Project Structure

```
src/
├── main.tsx
├── App.tsx              # switch menu/playing/paused/won/lost
├── index.css            # tailwind + fullscreen canvas
├── game/
│   ├── terrain.ts       # getHeight, CHECKPOINTS, LOOT_SPOTS
│   ├── store.ts         # zustand + persist, tickStats(dt)
│   ├── MountainScene.tsx# Canvas, TerrainMesh, SkyRig, Props
│   ├── Player.tsx       # movement + collision + pickup + checkpoint
│   ├── HUD.tsx          # bar, kompas, inventory, pause/akhir
│   └── audio.ts
└── screens/
    └── MainMenu.tsx
```

### 7.2 State Management (Zustand)

- Satu store `useMountainStore`: `screen`, `stamina/suhu/oksigen`, `inventory`, `checkpointIndex`, `playerPos`, `weather`, `timeOfDay`, `startedAt/endedAt`, `muted`.
- Actions: `startNew/finish/pause/resume/toMenu/tickStats/useItem/addItem/unlockCheckpoint/setPlayerPos/setWeather/...`.
- Persist partialize ~10 fields; merge defensif (clamp + fallback).

### 7.3 Key Constants

| Group | Value |
|-------|-------|
| WORLD | SIZE=400, BOUND=195 |
| PLAYER | EYE=1.7, WALK=6, SPRINT=10, JUMP=4.5 |
| DRAIN | STAM_WALK=1.2/s, STAM_SPRINT=2.5/s, COLD=0.4/s, O2_HIGH=0.3/s |
| WEATHER | CYCLE=40 s, DAY=240 s |
| PICKUP | RADIUS=3, CHECKPOINT_R=9–10 |

---

## 8. UI Structure

- **MainMenu**: judul, Mulai Baru, Lanjutkan (jika save), Reset, cara main + legenda item.
- **HUD playing**: bar stamina/suhu/oksigen, kompas arah puncak, ketinggian, cuaca + waktu ikon, inventory 4 slot + tombol pakai, pesan tengah, tombol MENU.
- **Pause**: Lanjutkan, Ulangi, Menu. **Won/Lost**: statistik + waktu + tombol Ulangi/Menu.

---

## 9. Roadmap

### v1 Selesai
- 1 gunung, 5 checkpoint, 4 item, cuaca + siang/malam, save lokal, audio synth, HUD + kompas.

### Future
- Multi-gunung (Semeru/Rinjani/Kerinci beda tinggi & sulit).
- Minimap top-down + jalur.
- NPC ranger + quest.
- Multiplayer leaderboard (butuh server → keluar dari offline).
- Mobile touch controls.
