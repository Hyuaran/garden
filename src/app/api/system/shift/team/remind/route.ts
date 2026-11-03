import { shiftRoute } from "@/lib/shift/route.server";
export const POST = (request: Request) => shiftRoute(request, "remind");
