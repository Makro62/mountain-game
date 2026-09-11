import { useEffect, useRef, useState } from "react";
import { BRIDGE, CHECKPOINTS, SHORTCUT_A, SHORTCUT_B, TRAIL, riverCenterX } from "./terrain";
import { playerState } from "./playerRef";
import { formatDuration, useMountainStore, type Weather } from "./store";

const WEATHER_ICON: Record<Weather, string> = {
  cerah: "☀️",
  kabut: "🌫️",
  hujan: "🌧️",
  badai: "⛈️",
};

function Bar({ label, value, color, critical }: { label: string; value: number; color: string; critical?: boolean }) {
  return (
    <div className={`w-44 ${critical ? "animate-pulse" : ""}`}>
      <div className={`flex justify-between text-[11px] font-semibold tracking-wide ${critical ? "text-red-400" : ""}`}>
        <span>{label} {critical && "⚠️"}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-2.5 rounded bg-black/50 overflow-hidden border border-white/20">
        <div
          className="h-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
        />
      </div>
    </div>
  );
}

function directionHint(dx: number, dz: number): string {
  // Utara = -Z
  const vert = dz < -5 ? "Utara ↑" : dz > 5 ? "Selatan ↓" : "";
  const horiz = dx > 5 ? "Timur →" : dx < -5 ? "← Barat" : "";
  return [vert, horiz].filter(Boolean).join(" ") || "di sini";
}

/** Minimap top-down: jalur, pintasan, sungai, pos, pemain. */
function Minimap({ checkpointIndex }: { checkpointIndex: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = 148;
    const k = S / 400;
    const X = (x: number) => (x + 200) * k;
    const Y = (z: number) => (z + 200) * k;

    let rafId = 0;
    const draw = () => {
      rafId = requestAnimationFrame(draw);

      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
      ctx.fillRect(0, 0, S, S);

      // Sungai
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let z = -60; z <= 192; z += 8) {
        const px = X(riverCenterX(z));
        const py = Y(z);
        if (z === -60) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Pintasan (oranye putus-putus)
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      for (const path of [SHORTCUT_A, SHORTCUT_B]) {
        ctx.beginPath();
        path.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(X(x), Y(z)) : ctx.lineTo(X(x), Y(z))));
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Jalur utama
      ctx.strokeStyle = "#d6a35c";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      TRAIL.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(X(x), Y(z)) : ctx.lineTo(X(x), Y(z))));
      ctx.stroke();

      // Jembatan
      ctx.fillStyle = "#92400e";
      ctx.fillRect(X(BRIDGE.x) - 2, Y(BRIDGE.z) - 2, 4, 4);

      // Checkpoint: hijau = tercapai, merah = berikutnya, abu = jauh
      CHECKPOINTS.forEach((cp, i) => {
        ctx.fillStyle = i <= checkpointIndex ? "#22c55e" : i === checkpointIndex + 1 ? "#ef4444" : "#64748b";
        ctx.beginPath();
        ctx.arc(X(cp.x), Y(cp.z), i === checkpointIndex + 1 ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Pemain
      const px = X(playerState.pos.x);
      const py = Y(playerState.pos.z);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      const tick = Math.floor(Date.now() / 500);
      ctx.arc(px, py, 6 + (tick % 2), 0, Math.PI * 2);
      ctx.stroke();

      // Label utara
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("U", 4, 11);
    };
    
    draw();
    return () => cancelAnimationFrame(rafId);
  }, [checkpointIndex]);

  return <canvas ref={ref} width={148} height={148} className="rounded-lg border border-white/15" />;
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
  return (
    <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-lg bg-black/65 px-4 py-2 text-sm font-semibold border border-white/15 transition-opacity">
      {message}
    </div>
  );
}

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
  const isNight = useMountainStore((s) => s.timeOfDay > 0.55 && s.timeOfDay < 0.95);
  const edelweiss = useMountainStore((s) => s.edelweiss);
  const startedAt = useMountainStore((s) => s.startedAt);
  const endedAt = useMountainStore((s) => s.endedAt);

  const pause = useMountainStore((s) => s.pause);
  const resume = useMountainStore((s) => s.resume);
  const toMenu = useMountainStore((s) => s.toMenu);
  const startNew = useMountainStore((s) => s.startNew);
  const consumeItem = useMountainStore((s) => s.useItem);
  const toggleMute = useMountainStore((s) => s.toggleMute);
  const muted = useMountainStore((s) => s.muted);

  const nextCp = CHECKPOINTS[Math.min(checkpointIndex + 1, CHECKPOINTS.length - 1)];
  const dx = nextCp.x - playerPos[0];
  const dz = nextCp.z - playerPos[2];
  const dist = Math.hypot(dx, dz);
  const elapsed = (endedAt ?? Date.now()) - (startedAt ?? Date.now());
  const itemsUsedText = Object.entries(itemsUsed).map(([id, count]) => `${count} ${id}`).join(", ") || "tidak ada";

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
      {/* Bar status kiri atas */}
      {screen === "playing" && (
        <div className="absolute left-3 top-3 flex flex-col gap-2 rounded-lg bg-black/45 p-3 backdrop-blur-sm border border-white/10">
          <Bar label="⚡ Stamina" value={stamina} color={stamina > 30 ? "#4ade80" : "#ef4444"} critical={stamina <= 20} />
          <Bar label="🌡️ Suhu" value={suhu} color={suhu > 30 ? "#fb923c" : "#38bdf8"} critical={suhu <= 20} />
          <Bar label="🫁 Oksigen" value={oksigen} color="#22d3ee" critical={oksigen <= 20 && playerPos[1] > 35} />
          <div className="text-[11px] text-white/80">
            {WEATHER_ICON[weather]} {weather} • {isNight ? "🌙 Malam" : "☀️ Siang"} • {Math.round(playerPos[1])} mdpl
          </div>
          <div className="text-[11px] text-white/80">🌸 Edelweiss {edelweiss.length}/12</div>
        </div>
      )}

      {/* Kompas + minimap kanan atas */}
      {screen === "playing" && (
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
          <div className="rounded-lg bg-black/45 px-3 py-2 text-right border border-white/10">
            <div className="text-xs font-bold">🧭 {nextCp.name}</div>
            <div className="text-[11px] text-white/80">
              {Math.round(dist)} m {directionHint(dx, dz)}
            </div>
            <div className="text-[11px] text-white/60">Pos {Math.min(checkpointIndex + 1, 5)}/5</div>
          </div>
          <Minimap checkpointIndex={checkpointIndex} />
        </div>
      )}

      {/* Inventory kiri bawah */}
      {screen === "playing" && (
        <div className="pointer-events-auto absolute bottom-3 left-3 flex gap-2">
          {(
            [
              ["bekal", "🍙", "1"],
              ["jaket", "🧥", "2"],
              ["p3k", "🩹", "3"],
              ["oksigen", "🫁", "4"],
            ] as const
          ).map(([id, emoji, key]) => (
            <button
              key={id}
              onClick={() => consumeItem(id)}
              className="flex w-16 flex-col items-center rounded-lg bg-black/55 border border-white/15 px-1 py-1.5 text-white hover:bg-black/75"
              title={`Pakai (${key})`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="text-[11px] font-bold">×{inventory[id]}</span>
              <span className="text-[10px] text-white/60">[{key}]</span>
            </button>
          ))}
        </div>
      )}

      {/* Tombol MENU + mute kanan bawah */}
      {screen === "playing" && (
        <div className="pointer-events-auto absolute bottom-3 right-3 flex gap-2">
          <button
            onClick={toggleMute}
            className="rounded-lg bg-black/55 border border-white/15 px-3 py-2 text-sm hover:bg-black/75"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={openMenu}
            className="rounded-lg bg-black/55 border border-white/15 px-4 py-2 text-sm font-bold tracking-widest hover:bg-black/75"
          >
            MENU [ESC]
          </button>
        </div>
      )}

      {/* Pesan tengah */}
      {screen === "playing" && <ToastMessage />}

      {/* Hint klik untuk kunci mouse */}
      {screen === "playing" && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-white/60 bg-black/35 px-3 py-1 rounded">
          Klik kanvas untuk kunci mouse • WASD/panah gerak (A/D atau ←/→ kiri-kanan) • Shift lari • E tenda/edelweiss
        </div>
      )}

      {/* Pause */}
      {screen === "paused" && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="w-80 rounded-xl bg-slate-900 border border-white/15 p-6 text-center">
            <h2 className="text-xl font-bold tracking-widest mb-1">PAUSE</h2>
            <p className="text-xs text-white/60 mb-4">{CHECKPOINTS[checkpointIndex].name} • {Math.round(playerPos[1])} mdpl</p>
            <div className="flex flex-col gap-2">
              <button onClick={resume} className="rounded-lg bg-green-600 px-4 py-2 font-bold hover:bg-green-500">Lanjutkan</button>
              <button onClick={startNew} className="rounded-lg bg-slate-700 px-4 py-2 font-bold hover:bg-slate-600">Ulangi dari Basecamp</button>
              <button onClick={toMenu} className="rounded-lg bg-slate-800 px-4 py-2 font-bold hover:bg-slate-700">Menu Utama</button>
            </div>
          </div>
        </div>
      )}

      {/* Menang / Kalah */}
      {(screen === "won" || screen === "lost") && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="w-96 rounded-xl bg-slate-900 border border-white/15 p-6 text-center">
            <h2 className="text-2xl font-bold mb-1">{screen === "won" ? "🏔️ PUNCAK!" : "🚨 EVAKUASI"}</h2>
            <p className="text-sm text-white/75 mb-2">{screen === "won" ? "Kamu berhasil menaklukkan gunung!" : "Stamina atau Suhu tubuh mencapai batas kritis."}</p>
            <div className="text-xs text-white/60 mb-4 flex flex-col gap-1">
              <div>Waktu: {formatDuration(elapsed)} • Pos: {CHECKPOINTS[checkpointIndex].name}</div>
              <div>Sisa ⚡{stamina} 🌡️{suhu} 🫁{oksigen} • 🌸 {edelweiss.length}/12</div>
              <div>Dipakai: {itemsUsedText}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={startNew} className="rounded-lg bg-green-600 px-4 py-2 font-bold hover:bg-green-500">Daki Lagi</button>
              <button onClick={toMenu} className="rounded-lg bg-slate-800 px-4 py-2 font-bold hover:bg-slate-700">Menu Utama</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
