import { useMountainStore } from "./game/store";
import { MountainScene } from "./game/MountainScene";
import { HUD } from "./game/HUD";
import { MainMenu } from "./screens/MainMenu";

export default function App() {
  const screen = useMountainStore((s) => s.screen);

  if (screen === "menu") {
    return (
      <div style={{ width: "100dvw", height: "100dvh" }}>
        <MainMenu />
      </div>
    );
  }

  return (
    <div style={{ width: "100dvw", height: "100dvh", position: "relative", background: "#000" }}>
      <MountainScene />
      <HUD />
    </div>
  );
}
