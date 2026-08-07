import TossForm from "./TossForm";
import styles from "./page.module.css";

export default function TossNewPage() {
  return <main className={styles.page}><header><a href="/toss">← ポータルへ戻る</a><p>Garden Toss Portal</p><h1>新規トスアップ入力</h1><span>入力内容は送信前にご確認ください。</span></header><TossForm /></main>;
}
