import { shiftRoute } from "@/lib/shift/route.server";
export const PUT = (request: Request) => shiftRoute(request, "person");
