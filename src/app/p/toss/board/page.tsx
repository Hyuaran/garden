import Board from "./Board";
import styles from "./page.module.css";
import headerStyles from "../shared-header.module.css";
import { PartnerHeaderActions } from "../../_components/PartnerHeaderActions";

export default function TossBoardPage() {
  return <main className={styles.page}><header><nav className={headerStyles.headerNav}><a href="/p/toss">← ポータルへ戻る</a><PartnerHeaderActions /></nav><p className={headerStyles.eyebrow}>Garden toss portal</p><h1>案件一覧</h1></header><Board /></main>;
}
