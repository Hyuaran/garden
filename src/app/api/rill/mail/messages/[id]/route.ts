import { NextRequest } from "next/server";
import sanitizeHtml from "sanitize-html";
import { getMessage } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

export async function GET(request: NextRequest, context: RouteContext<"/api/rill/mail/messages/[id]">) {
  try {
    const box = request.nextUrl.searchParams.get("box");
    if (!box) throw new RillMailHttpError(400, "box is required");
    const { id } = await context.params;
    const { supabase, user } = await requireGardenUser();
    const detail = await getMessage(supabase, user, box, id);
    if (detail.body.contentType === "html") {
      detail.body.content = sanitizeHtml(detail.body.content, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ["src", "alt", "title", "width", "height"], a: ["href", "name", "target", "rel"] }, allowedSchemes: ["http", "https", "mailto", "cid"], transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) } });
    }
    return Response.json(detail);
  } catch (error) { return errorResponse(error); }
}
