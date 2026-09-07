import Link from "next/link";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import VideoLibrary from "../_components/VideoLibrary";
import { loadVideos } from "../_lib/videos.server";
import styles from "../docs.module.css";

export const metadata = { title: "動画 | Garden" };

export default async function VideosPage() {
  const videos = await loadVideos();
  return <div className={styles.pageShell}>
    <header className={styles.header}><SystemBreadcrumb items={[{ label: "資料", href: "/system/docs" }, { label: "動画" }]} /><h1>動画</h1></header>
    <p className={styles.lead}>研修や説明の動画をまとめています。</p>
    <VideoLibrary videos={videos} />
    <Link className={styles.backToTop} href="/system/docs">資料の一覧へ戻る</Link>
  </div>;
}
