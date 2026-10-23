import "server-only";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createRecord, getAllRecords } from "@/lib/kintone/records";
import { syncRootRoster } from "@/app/root/_lib/roster-sync.server";
import { createKotEmployee, fetchKotHireEmployees, fetchKotHireOptions } from "@/app/root/_lib/kot-api";
import { parseHireInput, rosterPayload, type HireCandidate } from "./hire-candidates";
export class HireError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function hireAdminContext() {
 const db = await createServerClient();
 const { data: { user } } = await db.auth.getUser();
 if (!user) throw new HireError("閲覧権限がありません",403);
 const { data, error } = await db.from("root_employees").select("garden_role").eq("user_id",user.id).eq("is_active",true).is("deleted_at",null).maybeSingle();
 if (error || data?.garden_role !== "super_admin") throw new HireError("閲覧権限がありません",403);
 return { db: getSupabaseAdmin(), userId: user.id };
}
type Context = Awaited<ReturnType<typeof hireAdminContext>>;
function checked<T>(result: { data: T; error: unknown }): T {
 if (result.error) throw new HireError("保存・読み込みができませんでした。時間をおいてお試しください。",503);
 return result.data;
}
export async function listCandidates({db}: Context) {
 return checked(await db.from("system_hire_candidates").select("*").order("hire_date",{ascending:false}));
}
export async function candidateOptions({db}: Context) {
 const companies = checked(await db.from("root_companies").select("company_id,company_name"));
 return { ...await fetchKotHireOptions(), companies };
}
export async function saveCandidate(context: Context, raw: unknown, id?: string) {
 const {db,userId} = context;
 if (id && (raw as {status?: string})?.status === "no_show") {
  const row = checked(await db.from("system_hire_candidates").update({status:"no_show",updated_at:new Date().toISOString()}).eq("id",id).eq("status","planned").is("processing_token",null).select().maybeSingle());
  if (!row) throw new HireError("この方の入社処理はすでに始まっています",409);
  return row;
 }
 const input = parseHireInput(raw);
 const company = checked(await db.from("root_companies").select("company_id").eq("company_id",input.company_id).maybeSingle());
 if (!company) throw new HireError("所属法人を確認してください");
 if (!id) return checked(await db.from("system_hire_candidates").insert({...input,created_by:userId}).select().single());
 const row = checked(await db.from("system_hire_candidates").update({...input,updated_at:new Date().toISOString()}).eq("id",id).eq("status","planned").is("processing_token",null).is("employee_number",null).select().maybeSingle());
 if (!row) throw new HireError("入社処理が始まっているため変更できません",409);
 return row;
}
const field = (r: Record<string, unknown>, key: string) => String((r[key] as {value?:unknown})?.value ?? "");
const normalizeName = (s: string) => s.replace(/[\s　]/g, "");
export async function ensureRoster(c: HireCandidate, companyName: string) {
 const app = process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || "56";
 const token = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN || "";
 const records = await getAllRecords(app,token,'従業員ステータス in ("在籍中")', ["$id","従業員名_姓名","生年月日","社員番号","打刻ID"]);
 const matches = records.filter(r => normalizeName(field(r,"従業員名_姓名")) === normalizeName(c.last_name+c.first_name) && field(r,"生年月日") === c.birthday);
 if (matches.length > 1) throw new HireError("名簿に同じ氏名・生年月日の方が複数います。事務で確認してください",409);
 if (matches.length) {
  const r = matches[0];
  if (Number(field(r,"社員番号")) !== Number(c.employee_number) || Number(field(r,"打刻ID")) !== Number(c.employee_number)) throw new HireError("同じ方が別の社員番号で名簿に登録されています。事務で確認してください",409);
  return field(r,"$id");
 }
 try {
  const result = await createRecord(app,token,rosterPayload(c,companyName));
  if (!/^\d+$/.test(result.id)) throw new Error("invalid record id");
  return result.id;
 } catch (e) {
  if (e instanceof Error && e.message === "kintone_403") throw new HireError("Kintone 名簿に登録できませんでした（名簿の API トークンに『レコード追加』の権限が必要です）");
  throw new HireError("Kintone 名簿に登録できませんでした。続きからお試しください。");
 }
}
export async function hireCandidate({db}: Context, id: string, prepare = false) {
 const token = randomUUID();
 const row = checked(await db.from("system_hire_candidates").update({processing_token:token,processing_started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).in("status",["planned","hiring"]).or("processing_token.is.null,processing_started_at.lt."+new Date(Date.now()-10*60_000).toISOString()).select().maybeSingle());
 if (!row) throw new HireError("処理中、または入社済みです。画面を更新してください。",409);
 const c = row as HireCandidate;
 let stage = "number";
 const persist = async (values: Record<string,unknown>) => {
  const updated = checked(await db.from("system_hire_candidates").update({...values,updated_at:new Date().toISOString()}).eq("id",id).eq("processing_token",token).select().single());
  Object.assign(c,updated);
 };
 const done = async () => { await persist({steps:{...c.steps,[stage]:{done:true,at:new Date().toISOString()}}}); };
 try {
  // Sprout handoffs are planned before company and attendance assignments are chosen.
  if (!c.company_id || !c.kot_division_code || !c.kot_type_code) throw new HireError("会社・勤怠の所属・雇用区分を設定してから入社手続きを進めてください");
  // A reserved number survives failures and confirmation cancellation.
  if (!c.employee_number) {
   const employees = await fetchKotHireEmployees();
   const number = checked(await db.rpc("reserve_hire_employee_number",{candidate_id:id,kot_codes:employees.map(e=>e.code)}));
   c.employee_number = String(number);
   await done();
  }
  if (prepare) return c;
  await persist({status:"hiring"});
  stage = "kot";
  if (!c.steps.kot?.done) {
   if (process.env.KOT_EMPLOYEE_CREATE_ENABLED !== "true") throw new HireError("KOT 登録は停止中（東海林さんの OK 待ち）");
   const employees = await fetchKotHireEmployees();
   const existing = employees.find(e=> Number(e.code) === Number(c.employee_number));
   if (existing && (normalizeName((existing.lastName || "")+(existing.firstName || "")) !== normalizeName(c.last_name+c.first_name))) throw new HireError("同じ社員番号が別の方に使われています。事務で確認してください",409);
   if (!existing) await createKotEmployee({code:c.employee_number!,lastName:c.last_name,firstName:c.first_name,lastNamePhonetics:c.last_name_kana,firstNamePhonetics:c.first_name_kana,birthDate:c.birthday,hiredDate:c.hire_date,gender:c.gender as "male"|"female",divisionCode:c.kot_division_code,typeCode:c.kot_type_code});
   await done();
  }
  stage = "roster";
  if (!c.kintone_roster_record_id) {
   const company = checked(await db.from("root_companies").select("company_name").eq("company_id",c.company_id).single());
   const recordId = await ensureRoster(c,company!.company_name);
   await persist({kintone_roster_record_id:recordId});
  }
  await done();
  stage = "garden";
  const summary = await syncRootRoster({dryRun:false,recordIds:[c.kintone_roster_record_id!]});
  if (summary.errors.length) throw new HireError("Garden への反映を完了できませんでした。事務で確認して続きからお試しください。");
  const employee = checked(await db.from("root_employees").select("employee_id,user_id").eq("employee_number",c.employee_number!.padStart(4,"0")).single());
  if (!employee?.user_id) throw new HireError("アカウントの準備を完了できませんでした。続きからお試しください。");
  // The existing sync defaults new employees to COMP-001; apply the selected company.
  checked(await db.from("root_employees").update({company_id:c.company_id}).eq("employee_id",employee!.employee_id));
  await done();
  await persist({employee_id:employee!.employee_id,status:"hired"});
  return c;
 } catch (e) {
  const message = e instanceof HireError || e instanceof Error && e.message.startsWith("KOT が止まって") ? e.message : "処理を完了できませんでした。時間をおいて続きからお試しください。";
  await persist({steps:{...c.steps,[stage]:{done:false,at:new Date().toISOString(),error:message}}});
  return c;
 } finally {
  checked(await db.from("system_hire_candidates").update({processing_token:null,processing_started_at:null}).eq("id",id).eq("processing_token",token));
 }
}
export async function hireResponse(action: (context: Context) => Promise<unknown>) {
 try { return Response.json(await action(await hireAdminContext())); }
 catch(e) { return Response.json({error:e instanceof Error ? e.message : "処理できませんでした"},{status:e instanceof HireError ? e.status : 400}); }
}
