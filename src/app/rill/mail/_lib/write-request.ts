import { mutateMailMessages, type MailMutation } from "./graph";
import { assertOwnConfirmationName, isMailState, pinCategoryName, type MailWriteOperation } from "./write-ops";
import { errorResponse, requireGardenUser, RillMailHttpError } from "./server-auth";

type Body = { on?: unknown; read?: unknown; state?: unknown; name?: unknown };

function valueFor(op: MailWriteOperation, body: Body) {
  if (op === "pin" || op === "confirm") {
    if (typeof body.on !== "boolean") throw new RillMailHttpError(400, "on must be boolean");
    return body.on;
  }
  if (op === "read") {
    if (typeof body.read !== "boolean") throw new RillMailHttpError(400, "read must be boolean");
    return body.read;
  }
  if (body.state !== null && !isMailState(body.state)) throw new RillMailHttpError(400, "Invalid state");
  return body.state;
}

export async function patchOneMessage(request: Request, id: string, op: MailWriteOperation) {
  try {
    const { supabase, user } = await requireGardenUser();
    const boxId = new URL(request.url).searchParams.get("box");
    if (!boxId) throw new RillMailHttpError(400, "box is required");
    const body = await request.json() as Body;
    if ((op === "confirm" || op === "pin") && body.name !== undefined) {
      const { data } = await supabase.from("root_employees").select("name").eq("user_id", user.id).maybeSingle<{ name: string | null }>();
      if (!data?.name) throw new RillMailHttpError(403, "Gardenアカウントの氏名を確認できません");
      try {
        if (op === "confirm") assertOwnConfirmationName(String(body.name), data.name);
        else if (String(body.name) !== pinCategoryName(data.name)) throw new Error();
      }
      catch { throw new RillMailHttpError(403, op === "confirm" ? "他の利用者の確認印は変更できません" : "他の利用者のピンは変更できません"); }
    }
    const mutation: MailMutation = { id, boxId, op, value: valueFor(op, body) };
    const [result] = await mutateMailMessages(supabase, user, [mutation]);
    if (!result.ok) throw new RillMailHttpError(result.error?.includes("共有箱") ? 400 : 502, result.error ?? "Mail update failed");
    return Response.json(result);
  } catch (error) { return errorResponse(error); }
}
