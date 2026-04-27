import { GardenView } from "../components/shared/garden-view/GardenView";
import { resolveAtmosphereParam } from "../components/shared/garden-view/_lib/atmospheres";
import { AppHeader } from "./_components/AppHeader";
import { HelpCard } from "./_components/HelpCard";

// per-request 算出（URL クエリ ?atmosphere=N を反映するため SSG キャッシュ無効）
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ atmosphere?: string }>;
};

export default async function GardenHomePage({ searchParams }: Props) {
  const params = await searchParams;
  const initialAtmosphere = resolveAtmosphereParam(params.atmosphere);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #FAF8F3 0%, #F0EBE0 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppHeader />

      <section
        aria-label="挨拶"
        style={{ padding: "20px 24px 0", textAlign: "left" }}
      >
        <h1 style={{ fontSize: 22, margin: 0, color: "#1F5C3A" }}>
          東海林さん、おはようございます
        </h1>
        <p style={{ fontSize: 12, color: "#5C6E5F", marginTop: 6 }}>
          今日も素敵な一日を。業務の成長をサポートします。
        </p>
      </section>

      <section style={{ padding: "16px 24px 24px", position: "relative" }}>
        <GardenView initialAtmosphere={initialAtmosphere} />
        <HelpCard />
      </section>
    </main>
  );
}
