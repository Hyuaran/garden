import Link from "next/link";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { SystemViewButton, SystemViewHeading } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { RootMenuIcon } from "@/app/root/_components/RootMenuIcon";
import styles from "@/app/soil/soil.module.css";
import { LEAF_MENUS } from "./_constants/menus";

const divisions = [
  { title: "コールセンター", description: "受電・架電の日次業務を扱う予定です。" },
  { title: "ブレーカー", description: "電気設備の案件管理と点検を扱う予定です。" },
  { title: "不動産アライアンス", description: "提携先・物件・送客状況を扱う予定です。" },
  { title: "トスアップ", description: "初回のご案内から担当者への引き継ぎを扱う予定です。" },
  { title: "軽貨物事業", description: "配送・車両・稼働状況を扱う予定です。" },
];

export default function LeafHome({ viewAccess }: { viewAccess: Record<string, boolean> }) {
  return (
    <section className={styles.pageShell}>
      <SystemBreadcrumb root={{ label: "Leaf", href: "/leaf" }} items={[{ label: "概要" }]} />
      <SystemViewHeading><h1>概要</h1><SystemViewButton /></SystemViewHeading>
      <div className={styles.cards}>
        {viewAccess["leaf-kanden"] && (
          <Link href="/leaf/kanden" prefetch={false} className={styles.card}>
            <RootMenuIcon icon="document" />
            <h2>{LEAF_MENUS[0].title}</h2>
            <p>関西電力の受注と写メを確認できます。</p>
          </Link>
        )}
        {divisions.map(({ title, description }) => (
          <article key={title} className={styles.card}>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
