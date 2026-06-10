"use client";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { budActivityItems } from "../dashboard/mock-data";
import { BudGate } from "./BudGate";
import { getBudGardenPageMenu } from "./bud-garden-menu";
import { useBudState } from "../_state/BudStateContext";
import { budGardenPages, type BudGardenPageId } from "../_data/garden-pages";
import styles from "./BudGardenPage.module.css";

const BUD_ICON = "/themes/garden-shell/images/icons_bloom/orb_bud.png";

function formatRoleLabel(role: string | null): string {
  if (role === "admin") return "全権管理者 + 経理担当";
  if (role === "approver") return "承認者 + 経理担当";
  if (role === "staff") return "経理担当";
  return "Bud";
}

export function BudGardenPage({ pageId }: { pageId: BudGardenPageId }) {
  const page = budGardenPages[pageId];
  const { sessionUser, signOut, budRole } = useBudState();
  const userName = sessionUser?.name ?? "東海林 美琴";

  return (
    <BudGate>
      <GardenShell
        activeModule="bud"
        pageMenu={getBudGardenPageMenu(page.route)}
        activityItems={budActivityItems}
        userName={userName}
        userEmail={sessionUser?.employee_number ? `${sessionUser.employee_number}@garden.local` : null}
        userRoleLabel={formatRoleLabel(budRole)}
        onLogout={signOut}
      >
        <div className={styles.pageStack}>
          <PageHeader
            title={page.title}
            titleJp={page.titleJp}
            subtitle={page.subtitle}
            accessBadge={{ icon: "♕", label: page.badge }}
            moduleMark="bud"
            favoriteIcon={BUD_ICON}
          />

          <nav className={styles.tabs} aria-label={`${page.title} tabs`}>
            {page.tabs.map((tab, index) => (
              <span key={tab} className={`${styles.tab} ${index === 0 ? styles.tabActive : ""}`}>
                {tab}
              </span>
            ))}
          </nav>

          <div className={styles.segments} aria-label={`${page.title} filters`}>
            {page.segmentTabs.map((tab, index) => (
              <span key={tab} className={`${styles.segment} ${index === 0 ? styles.segmentActive : ""}`}>
                {tab}
              </span>
            ))}
          </div>

          <section className={styles.kpiGrid} aria-label={`${page.title} KPI`}>
            {page.metrics.map((metric) => (
              <article className={styles.card} key={metric.label}>
                <div className={styles.cardHead}>
                  <span className={`${styles.icon} ${metric.tone === "red" ? styles.iconRed : ""}`}>
                    {metric.icon}
                  </span>
                  <span className={styles.label}>{metric.label}</span>
                </div>
                <p className={styles.value}>{metric.value}</p>
                <p className={styles.note}>{metric.note}</p>
              </article>
            ))}
          </section>

          <section className={styles.mainGrid}>
            <div className={styles.panel}>
              <div className={styles.sectionHeader}>
                <h2>{page.chartTitle}</h2>
                <span>{page.mockName}</span>
              </div>
              <Chart type={page.chartType} values={page.chartSeries} />
            </div>

            <aside className={styles.panel}>
              <div className={styles.sectionHeader}>
                <h2>{page.sideTitle}</h2>
                <span>mock data</span>
              </div>
              <div className={styles.sideGrid}>
                {page.sideCards.map((card) => (
                  <section className={styles.sideCard} key={card.title}>
                    <h3>{card.title}</h3>
                    {card.items.map((item) => (
                      <div className={styles.sideItem} key={`${card.title}-${item.label}`}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </section>
                ))}
                <div className={styles.actions}>
                  {page.actions.map((action) => (
                    <button className={styles.actionButton} type="button" key={action}>
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <section className={`${styles.panel} ${styles.tablePanel}`}>
            <div className={styles.sectionHeader}>
              <h2>{page.tableTitle}</h2>
              <span>仮データ</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {page.columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row, index) => (
                    <tr key={`${page.id}-${index}`}>
                      {page.columns.map((column) => (
                        <td key={`${page.id}-${index}-${column.key}`}>
                          {column.key === "status" ? (
                            <span className={styles.status}>{row[column.key]}</span>
                          ) : (
                            row[column.key]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.footerPanel} aria-label={`${page.title} mirror links`}>
            {page.footerLinks.map((link) => (
              <div className={styles.footerItem} key={link}>
                {link}
              </div>
            ))}
          </section>
        </div>
      </GardenShell>
    </BudGate>
  );
}

function Chart({ type, values }: { type: "bars" | "line" | "matrix" | "timeline"; values: number[] }) {
  if (type === "line") {
    const width = 640;
    const height = 210;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const points = values.map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 18) - 9;
      return `${x},${y}`;
    });

    return (
      <svg className={styles.line} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="3" />
        {points.map((point) => {
          const [cx, cy] = point.split(",");
          return <circle key={point} cx={cx} cy={cy} r="4" />;
        })}
      </svg>
    );
  }

  if (type === "matrix") {
    return (
      <div className={styles.matrix} aria-hidden="true">
        {values.map((value, index) => (
          <div className={styles.matrixCell} key={`${value}-${index}`}>
            {value}%
          </div>
        ))}
      </div>
    );
  }

  if (type === "timeline") {
    return (
      <div className={styles.timeline} aria-hidden="true">
        {values.map((value, index) => (
          <span className={styles.dot} key={`${value}-${index}`}>
            {value}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.bars} aria-hidden="true">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ height: `${value}%` }} />
      ))}
    </div>
  );
}
