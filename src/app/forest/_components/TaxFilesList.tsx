"use client";

/**
 * Garden-Forest TaxFilesList: 税理士連携データ セクション本体。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md §5 Step 5
 *
 * - 法人ごとの TaxFilesGroup を TAX_FILE_COMPANY_ORDER 順で並べる
 * - taxFiles 全体が空なら「まだファイルが連携されていません」セクション表示
 * - 個別ファイル行のクリックで Storage signedURL を取得して新タブで開く
 *
 * Forest 規約に従いインラインスタイル（Tailwind 不使用）。
 */

import { useMemo } from "react";

import type { Company } from "../_constants/companies";
import type { TaxFile } from "../_lib/types";
import { TAX_FILE_COMPANY_ORDER } from "../_constants/tax-files";
import { C } from "../_constants/colors";
import { FOREST_THEME } from "../_constants/theme";
import { TaxFilesGroup } from "./TaxFilesGroup";

type Props = {
  companies: Company[];
  taxFiles: TaxFile[];
};

export function TaxFilesList({ companies, taxFiles }: Props) {
  // 法人 id → 日本語ラベルの map
  const labelMap = useMemo(() => {
    return Object.fromEntries(companies.map((c) => [c.id, c.name]));
  }, [companies]);

  // 法人 id 別にグループ化
  const grouped = useMemo(() => {
    const map = new Map<string, TaxFile[]>();
    for (const f of taxFiles) {
      const arr = map.get(f.company_id) ?? [];
      arr.push(f);
      map.set(f.company_id, arr);
    }
    return map;
  }, [taxFiles]);

  const isEmpty = taxFiles.length === 0;

  return (
    <section
      style={{
        background: FOREST_THEME.panelBg,
        border: `1px solid ${FOREST_THEME.panelBorder}`,
        borderRadius: 18,
        padding: 28,
        marginBottom: 28,
        boxShadow: FOREST_THEME.panelShadow,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: C.darkGreen,
          margin: "0 0 16px 0",
          paddingBottom: 12,
          borderBottom: `2px solid ${C.mintBg}`,
        }}
      >
        税理士連携データ
      </h2>

      {isEmpty ? (
        <div
          style={{
            textAlign: "center",
            color: C.textMuted,
            fontSize: 13,
            padding: "24px 0",
          }}
        >
          まだファイルが連携されていません
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {TAX_FILE_COMPANY_ORDER.map((cid) => {
            const files = grouped.get(cid) ?? [];
            const label = labelMap[cid] ?? cid;
            return (
              <TaxFilesGroup
                key={cid}
                companyLabel={label}
                files={files}
                defaultOpen={files.length > 0}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
