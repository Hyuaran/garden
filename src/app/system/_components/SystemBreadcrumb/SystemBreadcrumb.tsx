import Link from "next/link";
import styles from "./system-breadcrumb.module.css";

export type SystemBreadcrumbItem = {
  label: string;
  href?: string;
};

export default function SystemBreadcrumb({ items = [], root = { label: "System", href: "/system" } }: { items?: SystemBreadcrumbItem[]; root?: SystemBreadcrumbItem }) {
  const crumbs: SystemBreadcrumbItem[] = [{ ...root, href: items.length || root.label === "Root" ? root.href : undefined }, ...items];

  return (
    <nav className={styles.breadcrumb} aria-label="現在地">
      <ol>
        {crumbs.map((item, index) => {
          const isCurrent = index === crumbs.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.href && (!isCurrent || (items.length === 0 && root.label === "Root")) ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
