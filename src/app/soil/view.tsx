import Link from "next/link";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { SystemViewHeading, SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { RootMenuIcon } from "@/app/root/_components/RootMenuIcon";
import { visibleSoilMenus } from "./_constants/menus";
import styles from "./soil.module.css";

export default function SoilHome({ viewAccess }: { viewAccess: Record<string, boolean> }) {
  return (
    <section className={styles.pageShell}>
      <SystemBreadcrumb root={{ label: "Soil", href: "/soil" }} />
      <SystemViewHeading><h1>Soil</h1><SystemViewButton /></SystemViewHeading>
      <p className={styles.description}>Garden の各機能が共通で使うデータの台帳。</p>
      <div className={styles.cards}>
        {visibleSoilMenus(viewAccess).map(menu => (
          <Link key={menu.slug} href={`/soil/${menu.slug}`} className={styles.card}>
            <RootMenuIcon icon={menu.icon} />
            <h2>{menu.title}</h2>
            <p>{menu.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
