import { AppHeader } from "./_components/AppHeader";
import { Sidebar } from "./_components/Sidebar";
import { ModuleGrid } from "./_components/ModuleGrid";

// per-request 算出（URL クエリ拡張余地あり）
export const dynamic = "force-dynamic";

export default async function GardenHomePage() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        // v6 Step 1: 背景画像（v2 placeholder = 02-morning-calm の cp）右側配置 + 左 overlay
        backgroundImage: "url(/images/garden-home-bg-v2.webp)",
        backgroundSize: "cover",
        backgroundPosition: "right center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <Sidebar />

      {/* メインエリア（左 overlay でコンテンツの可読性確保） */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "linear-gradient(90deg, rgba(250, 248, 243, 0.92) 0%, rgba(250, 248, 243, 0.85) 60%, rgba(250, 248, 243, 0.0) 100%)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppHeader />

        <section
          aria-label="挨拶"
          style={{ padding: "20px 28px 0" }}
        >
          <h1 style={{ fontSize: 24, margin: 0, color: "#1F5C3A", fontWeight: 700 }}>
            東海林さん、おはようございます
          </h1>
          <p style={{ fontSize: 13, color: "#5C6E5F", marginTop: 6 }}>
            今日も素敵な一日を。業務の成長をサポートします。
          </p>
        </section>

        <section
          aria-label="モジュール一覧"
          style={{ padding: "16px 28px 32px", flex: 1 }}
        >
          <ModuleGrid />
        </section>
      </div>
    </div>
  );
}
