import Link from "next/link";
import styles from "./system-breadcrumb.module.css";

export type SystemBreadcrumbItem = {
  label: string;
  href?: string;
};

export default function SystemBreadcrumb({ items = [] }: { items?: SystemBreadcrumbItem[] }) {
  const crumbs: SystemBreadcrumbItem[] = [{ label: "System", href: items.length ? "/system" : undefined }, ...items];

  return (
    <nav className={styles.breadcrumb} aria-label="現在地">
      <ol>
        {crumbs.map((item, index) => {
          const isCurrent = index === crumbs.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !isCurrent ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
