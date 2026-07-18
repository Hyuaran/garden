import Anthropic from "@anthropic-ai/sdk";
import { prepareTranslationInput } from "@/app/rill/mail/_lib/translate";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireGardenUser();
    return Response.json({ available: Boolean(process.env.ANTHROPIC_API_KEY) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireGardenUser();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new RillMailHttpError(501, "翻訳機能は現在利用できません");
    const body = await request.json() as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim()) throw new RillMailHttpError(400, "text is required");
    const text = prepareTranslationInput(body.text);
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: process.env.RILL_TRANSLATE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: Math.min(8192, Math.max(512, Math.ceil(text.length * 0.75))),
      system: "以下のメール本文を自然な日本語に翻訳してください。翻訳文のみを出力してください。署名・免責の定型部も訳し、宛名や固有名詞はそのまま残してください。",
      messages: [{ role: "user", content: text }],
    });
    const translation = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!translation) throw new RillMailHttpError(502, "翻訳結果を取得できませんでした");
    return Response.json({ translation });
  } catch (error) {
    if (error instanceof RillMailHttpError) return errorResponse(error);
    return errorResponse(new RillMailHttpError(502, "翻訳に失敗しました"));
  }
}
