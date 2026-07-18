import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { assertNoticeKind, limitNoticePages } from "@/app/rill/mail/_lib/intake-notice";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

type IntakeRow = { kind: string; mail_from_name: string; mail_from_address: string };

export async function POST(request: Request) {
  try {
    const { supabase } = await requireGardenUser();
    const body = await request.json() as { intakeId?: unknown; pages?: unknown };
    const intakeId = typeof body.intakeId === "string" ? body.intakeId : "";
    if (!intakeId) throw new RillMailHttpError(400, "intakeId is required");
    const { pages, truncated } = limitNoticePages(body.pages);
    if (!pages.length) throw new RillMailHttpError(400, "PNG pages are required");
    const { data, error } = await supabase.from("garden_intake_items")
      .select("kind,mail_from_name,mail_from_address").eq("id", intakeId).maybeSingle<IntakeRow>();
    if (error) throw new RillMailHttpError(500, error.message);
    if (!data) throw new RillMailHttpError(404, "Intake item not found");
    try { assertNoticeKind(data.kind); }
    catch { throw new RillMailHttpError(400, "Only 周知 intake is supported"); }
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
      const images: ContentBlockParam[] = await Promise.all(pages.map(async (page) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/png" as const, data: await shrinkPng(page.base64) },
      })));
      const anthropic = new Anthropic({ apiKey });
      const message = await anthropic.messages.create({
        model: process.env.BUD_OCR_MODEL || "claude-opus-4-8",
        max_tokens: 500,
        messages: [{ role: "user", content: [...images, { type: "text", text: "FAX画像を読み、LINE周知用に内容の要点を日本語2〜4行でまとめてください。読み取れない箇所は断定せず、推測で補わないでください。固定の挨拶や送信元・枚数は不要です。" }] }],
      });
      const summary = message.content.find((block) => block.type === "text")?.text ?? "";
      return Response.json({ memo: summary.trim() || null, truncated });
    } catch (error) {
      console.error("Rill Mail notice draft generation failed", error instanceof Error ? error.message : error);
      return Response.json({ memo: null, truncated, fallback: true });
    }
  } catch (error) { return errorResponse(error); }
}

async function shrinkPng(value: string) {
  const source = Buffer.from(value.replace(/^data:image\/png;base64,/, ""), "base64");
  try {
    const sharp = (await import("sharp")).default;
    return (await sharp(source).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png({ quality: 82 }).toBuffer()).toString("base64");
  } catch { return source.toString("base64"); }
}
