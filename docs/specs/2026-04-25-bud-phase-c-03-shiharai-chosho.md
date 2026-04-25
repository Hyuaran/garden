# Bud Phase C-03: 支払調書（フリーランス・業務委託・講師・士業等）

- 対象: 給与以外の支払（フリーランス業務委託等）への年間支払実績集計と支払調書発行
- 優先度: **🔴 高**（法定調書の一部、年間支払 5 万円超は税務署提出必須）
- 見積: **0.6d**
- 担当セッション: a-bud
- 作成: 2026-04-25（a-auto 002 / Batch 11 Bud Phase C #03）
- 前提:
  - C-01（`bud_nenmatsu_chousei` の 4 階層 RLS パターン）
  - Bud Phase A-1 `bud_vendors`（新規取引先機能、予定）
  - Bud A-03（振込実績、`bud_furikomi_records`）
  - C-02（PDF 生成パターン、@react-pdf/renderer）

---

## 1. 目的とスコープ

### 目的

フリーランス・業務委託・講師・士業等への支払を年間集計し、**支払調書（報酬、料金、契約金及び賞金の支払調書）**を発行する。税務署提出用データ + 取引先交付用 PDF の 2 方向出力。

### 含める

- 支払調書データ管理テーブル（`bud_shiharai_chosho`）
- `bud_vendors`（取引先マスタ）との連携
- 年間支払実績の集計（`bud_furikomi_records` from A-03）
- 支払調書 PDF 生成（@react-pdf）
- 税務署提出用 CSV 出力（e-Tax XML は C-04）
- 取引先への配信（メール or ダウンロード）

### 含めない

- 給与の源泉徴収票（C-02）
- 法定調書合計表（C-04）
- UI（C-05）
- テスト（C-06）

---

## 2. 既存実装との関係

### 2.1 `bud_vendors` との接続（Phase A-1 予定）

- 取引先は Vendor 型として管理（法人 / 個人事業主の区別）
- 必須属性: 氏名 / 住所 / マイナンバー or 法人番号 / 源泉区分

### 2.2 `bud_furikomi_records`（A-03）との接続

- 振込レコードのうち **`vendor_id IS NOT NULL`** を対象
- 年間・Vendor 別に集計、源泉徴収額も同時に積算

### 2.3 源泉徴収の対象判定

所得税法 204 条の区分:

| 区分 | 該当例 | 源泉税率（100 万円以下）|
|---|---|---|
| 1 号 | 原稿料、講演料、デザイン料 | 10.21% |
| 2 号 | 弁護士、税理士、司法書士の報酬 | 10.21% |
| 3 号 | プロボクサー、外交員、集金人 | 10.21% / 一部別 |
| 4 号 | 芸能人、モデル | 10.21% |
| 5 号 | ホステス報酬 | 10.21% |
| 6 号 | 広告放送謝金 | 10.21% |
| 7 号 | 社会保険診療報酬 | 個別 |
| 8 号 | 馬主競馬賞金 | 個別 |

100 万円超部分は 20.42%（復興特別所得税含む）。

---

## 3. データモデル

### 3.1 `bud_shiharai_chosho`

```sql
CREATE TABLE bud_shiharai_chosho (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  fiscal_year             int NOT NULL,
  vendor_id               uuid NOT NULL,  -- bud_vendors へ FK（A-1 実装後に有効化）
  CONSTRAINT uniq_year_vendor UNIQUE (fiscal_year, vendor_id),

  -- 取引先情報（発行時点のスナップショット）
  vendor_type             text NOT NULL CHECK (vendor_type IN ('corporate', 'individual')),
  vendor_name             text NOT NULL,
  vendor_address          text,
  vendor_my_number        text,        -- 個人事業主、pgcrypto 暗号化
  vendor_corporate_number text,        -- 法人番号、13 桁

  -- 区分コード（源泉徴収区分）
  tax_category            text NOT NULL CHECK (tax_category IN (
    '1_manuscript', '2_professional', '3_professional_etc',
    '4_entertainer', '5_hostess', '6_ad', '7_medical',
    '8_racing', '9_non_resident', '99_other'
  )),
  tax_description         text,        -- 区分詳細（例: 「原稿料」「税理士報酬」）

  -- 年間支払実績（A-03 から集計）
  gross_payment_total     bigint NOT NULL DEFAULT 0 CHECK (gross_payment_total >= 0),
  withholding_tax_total   bigint NOT NULL DEFAULT 0 CHECK (withholding_tax_total >= 0),
  payment_count           int NOT NULL DEFAULT 0,
  first_payment_date      date,
  last_payment_date       date,

  -- 法定 5 万円超判定（支払調書提出対象）
  is_submission_required  boolean NOT NULL DEFAULT false,  -- Trigger で自動判定

  -- 発行状態
  status                  text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'reissued', 'voided')),
  issued_at               timestamptz,
  issued_by               text REFERENCES root_employees(employee_number),
  pdf_storage_key         text,
  pdf_sha256              text,

  -- 配信状態
  delivered_to_vendor     boolean NOT NULL DEFAULT false,
  delivered_at            timestamptz,
  delivery_method         text CHECK (delivery_method IN ('email', 'mail', 'download', 'not_required')),

  -- 再発行
  reissue_count           int NOT NULL DEFAULT 0 CHECK (reissue_count <= 5),
  reissue_reason          text,

  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

CREATE INDEX idx_bsc_year ON bud_shiharai_chosho (fiscal_year);
CREATE INDEX idx_bsc_vendor ON bud_shiharai_chosho (vendor_id);
CREATE INDEX idx_bsc_submission ON bud_shiharai_chosho (fiscal_year) WHERE is_submission_required = true;
```

### 3.2 判定 Trigger（5 万円超対象）

```sql
CREATE OR REPLACE FUNCTION trg_bsc_set_submission_flag() RETURNS trigger AS $$
BEGIN
  -- 区分 1-8 で年間 5 万円超は提出必須
  -- 弁護士/税理士（区分 2）は 5 万円超で必須
  IF NEW.tax_category LIKE '1_%' OR NEW.tax_category LIKE '2_%'
     OR NEW.tax_category LIKE '3_%' OR NEW.tax_category LIKE '4_%'
     OR NEW.tax_category LIKE '5_%' OR NEW.tax_category LIKE '6_%'
     OR NEW.tax_category LIKE '8_%' THEN
    NEW.is_submission_required := (NEW.gross_payment_total > 50000);
  ELSE
    NEW.is_submission_required := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bsc_before_insert_update
  BEFORE INSERT OR UPDATE ON bud_shiharai_chosho
  FOR EACH ROW EXECUTE FUNCTION trg_bsc_set_submission_flag();
```

### 3.3 Storage bucket `bud-shiharai-pdf`

```
bud-shiharai-pdf/
├── {fiscal_year}/
│   ├── {vendor_id}/
│   │   ├── shiharai_chosho_v1_20270115.pdf
│   │   └── ...
```

---

## 4. 集計ロジック

### 4.1 Vendor 別年間集計

```sql
CREATE OR REPLACE FUNCTION bud_aggregate_vendor_annual(
  p_year int, p_vendor_id uuid
) RETURNS TABLE (
  gross_total bigint,
  withholding_total bigint,
  payment_count int,
  first_date date,
  last_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount_gross), 0)::bigint,
    COALESCE(SUM(withholding_tax), 0)::bigint,
    COUNT(*)::int,
    MIN(payment_date),
    MAX(payment_date)
  FROM bud_furikomi_records
  WHERE vendor_id = p_vendor_id
    AND fiscal_year = p_year
    AND status = 'completed'
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 源泉徴収額の算出

```ts
// src/app/bud/_lib/withholdingTax.ts
export function calcWithholdingTax(
  gross: number,
  category: TaxCategory,
  isNonResident: boolean = false
): number {
  if (isNonResident) return Math.floor(gross * 0.2042);  // 非居住者一律 20.42%

  switch (category) {
    case '1_manuscript':
    case '2_professional':
    case '3_professional_etc':
    case '4_entertainer':
    case '5_hostess':
    case '6_ad':
      if (gross <= 1_000_000) return Math.floor(gross * 0.1021);
      return Math.floor(1_000_000 * 0.1021 + (gross - 1_000_000) * 0.2042);

    case '7_medical':
    case '8_racing':
      // 個別計算（§判断保留）
      return 0;

    default:
      return 0;
  }
}
```

### 4.3 一括集計バッチ

年末（12/31 or 1/15）に全 Vendor 分を一括計算 → `bud_shiharai_chosho` INSERT/UPDATE:

```ts
// src/app/bud/_actions/aggregateShiharaiChosho.ts
export async function aggregateShiharaiChosho(year: number) {
  const vendors = await supabase.from('bud_vendors').select().is('deleted_at', null);

  for (const vendor of vendors.data ?? []) {
    const aggregate = await rpc('bud_aggregate_vendor_annual', {
      p_year: year,
      p_vendor_id: vendor.id,
    });

    if ((aggregate.gross_total ?? 0) === 0) continue;  // 支払なし除外

    await supabase.from('bud_shiharai_chosho').upsert({
      fiscal_year: year,
      vendor_id: vendor.id,
      vendor_type: vendor.type,
      vendor_name: vendor.name,
      vendor_address: vendor.address,
      vendor_my_number: vendor.my_number,
      vendor_corporate_number: vendor.corporate_number,
      tax_category: vendor.default_tax_category,
      gross_payment_total: aggregate.gross_total,
      withholding_tax_total: aggregate.withholding_total,
      payment_count: aggregate.payment_count,
      first_payment_date: aggregate.first_date,
      last_payment_date: aggregate.last_date,
    }, { onConflict: 'fiscal_year,vendor_id' });
  }
}
```

---

## 5. PDF 生成

### 5.1 様式

- 国税庁「報酬、料金、契約金及び賞金の支払調書」A6 様式
- ヘッダ: 「支払調書」「年分」「支払者名」「受給者名」
- 本体: 「区分」「細目」「支払金額」「源泉徴収税額」

### 5.2 `ShiharaiChoshoDocument.tsx`

C-02 と同じ `@react-pdf/renderer` パターン、ただし様式差異あり。

### 5.3 出力パターン

1. **個別 PDF**: 1 Vendor 1 枚（交付用）
2. **一括 PDF**: 全 Vendor まとめ（事務保存用）
3. **CSV**: 税務署提出用

---

## 6. 税務署提出用 CSV

### 6.1 フォーマット

```
vendor_corporate_number,vendor_my_number,vendor_name,vendor_address,
fiscal_year,tax_category,gross_payment_total,withholding_tax_total,...
```

- UTF-8 + BOM
- is_submission_required = true のみ抽出
- ファイル名: `shiharai-chosho-{year}-{yyyymmdd}.csv`
- Storage: `bud-tax-exports/{year}/shiharai/`

### 6.2 e-Tax XML 対応（C-04 で詳述）

- Phase C-2 で直接 e-Tax 提出
- Phase C-1 は CSV → 税理士事務所経由で e-Tax 投函

---

## 7. 取引先への配信

### 7.1 配信方法選択

```sql
CREATE TABLE bud_vendors (
  -- ... 既存 ...
  preferred_delivery_method text CHECK (preferred_delivery_method IN
    ('email', 'mail', 'download_only', 'not_required'))
);
```

### 7.2 メール配信

- SendGrid / AWS SES（§判断保留）
- PDF 添付 ON/OFF:
  - 法人 Vendor → PDF 添付可（機密情報なし、営業情報のみ）
  - 個人 Vendor → **Garden マイページ誘導**（マイナンバー含む可能性、案 D 準拠）

### 7.3 郵送配信

- 月初に admin が一括印刷 → 郵送
- Garden 側は `delivery_method = 'mail'`、`delivered_at` を手動記録

### 7.4 ダウンロード専用

- Vendor が Garden 取引先ポータル（Phase D 予定）にログインして取得
- Phase C-1 はメール通知「印刷して郵送します」

---

## 8. RLS ポリシー

spec-cross-rls-audit 準拠、4 階層：

| 操作 | 本人 Vendor | staff | manager | admin+ |
|---|---|---|---|---|
| SELECT | 自分の分のみ | 全件 | 全件 | 全件 |
| INSERT | 不可 | 可 | 可 | 可 |
| UPDATE | 不可 | draft のみ | 不可（default、設定可）| 全列 |
| DELETE（論理）| 不可 | 不可 | 不可 | 可 |
| マイナンバー復号 | — | 不可 | 不可 | **可** |

---

## 9. 実装ステップ

1. **Step 1**: `bud_shiharai_chosho` migration + RLS + Trigger（1.5h）
2. **Step 2**: 集計関数 `bud_aggregate_vendor_annual`（0.5h）
3. **Step 3**: `calcWithholdingTax` 関数 + マスタ（1h）
4. **Step 4**: 一括集計バッチ Server Action（0.5h）
5. **Step 5**: `ShiharaiChoshoDocument.tsx` PDF（1.5h）
6. **Step 6**: CSV 出力（税務署提出用）（0.5h）
7. **Step 7**: メール / 郵送 / DL の配信振り分け（1h）
8. **Step 8**: 結合テスト・バグ修正（0.5h）

**合計**: 約 **0.6d**（約 7h）

---

## 10. テスト観点（詳細 C-06）

- 年間支払 5 万円 ちょうど / 5 万 1 円 の境界
- 源泉税率の境界（100 万円 ちょうど / 100 万 1 円）
- 非居住者 Vendor の一律 20.42% 適用
- 複数区分（同 Vendor が 1 号 + 2 号 両方）
- マイナンバー暗号化・復号
- Trigger（is_submission_required）の自動判定
- PDF 生成 100 件並列
- RLS: 他 Vendor 分の SELECT 拒否

---

## 11. 判断保留事項

- **判1: メール配信サービス**
  - SendGrid / AWS SES / Resend
  - **推定スタンス**: SendGrid（日本語サポート強、ドメイン認証容易）
- **判2: 個人 Vendor への PDF 添付**
  - マイナンバー含むため不可 / 暗号化 ZIP なら可
  - **推定スタンス**: 不可、Garden マイページ誘導（案 D）
- **判3: 医療・競馬等の特殊区分計算**
  - Phase C-1 実装 / C-2 以降
  - **推定スタンス**: Phase C-1 は一般区分のみ、特殊は手入力許容
- **判4: Vendor のマイページ実装**
  - Phase C / Phase D
  - **推定スタンス**: Phase D で Vendor ポータル新設、C は DL リンク配信のみ
- **判5: 提出義務 5 万円超判定の年度跨ぎ**
  - 支払日が 12 月末 / 1 月初で年度区切り
  - **推定スタンス**: 支払日（`payment_date`）基準、契約日ベースではない
- **判6: PDF の様式 A6 vs A4**
  - 正式は A6、A4 で見やすさ優先も
  - **推定スタンス**: A6 正式 + A4 見やすさ版の 2 種
- **判7: 再発行上限**
  - 5 回 / 10 回
  - **推定スタンス**: 5 回（C-02 と統一）

---

## 12. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| テーブル + RLS + Trigger | 1.5h |
| 集計関数 + 税率マスタ | 1.5h |
| 一括集計バッチ | 0.5h |
| PDF コンポーネント | 1.5h |
| CSV 出力 | 0.5h |
| 配信振り分け（メール/郵送/DL）| 1.0h |
| 結合テスト | 0.5h |
| **合計** | **0.6d**（約 7h）|

---

— spec-bud-phase-c-03 end —
