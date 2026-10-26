import { broadbandAccess } from "@/lib/bud/broadband/access";
import { readBroadbandTable } from "@/lib/bud/broadband/table";
import { readReferences } from "@/lib/bud/broadband/references";
import BroadbandTable from "./BroadbandTable";
export default async function BroadbandPage() {
  const auth = await broadbandAccess();
  if (!auth.ok) return <p>権限がありません</p>;
  try {
    // 収支の行と参考の明細は同時に読む（順番に読むと待ち時間が足し算になる）
    const [rows, references] = await Promise.all([readBroadbandTable(auth.db), readReferences(auth.db)]);
    const subdomain = process.env.KINTONE_SUBDOMAIN, app = process.env.KINTONE_BROADBAND_APP_ID;
    return <BroadbandTable admin={auth.admin} {...references} rows={rows} userId={auth.userId} today={new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(new Date())} kintoneBase={subdomain && app ? `https://${subdomain}.cybozu.com/k/${encodeURIComponent(app)}` : ""} />;
  } catch { return <p role="alert">収支を読み込めませんでした。時間をおいてもう一度お試しください。</p>; }
}
