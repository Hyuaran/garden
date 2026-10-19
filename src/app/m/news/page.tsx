import { NoticeList } from "@/app/_components/notices/NoticeList";

// スマホのお知らせ（中身は System のお知らせ一覧と同じ部品）。左右に 16px の余白
export default function MobileNewsPage() {
  return <main style={{ padding: "20px 16px 96px" }}><NoticeList /></main>;
}
