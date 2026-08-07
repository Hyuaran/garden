import Board from "./Board";
import styles from "./page.module.css";

export default function TossBoardPage() {
  return <main className={styles.page}><header><a href="/toss">← ポータルへ戻る</a><p>Garden Toss Portal</p><h1>トスアップ一覧</h1><span>登録された案件の最新状況を閲覧できます。</span></header><Board /></main>;
}
