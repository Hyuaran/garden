import { withSystemView } from "@/lib/auth/system-view-page.server";
import { hakenContext, loadHakenData } from "@/lib/haken/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { notFound } from "next/navigation";
import HakenDetail from "../../HakenDetail";
async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await hakenContext();
  const data = await loadHakenData(db);
  if (id !== "new" && !data.workers.some((row) => row.id === id)) notFound();
  return (
    <HakenDetail
      key={id}
      initialData={data}
      kind="ledger"
      id={id}
      canWrite={Boolean(await requireManager())}
    />
  );
}
export default withSystemView("system-haken", Page);
