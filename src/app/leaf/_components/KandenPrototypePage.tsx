"use client";
import { SystemViewButton, useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import ScopedTabs, { TabHeadingAction, useUrlTab } from "@/app/_components/ScopedTabs";
import { LEAF_FOREST_TABS } from "@/lib/auth/leaf-forest-view-scopes";


import LegacyUiNotice from "@/app/_components/LegacyUiNotice";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import LeafShell from "./LeafShell";
import styles from "./LeafPages.module.css";

type ProtoMode = "input" | "backoffice";

const PROTO = {
  input: {
    src: "/api/leaf/prototype?mode=input",
    title: "関電プロトタイプ 入力UI",
    pageTitle: "関電 入力",
    crumb: "入力",
  },
  backoffice: {
    src: "/api/leaf/prototype?mode=backoffice",
    title: "関電プロトタイプ 事務UI",
    pageTitle: "関電 事務",
    crumb: "事務",
  },
} satisfies Record<ProtoMode, { src: string; title: string; pageTitle: string; crumb: string }>;

type KandenPrototypePageProps = {
  mode: ProtoMode;
};

export default function KandenPrototypePage({ mode }: KandenPrototypePageProps) {
  const activeProto = PROTO[mode];
  const { allowedTab } = useSystemView();
  const [selected, setSelected] = useUrlTab<string>("input");
  const tabs = mode === "input" ? LEAF_FOREST_TABS["leaf-kanden-input"].filter(([key]) => allowedTab(key)) : [];
  const tab = tabs.some(([key]) => key === selected) ? selected : tabs[0]?.[0] ?? "";
  const source = activeProto.src + (tab ? `&tab=${tab}` : "");

  return (
    <LeafShell active={mode === "input" ? "kanden-input" : "kanden-backoffice"}>
      <div className={styles.pageStack}>
        <PageHeader
          title={activeProto.pageTitle}
          subtitle="関西電力業務委託の旧プロトタイプを Garden Shell 内で確認するページです。"
          accessBadge={{ icon: "i", label: "Leaf / 関電" }}
          titleAddon={
            <>{mode === "input" ? <TabHeadingAction items={tabs.map(([key, label]) => ({ key, label }))} active={tab} /> : <SystemViewButton />}<LegacyUiNotice
              badgeLabel="旧プロト・新UI切替予定"
              toastTitle="旧プロト・新UI切替予定"
              toastBody="この画面は旧プロトタイプです。新UIへの作り替えを予定しています。"
            /></>
          }
          moduleMark="leaf"
          favoriteIcon="/themes/garden-shell/images/icons_bloom/orb_leaf.png"
        />

        <nav className={styles.breadcrumb} aria-label="パンくず">
          <span>Leaf</span>
          <span aria-hidden="true">＞</span>
          <span>関電</span>
          <span aria-hidden="true">＞</span>
          <strong>{activeProto.crumb}</strong>
        </nav>

        {mode === "input" && <ScopedTabs items={tabs.map(([key, label]) => ({ key, label }))} active={tab} onChange={setSelected} label="関電入力" />}

        {mode === "input" && !tab ? <p>閲覧権限がありません</p> : <section className={styles.protoShell}>
          <div className={styles.protoToolbar}>
            <strong className={styles.protoTitle}>{activeProto.title}</strong>
            <a className={styles.protoLink} href={source} target="_blank" rel="noreferrer">
              HTMLを別タブで開く
            </a>
          </div>

          <div className={styles.iframeWrap}>
            <iframe
              key={`${mode}:${tab}`}
              className={styles.iframe}
              src={source}
              title={activeProto.title}
            />
          </div>
        </section>}
      </div>
    </LeafShell>
  );
}
