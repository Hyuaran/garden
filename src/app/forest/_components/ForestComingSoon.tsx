"use client";

import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import styles from "./ForestDesign.module.css";

type Props = {
  title: string;
  description: string;
};

export function ForestComingSoon({ title, description }: Props) {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        title={title}
        subtitle={description}
        accessBadge={{ icon: "\ud83c\udf31", label: "\u6e96\u5099\u4e2d" }}
        moduleMark="forest"
        favoriteIcon="/themes/garden-shell/images/icons_bloom/orb_forest.png"
      />
      <section className={styles.comingSoonPanel}>
        <div className={styles.comingSoonMark} aria-hidden="true">
          \ud83c\udf3f
        </div>
        <h2>\u6e96\u5099\u4e2d\u3067\u3059</h2>
        <p>
          \u3053\u306e\u30da\u30fc\u30b8\u306f Forest \u306e\u6b21\u30d5\u30a7\u30fc\u30ba\u3067\u5b9f\u88c5\u3057\u307e\u3059\u3002
          \u73fe\u5728\u306f\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u3068\u9032\u884c\u671f\u306e\u66f4\u65b0\u304b\u3089\u3054\u78ba\u8a8d\u304f\u3060\u3055\u3044\u3002
        </p>
      </section>
    </div>
  );
}
