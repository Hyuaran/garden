import { redirect } from "next/navigation";
import { requireBloomTreeRead } from '@/lib/auth/bloom-tree-view.server';

export default async function LegacyMyPageRedirect() {
  await requireBloomTreeRead('tree-mypage');
  redirect("/system/mypage");
}
