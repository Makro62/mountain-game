import { useEffect, useRef, useState } from "react";
import { BRIDGE, CHECKPOINTS, NOTES, SHORTCUT_A, SHORTCUT_B, TRAIL, riverCenterX } from "./terrain";
import { playerState } from "./playerRef";
import { formatDuration, calcRank, useMountainStore, type Weather } from "./store";
import { seedCode } from "./expedition";
import { ghostDistance, loadGhost } from "./ghost";
import { ghostEligible } from "./GhostRunner";

const WEATHER_META: Record<Weather, { icon: string; label: string; chip: string }> = {
  cerah: { icon: "☀️", label: "Cerah", chip: "border-amber-300/30 bg-amber-400/15 text-amber-200" },
  kabut: { icon: "🌫️", label: "Kabut", chip: "border-slate-300/30 bg-slate-400/15 text-slate-200" },
  hujan: { icon: "🌧️", label: "Hujan", chip: "border-sky-300/30 bg-sky-400/15 text-sky-200" },
  badai: { icon: "⛈️", label: "Badai", chip: "border-red-300/40 bg-red-500/20 text-red-200" },
};

function Bar({
  icon,
  label,
  value,
  gradient,
  critical,
}: {
  icon: string;
  label: string;
  value: number;
  gradient: string;
  critical?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={critical ? "anim-danger" : ""}>
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold tracking-wide">
        <span className={critical ? "text-red-300" : "text-white/85"}>
          {icon} {label} {critical && "⚠️"}
        </span>
        <span
          className={`rounded-md px-1.5 py-px font-mono text-[11px] ${critical ? "bg-red-500/25 text-red-100" : "bg-white/10 text-white/85"}`}
        >
          {Math.round(v)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/15 bg-black/60 shadow-inner">
        <div
          className="relative h-full rounded-full transition-all duration-300"
          style={{ width: `${v}%`, background: gradient }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/35 to-transparent" />
        </div>
      </div>
    </div>
  );
}

function directionHint(dx: number, dz: number): string {
  const vert = dz < -5 ? "Utara ↑" : dz > 5 ? "Selatan ↓" : "";
  const horiz = dx > 5 ? "Timur →" : dx < -5 ? "← Barat" : "";
  return [vert, horiz].filter(Boolean).join(" ") || "di sini";
}

function formatClock(t: number): string {
  const h = Math.floor(t * 24) % 24;
  const m = Math.floor(((t * 24) % 1) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Minimap top-down: jalur, pintasan, sungai, pos, pemain, arah kompas. */
function Minimap({
  checkpointIndex,
  hasKompas,
  weather,
}: {
  checkpointIndex: number;
  hasKompas: boolean;
  weather: Weather;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = 160;
    const k = S / 400;
    const X = (x: number) => (x + 200) * k;
    const Y = (z: number) => (z + 200) * k;

    let rafId = 0;
    const draw = () => {
      rafId = requestAnimationFrame(draw);

      ctx.clearRect(0, 0, S, S);
      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, "rgba(8,15,30,0.92)");
      g.addColorStop(1, "rgba(2,6,23,0.92)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);

      // Sungai
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(14,165,233,0.6)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let z = -60; z <= 192; z += 8) {
        const px = X(riverCenterX(z));
        const py = Y(z);
        if (z === -60) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Pintasan
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      for (const path of [SHORTCUT_A, SHORTCUT_B]) {
        ctx.beginPath();
        path.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(X(x), Y(z)) : ctx.lineTo(X(x), Y(z))));
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Jalur utama
      ctx.strokeStyle = "#e8c07a";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      TRAIL.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(X(x), Y(z)) : ctx.lineTo(X(x), Y(z))));
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Jembatan
      ctx.fillStyle = "#b45309";
      ctx.fillRect(X(BRIDGE.x) - 2.5, Y(BRIDGE.z) - 2.5, 5, 5);

      const px = X(playerState.pos.x);
      const py = Y(playerState.pos.z);

      // Kompas: garis bearing ke pos berikutnya (+ pulse saat kabut)
      const nextCp = CHECKPOINTS[Math.min(checkpointIndex + 1, CHECKPOINTS.length - 1)];
      if (hasKompas) {
        ctx.strokeStyle = "rgba(34,211,238,0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(X(nextCp.x), Y(nextCp.z));
        ctx.stroke();
        ctx.setLineDash([]);
        if (weather === "kabut") {
          ctx.strokeStyle = "rgba(34,211,238,0.75)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(X(nextCp.x), Y(nextCp.z), 8 + Math.sin(Date.now() / 220) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Checkpoint
      CHECKPOINTS.forEach((cp, i) => {
        const isNext = i === checkpointIndex + 1;
        ctx.fillStyle = i <= checkpointIndex ? "#22c55e" : isNext ? "#ef4444" : "#64748b";
        ctx.beginPath();
        ctx.arc(X(cp.x), Y(cp.z), isNext ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (isNext) {
          ctx.strokeStyle = "rgba(239,68,68,0.7)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const r = 7 + Math.sin(Date.now() / 300) * 1.5;
          ctx.arc(X(cp.x), Y(cp.z), r, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (i <= checkpointIndex) {
          ctx.strokeStyle = "rgba(34,197,94,0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(X(cp.x), Y(cp.z), 5.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Pemain
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 7 + (Math.floor(Date.now() / 500) % 2) * 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("U ▲", 6, 13);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [checkpointIndex, hasKompas, weather]);

  return <canvas ref={ref} width={160} height={160} className="h-32 w-32 sm:h-40 sm:w-40" />;
}

function ToastMessage() {
  const message = useMountainStore((s) => s.message);
  const messageAt = useMountainStore((s) => s.messageAt);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(id);
  }, [message, messageAt]);

  if (!visible) return null;
  const danger = /badai|hipotermia|evakuasi|tertimpa|habis/i.test(message);
  return (
    <div className="anim-toast pointer-events-none absolute left-1/2 top-[76px] z-20 w-max max-w-[min(92vw,480px)] -translate-x-1/2">
      <div
        className={`rounded-xl px-4 py-2.5 text-center text-[13px] font-semibold leading-snug shadow-2xl backdrop-blur-md ${
          danger
            ? "border border-red-300/40 bg-red-950/80 text-red-100"
            : "border border-white/15 bg-slate-950/75 text-white"
        }`}
      >
        {message}
      </div>
    </div>
  );
}

/** Banner minicelebrate saat checkpoint terbuka ("CHECKPOINT: Pos 2"). */
function CheckpointBanner() {
  const banner = useMountainStore((s) => s.banner);
  const bannerAt = useMountainStore((s) => s.bannerAt);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!banner || !bannerAt) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(id);
  }, [banner, bannerAt]);

  if (!visible || !banner) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[120px] z-20 -translate-x-1/2">
      <div className="anim-pop rounded-xl border border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-emerald-500/25 px-5 py-2 text-center text-sm font-black tracking-[0.2em] text-amber-100 shadow-2xl backdrop-blur-md">
        🚩 {banner}
      </div>
    </div>
  );
}

/** Flash putih sesaat: rana foto atau kilat petir. */
function FlashOverlay() {
  const photoFlashAt = useMountainStore((s) => s.photoFlashAt);
  const lightningAt = useMountainStore((s) => s.lightningAt);
  const [photo, setPhoto] = useState(false);
  const [bolt, setBolt] = useState(false);

  useEffect(() => {
    if (!photoFlashAt) return;
    setPhoto(true);
    const id = setTimeout(() => setPhoto(false), 220);
    return () => clearTimeout(id);
  }, [photoFlashAt]);

  useEffect(() => {
    if (!lightningAt) return;
    setBolt(true);
    const id = setTimeout(() => setBolt(false), 320);
    return () => clearTimeout(id);
  }, [lightningAt]);

  if (!photo && !bolt) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40"
      style={{
        background: photo
          ? "radial-gradient(ellipse at center, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 55%, transparent 80%)"
          : "rgba(226,232,240,0.55)",
        animation: "fade-in 0.22s ease both",
      }}
    />
  );
}

/** Modal catatan lore (interaksi E). */
function NoteModal() {
  const openNote = useMountainStore((s) => s.openNote);
  const notesRead = useMountainStore((s) => s.notesRead);
  const closeNote = useMountainStore((s) => s.closeNote);
  if (!openNote) return null;
  const note = NOTES.find((n) => n.id === openNote);
  if (!note) return null;
  const found = notesRead.length;
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="anim-pop w-full max-w-md rounded-2xl border border-amber-200/25 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/80">📖 Catatan Ekspedisi</span>
          <span className="font-mono text-[11px] font-bold text-white/50">{found}/{NOTES.length}</span>
        </div>
        <h3 className="text-lg font-black text-amber-100">{note.title}</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200/90">{note.text}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[11px] text-white/40">
            <span className="kbd">E</span> tutup
          </span>
          <button
            onClick={closeNote}
            className="btn-game rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-sm font-black text-white shadow-lg"
          >
            Simpan ke jurnal
          </button>
        </div>
      </div>
    </div>
  );
}

const INVENTORY_SLOTS = [
  { id: "bekal", emoji: "🍙", key: "1", name: "Bekal", effect: "+30 ⚡" },
  { id: "jaket", emoji: "🧥", key: "2", name: "Jaket", effect: "+30 🌡️" },
  { id: "p3k", emoji: "🩹", key: "3", name: "P3K", effect: "+40 ⚡🌡️" },
  { id: "oksigen", emoji: "🫁", key: "4", name: "Oksigen", effect: "+50 🫁" },
  { id: "tali", emoji: "🧗", key: "Q", name: "Tali", effect: "tanjakan -50%" },
  { id: "kompas", emoji: "🧭", key: "R", name: "Kompas", effect: "arah di minimap" },
  { id: "termos", emoji: "🫖", key: "T", name: "Termos", effect: "drain suhu -30%" },
  { id: "peluit", emoji: "📯", key: "G", name: "Peluit", effect: "+25 semua (1×)" },
] as const;

export function HUD() {
  const screen = useMountainStore((s) => s.screen);
  const stamina = useMountainStore((s) => Math.round(s.stamina));
  const suhu = useMountainStore((s) => Math.round(s.suhu));
  const oksigen = useMountainStore((s) => Math.round(s.oksigen));
  const inventory = useMountainStore((s) => s.inventory);
  const itemsUsed = useMountainStore((s) => s.itemsUsed);
  const playerPos = useMountainStore((s) => s.playerPos);
  const checkpointIndex = useMountainStore((s) => s.checkpointIndex);
  const weather = useMountainStore((s) => s.weather);
  const timeOfDay = useMountainStore((s) => s.timeOfDay);
  const isNight = timeOfDay > 0.55 && timeOfDay < 0.95;
  const edelweiss = useMountainStore((s) => s.edelweiss);
  const playMs = useMountainStore((s) => s.playMs);
  const mode = useMountainStore((s) => s.mode);
  const seed = useMountainStore((s) => s.seed);
  const modifiers = useMountainStore((s) => s.modifiers);
  const notesRead = useMountainStore((s) => s.notesRead);
  const photoScore = useMountainStore((s) => s.photoScore);
  const ghostEnabled = useMountainStore((s) => s.ghostEnabled);

  const pause = useMountainStore((s) => s.pause);
  const resume = useMountainStore((s) => s.resume);
  const toMenu = useMountainStore((s) => s.toMenu);
  const startNew = useMountainStore((s) => s.startNew);
  const consumeItem = useMountainStore((s) => s.useItem);
  const toggleMute = useMountainStore((s) => s.toggleMute);
  const toggleGhost = useMountainStore((s) => s.toggleGhost);
  const muted = useMountainStore((s) => s.muted);

  const nextCp = CHECKPOINTS[Math.min(checkpointIndex + 1, CHECKPOINTS.length - 1)];
  const dx = nextCp.x - playerPos[0];
  const dz = nextCp.z - playerPos[2];
  const dist = Math.hypot(dx, dz);
  // Waktu main aktif (playMs) — pause/menu tidak menambah waktu; rank & ghost jadi adil
  const elapsed = playMs;
  const itemsUsedText = Object.entries(itemsUsed).map(([id, count]) => `${count}× ${id}`).join(" • ") || "belum pakai item";
  const wMeta = WEATHER_META[weather];
  const critical = stamina <= 20 || suhu <= 20;
  const progress = Math.round(((checkpointIndex + 1) / CHECKPOINTS.length) * 100);
  const hasKompas = (inventory.kompas ?? 0) > 0;
  const seedLabel = seed === 0 ? "EXPEDITION" : `EXPEDITION ${seedCode(seed)}`;
  const runDistance = ghostDistance();
  const rank = calcRank(elapsed, edelweiss.length, notesRead.length, NOTES.length);

  const openMenu = () => {
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      /* abaikan */
    }
    pause();
  };

  if (screen === "menu") return null;

  return (
    <div className="pointer-events-none absolute inset-0 select-none" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <FlashOverlay />
      <NoteModal />
      {/* Vignette bahaya saat kritis */}
      {screen === "playing" && critical && (
        <div
          className="anim-danger absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(220,38,38,0.42) 100%)" }}
        />
      )}
      {/* Vignette sinematik halus */}
      {screen === "playing" && (
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.38) 100%)" }}
        />
      )}

      {/* Crosshair */}
      {screen === "playing" && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70">
          <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
        </div>
      )}

      {/* Banner badai (di bawah chip seed agar tidak tumpang tindih) */}
      {screen === "playing" && weather === "badai" && (
        <div className="absolute left-1/2 top-14 z-10 -translate-x-1/2 sm:top-16">
          <div className="anim-danger flex items-center gap-2 rounded-full border border-red-300/40 bg-red-950/80 px-4 py-1.5 text-xs font-black tracking-wider text-red-100 backdrop-blur-md">
            ⛈️ BADAI — JANGAN DIAM DI TERBUKA
          </div>
        </div>
      )}

      {/* Banner checkpoint */}
      {screen === "playing" && <CheckpointBanner />}

      {/* Chip seed ekspedisi + modifier */}
      {screen === "playing" && (
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
          {weather !== "badai" && (
            <div className="flex items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/75 px-3.5 py-1 font-mono text-[11px] font-black tracking-wider text-cyan-200 backdrop-blur-md">
              🗺️ {seedLabel}
              <span className="text-white/40">•</span>
              <span className="text-white/70">{mode === "harian" ? "Tantangan Harian" : "Standar"}</span>
            </div>
          )}
          {modifiers.length > 0 && (
            <div className="flex gap-1.5">
              {modifiers.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-fuchsia-300/25 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold text-fuchsia-100 backdrop-blur-md"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Panel status kiri atas */}
      {screen === "playing" && (
        <div className="anim-fade-up absolute left-2 top-2 w-44 rounded-2xl border border-white/12 bg-slate-950/70 p-3 shadow-2xl backdrop-blur-md sm:left-3 sm:top-3 sm:w-60 sm:p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Kondisi tubuh</span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white/85">
              {isNight ? "🌙" : "☀️"} {formatClock(timeOfDay)}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            <Bar icon="⚡" label="Stamina" value={stamina} gradient="linear-gradient(90deg,#16a34a,#4ade80)" critical={stamina <= 20} />
            <Bar icon="🌡️" label="Suhu" value={suhu} gradient={suhu > 30 ? "linear-gradient(90deg,#ea580c,#fb923c,#fde68a)" : "linear-gradient(90deg,#0284c7,#38bdf8)"} critical={suhu <= 20} />
            <Bar icon="🫁" label="Oksigen" value={oksigen} gradient="linear-gradient(90deg,#0e7490,#22d3ee)" critical={oksigen <= 20 && playerPos[1] > 35} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${wMeta.chip}`}>
              {wMeta.icon} {wMeta.label}
            </span>
            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[11px] font-bold text-white/80">
              ⛰️ {Math.round(playerPos[1])} mdpl
            </span>
          </div>
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[11px] font-bold text-white/70">
              <span>🌸 Edelweiss</span>
              <span key={edelweiss.length} className="anim-pop font-mono">{edelweiss.length}/12</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-300 transition-all"
                style={{ width: `${(edelweiss.length / 12) * 100}%` }}
              />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-bold text-white/70">
            <span className="rounded-md bg-black/40 px-1.5 py-1">
              📖 Catatan {notesRead.length}/{NOTES.length}
            </span>
            <span className="rounded-md bg-black/40 px-1.5 py-1">📷 Foto {photoScore}</span>
          </div>
        </div>
      )}

      {/* Kompas + minimap kanan atas */}
      {screen === "playing" && (
        <div className="anim-fade-up stagger-1 absolute right-2 top-2 flex w-36 flex-col items-stretch gap-2 sm:right-3 sm:top-3 sm:w-48">
          <div className="rounded-2xl border border-white/12 bg-slate-950/70 px-3.5 py-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
              🧭 Tujuan
            </div>
            <div className="mt-0.5 truncate text-[13px] font-black text-white">{nextCp.name}</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-black text-amber-200">{Math.round(dist)}</span>
              <span className="text-[11px] font-bold text-white/60">m • {directionHint(dx, dz)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-white/55">
              <span>Pos {Math.min(checkpointIndex + 1, 5)}/5</span>
              <span className="font-mono">{progress}%</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/12 bg-slate-950/70 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Minimap</span>
              <span className="text-[10px] font-bold text-white/40">U ▲</span>
            </div>
            <div className="flex justify-center px-2 pb-1">
              <Minimap checkpointIndex={checkpointIndex} hasKompas={hasKompas} weather={weather} />
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-white/10 px-2 py-1.5 text-[10px] font-semibold text-white/55">
              <span><i className="mr-1 inline-block h-1.5 w-3 rounded-full bg-[#e8c07a]" />Jalur</span>
              <span><i className="mr-1 inline-block h-1.5 w-3 rounded-full bg-[#fb923c]" />Pintas</span>
              <span><i className="mr-1 inline-block h-1.5 w-3 rounded-full bg-[#0ea5e9]" />Sungai</span>
              {hasKompas && <span><i className="mr-1 inline-block h-1.5 w-3 rounded-full bg-[#22d3ee]" />Kompas</span>}
            </div>
          </div>
        </div>
      )}

      {/* Inventory kiri bawah (2 baris: item survival + item ekspedisi) */}
      {screen === "playing" && (
        <div className="anim-fade-up stagger-2 absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
          <div className="mb-1.5 ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/55 drop-shadow">
            Inventaris
          </div>
          <div className="pointer-events-auto grid grid-cols-4 gap-2">
            {INVENTORY_SLOTS.map((slot) => {
              const count = inventory[slot.id] ?? 0;
              const empty = count <= 0;
              return (
                <button
                  key={slot.id}
                  onClick={() => consumeItem(slot.id)}
                  disabled={empty}
                  className={`btn-game group relative flex w-[54px] flex-col items-center rounded-xl border px-1 pb-1.5 pt-2 backdrop-blur-md sm:w-[74px] ${
                    empty
                      ? "border-white/10 bg-slate-950/50 opacity-45"
                      : "border-white/15 bg-slate-950/70 shadow-xl hover:border-emerald-300/40"
                  }`}
                  title={`${slot.name} (${slot.effect}) — tekan ${slot.key}`}
                >
                  <span className="absolute right-1 top-1 rounded-md bg-white/12 px-1 font-mono text-[10px] font-black text-white/75">
                    {slot.key}
                  </span>
                  <span className={`text-[22px] leading-none ${empty ? "grayscale" : ""}`}>{slot.emoji}</span>
                  <span className={`mt-1 text-[13px] font-black ${empty ? "text-white/40" : "text-white"}`}>×{count}</span>
                  <span className="text-[10px] font-bold text-white/55">{slot.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tombol MENU + ghost + mute kanan bawah */}
      {screen === "playing" && (
        <div className="pointer-events-auto absolute bottom-2 right-2 flex gap-2 sm:bottom-3 sm:right-3">
          <button
            onClick={toggleGhost}
            className="btn-game rounded-xl border border-white/15 bg-slate-950/70 px-3.5 py-2.5 text-base shadow-xl backdrop-blur-md"
            title={ghostEnabled ? "Sembunyikan ghost run" : "Tampilkan ghost run"}
          >
            {ghostEnabled ? "👻" : "👓"}
          </button>
          <button
            onClick={toggleMute}
            className="btn-game rounded-xl border border-white/15 bg-slate-950/70 px-3.5 py-2.5 text-base shadow-xl backdrop-blur-md"
            title={muted ? "Nyalakan suara" : "Bisukan suara"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={openMenu}
            className="btn-game rounded-xl border border-white/15 bg-slate-950/70 px-5 py-2.5 text-[13px] font-black tracking-[0.14em] text-white shadow-xl backdrop-blur-md hover:border-white/30"
          >
            MENU <span className="kbd ml-1">ESC</span>
          </button>
        </div>
      )}

      {/* Pesan tengah */}
      {screen === "playing" && <ToastMessage />}

      {/* Hint bawah tengah */}
      {screen === "playing" && (
        <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 lg:block">
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-[11px] font-semibold text-white/65 backdrop-blur-md">
            <span className="kbd">WASD</span> gerak
            <span className="text-white/25">•</span>
            <span className="kbd">Shift</span> lari
            <span className="text-white/25">•</span>
            <span className="kbd">E</span> tenda / petik / catatan
            <span className="text-white/25">•</span>
            <span className="kbd">F</span> foto satwa
            <span className="text-white/25">•</span>
            <span className="kbd">1–4</span>/<span className="kbd">QRTG</span> item
            <span className="text-white/25">•</span>
            klik kanvas = kunci mouse
          </div>
        </div>
      )}

      {/* Pause */}
      {screen === "paused" && (
        <div className="anim-fade-in pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="anim-pop w-full max-w-sm rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-2xl">⏸️</div>
            <h2 className="text-xl font-black tracking-[0.2em] text-white">PAUSE</h2>
            <p className="mt-1 text-xs font-semibold text-white/55">
              {CHECKPOINTS[checkpointIndex].name} • {Math.round(playerPos[1])} mdpl • {formatClock(timeOfDay)}
            </p>
            <div className="mt-1 font-mono text-[11px] font-bold text-cyan-200/80">
              {seedLabel} • 📖 {notesRead.length}/{NOTES.length} • 📷 {photoScore}
            </div>
            <div className="mx-auto mt-3 grid max-w-[240px] grid-cols-3 gap-1.5 text-[11px] font-bold text-white/70">
              <div className="rounded-lg bg-black/40 px-2 py-1.5">⚡ {stamina}</div>
              <div className="rounded-lg bg-black/40 px-2 py-1.5">🌡️ {suhu}</div>
              <div className="rounded-lg bg-black/40 px-2 py-1.5">🫁 {oksigen}</div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={resume} className="btn-game rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-black text-white shadow-lg">
                ▶ Lanjutkan
              </button>
              <button onClick={startNew} className="btn-game rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-600">
                🔄 Ulangi dari Basecamp
              </button>
              <div className="flex gap-2">
                <button onClick={toggleMute} className="btn-game flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10">
                  {muted ? "🔇 Mute" : "🔊 Suara"}
                </button>
                <button onClick={toggleGhost} className="btn-game flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10">
                  {ghostEnabled ? "👻 Ghost On" : "👓 Ghost Off"}
                </button>
                <button onClick={toMenu} className="btn-game flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10">
                  🏠 Menu
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/40">
              <span className="kbd">WASD</span>
              <span className="kbd">Shift</span>
              <span className="kbd">E</span>
              <span className="kbd">F</span>
              <span className="kbd">1–4</span>
              <span className="kbd">QRTG</span>
            </div>
          </div>
        </div>
      )}

      {/* Menang / Kalah */}
      {(screen === "won" || screen === "lost") && (
        <div className="anim-fade-in pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
          <div
            className={`anim-pop w-full max-w-md rounded-2xl border p-6 text-center shadow-2xl ${
              screen === "won"
                ? "border-emerald-300/25 bg-gradient-to-b from-emerald-950/90 to-slate-950"
                : "border-red-300/25 bg-gradient-to-b from-red-950/80 to-slate-950"
            }`}
          >
            <div className="anim-float-slow mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/8 text-4xl">
              {screen === "won" ? "🏔️" : "🚨"}
            </div>
            <h2 className={`text-3xl font-black tracking-tight ${screen === "won" ? "text-emerald-200" : "text-red-200"}`}>
              {screen === "won" ? "PUNCAK!" : "EVAKUASI"}
            </h2>
            <p className="mt-1 text-sm font-medium text-white/70">
              {screen === "won"
                ? "Luar biasa! Kamu menaklukkan Puncak Nusantara. 🏁"
                : "Stamina atau suhu mencapai batas kritis. Tim SAR menjemputmu."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/45">⏱️ Waktu</div>
                <div className="font-mono text-lg font-black text-white">{formatDuration(elapsed)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/45">📍 Pos</div>
                <div className="truncate text-sm font-black text-white">{CHECKPOINTS[checkpointIndex].name}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/45">🌸 Edelweiss</div>
                <div className="font-mono text-lg font-black text-pink-200">{edelweiss.length}/12</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/45">❤️ Sisa</div>
                <div className="font-mono text-sm font-black text-white">⚡{stamina} 🌡️{suhu} 🫁{oksigen}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/45">📖 / 📷</div>
                <div className="font-mono text-sm font-black text-white">
                  {notesRead.length}/{NOTES.length} catatan • {photoScore} foto
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/45">🥾 Jarak</div>
                <div className="font-mono text-sm font-black text-white">{Math.round(runDistance)} m</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/45">🗺️ Seed</div>
                <div className="truncate font-mono text-sm font-black text-cyan-200">
                  {seedLabel} • {mode === "harian" ? "Harian" : "Standar"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/45">🏅 Peringkat</div>
                <div className="font-mono text-lg font-black text-amber-200">{screen === "won" ? rank : "—"}</div>
              </div>
            </div>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-semibold text-white/55">
              🎒 Dipakai: {itemsUsedText}
              {screen === "won" && loadGhost(mode) && ghostEligible(loadGhost(mode), mode, seed) && ghostEnabled && (
                <span className="ml-2 text-cyan-300">• 👻 ghost terbaik tersimpan</span>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={startNew}
                className={`btn-game rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-lg ${
                  screen === "won"
                    ? "bg-gradient-to-r from-emerald-500 to-green-600"
                    : "bg-gradient-to-r from-sky-500 to-blue-600"
                }`}
              >
                {screen === "won" ? "🏔️ Daki Lagi" : "🥾 Coba Lagi"}
              </button>
              <button onClick={toMenu} className="btn-game rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10">
                🏠 Menu Utama
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
