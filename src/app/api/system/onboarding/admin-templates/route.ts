import { readAdminTemplates, saveAdminTemplate } from "@/app/system/onboarding/_lib/onboarding-admin-templates.server";
import { OnboardingError } from "@/app/system/onboarding/_lib/onboarding.server";

async function respond(action: () => Promise<unknown>) {
  try { return Response.json(await action()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "処理できませんでした" }, { status: error instanceof OnboardingError ? error.status : 400 }); }
}
export async function GET() { return respond(readAdminTemplates); }
export async function PATCH(request: Request) { return respond(async () => saveAdminTemplate(await request.json())); }
