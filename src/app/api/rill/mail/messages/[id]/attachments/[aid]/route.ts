import { NextRequest } from "next/server";
import { getAttachment } from "@/app/rill/mail/_lib/graph";
import { isViewableAttachment } from "@/app/rill/mail/_lib/format";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

function safeFileName(value: string) { return value.replace(/[\r\n"\\/]/g, "_"); }
function responseContentType(contentType: string | undefined, name: string) {
  if (contentType) return contentType;
  const extension = name.split(".").pop()?.toLowerCase();
  return ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

export async function GET(request: NextRequest, context: RouteContext<"/api/rill/mail/messages/[id]/attachments/[aid]">) {
  try {
    const box = request.nextUrl.searchParams.get("box");
    if (!box) throw new RillMailHttpError(400, "box is required");
    const { id, aid } = await context.params;
    const { supabase, user } = await requireGardenUser();
    const attachment = await getAttachment(supabase, user, box, id, aid);
    if (!attachment.contentBytes) throw new RillMailHttpError(404, "Attachment content is unavailable");
    const name = attachment.name ?? "attachment";
    const inline = request.nextUrl.searchParams.get("view") === "1" && isViewableAttachment(attachment.contentType, name);
    return new Response(Buffer.from(attachment.contentBytes, "base64"), { headers: { "Content-Type": responseContentType(attachment.contentType, name), "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(safeFileName(name))}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error); }
}
