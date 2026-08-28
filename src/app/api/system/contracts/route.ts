import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { downloadFile } from "@/app/api/bud/expense-drive/_lib/drive";
import { extractContract } from "@/app/system/contracts/_lib/contract-extraction.server";
import {
  saveOriginalContract,
  savePartnerTemplate,
} from "@/app/system/contracts/_lib/contract-drive.server";
import { generatePartnerTemplate } from "@/app/system/contracts/_lib/contract-template.server";
import {
  MAX_CONTRACT_SIZE,
  type ContractCompany,
} from "@/app/system/contracts/_lib/contract-types";
async function context() {
  const manager = await requireManager();
  if (!manager) return null;
  const admin = getSupabaseAdmin();
  const { data: companies } = await admin
    .from("root_companies")
    .select("company_id,company_name,representative,address")
    .eq("is_active", true)
    .order("company_id");
  return { manager, admin, companies: (companies ?? []) as ContractCompany[] };
}
export async function GET() {
  const c = await context();
  if (!c) return NextResponse.json({ ok: false }, { status: 403 });
  const { data: rows, error } = await c.admin
    .from("system_contracts")
    .select("*,root_companies(company_id,company_name,representative,address)")
    .order("created_at", { ascending: false })
    .limit(200);
  return error
    ? NextResponse.json(
        { ok: false, error: "読み込めませんでした。" },
        { status: 500 },
      )
    : NextResponse.json({ ok: true, companies: c.companies, rows });
}
export async function POST(request: Request) {
  const c = await context();
  if (!c) return NextResponse.json({ ok: false }, { status: 403 });
  const form = await request.formData(),
    action = String(form.get("action") ?? "");
  if (action === "analyze") {
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json(
        { ok: false, error: "PDFを選択してください。" },
        { status: 400 },
      );
    if (file.type !== "application/pdf")
      return NextResponse.json(
        { ok: false, error: "PDFファイルを選択してください。" },
        { status: 400 },
      );
    if (file.size > MAX_CONTRACT_SIZE)
      return NextResponse.json(
        { ok: false, error: "PDFは20MB以下にしてください。" },
        { status: 400 },
      );
    return NextResponse.json({
      ok: true,
      draft: await extractContract(
        Buffer.from(await file.arrayBuffer()),
        c.companies,
      ),
    });
  }
  if (action === "register") {
    const file = form.get("file"),
      counterparty = String(form.get("counterparty") ?? "").trim(),
      companyId = String(form.get("companyId") ?? ""),
      contractType = String(form.get("contractType") ?? "").trim(),
      concludedOn = String(form.get("concludedOn") ?? "");
    if (
      !(file instanceof File) ||
      !counterparty ||
      !companyId ||
      !contractType ||
      !concludedOn
    )
      return NextResponse.json(
        { ok: false, error: "必須項目を入力してください。" },
        { status: 400 },
      );
    if (file.type !== "application/pdf" || file.size > MAX_CONTRACT_SIZE)
      return NextResponse.json(
        {
          ok: false,
          error:
            file.size > MAX_CONTRACT_SIZE
              ? "PDFは20MB以下にしてください。"
              : "PDFファイルを選択してください。",
        },
        { status: 400 },
      );
    const saved = await saveOriginalContract(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      counterparty,
      companyId,
    );
    const { data, error } = await c.admin
      .from("system_contracts")
      .insert({
        counterparty,
        company_id: companyId,
        contract_type: contractType,
        concluded_on: concludedOn,
        note: String(form.get("note") ?? "") || null,
        drive_file_id: saved.fileId,
        drive_url: saved.url,
        drive_folder_name: saved.folderName,
        created_by: c.manager.userId,
      })
      .select("*")
      .single();
    return error
      ? NextResponse.json(
          { ok: false, error: "登録できませんでした。" },
          { status: 500 },
        )
      : NextResponse.json(
          { ok: true, row: data, driveStatus: saved.status },
          { status: 201 },
        );
  }
  if (action === "template") {
    const id = String(form.get("id") ?? ""),
      issuerId = String(form.get("issuerId") ?? ""),
      product = String(form.get("product") ?? "").trim();
    const { data: row } = await c.admin
      .from("system_contracts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const issuer = c.companies.find((x) => x.company_id === issuerId);
    if (!row?.drive_file_id || !issuer || !product)
      return NextResponse.json(
        { ok: false, error: "ひな形を生成する条件が不足しています。" },
        { status: 400 },
      );
    const source = await downloadFile(row.drive_file_id),
      hiddenTerms = String(form.get("hiddenTerms") ?? "")
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean),
      generated = await generatePartnerTemplate(source, {
        hiddenTerms,
        maskMoney: String(form.get("maskMoney")) !== "false",
        issuer,
      }),
      filename = `${row.contract_type}_ひな形_DRAFT.pdf`,
      saved = await savePartnerTemplate(generated.buffer, filename, product);
    await c.admin
      .from("system_contracts")
      .update({
        template_file_id: saved.fileId,
        template_url: saved.url,
        template_generated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return new Response(new Uint8Array(generated.buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "x-contract-scanned": String(generated.scanned),
        "x-contract-masked-count": String(generated.maskedCount),
      },
    });
  }
  return NextResponse.json(
    { ok: false, error: "操作を確認してください。" },
    { status: 400 },
  );
}
