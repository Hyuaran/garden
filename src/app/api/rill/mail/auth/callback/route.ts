import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";
import { encryptToken } from "@/app/rill/mail/_lib/token-crypto";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireGardenUser();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const expected = request.cookies.get("rill_mail_oauth_state")?.value;
    if (!code || !state || !expected || state !== expected) throw new RillMailHttpError(400, "Invalid Microsoft OAuth callback");
    const tokens = await exchangeCode(code, request.url);
    if (!tokens.refresh_token) throw new RillMailHttpError(502, "Microsoft did not return a refresh token");
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=userPrincipalName,mail", { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
    if (!profileResponse.ok) throw new RillMailHttpError(502, "Could not read Microsoft profile");
    const profile = await profileResponse.json() as { userPrincipalName?: string; mail?: string };
    const { error } = await supabase.from("rill_mail_tokens").upsert({ user_id: user.id, ms_upn: profile.mail ?? profile.userPrincipalName ?? null, refresh_token_enc: encryptToken(tokens.refresh_token), access_token_enc: encryptToken(tokens.access_token), access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new RillMailHttpError(500, error.message);
    const response = NextResponse.redirect(new URL("/rill/mail?connected=1", request.url));
    response.cookies.delete("rill_mail_oauth_state");
    return response;
  } catch (error) { return errorResponse(error); }
}
