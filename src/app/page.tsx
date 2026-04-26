import { GardenView } from "../components/shared/garden-view/GardenView";
import { getCurrentTimeTheme } from "../components/shared/_lib/timeTheme";

// 時間帯テーマを per-request 算出（cross-ui-04）。
// SSG キャッシュさせず常に「今の時刻」の theme を反映。
export const dynamic = "force-dynamic";

export default function GardenHomePage() {
  const theme = getCurrentTimeTheme();
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px 16px",
        background: "linear-gradient(180deg, #FAF8F3 0%, #F0EBE0 100%)",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>Garden</h1>
        <p style={{ color: "#666", marginTop: 8, fontSize: 13 }}>盆栽ビュー</p>
      </header>

      <GardenView theme={theme} />
    </main>
  );
}
