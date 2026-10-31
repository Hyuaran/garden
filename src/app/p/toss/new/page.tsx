import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import TossForm from "./TossForm";
import styles from "./page.module.css";
import headerStyles from "../shared-header.module.css";
import { PartnerHeaderActions } from "../../_components/PartnerHeaderActions";

export default function TossNewPage() {
  return <main className={styles.page}><header><nav className={headerStyles.headerNav}><a href="/p/toss">← ポータルへ戻る</a><PartnerHeaderActions /></nav><p className={headerStyles.eyebrow}>Garden toss portal</p><div className="garden-help-heading"><h1>トスアップ入力</h1><HelpButton /></div><span>入力内容は送信前にご確認ください。</span></header><SystemTabs /><TossForm /></main>;
}
