import { hireResponse, candidateOptions } from "@/app/system/onboarding/_lib/hire-candidates.server";
export async function GET() { return hireResponse(candidateOptions); }
