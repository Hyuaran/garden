"use client";

import Image from "next/image";
import { useState } from "react";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import { buildGardenBlueprintMarkdown } from "../_data/markdown";
import { blueprintNotes } from "../_data/notes";
import { blueprintCommonNotes, moduleBlueprints } from "../_data/modules";
import { blueprintOverview } from "../_data/overview";
import { roleAllocations } from "../_data/roles";
import { sourceLinkGroups } from "../_data/sources";
import styles from "./BlueprintDashboard.module.css";

type BlueprintTab = "overview" | "modules";

const tabs: Array<{ key: BlueprintTab; label: string }> = [
  { key: "overview", label: "全体 / Overview" },
  { key: "modules", label: "モジュール / Modules" },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function roleLabel(role: string | null) {
  if (role === "super_admin") return "正社員 / 全権管理";
  if (role) return `Garden role: ${role}`;
  return "Garden Bloom";
}

export default function BlueprintDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const [activeTab, setActiveTab] = useState<BlueprintTab>("overview");
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美樹";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({ ...item, active: item.href === "/bloom/blueprint" }));

  const handleDownloadMarkdown = () => {
    const blob = new Blob([buildGardenBlueprintMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "garden-blueprint.md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <GardenShell
      activeModule="bloom"
      pageMenu={activeMenu}
      userName={userName}
      userEmail={userEmail}
      userRoleLabel={roleLabel(role)}
      onLogout={() => lockAndLogout("manual")}
    >
      <div className={styles.page}>
        <div className={styles.headerWrap}>
          <PageHeader
            title="Garden 設計図"
            titleJp="庭の今、ひと目で"
            subtitle="12モジュールの構成・役割・運用ルールを一画面で把握"
            accessBadge={{ icon: "AI", label: "AI + 将来の開発者向け" }}
          />
        </div>

        <div className={styles.bodyActions}>
          <div className={styles.headerBadge}>12 modules / roles</div>
          <button type="button" className={styles.downloadButton} onClick={handleDownloadMarkdown}>
            設計図を .md でダウンロード
          </button>
        </div>

        <nav className={styles.tabs} aria-label="blueprint sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={cx(styles.tab, activeTab === tab.key && styles.tabActive)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "modules" && <ModulesTab />}
      </div>
    </GardenShell>
  );
}

function OverviewTab() {
  return (
    <>
      <section className={cx(styles.panel, styles.overviewPanel)} aria-labelledby="blueprint-overview">
        <div className={styles.sakuraWash} />
        <p className={styles.eyebrow}>{blueprintOverview.eyebrow}</p>
        <h2 id="blueprint-overview" className={styles.sectionTitle}>Garden Series とは</h2>
        <p className={styles.lead}>{blueprintOverview.lead}</p>
        <div className={styles.overviewGrid}>
          {blueprintOverview.principles.map((card, index) => (
            <article key={card.title} className={styles.miniCard}>
              <Image src={["/themes/garden-shell/images/icons_bloom/orb_sprout.png", "/themes/garden-shell/images/header_icons/D-02_help_simple.png", "/themes/garden-shell/images/icons_bloom/orb_root.png"][index]} alt="" width={44} height={44} />
              <div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.bottomGrid}>
        <section className={styles.panel} aria-labelledby="blueprint-ai">
          <h2 id="blueprint-ai" className={styles.sectionTitle}>AI ROLES / AI 役割分担</h2>
          <div className={styles.aiGrid}>
            {roleAllocations.map((item) => (
              <article key={item.name} className={styles.aiCard}>
                <span>{item.position}</span>
                <h3>{item.name}</h3>
                <ul>
                  {item.responsibilities.map((responsibility) => <li key={responsibility}>{responsibility}</li>)}
                </ul>
                <small>{item.recordTarget}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="blueprint-sources">
          <h2 id="blueprint-sources" className={styles.sectionTitle}>SOURCES / 参照先</h2>
          <div className={styles.sourceGrid}>
            {sourceLinkGroups.map((source) => (
              <article key={source.title}>
                <h3>{source.title}</h3>
                <p className={styles.sourceDescription}>{source.description}</p>
                {source.items.map((item) => (
                  <div key={item.path} className={styles.sourceItem}>
                    <strong>{item.label}</strong>
                    <p>{item.path}</p>
                    <small>{item.note}</small>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.noteGrid} aria-label="known notes">
        {blueprintNotes.map((note) => (
          <article key={note.title} className={styles.noteCard}>
            <span>{note.severity}</span>
            <div>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function ModulesTab() {
  return (
    <section className={styles.panel} aria-labelledby="blueprint-modules">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Module Design Data</p>
          <h2 id="blueprint-modules" className={styles.sectionTitle}>12 MODULES / モジュール設計</h2>
        </div>
        <span>役割・概要・機能・関連・フォルダ・段階を、進捗ではなく設計情報として表示します。</span>
      </div>

      <div className={styles.commonNotes}>
        {blueprintCommonNotes.map((note) => <p key={note}>{note}</p>)}
      </div>

      <div className={styles.designGrid}>
        {moduleBlueprints.map((module, index) => (
          <article key={module.id} className={styles.designCard}>
            <div className={styles.designHead}>
              <Image src={module.iconSrc} alt="" width={64} height={64} className={styles.moduleIcon} />
              <div>
                <div className={styles.moduleMeta}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{module.code2}</b>
                </div>
                <h3>{module.name}</h3>
                <p>{module.role}</p>
              </div>
              <span className={styles.stageText}>{module.stageLabel}</span>
            </div>

            <p className={styles.summary}>{module.summary}</p>

            <div className={styles.featureBlock}>
              <h4>主な機能・想定画面</h4>
              <ul>
                {module.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </div>

            <dl className={styles.designFacts}>
              <div>
                <dt>関連</dt>
                <dd>{module.relations}</dd>
              </div>
              <div>
                <dt>フォルダ</dt>
                <dd>{module.folder}</dd>
              </div>
              {module.note && (
                <div>
                  <dt>特記</dt>
                  <dd>{module.note}</dd>
                </div>
              )}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
