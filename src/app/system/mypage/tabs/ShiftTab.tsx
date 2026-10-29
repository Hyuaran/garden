import styles from "../mypage.module.css";

export default function ShiftTab({ embedded = false }: { embedded?: boolean }) {
  return <section className={styles.comingSoon}>{!embedded && <h2>シフト</h2>}<p>準備中です。シフトの提出・確認はもうしばらくお待ちください。</p></section>;
}
