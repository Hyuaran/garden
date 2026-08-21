import { redirect } from "next/navigation";

export default function LegacyMyPageRedirect() {
  redirect("/system/mypage");
}
