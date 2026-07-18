import { patchOneMessage } from "@/app/rill/mail/_lib/write-request";

export async function PATCH(request: Request, context: RouteContext<"/api/rill/mail/messages/[id]/state">) {
  const { id } = await context.params;
  return patchOneMessage(request, id, "state");
}
