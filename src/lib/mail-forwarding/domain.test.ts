import { describe, expect, it, vi } from "vitest";
import { expiry, tone, remaining, dueNotice, sortForwardings, type Forwarding, type Notice } from "./domain";
import { deliverNotices } from "./notify";
import { ROOT_VIEW_SCOPES } from "@/lib/auth/root-view-scopes";
import { resolveCanView } from "@/lib/auth/view-permission";
import { readFileSync } from "node:fs";
const row: Forwarding = { id:"a", holder:"会社", from_address:"元", to_address:"先", notes:"", stopped:false, filings:[{id:"f", forwarding_id:"a", filed_on:"2025-10-15", method:"e転居", receipt:"", filed_by:"", notes:""}] };
describe("郵便の転送", () => {
 it("DB は匿名アクセスを拒否し、閲覧と編集を別々の方針で制御する", () => {
   const sql=readFileSync("supabase/migrations/20261028000462_root_mail_forwarding.sql","utf8");
   for(const table of ["root_mail_forwardings","root_mail_forwarding_filings","root_mail_forwarding_notices"]) expect(sql).toContain(`alter table public.${table} enable row level security`);
   expect(sql).toContain("from anon,authenticated");
   expect(sql).toContain("for select to authenticated using(public.root_mail_forwarding_can_read())");
   expect(sql).toContain("for insert to authenticated with check(public.root_is_super_admin())");
   expect(sql).toContain("for update to authenticated using(public.root_is_super_admin()) with check(public.root_is_super_admin())");
   expect(sql).toContain("e.employee_id=any(p.employee_ids)");
   expect(sql).toContain("primary key(forwarding_id,filed_on,stage)");
   expect(sql).toContain("from public,anon,authenticated");
   expect(sql).not.toMatch(/grant[^;]*update[^;]*root_mail_forwarding_filings to authenticated/);
 });
 it.each([["2025-10-15","2026-10-14"],["2024-02-29","2025-02-27"],["2023-03-01","2024-02-29"],["2025-01-31","2026-01-30"]])("期限 %s", (date, expected) => expect(expiry(date)).toBe(expected));
 it.each([[61,"ok"],[60,"wait"],[0,"wait"],[-1,"ng"]])("残り %s 日", (days, expected) => expect(tone(days as number)).toBe(expected));
 it("期限当日は有効、翌日は期限切れ", () => { expect(remaining("2025-10-15","2026-10-14")).toBe(0); expect(dueNotice(row,[],"2026-10-14")?.stage).toBe("7"); expect(dueNotice(row,[],"2026-10-15")?.stage).toBe("expired"); });
 it("送信失敗後は閾値の翌日にも再試行する", () => {
   expect(dueNotice(row,[],"2026-08-16")?.stage).toBe("60");
   expect(dueNotice(row,[{forwarding_id:"a",filed_on:"2025-10-15",stage:"60",sent_at:"2026-08-15"}],"2026-08-16")).toBeNull();
 });
 it.each([["2026-08-15","60"],["2026-09-14","30"],["2026-09-30","14"],["2026-10-07","7"],["2026-11-01","expired"]])("段階 %s", (date, stage) => expect(dueNotice(row,[],date)?.stage).toBe(stage));
 it("同じ届出の同じ段階は再送しない。届け直すと再開", () => {
   const notices: Notice[] = [{ forwarding_id:"a", filed_on:"2025-10-15", stage:"expired", sent_at:"2026-10-15" }];
   expect(dueNotice(row,notices,"2026-11-01")).toBeNull();
   const renewed = {...row,filings:[...row.filings,{...row.filings[0],id:"g",filed_on:"2026-10-20"}]};
   expect(dueNotice(renewed,notices,"2027-10-20")?.stage).toBe("expired");
   expect(dueNotice({...row,stopped:true},[],"2026-11-01")).toBeNull();
 });
 it("期限順、停止は最後", () => {
   const renewed = {...row,id:"b",filings:[{...row.filings[0],filed_on:"2026-10-20"}]};
   expect(sortForwardings([renewed,{...row,id:"c",stopped:true},row]).map(r=>r.id)).toEqual(["a","b","c"]);
 });
 it("既定の閲覧は全権管理者だけ、個人追加は閲覧のみ", () => {
   expect(ROOT_VIEW_SCOPES.find(s=>s.pageKey==="root-mail-forwarding")?.defaultRoles).toEqual(["super_admin"]);
   for(const role of ["admin","manager","staff","toss"] as const) expect(resolveCanView([],"root-mail-forwarding","",{employeeId:"e",role})).toBe(false);
 });
 it("dryRun は送信・予約・記録をしない", async () => {
   const store={claim:vi.fn(),sent:vi.fn(),release:vi.fn()}, send=vi.fn();
   const result=await deliverNotices([row],[],"2026-11-01",true,store,send);
   expect(result[0].status).toBe("dryRun"); expect(send).not.toHaveBeenCalled(); expect(store.claim).not.toHaveBeenCalled(); expect(store.sent).not.toHaveBeenCalled();
 });
 it("送信成功後だけ記録し、失敗は予約解除", async () => {
   const store={claim:vi.fn().mockResolvedValue(true),sent:vi.fn(),release:vi.fn()}, send=vi.fn().mockRejectedValue(new Error("fail"));
   await deliverNotices([row],[],"2026-11-01",false,store,send);
   expect(store.sent).not.toHaveBeenCalled(); expect(store.release).toHaveBeenCalledOnce();
   send.mockResolvedValue(undefined); await deliverNotices([row],[],"2026-11-02",false,store,send); expect(store.sent).toHaveBeenCalledOnce();
 });
 it("予約を取得できない同時実行は送らない", async () => {
   const send=vi.fn(); await deliverNotices([row],[],"2026-11-01",false,{claim:async()=>false,sent:vi.fn(),release:vi.fn()},send); expect(send).not.toHaveBeenCalled();
 });
});
