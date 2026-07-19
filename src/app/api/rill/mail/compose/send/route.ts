import { validateAttachmentSizes, validateComposeInput } from "@/app/rill/mail/_lib/compose";
import { sendComposeMessage } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireGardenUser();
    let input;
    let attachments: Array<{ name: string; contentType: string; bytes: Uint8Array }> = [];
    try {
      if (request.headers.get("content-type")?.includes("multipart/form-data")) {
        const form = await request.formData();
        const rawInput = form.get("input");
        if (typeof rawInput !== "string") throw new Error("input is required");
        input = validateComposeInput(JSON.parse(rawInput));
        const files = form.getAll("attachments").filter((value): value is File => value instanceof Blob && "name" in value);
        validateAttachmentSizes([], files);
        attachments = await Promise.all(files.map(async (file) => ({ name: file.name, contentType: file.type || "application/octet-stream", bytes: new Uint8Array(await file.arrayBuffer()) })));
      } else {
        input = validateComposeInput(await request.json());
      }
    }
    catch (error) { throw new RillMailHttpError(400, error instanceof Error ? error.message : "Invalid compose input"); }
    await sendComposeMessage(supabase, user, input, attachments);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
