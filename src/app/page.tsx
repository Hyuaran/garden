import { AppHeader } from "./_components/AppHeader";
import { Sidebar } from "./_components/Sidebar";
import { ModuleGrid } from "./_components/ModuleGrid";
import { KpiCard } from "./_components/KpiCard";
import { getVisibleKpiCards } from "./_lib/kpi-fetchers";

// per-request 算出
export const dynamic = "force-dynamic";

export default async function GardenHomePage() {
  // 5/5 デモ用 super_admin 想定。post-5/5 で root_employees 連携 → 動的 role
  const role = "super_admin";
  const kpiCards = getVisibleKpiCards(role);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: "url(/images/garden-home-bg-v2.webp)",
        backgroundSize: "cover",
        backgroundPosition: "right center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <Sidebar />

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

        <section aria-label="挨拶" style={{ padding: "20px 28px 0" }}>
          <h1 style={{ fontSize: 24, margin: 0, color: "#1F5C3A", fontWeight: 700 }}>
            東海林さん、おはようございます
          </h1>
          <p style={{ fontSize: 13, color: "#5C6E5F", marginTop: 6 }}>
            今日も素敵な一日を。業務の成長をサポートします。
          </p>
        </section>

        {kpiCards.length > 0 && (
          <section
            aria-label="KPI ダッシュボード"
            style={{
              padding: "16px 28px 0",
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(kpiCards.length, 4)}, 1fr)`,
              gap: 14,
              maxWidth: 1080,
              width: "100%",
              margin: "0 auto",
            }}
          >
            {kpiCards.map((card) => (
              <KpiCard key={card.id} card={card} />
            ))}
          </section>
        )}

        <section aria-label="モジュール一覧" style={{ padding: "16px 28px 32px", flex: 1 }}>
          <ModuleGrid />
        </section>
      </div>
    </div>
  );
}
