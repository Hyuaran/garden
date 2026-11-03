import { shiftRoute } from "@/lib/shift/route.server";

export const maxDuration = 300;
export const POST = (request: Request) => shiftRoute(request, "kot");
