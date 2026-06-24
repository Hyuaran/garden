"use client";

import type { DataSource } from "../_lib/transfer-create-schema";
import { DATA_SOURCES } from "../_lib/transfer-create-schema";
import { transferFormStyles as styles } from "./transferFormStyles";

interface Props {
  value: DataSource;
  onChange: (value: DataSource) => void;
  disabled?: boolean;
}

const DATA_SOURCE_DESCRIPTIONS: Record<DataSource, string> = {
  紙スキャン: "スキャン済み請求書から登録",
  デジタル入力: "手入力で依頼を作成",
  CSVインポート: "一覧データから取り込み",
};

export function DataSourceSelector({ value, onChange, disabled }: Props) {
  return (
    <article className={styles.panel}>
      <div className={styles.cardHeader}>
        <h2 className={styles.panelTitle}>
          <span className={styles.titleIcon}>源</span>
          データソース選択
        </h2>
      </div>
      <fieldset className={styles.cardBody}>
        <legend className="sr-only">データソース</legend>
        <div className={styles.sourceOptions}>
          {DATA_SOURCES.map((ds) => (
            <label
              key={ds}
              className={`${styles.sourceOption} ${
                value === ds ? styles.sourceOptionActive : ""
              }`}
            >
              <input
                type="radio"
                name="data_source"
                value={ds}
                checked={value === ds}
                onChange={() => onChange(ds)}
                disabled={disabled}
                className="sr-only"
              />
              <b className={styles.sourceOptionTitle}>{ds}</b>
              <small className={styles.sourceOptionText}>
                {DATA_SOURCE_DESCRIPTIONS[ds]}
              </small>
            </label>
          ))}
        </div>
      </fieldset>
    </article>
  );
}
