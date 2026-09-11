# ⛰️ Mountain Game — Pendakian 3D Offline

Game pendakian gunung 3D yang jalan **lokal/offline** di browser. Naik dari Basecamp → Pos 1-3 → Puncak, atur stamina, suhu, dan oksigen.

![Stack](https://img.shields.io/badge/Vite-5-646cff?logo=vite) ![React](https://img.shields.io/badge/React-18-61dafb?logo=react) ![Three.js](https://img.shields.io/badge/Three.js-r170-black?logo=three.js) ![Offline](https://img.shields.io/badge/Offline-100%25-brightgreen)

> Pola stack mengikuti `cs-game/client` (Vite + React + Three.js + Zustand), disederhanakan tanpa Rapier/postprocessing agar mudah dijalankan.

---

## Mode permainan

### Pendakian Offline (satu-satunya mode, v1)

Solo hiking dari basecamp ke puncak Gunung Nusantara (fiktif, prosedural).

- **Checkpoint:** Basecamp → Pos 1 (Kaki) → Pos 2 (Hutan) → Pos 3 (Batu) → **Puncak**.
- Masuk radius pos untuk unlock + auto-save `localStorage`.
- **Menang:** masuk radius puncak (dapat peringkat S/A/B).
- **Kalah (Evakuasi):** stamina 0 atau suhu 0 → layar akhir + tombol Ulangi/Menu.
- **Bahaya batu jatuh** saat badai di zona batu — awas banner merah!
- Peta: satu terrain low-poly prosedural (tanpa download aset). Jalur utama zigzag + 2 pintasan curam.

### Item survival

| Item | Efek | Cara dapat |
| :--- | :--- | :--- |
| 🍙 Bekal | +30 stamina | Loot di jalur / pos |
| 🧥 Jaket hangat | +30 suhu | Loot Pos 2 |
| 🩹 P3K | +40 suhu & stamina | Loot Pos 1/3 |
| 🫁 Oksigen | +50 oksigen | Loot atas (Pos 3+) |

Ambil otomatis saat dekat, pakai via HUD atau tombol `1-4`. Tenda di tiap pos = titik save.

---

## Kontrol

| Tombol | Aksi |
| :--- | :--- |
| **W A S D / panah** | Gerak relatif pandangan (A/D atau ←/→ = kiri-kanan) |
| **Mouse** | Putar kamera mengelilingi karakter (klik kanvas untuk kunci pointer) |
| **Shift** | Sprint (kuras stamina 2x) |
| **Spasi** | Lompat kecil |
| **1 / 2 / 3 / 4** | Pakai Bekal / Jaket / P3K / Oksigen |
| **E** | Interaksi / dirikan tenda di pos (save) |
| **Esc** | Pause (Lanjutkan, Ulangi, Menu utama) |

HUD hanya punya satu tombol **MENU [ESC]**. Pengaturan + restart ada di pause — bukan tombol dobel (ikut aturan `cs-game`).

Lihat juga: `docs/PRD-MTN-001.md`, `docs/CONTROLS.md`, `docs/GLOSSARY.md`, `docs/MOUNTAIN_GDD.md`.

---

## Stack

| Bagian | Teknologi |
| :--- | :--- |
| UI | React 18, TypeScript |
| 3D | Three.js r170, React Three Fiber 8, Drei 9 |
| Fisika | Heightmap math sendiri (tanpa Rapier) |
| State | Zustand 4 + persist (`localStorage`) |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` |
| Audio | Web Audio API prosedural (angin, langkah, checkpoint) |
| Bundler | Vite 5 |

100% offline setelah `npm install`: tanpa CDN, tanpa Google Fonts, tanpa fetch internet. Semua tekstur warna-vertex + suara synth lokal.

---

## Menjalankan (lokal/offline)

Butuh **Node.js 18+**.

```bash
npm install
npm run dev
```

Buka **http://localhost:5174** (kalau port terpakai, Vite naik ke 5175, …).

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Dev server + HMR |
| `npm run build` | Build `dist/` offline |
| `npm run preview` | Serve hasil build secara lokal |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

Save lokal: key `mountain-game-storage` di `localStorage`. Hapus via Menu → Reset Save.

---

## Rute / Layar

| State | Layar |
| :--- | :--- |
| `menu` | Menu utama (Mulai, Lanjutkan, Reset, Cara main) |
| `playing` | 3D + HUD |
| `paused` | Pause (Lanjutkan, Ulangi, Menu) |
| `won` / `lost` | Layar akhir + statistik |

---

## Struktur repo

```text
mountain-game/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── README.md
├── docs/
│   ├── PRD-MTN-001.md    # PRD + Appendix hasil audit vs implementasi
│   ├── MOUNTAIN_GDD.md   # GDD lengkap (ikut pola farm-game)
│   ├── CONTROLS.md
│   └── GLOSSARY.md
├── graphify-out/         # Knowledge graph (graph.json, GRAPH_REPORT.md, graph.html)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── game/
    │   ├── terrain.ts        # heightmap + sungai + jalur zigzag + pos + loot (satu sumber)
    │   ├── store.ts          # Zustand: stats, inventory, cuaca, waktu, edelweiss
    │   ├── MountainScene.tsx # Canvas R3F: terrain, langit, PBR, bayangan, tenda, rambu
    │   ├── Player.tsx        # Controller third-person + pointer-lock orbit
    │   ├── Hiker.tsx         # Avatar pendaki low-poly + animasi jalan
    │   ├── playerRef.ts      # Posisi 60fps logika → visual (tanpa re-render)
    │   ├── Trees.tsx         # Pinus + birch + batu + rumput (instanced)
    │   ├── Animals.tsx       # Burung terbang + rusa wander
    │   ├── River.tsx         # Air + buih + jembatan kayu
    │   ├── Sun.tsx           # Matahari/bulan mengikuti siklus waktu
    │   ├── Clouds.tsx        # Awan billboard melayang
    │   ├── Snowfall.tsx      # Hujan salju + jejak kaki
    │   ├── Rockfall.tsx      # Batu jatuh saat badai
    │   ├── Flowers.tsx       # Padang bunga + edelweiss kolektibel
    │   ├── HUD.tsx           # Bar, kompas, minimap, inventory, pause/akhir
    │   └── audio.ts          # SFX + angin prosedural
    └── screens/
        └── MainMenu.tsx
```

Satu sumber data posisi pos & loot ada di `terrain.ts` (meniru aturan `survivalLayout.ts` di cs-game).

---

## Lisensi

Untuk edukasi dan eksplorasi web 3D offline.
