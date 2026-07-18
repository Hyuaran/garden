import { mutateMailMessages, type MailMutation } from "@/app/rill/mail/_lib/graph";
import { isMailState, type MailWriteOperation } from "@/app/rill/mail/_lib/write-ops";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

const OPS = new Set<MailWriteOperation>(["flag", "state", "confirm", "read"]);

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireGardenUser();
    const body = await request.json() as { ids?: unknown; box?: unknown; op?: unknown; value?: unknown };
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 200 || !body.ids.every((id) => typeof id === "string" && id.length > 0)) throw new RillMailHttpError(400, "ids must contain 1 to 200 message ids");
    if (typeof body.box !== "string" || !body.box) throw new RillMailHttpError(400, "box is required");
    if (typeof body.op !== "string" || !OPS.has(body.op as MailWriteOperation)) throw new RillMailHttpError(400, "Invalid operation");
    const op = body.op as MailWriteOperation;
    if ((op === "flag" || op === "confirm" || op === "read") && typeof body.value !== "boolean") throw new RillMailHttpError(400, "value must be boolean");
    if (op === "state" && body.value !== null && !isMailState(body.value)) throw new RillMailHttpError(400, "Invalid state");
    const ids = [...new Set(body.ids as string[])];
    const mutations: MailMutation[] = ids.map((id) => ({ id, boxId: body.box as string, op, value: body.value as MailMutation["value"] }));
    const results = await mutateMailMessages(supabase, user, mutations);
    return Response.json({ ok: results.every((result) => result.ok), results }, { status: results.some((result) => result.ok) ? 200 : 502 });
  } catch (error) { return errorResponse(error); }
}
