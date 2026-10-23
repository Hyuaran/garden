import { hireResponse, saveCandidate } from "@/app/system/onboarding/_lib/hire-candidates.server";
export async function PATCH(request: Request, {params}: {params: Promise<{id:string}>}) { return hireResponse(async c => saveCandidate(c,await request.json(),(await params).id)); }
