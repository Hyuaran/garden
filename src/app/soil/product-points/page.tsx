import { withSystemView } from "@/lib/auth/system-view-page.server";
import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import { loadPoints, productPointsContext } from "./server";
import ProductPointsClient from "./ProductPointsClient";
import type { PointRow } from "@/lib/product-points";

export const metadata = { title: "付与ポイント表 | Garden" };

async function Page() {
  const { db, canWrite } = await productPointsContext();
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  let rows: PointRow[] = [];
  let error = "";
  try {
    rows = await loadPoints(db);
  } catch {
    error =
      "付与ポイント表を読み込めませんでした。時間をおいて開き直してください。";
  }
  return (
    <ProductPointsClient
      initialRows={rows}
      canWrite={canWrite && !error}
      today={today}
      initialError={error}
    />
  );
}

export default withInitialUrlView(
  withSystemView("soil-product-points", Page, undefined, "/soil/product-points"),
);
