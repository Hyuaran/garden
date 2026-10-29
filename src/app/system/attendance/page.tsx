import { redirect } from "next/navigation";
import { MY_PAGE_ROUTES } from "@/app/system/mypage/types";

export default function Page() {
  redirect(MY_PAGE_ROUTES.attendance);
}
