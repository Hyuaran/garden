import "server-only";
import ExcelJS from "exceljs";
import { getSupabaseAdmin } from "./supabase/admin";
import { ChatworkClient } from "./chatwork";
const PAGE = "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/minimumichiran/";
export async function parseMinimumWageExcel(bytes: ArrayBuffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(new Uint8Array(bytes)) as never);
  if (book.worksheets.length !== 1) throw new Error("最低賃金の表の形を確認できませんでした");
  const sheet = book.worksheets[0];
  let result: { hourly_amount: number; effective_from: string } | undefined;
  sheet.eachRow((row, index) => {
    if (index < 3 || String(row.getCell(1).text).replace(/\s/g, "") !== "大阪") return;
    const c = sheet.columnCount - 1;
    if (!/時間額|改定額/.test(String(sheet.getRow(2).getCell(c).text)) || !String(sheet.getRow(2).getCell(c+1).text).includes("発効年月日")) throw new Error("最低賃金の表の形を確認できませんでした");
    const amount = row.getCell(c).value, value = row.getCell(c+1).value;
    const date = value instanceof Date ? value : typeof value === "number" ? new Date(Date.UTC(1899,11,30) + value * 86400000) : null;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || !date || !Number.isFinite(date.getTime())) throw new Error("最低賃金の金額・発効日を読めませんでした");
    result = { hourly_amount: amount, effective_from: date.toISOString().slice(0,10) };
  });
  if (!result) throw new Error("大阪の最低賃金を読めませんでした");
  return result;
}
export function mhlwExcelUrl(html: string) {
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!match[2].replace(/<[^>]*>/g, "").includes("改定状況")) continue;
    const url = new URL(match[1].replace(/&amp;/g,"&"), PAGE);
    if (url.protocol === "https:" && url.hostname === "www.mhlw.go.jp" && url.pathname.endsWith(".xlsx")) return url.href;
  }
  throw new Error("厚生労働省の改定状況の表が見つかりませんでした");
}
export async function syncMinimumWagesFromMhlw(deps = { db: getSupabaseAdmin(), fetcher: fetch }) {
  try {
    const page = await deps.fetcher(PAGE, { signal: AbortSignal.timeout(30000) });
    if (!page.ok) throw new Error("厚生労働省のページを読めませんでした");
    const source_url = mhlwExcelUrl(await page.text());
    const excel = await deps.fetcher(source_url, { signal: AbortSignal.timeout(30000) });
    if (!excel.ok) throw new Error("最低賃金の表を読めませんでした");
    const wage = await parseMinimumWageExcel(await excel.arrayBuffer());
    const { data, error } = await deps.db.from("root_minimum_wages").upsert({ ...wage, prefecture:"大阪府", source_url, created_by:"自動（厚生労働省）" }, {onConflict:"prefecture,effective_from",ignoreDuplicates:true}).select("id");
    if (error) throw new Error("最低賃金を登録できませんでした");
    return { ok:true as const, added:!!data?.length, ...wage };
  } catch (error) { return { ok:false as const, error:error instanceof Error ? error.message : "取り込みに失敗しました" }; }
}
export async function runMinimumWageCron(now = new Date(), deps = { db:getSupabaseAdmin(), sync:syncMinimumWagesFromMhlw, notify:async (message:string) => { await new ChatworkClient(process.env.CHATWORK_API_TOKEN ?? "").sendMessage("450125458",message); } }) {
  const month = Number(now.toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"}).slice(5,7));
  if (month < 8 || month > 10) return {ok:true, skipped:true};
  const result = await deps.sync();
  const {data:health,error} = await deps.db.from("root_minimum_wage_sync_log").select("last_error").eq("id","_health:sync").maybeSingle();
  if (error) throw new Error("取り込みの記録を読めませんでした");
  if (result.ok && result.added) await deps.notify(`大阪の最低賃金を自動で登録しました：${result.hourly_amount.toLocaleString("ja-JP")} 円（${result.effective_from} から）。最低賃金マスタで確かめてください`);
  if (!result.ok && !health?.last_error) await deps.notify(`最低賃金の自動登録に失敗しました：${result.error}`);
  if (result.ok && health?.last_error) await deps.notify("最低賃金の自動登録が回復しました");
  const saved = await deps.db.from("root_minimum_wage_sync_log").upsert({id:"_health:sync",last_error:result.ok?null:result.error,updated_at:now.toISOString()});
  if (saved.error) throw new Error("取り込みの記録を保存できませんでした");
  return result;
}
