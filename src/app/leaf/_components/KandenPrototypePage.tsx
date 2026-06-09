"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import LeafShell from "./LeafShell";
import styles from "./LeafPages.module.css";

type ProtoTab = "input" | "backoffice";

const PROTO = {
  input: {
    label: "入力UI",
    src: "/_proto/leaf-kanden/input.html",
    title: "関電プロト 入力UI",
  },
  backoffice: {
    label: "事務UI",
    src: "/_proto/leaf-kanden/backoffice.html",
    title: "関電プロト 事務UI",
  },
} satisfies Record<ProtoTab, { label: string; src: string; title: string }>;

export default function KandenPrototypePage() {
  const [activeTab, setActiveTab] = useState<ProtoTab>("input");
  const activeProto = PROTO[activeTab];
  const tabs = useMemo(() => Object.entries(PROTO) as Array<[ProtoTab, typeof PROTO[ProtoTab]]>, []);

  return (
    <LeafShell active="kanden">
      <div className={styles.pageStack}>
        <PageHeader
          title="関電プロト閲覧"
          subtitle="関西電力業務委託の旧プロトタイプをGarden Shell内で確認するためのページです。"
          accessBadge={{ icon: "🌿", label: "Leaf / 関電" }}
          moduleMark="leaf"
          favoriteIcon="/themes/garden-shell/images/icons_bloom/orb_leaf.png"
        />

        <nav className={styles.protoBanner} aria-label="パンくず">
          <span className={styles.protoBannerIcon} aria-hidden="true">i</span>
          <div>
            <strong>このページは旧プロトタイプ表示です。新UI（Garden Shell）への作り替えを予定しています。</strong>
            <p>
              HTMLプロトタイプは無改変で埋め込んでいます。Leafの共通バナーとして、今後の旧UI閲覧ページにも流用する想定です。
              <Link href="/leaf"> Leaf overviewへ戻る</Link>
            </p>
          </div>
        </nav>

        <section className={styles.protoShell}>
          <div className={styles.protoToolbar}>
            <div className={styles.protoTabs} role="tablist" aria-label="関電プロトタイプ切替">
              {tabs.map(([key, proto]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  className={`${styles.protoTab} ${activeTab === key ? styles.protoTabActive : ""}`}
                  onClick={() => setActiveTab(key)}
                >
                  {proto.label}
                </button>
              ))}
            </div>
            <a className={styles.protoLink} href={activeProto.src} target="_blank" rel="noreferrer">
              HTMLを別タブで開く
            </a>
          </div>

          <div className={styles.iframeWrap}>
            <iframe
              key={activeTab}
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
