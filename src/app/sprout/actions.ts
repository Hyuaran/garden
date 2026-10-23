"use server";
import { requireSproutUser } from "@/lib/sprout/access.server";
import { importRecruit } from "@/lib/sprout/import.server";
import { queryPg, withPgClient } from "@/lib/db/pg";
import { hireValues, type Applicant, type Hearing } from "@/lib/sprout/model";

export async function loadSprout() {
  await requireSproutUser();
  const applicants = await queryPg<Applicant>("select * from sprout_applicants order by applied_date desc nulls last", []);
  const hearings = await queryPg<Hearing>("select * from sprout_hearing_sheets", []);
  const runs = await queryPg("select finished_at from sprout_import_runs where status='success' order by finished_at desc limit 1", []);
  const sent = await queryPg("select source_applicant_id from system_hire_candidates where source_applicant_id is not null", []);
  // pg timestamps become Dates; serialize explicitly for the browser.
  return JSON.parse(JSON.stringify({ applicants: applicants.rows, hearings: hearings.rows, updated: runs.rows[0]?.finished_at || null, sent: sent.rows.map(r => r.source_applicant_id) })) as {
    applicants: Applicant[]; hearings: Hearing[]; updated: string | null; sent: string[];
  };
}
export async function refreshSprout() {
  try { await importRecruit(); return { ok: true }; }
  catch (error) { return { ok: false, message: error instanceof Error && /^(閲覧権限|取り込み中|取り込みの接続|採用情報)/.test(error.message) ? error.message : "取り込めませんでした。時間をおいてお試しください" }; }
}
export async function sendToHire(id: string) {
  try {
    const user = await requireSproutUser();
    await withPgClient(async client => {
      const { rows } = await client.query<Applicant>("select * from sprout_applicants where kintone_record_id=$1", [id]);
      if (!rows[0]) throw new Error("応募者が見つかりません");
      const values = hireValues(rows[0]);
      const columns = Object.keys(values);
      await client.query(`insert into system_hire_candidates(${columns.join(",")},created_by) values(${columns.map((_,i) => `$${i+1}`).join(",")},$${columns.length+1}) on conflict(source_applicant_id) do nothing`, [...Object.values(values), user.id]);
    });
    return { ok: true, message: "入社予定者に送りました（System ＞ 入社手続き（事務）＞ 入社予定者）" };
  } catch (error) {
    const message = error instanceof Error && /^(閲覧権限|応募者|研修待ち|氏名)/.test(error.message) ? error.message : "送れませんでした。時間をおいてお試しください";
    return { ok: false, message };
  }
}
