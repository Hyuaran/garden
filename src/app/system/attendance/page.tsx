import { redirect } from "next/navigation";
export default async function AttendancePage() {
  redirect("/system/mypage?tab=attendance");
}

