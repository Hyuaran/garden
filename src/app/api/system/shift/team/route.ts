import { shiftRoute } from "@/lib/shift/route.server";
export const GET = (request: Request) => shiftRoute(request, "read");
