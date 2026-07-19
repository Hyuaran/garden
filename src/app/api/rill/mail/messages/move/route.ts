import { moveMailMessages, type MailMove } from "@/app/rill/mail/_lib/graph";
import { type MailMoveOperation } from "@/app/rill/mail/_lib/move-ops";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

const OPERATIONS = new Set<MailMoveOperation>(["archive", "delete", "restore"]);

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireGardenUser();
    const body = await request.json() as { moves?: unknown };
    if (!Array.isArray(body.moves) || !body.moves.length || body.moves.length > 100) {
      throw new RillMailHttpError(400, "moves must contain 1 to 100 items");
    }
    const moves = body.moves.map((value) => {
      const move = value as Partial<MailMove>;
      if (typeof move.id !== "string" || !move.id || typeof move.boxId !== "string" || !move.boxId || !OPERATIONS.has(move.operation as MailMoveOperation)) {
        throw new RillMailHttpError(400, "Invalid mail move");
      }
      return { id: move.id, boxId: move.boxId, operation: move.operation as MailMoveOperation };
    });
    return Response.json({ results: await moveMailMessages(supabase, user, moves) });
  } catch (error) { return errorResponse(error); }
}
