"use client";

import type { DataSource } from "../_lib/transfer-create-schema";
import { DATA_SOURCES } from "../_lib/transfer-create-schema";

interface Props {
  value: DataSource;
  onChange: (value: DataSource) => void;
  disabled?: boolean;
}

export function DataSourceSelector({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <legend className="text-xs font-medium text-gray-600 px-2">
        データソース
      </legend>
      <div className="flex gap-4">
        {DATA_SOURCES.map((ds) => (
          <label
            key={ds}
            className="inline-flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="radio"
              name="data_source"
              value={ds}
              checked={value === ds}
              onChange={() => onChange(ds)}
              disabled={disabled}
              className="accent-emerald-600"
            />
            <span className="text-gray-900">{ds}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
