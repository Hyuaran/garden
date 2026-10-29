import "server-only";
import { overallStatus } from "./filemaker-accounts.server";
import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createRecord, getAllRecords } from "@/lib/kintone/records";
import { syncRootRoster } from "@/app/root/_lib/roster-sync.server";
import { createKotEmployee, fetchKotHireEmployees, fetchKotHireOptions } from "@/app/root/_lib/kot-api";
import { signaturesComplete, lineComplete, parseHireInput, parseChecklist, checklistPriority, rosterPayload, type HireCandidate, type HireChecklist } from "./hire-candidates";
export class HireError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function hireAdminContext(readTab?: "candidates" | "confirmations") {
 if (readTab) {
  try {
   const context = await viewPermissionContext();
   if (!(await canView("system-onboarding", readTab, context.viewer))) throw new HireError("閲覧権限がありません",403);
   return {db:getSupabaseAdmin(),userId:context.userId};
  } catch (error) { throw new HireError(error instanceof Error ? error.message : "閲覧権限がありません",403); }
 }
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
export async function listCandidates({db}: Context, tab?: "candidates" | "confirmations") {
 const rows = checked(await (tab === "confirmations" ? db.from("system_hire_candidates").select("*").eq("status","hired") : tab === "candidates" ? db.from("system_hire_candidates").select("*").in("status",["planned","hiring","no_show"]) : db.from("system_hire_candidates").select("*")).order("hire_date",{ascending:false})) as HireCandidate[];
 if(rows.length){
  const requests = checked(await db.from("system_filemaker_account_requests").select("hire_candidate_id,status,files").in("hire_candidate_id",rows.map(r=>r.id))) ?? [];
  for(const row of rows) {
   const request=requests.find(r=>r.hire_candidate_id===row.id);
   if(request){
    const files={...request.files,roster:request.files.roster??{status:"waiting"}};
    row.filemaker_request={...request,files,status:overallStatus(files)};
   }else row.filemaker_request=null;
  }
 }
 const ids = rows.filter(r => r.status === "hired" && r.employee_id).map(r => r.employee_id!);
 if (!ids.length) return rows;
 const [onboarding, employees] = await Promise.all([
  db.from("system_onboarding").select("employee_id,status").in("employee_id",ids),
  db.from("root_employees").select("employee_id,line_user_id").in("employee_id",ids).is("deleted_at",null),
 ]);
 const statuses = new Map((checked(onboarding) ?? []).map(r => [r.employee_id,r.status]));
 const lines = new Map((checked(employees) ?? []).map(r => [r.employee_id,!!r.line_user_id]));
 return rows.map(r => r.status === "hired" ? {...r,onboarding_status:statuses.get(r.employee_id) ?? null,line_registered:lines.get(r.employee_id) ?? false} : r)
  .sort((a,b) => checklistPriority(a)-checklistPriority(b));
}
export async function candidateOptions({db}: Context) {
 const companies = checked(await db.from("root_companies").select("company_id,company_name").order("established_on",{ascending:true}));
 // KOT の選択肢は控えておき、KOT が止まっている時間（8:30〜10:00・17:30〜18:30）や読めないときは控えを使う（登録するだけなら KOT は要らない・2026-10-26）
 const admin = getSupabaseAdmin();
 try {
  const options = await fetchKotHireOptions();
  await admin.from("system_kot_options_cache").upsert({ id: "hire", divisions: options.divisions, working_types: options.workingTypes, updated_at: new Date().toISOString() });
  return { ...options, companies };
 } catch (error) {
  const { data } = await admin.from("system_kot_options_cache").select("divisions,working_types").eq("id", "hire").maybeSingle();
  if (!data) throw error;
  return { divisions: data.divisions, workingTypes: data.working_types, companies, cached: true };
 }
}
export async function saveCandidate(context: Context, raw: unknown, id?: string) {
 const {db,userId} = context;
 if (raw && typeof raw === "object" && Object.hasOwn(raw,"checklist")) {
  if (!id || Object.keys(raw).some(key => key !== "checklist")) throw new HireError("確認する項目を選び直してください");
  // line_skipped も共通の許可リストで検証し、操作者と時刻を保存する。
  const changes = parseChecklist((raw as {checklist:unknown}).checklist);
  const current = checked(await db.from("system_hire_candidates").select("status,checklist,line_verified_at,line_display_renamed_at").eq("id",id).maybeSingle());
  if (!current || current.status !== "hired") throw new HireError("入社済みの方だけ確認できます");
  if (changes.line_skipped === true && !signaturesComplete(current)) throw new HireError("①の締結がそろうと進めます",409);
  if (changes.filemaker_added === true && (!signaturesComplete(current) || !lineComplete(current))) throw new HireError("①の締結と②の LINE 確認と表示名の変更が済むと進めます",409);
  const checklist: HireChecklist = {...current.checklist};
  const now = new Date().toISOString();
  for (const key of Object.keys(changes) as (keyof HireChecklist)[]) {
   if (changes[key]) checklist[key] = {checked_at:now,checked_by:userId};
   else delete checklist[key];
  }
  const updated = checked(await db.from("system_hire_candidates").update({checklist,updated_at:now}).eq("id",id).eq("status","hired").eq("checklist",JSON.stringify(current.checklist)).select().maybeSingle());
  if (!updated) throw new HireError("ほかの方が更新しました。画面を更新してもう一度お試しください",409);
  return updated;
 }
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
 const records = await getAllRecords(app,token,'従業員ステータス in ("在籍中")', ["$id","従業員名_姓名","生年月日","社員番号","打刻ID"]).catch(()=>{throw new HireError(`社員番号 ${c.employee_number} の登録前に Kintone 名簿を読み込めませんでした。名簿の API トークンの閲覧権限と接続を確認してから［続きから］を押してください。`);});
 const matches = records.filter(r => normalizeName(field(r,"従業員名_姓名")) === normalizeName(c.last_name+c.first_name) && field(r,"生年月日") === c.birthday);
 if (matches.length > 1) throw new HireError(`Kintone 名簿に『${c.last_name} ${c.first_name}』さん（生年月日 ${c.birthday}）が ${matches.length} 件あります。重複しているレコードを 1 件にしてから［続きから］を押してください。`,409);
 if (matches.length) {
  const r = matches[0];
  if (Number(field(r,"社員番号")) !== Number(c.employee_number) || Number(field(r,"打刻ID")) !== Number(c.employee_number)) throw new HireError(`Kintone 名簿に『${c.last_name} ${c.first_name}』さん（生年月日 ${c.birthday}）が別の番号（社員番号 ${field(r,"社員番号") || "なし"}／打刻ID ${field(r,"打刻ID") || "なし"}）で登録されています。名簿のその方の社員番号と打刻ID を ${c.employee_number} に直してから［続きから］を押してください。`,409);
  return field(r,"$id");
 }
 try {
  const result = await createRecord(app,token,rosterPayload(c,companyName));
  if (!/^\d+$/.test(result.id)) throw new Error("invalid record id");
  return result.id;
 } catch (e) {
  if (e instanceof Error && e.message === "kintone_403") throw new HireError(`社員番号 ${c.employee_number} を Kintone 名簿に登録できませんでした。名簿の API トークンに『レコード追加』の権限を付けてから［続きから］を押してください。`);
  throw new HireError(`社員番号 ${c.employee_number} を Kintone 名簿に登録できませんでした。名簿の接続と登録内容を確認してから［続きから］を押してください。`);
 }
}
export async function hireCandidate({db,userId}: Context, id: string, prepare = false) {
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
   if (process.env.KOT_EMPLOYEE_CREATE_ENABLED !== "true") throw new HireError(`社員番号 ${c.employee_number} の KING OF TIME 登録は停止中です（東海林さんの OK 待ち）。登録の再開後に［続きから］を押してください。`);
   const employees = await fetchKotHireEmployees();
   const existing = employees.find(e=> Number(e.code) === Number(c.employee_number));
   if (existing && (normalizeName((existing.lastName || "")+(existing.firstName || "")) !== normalizeName(c.last_name+c.first_name))) throw new HireError(`社員番号 ${c.employee_number} は KING OF TIME で別の方（${existing.lastName || ""} ${existing.firstName || ""}）に使われています。KING OF TIME のその方の社員番号を確認・修正してから［続きから］を押してください。`,409);
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
  const existingGarden = checked(await db.from("root_employees").select("name").eq("employee_number",c.employee_number!.padStart(4,"0")).maybeSingle());
  if (existingGarden?.name && normalizeName(existingGarden.name) !== normalizeName(c.last_name+c.first_name)) throw new HireError(`社員番号 ${c.employee_number} は Garden で別の方（${existingGarden.name}）に使われています。管理者が Garden と名簿の社員番号を確認・修正してから［続きから］を押してください。`,409);
  const summary = await syncRootRoster({dryRun:false,recordIds:[c.kintone_roster_record_id!]});
  if (summary.errors.length) throw new HireError(`社員番号 ${c.employee_number} の Kintone 名簿から Garden への反映に失敗しました。管理者が名簿の登録内容と同期処理のエラーを確認・修正してから［続きから］を押してください。`);
  const employee = checked(await db.from("root_employees").select("employee_id,user_id").eq("employee_number",c.employee_number!.padStart(4,"0")).single());
  if (!employee?.user_id) throw new HireError(`社員番号 ${c.employee_number} の Garden アカウントを準備できませんでした。管理者がアカウント作成処理を確認・修正してから［続きから］を押してください。`);
  // The existing sync defaults new employees to COMP-001; apply the selected company.
  checked(await db.from("root_employees").update({company_id:c.company_id}).eq("employee_id",employee!.employee_id));
  await done();
  await persist({employee_id:employee!.employee_id,status:"hired"});
  return c;
 } catch (e) {
  const stageName = {number:"社員番号の採番",kot:"KING OF TIME 登録",roster:"Kintone 名簿への登録",garden:"Garden への反映"}[stage];
  const message = e instanceof HireError ? e.message : `社員番号 ${c.employee_number || "未決定"} の${stageName}を完了できませんでした。${e instanceof Error && e.message.startsWith("KING OF TIME が止まって") ? "KING OF TIME が止まっている時間帯です。利用できる時間になってから" : "管理者が接続と登録内容を確認してから"}［続きから］を押してください。`;
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
