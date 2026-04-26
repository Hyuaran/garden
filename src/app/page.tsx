import { HomeIconGrid } from "../components/shared/HomeIconGrid";
import { ShojiStatusWidget } from "../components/shared/ShojiStatusWidget";

export default function GardenHomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 16px",
        background: "linear-gradient(180deg, #87CEEB 0%, #E0F6FF 60%, #FAF8F3 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <header style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>Garden</h1>
        <p style={{ color: "#666", marginTop: 8 }}>9 アプリ ホーム</p>
      </header>

      <section
        aria-label="東海林さん現在のステータス"
        style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}
      >
        <ShojiStatusWidget mode="compact" />
      </section>

      <section style={{ marginTop: 16 }}>
        <HomeIconGrid />
      </section>
    </main>
  );
}
