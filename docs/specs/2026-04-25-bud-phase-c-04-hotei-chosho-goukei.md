# Bud Phase C-04: 法定調書合計表（給与・退職・報酬・賃料の 4 区分）

- 対象: 年間法定調書合計表の集計・e-Tax XML 出力・税理士提出用フォーマット
- 優先度: **🔴 高**（1/31 税務署提出期限、法定義務）
- 見積: **0.6d**
- 担当セッション: a-bud
- 作成: 2026-04-25（a-auto 002 / Batch 11 Bud Phase C #04）
- 前提:
  - C-02（`bud_gensen_choshu` 源泉徴収票データ）
  - C-03（`bud_shiharai_chosho` 支払調書データ）
  - Bud Phase A-1（退職金・賃料支払データ、別途実装）
  - spec-cross-storage（Storage bucket）

---

## 1. 目的とスコープ

### 目的

年末調整確定後、税務署に提出する**法定調書合計表（給与所得・退職所得・報酬料金・不動産賃借料の 4 区分）**を集計し、e-Tax XML もしくは税理士事務所提出用フォーマットで出力する。

### 含める

- 4 区分の集計テーブル（`bud_hotei_chosho_summary`）
- 集計ロジック（年度跨ぎ対応、源泉税含め合算）
- e-Tax XML 出力形式（国税庁公式スキーマ準拠）
- 税理士事務所提出用 CSV / Excel
- 提出期限管理（1/31）とリマインダー
- admin 承認フロー（税務署提出 = 取消不可、慎重運用）

### 含めない

- 源泉徴収票自体（C-02）
- 支払調書自体（C-03）
- UI（C-05）
- テスト（C-06）

---

## 2. 既存実装との関係

### 2.1 4 区分のソース

| 区分 | ソーステーブル | 1 枚あたり要件 |
|---|---|---|
| 給与所得の源泉徴収票合計表 | `bud_gensen_choshu`（C-02）| 500 万円超 or 役員 150 万円超 |
| 退職所得の源泉徴収票合計表 | `bud_taishoku` + `bud_gensen_choshu` | 年間 100 万超（？要確認）|
| 報酬、料金、契約金及び賞金の支払調書合計表 | `bud_shiharai_chosho`（C-03）| 5 万円超（区分 1-6, 8）|
| 不動産の使用料等の支払調書合計表 | `bud_fudosan_chosho`（Phase A 予定）| 年間 15 万円超 |

### 2.2 e-Tax XML の位置付け

- 税務署提出は e-Tax（電子申告）が主流
- Phase C-1: CSV 出力（税理士事務所手動投函）
- Phase C-2: e-Tax XML 直接投函（Phase D 検討）

---

## 3. データモデル

### 3.1 `bud_hotei_chosho_summary`

```sql
CREATE TABLE bud_hotei_chosho_summary (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  fiscal_year              int NOT NULL UNIQUE,   -- 年度ごと 1 行

  -- 給与所得の源泉徴収票合計表
  salary_total_count       int NOT NULL DEFAULT 0,
  salary_total_payment     bigint NOT NULL DEFAULT 0,
  salary_total_withholding bigint NOT NULL DEFAULT 0,
  salary_submission_count  int NOT NULL DEFAULT 0,    -- 提出対象人数（500 万円超）
  salary_submission_payment bigint NOT NULL DEFAULT 0,
  salary_submission_withholding bigint NOT NULL DEFAULT 0,

  -- 退職所得の源泉徴収票合計表
  taishoku_total_count     int NOT NULL DEFAULT 0,
  taishoku_total_payment   bigint NOT NULL DEFAULT 0,
  taishoku_total_withholding bigint NOT NULL DEFAULT 0,

  -- 報酬、料金、契約金及び賞金の支払調書合計表
  houshu_total_count       int NOT NULL DEFAULT 0,
  houshu_total_payment     bigint NOT NULL DEFAULT 0,
  houshu_total_withholding bigint NOT NULL DEFAULT 0,
  houshu_submission_count  int NOT NULL DEFAULT 0,    -- 提出対象件数（5 万円超）
  houshu_submission_payment bigint NOT NULL DEFAULT 0,
  houshu_submission_withholding bigint NOT NULL DEFAULT 0,

  -- 不動産の使用料等の支払調書合計表
  fudosan_total_count      int NOT NULL DEFAULT 0,
  fudosan_total_payment    bigint NOT NULL DEFAULT 0,
  fudosan_submission_count int NOT NULL DEFAULT 0,

  -- ステータス
  status                   text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'calculated', 'reviewed', 'submitted', 'amended')),
  calculated_at            timestamptz,
  reviewed_at              timestamptz,
  reviewed_by              text REFERENCES root_employees(employee_number),
  submitted_at             timestamptz,
  submitted_by             text REFERENCES root_employees(employee_number),
  submission_method        text CHECK (submission_method IN ('e_tax', 'paper', 'tax_accountant')),
  submission_receipt       text,   -- e-Tax 受信番号 or 事務所納品番号

  -- 出力
  csv_storage_key          text,
  xml_storage_key          text,
  pdf_storage_key          text,

  note                     text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE INDEX idx_bhcs_year ON bud_hotei_chosho_summary (fiscal_year DESC);
```

### 3.2 `bud_hotei_chosho_detail`（4 区分の明細、e-Tax XML 用）

```sql
CREATE TABLE bud_hotei_chosho_detail (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id           uuid NOT NULL REFERENCES bud_hotei_chosho_summary(id) ON DELETE CASCADE,

  category             text NOT NULL CHECK (category IN ('salary', 'taishoku', 'houshu', 'fudosan')),
  source_table         text NOT NULL,  -- 'bud_gensen_choshu' / 'bud_shiharai_chosho' / etc
  source_id            uuid NOT NULL,

  is_submission_target boolean NOT NULL DEFAULT false,
  gross_amount         bigint NOT NULL,
  withholding_amount   bigint NOT NULL DEFAULT 0,
  recipient_name       text NOT NULL,
  recipient_address    text,
  recipient_id_type    text CHECK (recipient_id_type IN ('my_number', 'corporate_number')),
  recipient_id_value   text,   -- 暗号化

  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bhcd_summary_cat ON bud_hotei_chosho_detail (summary_id, category);
CREATE INDEX idx_bhcd_target ON bud_hotei_chosho_detail (summary_id)
  WHERE is_submission_target = true;
```

---

## 4. 集計ロジック

### 4.1 一括集計関数

```sql
CREATE OR REPLACE FUNCTION bud_calculate_hotei_chosho_summary(p_year int)
RETURNS uuid AS $$
DECLARE v_summary_id uuid;
BEGIN
  -- 既存サマリを delete して再生成（冪等）
  DELETE FROM bud_hotei_chosho_summary WHERE fiscal_year = p_year;

  INSERT INTO bud_hotei_chosho_summary (
    fiscal_year,
    salary_total_count, salary_total_payment, salary_total_withholding,
    salary_submission_count, salary_submission_payment, salary_submission_withholding,
    houshu_total_count, houshu_total_payment, houshu_total_withholding,
    houshu_submission_count, houshu_submission_payment, houshu_submission_withholding,
    status, calculated_at
  )
  SELECT
    p_year,
    -- 給与
    (SELECT count(*) FROM bud_gensen_choshu WHERE fiscal_year = p_year),
    (SELECT coalesce(sum(gross_salary_total), 0) FROM bud_gensen_choshu WHERE fiscal_year = p_year),
    (SELECT coalesce(sum(withholding_tax_final), 0) FROM bud_gensen_choshu WHERE fiscal_year = p_year),
    -- 給与提出対象
    (SELECT count(*) FROM bud_gensen_choshu WHERE fiscal_year = p_year AND gross_salary_total > 5000000),
    (SELECT coalesce(sum(gross_salary_total), 0) FROM bud_gensen_choshu WHERE fiscal_year = p_year AND gross_salary_total > 5000000),
    (SELECT coalesce(sum(withholding_tax_final), 0) FROM bud_gensen_choshu WHERE fiscal_year = p_year AND gross_salary_total > 5000000),
    -- 報酬
    (SELECT count(*) FROM bud_shiharai_chosho WHERE fiscal_year = p_year),
    (SELECT coalesce(sum(gross_payment_total), 0) FROM bud_shiharai_chosho WHERE fiscal_year = p_year),
    (SELECT coalesce(sum(withholding_tax_total), 0) FROM bud_shiharai_chosho WHERE fiscal_year = p_year),
    (SELECT count(*) FROM bud_shiharai_chosho WHERE fiscal_year = p_year AND is_submission_required = true),
    (SELECT coalesce(sum(gross_payment_total), 0) FROM bud_shiharai_chosho WHERE fiscal_year = p_year AND is_submission_required = true),
    (SELECT coalesce(sum(withholding_tax_total), 0) FROM bud_shiharai_chosho WHERE fiscal_year = p_year AND is_submission_required = true),
    'calculated', now()
  RETURNING id INTO v_summary_id;

  -- 明細も生成（省略）
  PERFORM bud_generate_hotei_chosho_details(v_summary_id, p_year);

  RETURN v_summary_id;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 提出判定

| 区分 | 提出対象 |
|---|---|
| 給与 | 年 500 万円超 + 役員 150 万円超 |
| 退職 | 個別確認（§判断保留）|
| 報酬 | 年 5 万円超（区分 1-6, 8）|
| 不動産 | 年 15 万円超 |

- 提出対象**件数・金額**と**全体件数・金額**の両方を保持（国税庁様式どおり）

### 4.3 年度跨ぎ

- `fiscal_year` は給与支払日の年（1-12 月）
- 12 月給与を 1 月支払（翌月払い）の場合、**支払日ベース**で判定
  - 例: 12 月勤務給与を 1 月 25 日支払 → 翌年度に集計

---

## 5. e-Tax XML 出力

### 5.1 スキーマ仕様

国税庁 e-Tax の XML スキーマ:

- 参照 URL: `http://xml.e-tax.nta.go.jp/XmlSchema/hotei/...`（具体 URL は §判断保留）
- 文字コード: UTF-8
- ルート要素: `<HTNS200>`（法定調書合計表）
- 4 区分それぞれ子要素（`<Kyuyo>`, `<Taishoku>`, `<Houshu>`, `<Fudosan>`）

### 5.2 XML 構造概要

```xml
<?xml version="1.0" encoding="UTF-8"?>
<HTNS200 xmlns="http://xml.e-tax.nta.go.jp/XmlSchema/hotei/HTNS200/1_0">
  <KihonJoho>
    <NendoYear>2026</NendoYear>
    <ShiharaiBasho>
      <Jusho>大阪府大阪市...</Jusho>
      <Meisho>センターライズ株式会社</Meisho>
      <HojinBango>1234567890123</HojinBango>
    </ShiharaiBasho>
  </KihonJoho>

  <Kyuyo>
    <ZentaiKensu>120</ZentaiKensu>
    <ZentaiShiharaiGaku>360000000</ZentaiShiharaiGaku>
    <TeishutsuKensu>15</TeishutsuKensu>
    <TeishutsuShiharaiGaku>90000000</TeishutsuShiharaiGaku>
    <!-- 明細 (従業員別) -->
    <Meisai>
      <Kojin>
        <MyNumber>1234567890123</MyNumber>
        <Shimei>山田太郎</Shimei>
        <ShiharaiGaku>5500000</ShiharaiGaku>
        <GensenzeiGaku>320000</GensenzeiGaku>
      </Kojin>
      <!-- ... -->
    </Meisai>
  </Kyuyo>

  <Houshu>
    <!-- 報酬分 -->
  </Houshu>

  <!-- Taishoku, Fudosan -->
</HTNS200>
```

**重要**: 正確な要素名は国税庁スキーマ確認後に確定（§判断保留 1）。

### 5.3 XML 生成ライブラリ

- Node.js: `xml2js` or `fast-xml-parser`
- 推奨: **手組み string template + 検証**（スキーマ厳密性確保）
- マイナンバー復号は admin+ のみ（C-02 パターン）

### 5.4 出力先

```
bud-tax-exports/{year}/hotei/
├── hotei-chosho-2026.xml        ← e-Tax 用
├── hotei-chosho-2026.csv        ← 税理士事務所用
├── hotei-chosho-2026-summary.pdf ← サマリ PDF
└── kyuyo-meisai-2026.csv         ← 給与明細 CSV
```

---

## 6. 税理士事務所提出用フォーマット

### 6.1 CSV

```
category,source_id,recipient_name,recipient_id,gross_amount,withholding_amount,is_submission_target
salary,0001,山田太郎,1234-5678-9012,4800000,180000,true
salary,0002,佐藤花子,2345-6789-0123,5200000,210000,true
houshu,V001,田中太郎（フリー）,3456-7890-1234,300000,30630,true
...
```

- UTF-8 + BOM
- 区分を 1 列目に明示

### 6.2 Excel（.xlsx）

- シート分け: 給与 / 退職 / 報酬 / 不動産 + 合計サマリ
- ヘッダ色分け、合計行太字
- `anthropic-skills:xlsx` スキル活用

### 6.3 提出用サマリ PDF

- 合計表 1 枚のみ（詳細は Excel 参照）
- 税理士事務所ハンコ欄あり

---

## 7. admin 承認フロー

### 7.1 ステータス遷移

```
draft → calculated → reviewed → submitted
                       ↓
                   amended（修正版、再提出）
```

### 7.2 承認ゲート

| 遷移 | 権限 |
|---|---|
| draft → calculated | staff（集計実行）|
| calculated → reviewed | manager |
| reviewed → submitted | **admin+**（提出確定）|
| submitted → amended | admin+（例外対応）|

### 7.3 提出後の修正

- 提出後は**レコード編集不可**（Trigger で弾く）
- 修正必要時は `amended` 状態に遷移 → 新しいサマリレコード作成 → e-Tax 再投函

---

## 8. 提出期限管理

### 8.1 法定期限

- **翌年 1/31**（例: 令和 8 年分 → 2027-01-31）

### 8.2 リマインダー Cron

```
12 月中旬: 「年末調整データ入力を開始してください」
12 月末: 「給与データの整合性確認をしてください」
1 月初旬: 「法定調書合計表の計算を実行してください」
1 月中旬: 「提出期限まで 2 週間です」
1 月 25 日: 「提出期限まで 1 週間です、至急確認」
1 月 30 日: 「提出期限まで 24 時間です」
1 月 31 日以降（未提出）: 「期限超過」admin 緊急通知
```

- 宛先: 事務担当者 Chatwork DM
- **案 D 準拠**: Garden ログイン誘導のみ、署名 URL 不流通

---

## 9. RLS / 権限

- SELECT: staff+（サマリ見える）
- INSERT / UPDATE: staff+（draft のみ）、manager 以上で reviewed まで
- 提出確定（submitted）: admin+ のみ
- マイナンバー復号: admin+ のみ（§C-02 パターン）

---

## 10. 実装ステップ

1. **Step 1**: `bud_hotei_chosho_summary` / `_detail` migration + RLS（1.5h）
2. **Step 2**: 集計関数 `bud_calculate_hotei_chosho_summary` + 明細生成（1.5h）
3. **Step 3**: CSV 出力（税理士事務所用）（0.5h）
4. **Step 4**: Excel 出力（anthropic-skills:xlsx 活用）（1h）
5. **Step 5**: サマリ PDF 出力（0.5h）
6. **Step 6**: e-Tax XML 生成（**詳細は §判断保留、要国税庁スキーマ確認**）（1.5h）
7. **Step 7**: admin 承認フロー + 期限リマインダー Cron（0.5h）
8. **Step 8**: 結合テスト・バグ修正（0.5h）

**合計**: 約 **0.6d**（約 7.5h）

---

## 11. 判断保留事項（東海林さん / 税理士事務所確認事項）

- **判1: e-Tax XML スキーマの正確な仕様** ⭐ 要確認
  - 国税庁「e-Tax 電子申告・納税システム」公式スキーマは年次改訂
  - 令和 X 年分のスキーマ XSD を入手する必要（`e-Tax ソフト DL センター` 経由）
  - **推定スタンス**: Phase C-1 は CSV のみ、e-Tax XML は Phase C-2 で税理士事務所と連携しながら実装
  - **Action**: 東海林さんから顧問税理士に XML サンプル依頼
- **判2: 税理士事務所の実際の運用** ⭐ 要確認
  - 現状 Excel / CSV / PDF どの形式で提出しているか
  - 勘定科目内訳明細書との関連
  - **推定スタンス**: Phase C-1 は現状踏襲（事務所ヒアリング後確定）
- **判3: 提出区分の細かい条件**
  - 役員の 150 万円超基準、非居住者扱い、同族会社判定
  - **推定スタンス**: 基本条件のみ実装、例外は admin 手動補正
- **判4: 提出後の「amended」扱い**
  - e-Tax の修正申告と Garden 側ステータスの対応
  - **推定スタンス**: 新レコード `status=amended` + 旧は `voided`、両方保持
- **判5: 退職所得の集計ソース**
  - Phase A で退職テーブル実装予定、Phase C までに整備必要
  - **推定スタンス**: Phase C-1 は空値 OK、Phase D で退職テーブル統合
- **判6: マイナンバー XML 内の暗号化**
  - e-Tax 側の暗号化要件（TLS 経由で平文 OK / クライアント暗号化必要）
  - **推定スタンス**: e-Tax 公式推奨に従う（顧問税理士確認）
- **判7: 法人番号の自動取得**
  - 国税庁法人番号公表サイト API
  - **推定スタンス**: Phase C-1 は手入力（社数少）、Phase D で API 連携
- **判8: 期限直前の緊急対応フロー**
  - 1 月 31 日当日のトラブル時
  - **推定スタンス**: Chatwork 緊急通知 + 手動書面提出準備（admin 運用手順書化）

---

## 12. テスト観点（詳細 C-06）

- 集計の整合性（個別 `bud_gensen_choshu` の合算 = `bud_hotei_chosho_summary`）
- 年度跨ぎ（12/31 支払 / 1/1 支払 の境界）
- 提出対象判定（500 万円ちょうど / 500 万 1 円）
- XML の well-formed / schema valid
- マイナンバー XML 内復号（admin+ のみ）
- 提出確定後の UPDATE 拒否（Trigger）
- amended フロー（新旧レコード併存）
- CSV 文字化け（UTF-8 BOM）
- 期限リマインダーの発火タイミング

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| テーブル + RLS + 集計関数 | 3.0h |
| CSV / Excel / PDF 出力 | 2.0h |
| e-Tax XML 生成（**Phase C-1 スコープ調整**）| 1.5h |
| admin 承認 + リマインダー Cron | 0.5h |
| 結合テスト | 0.5h |
| **合計** | **0.6d**（約 7.5h、e-Tax XML は C-2 先送り前提）|

---

— spec-bud-phase-c-04 end —
