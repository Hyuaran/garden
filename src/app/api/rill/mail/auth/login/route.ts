import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET(request: Request) {
  try {
    await requireGardenUser();
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(authorizeUrl(request.url, state));
    response.cookies.set("rill_mail_oauth_state", state, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/api/rill/mail/auth", maxAge: 600 });
    return response;
  } catch (error) { return errorResponse(error); }
}
