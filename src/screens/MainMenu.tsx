import { CHECKPOINTS } from "../game/terrain";
import { useMountainStore } from "../game/store";

export function MainMenu() {
  const startNew = useMountainStore((s) => s.startNew);
  const continueGame = useMountainStore((s) => s.continueGame);
  const resetSave = useMountainStore((s) => s.resetSave);
  const startedAt = useMountainStore((s) => s.startedAt);
  const checkpointIndex = useMountainStore((s) => s.checkpointIndex);

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-sky-900 via-slate-900 to-black p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-black/55 p-8 text-center backdrop-blur">
        <div className="text-5xl mb-2">⛰️</div>
        <h1 className="text-3xl font-black tracking-wide">MOUNTAIN GAME</h1>
        <p className="text-sm text-white/65 mb-1">Pendakian 3D offline — Basecamp → Puncak Nusantara</p>
        <p className="text-xs text-white/45 mb-6">Vite + React + Three.js • save lokal otomatis tiap pos</p>

        <div className="flex flex-col gap-2 mb-6">
          <button onClick={startNew} className="rounded-lg bg-green-600 px-4 py-2.5 font-bold hover:bg-green-500">
            🥾 Mulai Pendakian Baru
          </button>
          {startedAt && (
            <button onClick={continueGame} className="rounded-lg bg-sky-600 px-4 py-2.5 font-bold hover:bg-sky-500">
              ▶️ Lanjutkan — {CHECKPOINTS[checkpointIndex].name}
            </button>
          )}
          <button onClick={resetSave} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white/70 hover:bg-slate-700">
            🗑️ Reset Save
          </button>
        </div>

        <div className="text-left text-xs text-white/70 bg-white/5 rounded-lg p-3 border border-white/10">
          <div className="font-bold mb-1">Cara main</div>
          <div>WASD/panah gerak (A/D atau ←/→ kiri-kanan) • Mouse lihat (klik kanvas) • Shift sprint • Spasi lompat</div>
          <div>1-4 pakai item • E dirikan tenda di pos • Esc pause</div>
          <div className="mt-1">Jaga ⚡stamina, 🌡️suhu, 🫁oksigen. Badai + malam = bahaya.</div>
        </div>
      </div>
    </div>
  );
}
