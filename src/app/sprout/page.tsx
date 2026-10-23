import { ComingSoonPage } from "../_components/ComingSoonPage";
import { sproutUser } from "@/lib/sprout/access.server";
import Sprout from "./sprout";
export default async function SproutPage() {
  if (!await sproutUser()) return <ComingSoonPage moduleName="Sprout" nameJa="新芽" description="採用 → 面接 → 内定 → 入社準備" phase="Phase B" />;
  return <Sprout />;
}
