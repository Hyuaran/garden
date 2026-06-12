import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import sharp from "sharp";

import { createServerClient } from "@/app/_lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ReceiptOcrResult = {
  receipt_date: string | null;
  receipt_time: string | null;
  store_name: string | null;
  amount: number | null;
  qualified_number: string | null;
  qualified_class: "有" | "無";
  orientation: 0 | 90 | 180 | 270;
  confidence: "high" | "low";
};

const OCR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    receipt_date: { type: ["string", "null"], description: "Receipt date in YYYY-MM-DD, or null when unreadable." },
    receipt_time: { type: ["string", "null"], description: "Receipt time in HH:MM 24-hour format, or null when unreadable." },
    store_name: { type: ["string", "null"], description: "Merchant/store name, or null when unreadable." },
    amount: { type: ["integer", "null"], description: "Tax-inclusive total amount in JPY, or null when unreadable." },
    qualified_number: { type: ["string", "null"], description: "Japanese qualified invoice number, T followed by 13 digits, or null." },
    orientation: { enum: [0, 90, 180, 270], description: "Clockwise degrees needed to make the current image upright." },
    confidence: { enum: ["high", "low"], description: "Use low if any major field is uncertain." },
  },
  required: ["receipt_date", "receipt_time", "store_name", "amount", "qualified_number", "orientation", "confidence"],
} as const;

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) {
      return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
    }

    const image = await readImage(req);
    if (!image) {
      return NextResponse.json({ ok: false, error: "画像がありません" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY が未設定です" }, { status: 500 });
    }

    const ocrBuffer = await sharp(image)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    const anthropic = new Anthropic({ apiKey });
    const model = process.env.BUD_OCR_MODEL || "claude-opus-4-8";
    const message = await anthropic.messages.parse({
      model,
      max_tokens: 512,
      output_config: { format: { type: "json_schema", schema: OCR_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: ocrBuffer.toString("base64"),
              },
            },
            {
              type: "text",
              text:
                "日本の経費精算用レシート画像から、日付、時刻、店名、税込合計金額、適格請求書発行事業者番号(T番号)を抽出してください。" +
                "画像が横向き・逆向きなら、現在の画像を正しい向きにするための時計回り回転角も返してください。" +
                "読み取れない項目はnullにしてください。合計金額は税込合計のみを整数円で返してください。",
            },
          ],
        },
      ],
    });

    const raw = (message as { parsed_output?: unknown }).parsed_output ?? extractJsonFromContent(message.content);
    const result = normalizeResult(raw);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[bud expense ocr]", error);
    return NextResponse.json({ ok: false, error: "OCRに失敗しました" }, { status: 502 });
  }
}

async function readImage(req: Request): Promise<Buffer | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return null;
    if (!file.type.startsWith("image/")) return null;
    return Buffer.from(await file.arrayBuffer());
  }

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as { imageBase64?: string };
    const base64 = body.imageBase64?.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    return base64 ? Buffer.from(base64, "base64") : null;
  }

  return null;
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
        // Keep looking for a parseable block.
      }
    }
  }
  return null;
}

function normalizeResult(raw: unknown): ReceiptOcrResult {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const qualifiedNumber = normalizeQualifiedNumber(value.qualified_number);
  return {
    receipt_date: normalizeDate(value.receipt_date),
    receipt_time: normalizeTime(value.receipt_time),
    store_name: normalizeString(value.store_name),
    amount: normalizeAmount(value.amount),
    qualified_number: qualifiedNumber,
    qualified_class: qualifiedNumber ? "有" : "無",
    orientation: normalizeOrientation(value.orientation),
    confidence: value.confidence === "high" ? "high" : "low",
  };
}

function normalizeDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? value : null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const amount = Math.trunc(value);
  return amount > 0 ? amount : null;
}

function normalizeQualifiedNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^\dTt]/g, "").toUpperCase();
  return /^T\d{13}$/.test(normalized) ? normalized : null;
}

function normalizeOrientation(value: unknown): 0 | 90 | 180 | 270 {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}
