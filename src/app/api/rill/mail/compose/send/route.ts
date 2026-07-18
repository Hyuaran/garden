import { validateComposeInput } from "@/app/rill/mail/_lib/compose";
import { sendComposeMessage } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireGardenUser();
    let input;
    try { input = validateComposeInput(await request.json()); }
    catch (error) { throw new RillMailHttpError(400, error instanceof Error ? error.message : "Invalid compose input"); }
    await sendComposeMessage(supabase, user, input);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
