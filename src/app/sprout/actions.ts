"use server";
import { requireSproutUser } from "@/lib/sprout/access.server";
import { importRecruit } from "@/lib/sprout/import.server";
import { withPgClient } from "@/lib/db/pg";
import { hireValues, type Applicant, type ApplicantSummary, type Hearing } from "@/lib/sprout/model";

export async function loadSprout() {
  await requireSproutUser();
  return withPgClient(async client => {
    const [applicants, hearings, runs, sent] = await Promise.all([
      client.query<ApplicantSummary>("select kintone_record_id, name, kana, birthday, gender, phone, email, address, applied_date, application_methods, status, interview_at, interview_date, training_at, training_date, hire_date, age_group from sprout_applicants order by applied_date desc nulls last", []),
      client.query<Pick<Hearing, "applicant_record_id">>("select applicant_record_id from sprout_hearing_sheets", []),
      client.query("select finished_at from sprout_import_runs where status='success' order by finished_at desc limit 1", []),
      client.query("select source_applicant_id from system_hire_candidates where source_applicant_id is not null", []),
    ]);
    return JSON.parse(JSON.stringify({ applicants: applicants.rows, hearings: hearings.rows, updated: runs.rows[0]?.finished_at || null, sent: sent.rows.map(r => r.source_applicant_id) })) as {
      applicants: ApplicantSummary[]; hearings: Pick<Hearing, "applicant_record_id">[]; updated: string | null; sent: string[];
    };
  });
}
export async function loadApplicantDetail(kintoneRecordId: string) {
  await requireSproutUser();
  return withPgClient(async client => {
    const [applicants, hearings] = await Promise.all([
      client.query<Pick<Applicant, "raw">>("select raw from sprout_applicants where kintone_record_id=$1", [kintoneRecordId]),
      client.query<Pick<Hearing, "kintone_record_id" | "raw">>("select kintone_record_id, raw from sprout_hearing_sheets where applicant_record_id=$1", [kintoneRecordId]),
    ]);
    if (!applicants.rows[0]) throw new Error("応募者が見つかりません");
    return { raw: applicants.rows[0].raw, hearings: hearings.rows };
  });
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
