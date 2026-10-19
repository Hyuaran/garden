import { redirect } from "next/navigation";

// ホームの「お知らせ」リンクなどの古い入口。System の中のお知らせ一覧へ送る
export default function NoticesPage() {
  redirect("/system/notices");
}
