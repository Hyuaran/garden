import { requireRillRead } from "@/app/rill/mail/_lib/view-access.server";
import { NextRequest } from "next/server";
import { getMessage } from "@/app/rill/mail/_lib/graph";
import { sanitizeMailHtml } from "@/app/rill/mail/_lib/sanitize-body";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

export async function GET(request: NextRequest, context: RouteContext<"/api/rill/mail/messages/[id]">) {
  try {
    const box = request.nextUrl.searchParams.get("box");
    if (!box) throw new RillMailHttpError(400, "box is required");
    const { id } = await context.params;
    const { supabase, user, readTabs } = await requireRillRead(box);
    const detail = await getMessage(supabase, user, box, id, readTabs);
    if (detail.body.contentType === "html") {
      detail.body.content = sanitizeMailHtml(detail.body.content);
    }
    return Response.json(detail);
  } catch (error) { return errorResponse(error); }
}
