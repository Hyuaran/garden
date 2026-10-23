import { hireResponse, hireCandidate } from "@/app/system/onboarding/_lib/hire-candidates.server";
export const maxDuration = 120;
export async function POST(request: Request, {params}: {params: Promise<{id:string}>}) { return hireResponse(async c => { const body = await request.json(); return hireCandidate(c,(await params).id,body.prepare === true); }); }
