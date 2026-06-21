import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type DepositType = "普通" | "当座" | "貯蓄";

type TransferInvoiceOcrResult = {
  payee_name: string | null;
  payee_bank_name: string | null;
  payee_bank_code: string | null;
  payee_branch_name: string | null;
  payee_branch_code: string | null;
  payee_account_type: DepositType | null;
  payee_account_number: string | null;
  payee_account_holder_kana: string | null;
  amount: number | null;
  scheduled_date: string | null;
  invoice_no: string | null;
  confidence: "high" | "low";
};

type OcrInput =
  | { kind: "image"; mediaType: "image/jpeg" | "image/png"; buffer: Buffer }
  | { kind: "pdf"; mediaType: "application/pdf"; buffer: Buffer };

const STORAGE_BUCKET = "bud-attachments";

const OCR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    payee_name: { type: ["string", "null"], description: "請求元・振込先の会社名。読めない場合はnull。" },
    payee_bank_name: { type: ["string", "null"], description: "金融機関名。読めない場合はnull。" },
    payee_bank_code: { type: ["string", "null"], description: "金融機関コード4桁。読めない場合はnull。" },
    payee_branch_name: { type: ["string", "null"], description: "支店名。読めない場合はnull。" },
    payee_branch_code: { type: ["string", "null"], description: "支店コード3桁。読めない場合はnull。" },
    payee_account_type: { enum: ["普通", "当座", "貯蓄", null], description: "預金種目。読めない場合はnull。" },
    payee_account_number: { type: ["string", "null"], description: "口座番号。数字のみ。読めない場合はnull。" },
    payee_account_holder_kana: { type: ["string", "null"], description: "口座名義カナ。読めない場合はnull。" },
    amount: { type: ["integer", "null"], description: "税込請求合計額。整数円。読めない場合はnull。" },
    scheduled_date: { type: ["string", "null"], description: "支払期日 YYYY-MM-DD。読めない場合はnull。" },
    invoice_no: { type: ["string", "null"], description: "請求書番号。読めない場合はnull。" },
    confidence: { enum: ["high", "low"], description: "主要項目に不確実さがある場合はlow。" },
  },
  required: [
    "payee_name",
    "payee_bank_name",
    "payee_bank_code",
    "payee_branch_name",
    "payee_branch_code",
    "payee_account_type",
    "payee_account_number",
    "payee_account_holder_kana",
    "amount",
    "scheduled_date",
    "invoice_no",
    "confidence",
  ],
} as const;

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) {
      return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
    }

    const input = await readOcrInput(req, supabase);
    if (!input) {
      return NextResponse.json({ ok: false, error: "PDF / JPG / PNG の請求書ファイルがありません" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY が未設定です" }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey });
    const model = process.env.BUD_OCR_MODEL || "claude-opus-4-8";
    const media = input.kind === "image" ? await prepareOcrImage(input) : input;
    const message = await anthropic.messages.parse({
      model,
      max_tokens: 900,
      output_config: { format: { type: "json_schema", schema: OCR_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            toClaudeContentBlock(media),
            {
              type: "text",
              text:
                "日本の受領請求書から、振込依頼作成に必要な項目を抽出してください。" +
                "請求元の会社名をお支払い先として扱い、振込先口座情報、税込合計金額、支払期日、請求書番号を読んでください。" +
                "金額は税込合計のみを整数円で返し、税抜金額や消費税額とは混同しないでください。" +
                "口座番号・銀行コード・支店コードは数字のみ、口座名義はカナ表記を優先してください。" +
                "読み取れない項目はnullにしてください。",
            },
          ],
        },
      ],
    });

    const raw = (message as { parsed_output?: unknown }).parsed_output ?? extractJsonFromContent(message.content);
    return NextResponse.json({ ok: true, result: normalizeResult(raw) });
  } catch (error) {
    console.error("[bud transfer invoice ocr]", error);
    return NextResponse.json({ ok: false, error: "請求書OCRに失敗しました" }, { status: 502 });
  }
}

async function readOcrInput(
  req: Request,
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<OcrInput | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return null;
    if (!isAcceptedMime(file.type)) return null;
    const buffer = Buffer.from(await file.arrayBuffer());
    return file.type === "application/pdf"
      ? { kind: "pdf", mediaType: "application/pdf", buffer }
      : { kind: "image", mediaType: file.type as "image/jpeg" | "image/png", buffer };
  }

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as {
      imageBase64?: string;
      storagePath?: string;
      mimeType?: string;
    };
    if (body.storagePath) {
      if (!isAcceptedMime(body.mimeType ?? "")) return null;
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(body.storagePath);
      if (error || !data) return null;
      const buffer = Buffer.from(await data.arrayBuffer());
      return body.mimeType === "application/pdf"
        ? { kind: "pdf", mediaType: "application/pdf", buffer }
        : {
            kind: "image",
            mediaType: body.mimeType as "image/jpeg" | "image/png",
            buffer,
          };
    }
    if (!body.imageBase64) return null;
    const parsed = parseImageDataUrl(body.imageBase64);
    if (!parsed) return null;
    return { kind: "image", mediaType: parsed.mediaType, buffer: Buffer.from(parsed.base64, "base64") };
  }

  return null;
}

function isAcceptedMime(value: string): value is "application/pdf" | "image/jpeg" | "image/png" {
  return value === "application/pdf" || value === "image/jpeg" || value === "image/png";
}

function parseImageDataUrl(value: string): { mediaType: "image/jpeg" | "image/png"; base64: string } | null {
  const match = value.match(/^data:(image\/jpeg|image\/png);base64,(.+)$/);
  if (match) return { mediaType: match[1] as "image/jpeg" | "image/png", base64: match[2] };
  return { mediaType: "image/jpeg", base64: value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "") };
}

async function prepareOcrImage(input: Extract<OcrInput, { kind: "image" }>): Promise<OcrInput> {
  try {
    const sharp = (await import("sharp")).default;
    const buffer = await sharp(input.buffer)
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    return { kind: "image", mediaType: "image/jpeg", buffer };
  } catch (error) {
    console.error("[bud transfer invoice ocr] sharp unavailable; sending original image", error);
    return input;
  }
}

function toClaudeContentBlock(input: OcrInput): ContentBlockParam {
  if (input.kind === "pdf") {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: input.buffer.toString("base64"),
      },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: input.mediaType,
      data: input.buffer.toString("base64"),
    },
  };
}

function extractJsonFromContent(content: unknown): unknown {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    const candidate = block as { type?: string; json?: unknown; text?: string };
    if (candidate.type === "json" && candidate.json) return candidate.json;
    if (candidate.type === "text" && candidate.text) {
      try {
        return JSON.parse(candidate.text);
      } catch {
        // Keep looking.
      }
    }
  }
  return null;
}

function normalizeResult(raw: unknown): TransferInvoiceOcrResult {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bankCode = normalizeFixedDigits(value.payee_bank_code, 4);
  const branchCode = normalizeFixedDigits(value.payee_branch_code, 3);
  const accountNumber = normalizeDigits(value.payee_account_number, 7);
  const amount = normalizeAmount(value.amount);
  const scheduledDate = normalizeDate(value.scheduled_date);
  return {
    payee_name: normalizeString(value.payee_name),
    payee_bank_name: normalizeString(value.payee_bank_name),
    payee_bank_code: bankCode,
    payee_branch_name: normalizeString(value.payee_branch_name),
    payee_branch_code: branchCode,
    payee_account_type: normalizeDepositType(value.payee_account_type),
    payee_account_number: accountNumber,
    payee_account_holder_kana: normalizeKana(value.payee_account_holder_kana),
    amount,
    scheduled_date: scheduledDate,
    invoice_no: normalizeString(value.invoice_no),
    confidence:
      value.confidence === "high" && bankCode && branchCode && accountNumber && amount && scheduledDate
        ? "high"
        : "low",
  };
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeDigits(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/\D/g, "");
  return digits && digits.length <= maxLength ? digits : null;
}

function normalizeFixedDigits(value: unknown, length: number): string | null {
  const digits = normalizeDigits(value, length);
  return digits && digits.length === length ? digits : null;
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const amount = Math.trunc(value);
  return amount > 0 ? amount : null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function normalizeDepositType(value: unknown): DepositType | null {
  if (value === "普通" || value === "当座" || value === "貯蓄") return value;
  return null;
}

function normalizeKana(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed : null;
}
