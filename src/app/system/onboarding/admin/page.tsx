import { redirect } from "next/navigation";
import { hireAdminContext } from "../_lib/hire-candidates.server";
export default async function OnboardingAdminPage() {
let canManageHires = false;
try { await hireAdminContext(); canManageHires = true; } catch {}
redirect(`/system/onboarding?tab=${canManageHires ? "candidates" : "all"}`);
}
