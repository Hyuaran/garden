import { ComingSoonPage } from "../_components/ComingSoonPage";
import { RecruitMailView } from "@/lib/auth/sprout-rill-view.server";
import Sprout from "./sprout";
export default async function SproutPage() {
  const fallback = <ComingSoonPage moduleName="Sprout" nameJa="新芽" description="採用 → 面接 → 内定 → 入社準備" phase="Phase B" />;
  return <RecruitMailView page="sprout-applicants" fallback={fallback}><Sprout /></RecruitMailView>;
}
