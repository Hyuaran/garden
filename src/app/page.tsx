import { GardenView } from "../components/shared/garden-view/GardenView";
import { resolveAtmosphereParam } from "../components/shared/garden-view/_lib/atmospheres";

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
        padding: "24px 16px",
        background: "linear-gradient(180deg, #FAF8F3 0%, #F0EBE0 100%)",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>Garden</h1>
        <p style={{ color: "#666", marginTop: 8, fontSize: 13 }}>盆栽 / 大樹ビュー</p>
      </header>

      <GardenView initialAtmosphere={initialAtmosphere} />
    </main>
  );
}
