import {
  checked,
  date,
  hakenContext,
  hakenError,
  HakenError,
  loadHakenData,
  object,
  text,
} from "@/lib/haken/server";
import { generateHakenPdf, type IssueType } from "@/lib/haken/haken-pdf.server";
import { saveHakenPdf, validateHakenPdf } from "@/lib/haken/haken-drive.server";
import { conflictDate } from "@/lib/haken/rules";
import { DOCUMENT_LABELS } from "@/lib/haken/types";
import { MAX_CONTRACT_SIZE } from "@/app/system/contracts/_lib/contract-types";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { db } = await hakenContext(true);
    const data = await loadHakenData(db);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new HakenError("ファイルを選んでください。");
      if (file.size > MAX_CONTRACT_SIZE)
        throw new HakenError("PDF は20MBまでです。");
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        validateHakenPdf(buffer, file.name, file.type);
      } catch (error) {
        throw new HakenError((error as Error).message);
      }
      const contract = data.contracts.find(
        (c) => c.id === form.get("contract_id"),
      );
      const party = data.parties.find((p) => p.id === contract?.party_id);
      const docType = String(form.get("doc_type"));
      const issuedOn = date(
        { issued_on: form.get("issued_on") },
        "issued_on",
        true,
      );
      if (!contract || !party || !DOCUMENT_LABELS[docType])
        throw new HakenError("契約と書類の種類を確認してください。");
      let saved;
      try {
        saved = await saveHakenPdf(buffer, file.name, party.name);
      } catch {
        throw new HakenError(
          "書類を保存できませんでした。保存先の設定を確認してください。",
          503,
        );
      }
      checked(
        await db.from("system_haken_document").insert({
          contract_id: contract.id,
          party_id: party.id,
          doc_type: docType,
          issued_on: issuedOn,
          file_name: file.name,
          drive_file_id: saved.fileId,
          drive_url: saved.url,
        }),
      );
      return Response.json({ ok: true });
    }
    const body = object(await request.json());
    const party = data.parties.find((p) => p.id === body.party_id);
    const office = data.offices.find(
      (o) => o.id === party?.issue_defaults.office_id,
    );
    const type = text(body, "doc_type") as IssueType;
    const start = date(body, "start", true)!;
    const end = date(body, "end", true)!;
    const issuedOn = date(body, "issued_on", true)!;
    if (
      !party ||
      !office ||
      !["conflict_notice", "treatment", "reply"].includes(type) ||
      end < start
    )
      throw new HakenError("派遣会社・受入事業所・期間を確認してください。");
    const conflict = conflictDate(
      [
        ...data.contracts
          .filter((c) => c.office_id === office.id)
          .map((c) => ({ start: c.period_start, end: c.period_end })),
        { start, end },
      ],
      start,
    )!;
    const companyName = data.companies.find(
      (c) => c.company_id === office.company_id,
    )?.company_name;
    if (!companyName)
      throw new HakenError("受入事業所の法人を確認してください。");
    const buffer = await generateHakenPdf(type, {
      party,
      office,
      companyName,
      start,
      end,
      issuedOn,
      conflict,
    });
    const filename = `${DOCUMENT_LABELS[type]}_${party.name}_${issuedOn.replaceAll("-", "")}.pdf`;
    let saved: { fileId: string; url: string | null } | null = null;
    let warning = "";
    try {
      saved = await saveHakenPdf(buffer, filename, party.name);
    } catch {
      warning = "書類を保存できませんでした。";
    }
    // 発行の記録を先に作る。保存失敗も記録し、PDFのダウンロードは継続する。
    try {
      checked(
        await db.from("system_haken_document").insert({
          party_id: party.id,
          hire_candidate_id: text(body, "hire_candidate_id") || null,
          issue_batch_id: text(body, "issue_batch_id") || null,
          doc_type: type,
          document_status: "issued",
          issued_on: issuedOn,
          file_name: filename,
          drive_file_id: saved?.fileId ?? null,
          drive_url: saved?.url ?? null,
          save_error: warning || null,
        }),
      );
    } catch {
      warning = "発行履歴を保存できませんでした。";
    }
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        ...(warning ? { "X-Haken-Warning": encodeURIComponent(warning) } : {}),
      },
    });
  } catch (error) {
    return hakenError(error);
  }
}
