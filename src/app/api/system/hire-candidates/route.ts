import { hireResponse, listCandidates, saveCandidate } from "@/app/system/onboarding/_lib/hire-candidates.server";
export async function GET() { return hireResponse(listCandidates); }
export async function POST(request: Request) { return hireResponse(async c => saveCandidate(c,await request.json())); }
