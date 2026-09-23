import { CHECKPOINTS, NOTES } from "../game/terrain";
import { useMountainStore } from "../game/store";
import { dailySeedString, hashSeed, seedCode } from "../game/expedition";

const STATS = [
  { icon: "🏕️", value: "5 Pos", label: "Basecamp → Puncak" },
  { icon: "🌸", value: "12", label: "Edelweiss" },
  { icon: "🎒", value: "8", label: "Jenis item" },
];

const CONTROLS: Array<[string, string]> = [
  ["W A S D / ← ↑ ↓ →", "Gerak relatif kamera"],
  ["Mouse (klik kanvas)", "Putar kamera / kunci pointer"],
  ["Shift", "Sprint — boros stamina"],
  ["Spasi", "Lompat kecil"],
  ["1 – 4", "Pakai Bekal / Jaket / P3K / Oksigen"],
  ["Q R T G", "Tali / Kompas / Termos / Peluit"],
  ["E", "Petik edelweiss / catatan / tenda di pos"],
  ["F", "Foto satwa (rusa/burung ≤6 m)"],
  ["Esc", "Pause"],
];

const TIPS = [
  { icon: "⚡", title: "Stamina", desc: "Sprint, tanjakan & salju menguras cepat. Jalan santai untuk mengisi.", dot: "#4ade80" },
  { icon: "🌡️", title: "Suhu", desc: "Hujan, badai, malam & zona salju bikin hipotermia. Jaket + api unggun membantu.", dot: "#fb923c" },
  { icon: "🫁", title: "Oksigen", desc: "Menipis di atas 35 mdpl. Bawa tabung oksigen sebelum Pos 3.", dot: "#22d3ee" },
];

export function MainMenu() {
  const startNew = useMountainStore((s) => s.startNew);
  const startExpedition = useMountainStore((s) => s.startExpedition);
  const continueGame = useMountainStore((s) => s.continueGame);
  const resetSave = useMountainStore((s) => s.resetSave);
  const startedAt = useMountainStore((s) => s.startedAt);
  const checkpointIndex = useMountainStore((s) => s.checkpointIndex);
  const edelweiss = useMountainStore((s) => s.edelweiss);
  const notesRead = useMountainStore((s) => s.notesRead);
  const photoScore = useMountainStore((s) => s.photoScore);
  const mode = useMountainStore((s) => s.mode);
  const seed = useMountainStore((s) => s.seed);
  const ghostEnabled = useMountainStore((s) => s.ghostEnabled);
  const toggleGhost = useMountainStore((s) => s.toggleGhost);

  const progress = Math.round(((checkpointIndex + 1) / CHECKPOINTS.length) * 100);
  const currentCp = CHECKPOINTS[Math.min(checkpointIndex, CHECKPOINTS.length - 1)];
  const todayCode = seedCode(hashSeed(dailySeedString()));

  return (
    <div className="relative min-h-full w-full overflow-hidden bg-[#060b16]">
      {/* Latar langit */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c1a3a] via-[#0f2547] to-[#060b16]" />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(900px 420px at 15% 8%, rgba(56,189,248,0.22), transparent 60%), radial-gradient(700px 380px at 85% 18%, rgba(251,146,60,0.16), transparent 60%), radial-gradient(500px 300px at 50% 100%, rgba(34,197,94,0.12), transparent 60%)",
          }}
        />
        {/* Bintang */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 12% 12%, white, transparent), radial-gradient(1px 1px at 28% 8%, white, transparent), radial-gradient(1.5px 1.5px at 44% 14%, white, transparent), radial-gradient(1px 1px at 62% 6%, white, transparent), radial-gradient(1px 1px at 78% 12%, white, transparent), radial-gradient(1.5px 1.5px at 90% 20%, white, transparent), radial-gradient(1px 1px at 35% 22%, white, transparent), radial-gradient(1px 1px at 55% 18%, white, transparent)",
          }}
        />
        {/* Awan dekoratif */}
        <div className="anim-drift absolute left-[8%] top-[16%] h-10 w-56 rounded-full bg-white/10 blur-xl" />
        <div className="anim-drift absolute right-[10%] top-[26%] h-8 w-44 rounded-full bg-white/10 blur-xl" style={{ animationDelay: "-6s" }} />
        {/* Siluet gunung */}
        <svg
          className="absolute bottom-0 left-0 h-[38vh] w-full"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,320 L0,230 L120,150 L210,200 L330,90 L430,170 L540,120 L660,220 L780,140 L900,210 L1020,100 L1140,190 L1260,150 L1380,220 L1440,180 L1440,320 Z" fill="#0b1526" opacity="0.95" />
          <path d="M0,320 L0,270 L150,200 L280,250 L420,160 L560,240 L720,190 L880,250 L1040,180 L1200,250 L1320,220 L1440,250 L1440,320 Z" fill="#060d1a" />
          <path d="M330,90 L360,115 L340,125 L315,112 Z M1020,100 L1052,128 L1028,138 L1000,118 Z" fill="#e2e8f0" opacity="0.9" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      <div className="scroll-slim relative mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-4 py-8 sm:px-8 lg:py-12">
        <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Kolom kiri: hero */}
          <div className="flex flex-col gap-5">
            <div className="anim-fade-up flex items-center gap-2">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                ● 100% Offline • Tanpa download
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60">
                Vite + React + Three.js
              </span>
            </div>

            <div className="anim-fade-up stagger-1">
              <div className="anim-float-slow mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-b from-slate-800 to-slate-900 text-4xl shadow-2xl">
                ⛰️
              </div>
              <h1 className="text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
                <span className="title-gradient text-glow">MOUNTAIN</span>
                <br />
                <span className="text-white">NUSANTARA</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-[15px]">
                Pendakian 3D prosedural dari <b className="text-white">Basecamp → Puncak Nusantara</b>.
                Ikuti jalur berkelok, potong lewat pintasan curam, dan taklukkan badai, malam, dan zona salju.
              </p>
            </div>

            <div className="anim-fade-up stagger-2 grid max-w-md grid-cols-3 gap-2">
              {STATS.map((s) => (
                <div key={s.label} className="glass rounded-xl px-3 py-2.5 text-center">
                  <div className="text-xl">{s.icon}</div>
                  <div className="text-sm font-black text-white">{s.value}</div>
                  <div className="text-[11px] leading-tight text-white/60">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Save / progress */}
            {startedAt ? (
              <div className="anim-fade-up stagger-3 glass max-w-md rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">Save ditemukan</div>
                    <div className="text-sm font-bold text-white">Terakhir: {currentCp.name}</div>
                    <div className="text-xs text-white/60">
                      🌸 {edelweiss.length}/12 edelweiss • 📖 {notesRead.length}/{NOTES.length} catatan • 📷 {photoScore} foto
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] font-bold text-cyan-200/80">
                      {seed === 0 ? "EXPEDITION" : `EXPEDITION ${seedCode(seed)}`} • {mode === "harian" ? "Tantangan Harian" : "Standar"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white">{progress}%</div>
                    <div className="text-[11px] text-white/55">progress</div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-amber-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {CHECKPOINTS.map((cp, i) => (
                    <div key={cp.id} className="flex flex-1 items-center gap-1.5 last:flex-none">
                      <div
                        title={cp.name}
                        className={`h-2.5 flex-1 rounded-full ${i <= checkpointIndex ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" : "bg-white/15"}`}
                      />
                      {i < CHECKPOINTS.length - 1 && <div className="h-px w-1 bg-white/20" />}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="anim-fade-up stagger-3 max-w-md rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-4 text-sm text-white/60">
                💡 <b className="text-white/85">Belum ada save.</b> Progress tersimpan otomatis tiap kali kamu masuk radius pos.
              </div>
            )}

            <div className="anim-fade-up stagger-4 flex max-w-md flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => startExpedition("standar")}
                  className="btn-game group flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3.5 text-white shadow-[0_10px_30px_rgba(34,197,94,0.35)]"
                >
                  <span className="text-lg">🥾</span>
                  <span className="text-[13px] font-black tracking-wide">EKSPEDISI STANDAR</span>
                  <span className="text-[10px] font-semibold text-white/75">seed acak tiap mulai</span>
                </button>
                <button
                  onClick={() => startExpedition("harian")}
                  className="btn-game group flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3.5 text-white shadow-[0_10px_30px_rgba(14,165,233,0.35)]"
                >
                  <span className="text-lg">📅</span>
                  <span className="text-[13px] font-black tracking-wide">TANTANGAN HARIAN</span>
                  <span className="font-mono text-[10px] font-bold text-white/85">{todayCode} • sama untuk semua</span>
                </button>
              </div>
              {startedAt && (
                <button
                  onClick={continueGame}
                  className="btn-game flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 px-5 py-3 text-sm font-black text-white shadow-[0_10px_30px_rgba(100,116,139,0.3)]"
                >
                  ▶️ LANJUTKAN — {currentCp.name.toUpperCase()}
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={toggleGhost}
                  className="btn-game flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white/80"
                  title="Tampilkan rekaman best-run saat pendakian berikutnya"
                >
                  {ghostEnabled ? "👻 Ghost: ON" : "👓 Ghost: OFF"}
                </button>
                <button
                  onClick={startNew}
                  className="btn-game flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white/80"
                  title="Ulangi ekspedisi terakhir dengan seed yang sama"
                >
                  🔁 Ulangi seed terakhir
                </button>
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Hapus save lokal dan mulai dari nol?")) resetSave();
                }}
                className="btn-game rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2 text-xs font-bold text-white/55 hover:bg-white/10 hover:text-white/80"
              >
                🗑️ Reset save lokal
              </button>
            </div>
          </div>

          {/* Kolom kanan: rute + kontrol + tips */}
          <div className="flex flex-col gap-4">
            <div className="anim-fade-up stagger-2 glass rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">🗺️ Rute pendakian</h2>
                <span className="text-[11px] font-semibold text-white/50">{CHECKPOINTS.length} checkpoint</span>
              </div>
              <div className="flex flex-col">
                {CHECKPOINTS.map((cp, i) => {
                  const done = startedAt ? i <= checkpointIndex : false;
                  const isNext = startedAt ? i === checkpointIndex + 1 : i === 0;
                  return (
                    <div key={cp.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
                            done
                              ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-200"
                              : isNext
                                ? "anim-danger border-red-300/50 bg-red-500/15 text-red-200"
                                : "border-white/15 bg-white/5 text-white/50"
                          }`}
                        >
                          {done ? "✓" : i === CHECKPOINTS.length - 1 ? "🏔️" : i === 0 ? "🏕️" : "⛺"}
                        </div>
                        {i < CHECKPOINTS.length - 1 && (
                          <div className={`h-5 w-0.5 ${done ? "bg-emerald-400/60" : "bg-white/10"}`} />
                        )}
                      </div>
                      <div className="pb-3">
                        <div className={`text-sm font-bold ${done ? "text-emerald-200" : isNext ? "text-white" : "text-white/55"}`}>
                          {cp.name}
                          {isNext && startedAt && (
                            <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-200">
                              Target
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/45">
                          {i === 0 && "Spawn • gapura + tenda ganda"}
                          {i === 1 && "Kaki gunung • loot P3K"}
                          {i === 2 && "Hutan pinus • loot jaket"}
                          {i === 3 && "Zona batu • loot oksigen, awas rockfall"}
                          {i === 4 && "Zona salju • garis finis + peringkat"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="anim-fade-up stagger-3 glass rounded-2xl p-5">
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-white">🎮 Cara main</h2>
              <div className="flex flex-col gap-2">
                {CONTROLS.map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-white/70">{desc}</span>
                    <span className="kbd shrink-0">{key}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="anim-fade-up stagger-4 glass rounded-2xl p-5">
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-white">⚠️ Survival</h2>
              <div className="flex flex-col gap-2.5">
                {TIPS.map((t) => (
                  <div key={t.title} className="flex gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/8 text-lg" style={{ boxShadow: `inset 0 0 0 1px ${t.dot}44` }}>
                      {t.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-[13px] font-bold text-white">
                        {t.title}
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
                      </div>
                      <div className="text-xs leading-relaxed text-white/60">{t.desc}</div>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100/90">
                  🌩️ <b>Badai + malam = bahaya ganda.</b> Di zona batu saat badai ada <b>rockfall</b> — jangan diam di tempat terbuka, cari loot lalu lanjut.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="anim-fade-in mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/35">
          <span>Mountain Nusantara • prosedural • save: <span className="font-mono">mountain-game-storage</span></span>
          <span>v1.0 • 100% offline setelah npm install</span>
        </div>
      </div>
    </div>
  );
}
