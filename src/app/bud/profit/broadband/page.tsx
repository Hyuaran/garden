import { broadbandAccess } from "@/lib/bud/broadband/access";
import { readBroadbandTable } from "@/lib/bud/broadband/table";
import { readReferences } from "@/lib/bud/broadband/references";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import BroadbandTable from "./BroadbandTable";
export default async function BroadbandPage() {
  const auth = await broadbandAccess();
  if (!auth.ok) return <p>権限がありません</p>;
  try {
    // 収支の行と参考の明細は同時に読む（順番に読むと待ち時間が足し算になる）。
    // 参考の明細（口座の出金）は、上で見てよい人かを確かめたうえでシステムの権限で読む（ログインした人の権限だと 1 行ずつの判定で時間切れになった・2026-10-26）
    const [rows, references] = await Promise.all([readBroadbandTable(auth.db), readReferences(getSupabaseAdmin())]);
    const subdomain = process.env.KINTONE_SUBDOMAIN, app = process.env.KINTONE_BROADBAND_APP_ID;
    return <BroadbandTable admin={auth.admin} {...references} rows={rows} userId={auth.userId} today={new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(new Date())} kintoneBase={subdomain && app ? `https://${subdomain}.cybozu.com/k/${encodeURIComponent(app)}` : ""} />;
  } catch { return <p role="alert">収支を読み込めませんでした。時間をおいてもう一度お試しください。</p>; }
}
