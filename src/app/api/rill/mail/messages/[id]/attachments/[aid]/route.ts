import { NextRequest } from "next/server";
import { getAttachment } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

function safeFileName(value: string) { return value.replace(/[\r\n"\\/]/g, "_"); }

export async function GET(request: NextRequest, context: RouteContext<"/api/rill/mail/messages/[id]/attachments/[aid]">) {
  try {
    const box = request.nextUrl.searchParams.get("box");
    if (!box) throw new RillMailHttpError(400, "box is required");
    const { id, aid } = await context.params;
    const { supabase, user } = await requireGardenUser();
    const attachment = await getAttachment(supabase, user, box, id, aid);
    if (!attachment.contentBytes) throw new RillMailHttpError(404, "Attachment content is unavailable");
    return new Response(Buffer.from(attachment.contentBytes, "base64"), { headers: { "Content-Type": attachment.contentType ?? "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFileName(attachment.name ?? "attachment"))}`, "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
