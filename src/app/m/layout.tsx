import { MobileAuthGate } from "./_components/MobileAuthGate";
import { MobileBottomNav } from "./_components/MobileBottomNav";
import { MobileHeader } from "./_components/MobileHeader";
import styles from "./mobile.module.css";
export default function MobileLayout({ children }: {
    children: React.ReactNode;
}) {
    return <div className={styles.shell}><MobileAuthGate><MobileHeader /><div className={styles.content}>{children}</div><MobileBottomNav /></MobileAuthGate></div>;
}
