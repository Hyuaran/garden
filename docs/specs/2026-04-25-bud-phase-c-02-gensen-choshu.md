# Bud Phase C-02: 源泉徴収票データ管理と PDF 発行

- 対象: 年末調整確定後の源泉徴収票生成・配信・再発行フロー
- 優先度: **🔴 最高**（年末調整の成果物、税務上必須）
- 見積: **0.6d**
- 担当セッション: a-bud
- 作成: 2026-04-25（a-auto 002 / Batch 11 Bud Phase C #02）
- 前提:
  - C-01（`bud_nenmatsu_chousei` テーブル、確定データ）
  - Batch 6 B-01（給与計算エンジン、`bud_salary_records`）
  - Batch 6 B-03（給与明細 PDF、@react-pdf/renderer 活用パターン）
  - spec-cross-storage（Storage bucket 方針）
  - Bud A-03（振込パターン、月次給与振込実績）

---

## 1. 目的とスコープ

### 目的

C-01 で確定した年末調整結果と月次給与データを組み合わせ、**源泉徴収票（給与所得の源泉徴収票）**を生成・配信する。税務署・市区町村・従業員本人の 3 方向に PDF/XML を供給する仕組み。

### 含める

- 源泉徴収票データ管理テーブル（`bud_gensen_choshu`）
- 月次給与との年間集計ロジック（`bud_salary_records` からの集計）
- 源泉徴収票 PDF 生成（@react-pdf/renderer）
- **配信方式: Garden マイページ経由**（Chatwork 本文に URL 貼らない、案 D 準拠）
- 再発行フロー（最大 5 回、監査付き）
- 税務署提出用データ出力（e-Tax XML は C-04 で詳述）

### 含めない

- 支払調書（C-03）
- 法定調書合計表（C-04）
- UI（C-05）
- テスト戦略（C-06）

---

## 2. 既存実装との関係

### 2.1 Batch 6 Bud Phase B との接続

| B-0X | 提供物 | C-02 での利用 |
|---|---|---|
| B-01 | `bud_salary_records` | 年間総支給額・源泉徴収税額の集計 |
| B-02 | 社保・源泉計算 | 年間社保料合計 |
| B-03 | @react-pdf/renderer 基盤 | PDF コンポーネント流用 |
| B-04 | 振込パターン | 給与振込実績との照合 |
| B-05 | 賞与処理 | 賞与分の源泉徴収含め集計 |

### 2.2 C-01 との接続

- `bud_nenmatsu_chousei.status = 'finalized'` 到達後にのみ発行可能
- 扶養控除・保険料控除等の**確定済データ**を使用

### 2.3 源泉徴収票の様式

- **国税庁令和 X 年分 給与所得の源泉徴収票**の A6 2 枚組様式に準拠
- 1 枚目: 受給者交付用
- 2 枚目: 税務署提出用
- 3 枚目: 市区町村提出用（給与支払報告書）

---

## 3. データモデル

### 3.1 `bud_gensen_choshu`

```sql
CREATE TABLE bud_gensen_choshu (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本キー
  fiscal_year           int NOT NULL,
  employee_id           text NOT NULL REFERENCES root_employees(employee_number),
  chousei_id            uuid REFERENCES bud_nenmatsu_chousei(id),  -- C-01 への参照
  CONSTRAINT uniq_gensen UNIQUE (fiscal_year, employee_id),

  -- 受給者情報（発行時点のスナップショット）
  recipient_name        text NOT NULL,
  recipient_name_furigana text,
  recipient_address     text NOT NULL,
  recipient_postcode    text,
  recipient_my_number   text,   -- 暗号化必須（§5 参照）

  -- 支払者情報（自社）
  payer_name            text NOT NULL DEFAULT 'センターライズ株式会社',
  payer_address         text NOT NULL,
  payer_corporate_number text,

  -- 金額集計（C-01 からの転記 + B-0X からの集計）
  gross_salary_total    bigint NOT NULL CHECK (gross_salary_total >= 0),
  salary_income         bigint NOT NULL,  -- 給与所得控除後の金額
  income_deduction_total bigint NOT NULL,
  withholding_tax_final bigint NOT NULL,
  social_insurance_total bigint NOT NULL,

  -- 扶養情報（C-01 からの転記）
  spouse_deduction      bigint NOT NULL DEFAULT 0,
  dependents_count_specific int NOT NULL DEFAULT 0,
  dependents_count_elderly  int NOT NULL DEFAULT 0,
  dependents_count_other    int NOT NULL DEFAULT 0,

  -- 保険料控除
  life_insurance_deduction     bigint NOT NULL DEFAULT 0,
  pension_insurance_deduction  bigint NOT NULL DEFAULT 0,
  earthquake_insurance_deduction bigint NOT NULL DEFAULT 0,
  house_loan_deduction         bigint NOT NULL DEFAULT 0,

  -- 発行状態
  status                text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'reissued', 'voided')),
  issued_at             timestamptz,
  issued_by             text REFERENCES root_employees(employee_number),
  pdf_storage_key       text,
  pdf_sha256            text,   -- 改ざん検知

  -- 再発行管理
  reissue_count         int NOT NULL DEFAULT 0 CHECK (reissue_count <= 5),
  reissue_reason        text,

  -- 配信状態
  delivered_to_employee boolean NOT NULL DEFAULT false,
  delivered_at          timestamptz,
  viewed_by_employee    boolean NOT NULL DEFAULT false,
  viewed_at             timestamptz,

  -- メタ
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX idx_bgc_year_employee ON bud_gensen_choshu (fiscal_year, employee_id);
CREATE INDEX idx_bgc_status ON bud_gensen_choshu (status, fiscal_year DESC);
CREATE INDEX idx_bgc_undelivered ON bud_gensen_choshu (fiscal_year)
  WHERE delivered_to_employee = false AND deleted_at IS NULL;
```

### 3.2 Storage bucket `bud-gensen-pdf`

```
bud-gensen-pdf/
├── {fiscal_year}/
│   ├── {employee_id}/
│   │   ├── gensen_choshu_v1_20270115.pdf
│   │   ├── gensen_choshu_v2_20270220.pdf  ← 再発行
│   │   └── ...
```

### 3.3 My Number 暗号化

マイナンバー（`recipient_my_number`）は **PostgreSQL pgcrypto 拡張**で暗号化：

```sql
-- 保存時
UPDATE bud_gensen_choshu
SET recipient_my_number = pgp_sym_encrypt('1234-5678-9012', :app_secret)
WHERE id = ...;

-- 読み取り時
SELECT pgp_sym_decrypt(recipient_my_number::bytea, :app_secret) AS my_number
FROM bud_gensen_choshu ...;
```

- シークレットは Vercel 環境変数 `BUD_MYNUMBER_SECRET`（本番 / dev 別）
- admin+ 専用関数 `get_my_number(gensen_id)` 経由でのみ復号

---

## 4. 集計ロジック

### 4.1 年間集計関数

```sql
CREATE OR REPLACE FUNCTION bud_aggregate_annual_salary(
  p_year int, p_employee_id text
) RETURNS TABLE (
  gross_total bigint,
  withholding_total bigint,
  social_insurance_total bigint,
  bonus_total bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(gross_salary), 0)::bigint,
    COALESCE(SUM(withholding_tax), 0)::bigint,
    COALESCE(SUM(social_insurance), 0)::bigint,
    COALESCE(SUM(bonus_amount), 0)::bigint
  FROM bud_salary_records
  WHERE fiscal_year = p_year
    AND employee_id = p_employee_id
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 前職給与合算

- `bud_nenmatsu_chousei.prev_job_gross_salary` / `prev_job_withholding_tax` を加算
- 中途入社者の正確な年間所得を算出

### 4.3 給与所得控除額

国税庁の給与所得控除額表に基づく計算（令和 2 年改正後）:

| 年間給与収入 | 給与所得控除額 |
|---|---|
| ～ 162.5 万円 | 55 万円（最低保証） |
| 162.5 万～ 180 万 | 収入 × 40% - 10 万円 |
| 180 万～ 360 万 | 収入 × 30% + 8 万円 |
| 360 万～ 660 万 | 収入 × 20% + 44 万円 |
| 660 万～ 850 万 | 収入 × 10% + 110 万円 |
| 850 万超 | 195 万円（上限） |

- マスタテーブル `bud_tax_salary_deduction` に保持（法改正対応容易化）

---

## 5. PDF 生成

### 5.1 @react-pdf/renderer 使用

Batch 6 B-03 のパターンを踏襲：

```tsx
// src/app/bud/_components/pdfs/GensenChoshuDocument.tsx
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({ family: 'Noto Sans JP', src: '/fonts/NotoSansJP-Regular.ttf' });

export function GensenChoshuDocument({ data }: { data: GensenChoshuData }) {
  return (
    <Document>
      <Page size="A6" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text>令和{data.japaneseYear}年分 給与所得の源泉徴収票</Text>
        </View>
        {/* ... */}
      </Page>
    </Document>
  );
}
```

### 5.2 Server Action で生成

```ts
// src/app/bud/_actions/issueGensenChoshu.ts
'use server';

export async function issueGensenChoshu(gensen_id: string) {
  const data = await loadData(gensen_id);
  const pdf = await renderToBuffer(<GensenChoshuDocument data={data} />);
  const storageKey = `${data.fiscal_year}/${data.employee_id}/gensen_choshu_v${data.reissue_count + 1}_${formatDate()}.pdf`;
  await supabase.storage.from('bud-gensen-pdf').upload(storageKey, pdf);

  const hash = await sha256(pdf);
  await supabase.from('bud_gensen_choshu').update({
    status: 'issued',
    issued_at: new Date(),
    pdf_storage_key: storageKey,
    pdf_sha256: hash,
  }).eq('id', gensen_id);

  // 監査
  await auditLog({ event: 'bud.gensen.issue', gensen_id, sha256: hash });

  return { ok: true, storageKey };
}
```

### 5.3 帳票仕様（国税庁準拠）

- 用紙: A6 ヨコ（105×148mm、1/4 A4）
- 文字: Noto Sans JP、10pt ベース、ヘッダ 12pt
- レイアウト: 国税庁公式 XML スキーマの座標系に準拠
- 金額: 3 桁カンマ区切り、¥ 記号なし（税務書式慣習）

---

## 6. 配信方式（案 D 準拠）

### 6.1 Garden マイページ経由

```
従業員ログイン
  ↓
/bud/my-page にアクセス
  ↓
「令和 X 年分 源泉徴収票 発行済」の通知カード
  ↓
クリック → 署名 URL 発行（60 秒有効）→ PDF 表示 / DL
  ↓
`viewed_at` 記録
```

### 6.2 Chatwork 通知（案 D）

```
【事務局】システム自動通知 様

令和 X 年分 源泉徴収票が発行されました。
Garden にログインしてご確認ください。

https://garden.hyuaran.com/bud/my-page

※ 添付ファイル・署名 URL はありません。ログイン必須です。
```

### 6.3 署名 URL 発行

- 本文流通禁止（案 D）
- ダウンロード時にのみ `createSignedUrl(key, 60)` で 60 秒有効
- 有効期限内でも 1 度 DL したら再発行必要（監査性）

### 6.4 未閲覧フォロー

- 発行から 7 日閲覧なし → リマインダー Chatwork 通知
- 発行から 30 日閲覧なし → 事務チームに admin 通知

---

## 7. 再発行フロー

### 7.1 再発行理由

| 理由コード | 説明 |
|---|---|
| `correction` | 金額訂正（計算誤り発覚）|
| `name_change` | 氏名・住所変更 |
| `lost` | 紛失 |
| `additional_income` | 他所得発覚（前職給与等）|
| `other` | その他 |

### 7.2 制限

- 最大 **5 回**まで（DB CHECK 制約）
- admin+ のみが再発行承認可能
- 再発行時は旧 PDF を voided 扱い、新 PDF を発行
- 旧 PDF は Storage に残す（税務調査対応）

### 7.3 UI フロー（C-05 で詳述）

```
一覧 → 従業員選択 → 「再発行」押下
  ↓
再発行モーダル（理由選択 + 備考入力）
  ↓
admin 承認待ち
  ↓
admin 承認 → 新 PDF 生成 + 旧 voided
  ↓
Chatwork 通知 → マイページで DL
```

---

## 8. 税務署提出用データ

### 8.1 Phase C-1 は CSV 出力のみ

- CSV 形式（UTF-8 + BOM、Excel 互換）
- フィールド: 氏名 / マイナンバー（復号）/ 年間給与 / 源泉税 / ...
- 税理士事務所に提出（CSV → 税理士が e-Tax にアップロード）

### 8.2 Phase C-2 以降で e-Tax XML 直接提出

- 国税庁 e-Tax 公式 XML スキーマ（`http://xml.e-tax.nta.go.jp/.../`）
- 詳細は C-04 で策定（法定調書合計表と同じ XML パッケージ）

### 8.3 CSV フォーマット例

```
employee_number,name,my_number,gross_salary,withholding_tax,...
0001,山田太郎,1234-5678-9012,4800000,180000,...
0002,佐藤花子,2345-6789-0123,5200000,210000,...
```

---

## 9. RLS ポリシー

### 9.1 `bud_gensen_choshu`

```sql
ALTER TABLE bud_gensen_choshu ENABLE ROW LEVEL SECURITY;

-- 本人: 自分の源泉徴収票のみ SELECT
CREATE POLICY bgc_select_self ON bud_gensen_choshu FOR SELECT
  USING (employee_id = auth_employee_number());

-- staff+: 全件 SELECT（マイナンバー除く、VIEW 経由で取得）
CREATE POLICY bgc_select_staff ON bud_gensen_choshu FOR SELECT
  USING (has_role_at_least('staff'));

-- admin+ のみ: INSERT / UPDATE / マイナンバー復号
CREATE POLICY bgc_all_admin ON bud_gensen_choshu FOR ALL
  USING (has_role_at_least('admin'))
  WITH CHECK (has_role_at_least('admin'));
```

### 9.2 マイナンバー復号は admin+ 関数経由

```sql
CREATE OR REPLACE FUNCTION get_my_number(gensen_id uuid)
RETURNS text AS $$
DECLARE v_mynumber text;
BEGIN
  IF NOT has_role_at_least('admin') THEN
    RAISE EXCEPTION 'Only admin can access my_number';
  END IF;
  SELECT pgp_sym_decrypt(recipient_my_number::bytea, current_setting('app.mynumber_secret'))
  INTO v_mynumber FROM bud_gensen_choshu WHERE id = gensen_id;

  -- 復号のたびに監査
  INSERT INTO audit_logs (event_type, actor, data)
  VALUES ('bud.gensen.mynumber.decrypt', auth_employee_number(),
          jsonb_build_object('gensen_id', gensen_id));

  RETURN v_mynumber;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 10. 実装ステップ

1. **Step 1**: `bud_gensen_choshu` migration + RLS + pgcrypto 拡張（1.5h）
2. **Step 2**: 集計関数 `bud_aggregate_annual_salary` + マスタ `bud_tax_salary_deduction`（1h）
3. **Step 3**: `GensenChoshuDocument.tsx` PDF コンポーネント（A6 2 枚組、@react-pdf）（2h）
4. **Step 4**: Server Action `issueGensenChoshu` + Storage upload + hash 計算（1h）
5. **Step 5**: Garden マイページ表示 + 署名 URL 60s + 閲覧記録（1h）
6. **Step 6**: Chatwork 通知（案 D、URL 不流通）+ 未閲覧リマインダー Cron（0.5h）
7. **Step 7**: 再発行フロー（モーダル + admin 承認 + 旧 void）（0.5h）
8. **Step 8**: 結合テスト・バグ修正（0.5h）

**合計**: 約 **0.6d**（約 8h）

---

## 11. パフォーマンス

| 指標 | 目標 |
|---|---|
| 1 人分 PDF 生成 | < 2s |
| 100 人分一括生成（順次）| < 5min |
| 100 人分並列生成（10 並列）| < 1min |
| マイページ表示 | < 500ms |
| 署名 URL 発行 | < 200ms |

---

## 12. テスト観点（詳細 C-06）

- 金額集計の正確性（月次 12 回 + 賞与の合算）
- 前職給与合算（中途入社の境界）
- 住宅ローン控除 2 年目以降の計算
- マイナンバー暗号化・復号（admin+ 権限のみ）
- PDF の改ざん検知（sha256 保存 / 比較）
- 再発行 5 回上限
- Chatwork 通知の URL 不流通検証（案 D）
- 署名 URL 60s 超過で AccessDenied
- RLS: 本人以外の PDF 取得拒否
- Storage: 他人フォルダへのアクセス拒否

---

## 13. 判断保留事項

- **判1: マイナンバー暗号化方式**
  - pgcrypto / Vault 外部連携 / アプリ層 AES-256
  - **推定スタンス**: pgcrypto（Supabase 拡張で即使える、運用軽）
- **判2: PDF 署名（改ざん防止）**
  - sha256 のみ保存 / PDF 電子署名（タイムスタンプ）
  - **推定スタンス**: sha256 保存、Phase C-2 で電子署名検討
- **判3: A6 様式 vs A4 様式**
  - 国税庁は A6 が正式、A4 で見やすさ優先もあり
  - **推定スタンス**: 正式は A6、従業員交付用に A4 版も提供（2 種発行）
- **判4: 再発行上限の値**
  - 5 回 / 10 回 / 無制限
  - **推定スタンス**: 5 回で admin unlock 必須、不正防止
- **判5: 未閲覧リマインダー頻度**
  - 7 日・14 日・30 日 / 3 回 / 1 回
  - **推定スタンス**: 7 日（従業員）→ 30 日（管理者）の 2 段階
- **判6: Chatwork 通知文言**
  - 絵文字使用 / プレーン / 定型文
  - **推定スタンス**: プレーン（税務関連は堅実に、絵文字不使用）
- **判7: 紙交付の廃止**
  - 完全電子化 / 紙併用
  - **推定スタンス**: 完全電子化（環境配慮・業務効率、ただし希望者には admin 個別対応で紙発行可）

---

## 14. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| テーブル + RLS + pgcrypto 暗号化 | 1.5h |
| 集計関数・マスタ | 1.0h |
| PDF コンポーネント（@react-pdf）| 2.0h |
| Server Action + Storage + hash | 1.0h |
| マイページ + 署名 URL + 閲覧記録 | 1.0h |
| Chatwork 通知 + リマインダー | 0.5h |
| 再発行フロー + admin 承認 | 0.5h |
| 結合テスト | 0.5h |
| **合計** | **0.6d**（約 8h）|

---

— spec-bud-phase-c-02 end —
