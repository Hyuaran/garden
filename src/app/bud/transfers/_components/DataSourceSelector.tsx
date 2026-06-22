"use client";

import type { DataSource } from "../_lib/transfer-create-schema";
import { DATA_SOURCES } from "../_lib/transfer-create-schema";
import { transferFormStyles as styles } from "./transferFormStyles";

interface Props {
  value: DataSource;
  onChange: (value: DataSource) => void;
  disabled?: boolean;
}

export function DataSourceSelector({ value, onChange, disabled }: Props) {
  return (
    <fieldset className={styles.panel}>
      <legend className="px-2 text-xs font-medium text-text-sub">
        データソース
      </legend>
      <div className="flex gap-4">
        {DATA_SOURCES.map((ds) => (
          <label
            key={ds}
            className={styles.radioLabel}
          >
            <input
              type="radio"
              name="data_source"
              value={ds}
              checked={value === ds}
              onChange={() => onChange(ds)}
              disabled={disabled}
              className={styles.radio}
            />
            <span>{ds}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
