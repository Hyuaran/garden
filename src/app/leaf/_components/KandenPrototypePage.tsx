"use client";

import LegacyUiNotice from "@/app/_components/LegacyUiNotice";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import LeafShell from "./LeafShell";
import styles from "./LeafPages.module.css";

type ProtoMode = "input" | "backoffice";

const PROTO = {
  input: {
    src: "/_proto/leaf-kanden/input.html",
    title: "関電プロトタイプ 入力UI",
    pageTitle: "関電 入力",
    crumb: "入力",
  },
  backoffice: {
    src: "/_proto/leaf-kanden/backoffice.html",
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

  return (
    <LeafShell active={mode === "input" ? "kanden-input" : "kanden-backoffice"}>
      <div className={styles.pageStack}>
        <PageHeader
          title={activeProto.pageTitle}
          subtitle="関西電力業務委託の旧プロトタイプを Garden Shell 内で確認するページです。"
          accessBadge={{ icon: "i", label: "Leaf / 関電" }}
          titleAddon={
            <LegacyUiNotice
              badgeLabel="旧プロト・新UI切替予定"
              toastTitle="旧プロト・新UI切替予定"
              toastBody="この画面は旧プロトタイプです。新UIへの作り替えを予定しています。"
            />
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

        <section className={styles.protoShell}>
          <div className={styles.protoToolbar}>
            <strong className={styles.protoTitle}>{activeProto.title}</strong>
            <a className={styles.protoLink} href={activeProto.src} target="_blank" rel="noreferrer">
              HTMLを別タブで開く
            </a>
          </div>

          <div className={styles.iframeWrap}>
            <iframe
              key={mode}
              className={styles.iframe}
              src={activeProto.src}
              title={activeProto.title}
            />
          </div>
        </section>
      </div>
    </LeafShell>
  );
}
