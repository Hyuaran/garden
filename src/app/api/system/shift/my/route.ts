import { shiftRoute } from "@/lib/shift/route.server";
export const GET = (request: Request) => shiftRoute(request, "my");
export const PUT = (request: Request) => shiftRoute(request, "my");
