# Bud B-03: 給与明細生成（PDF 発行 + Tree マイページ配信）仕様書

- 対象: Garden-Bud 給与明細の PDF 生成・保管・Tree マイページ配信
- 見積: **0.5d**（約 4 時間）
- 担当セッション: a-bud
- 作成: 2026-04-24（a-auto / Phase A 先行 batch6 #B-03）
- 前提 spec: B-01（給与計算エンジン）, B-02（社保・源泉）
- **A-07 採択結果反映 (2026-04-25)**:
  - 配信は **A 案 + メール送信 拡張採択**: Tree マイページ全員閲覧 **+** メール配信
  - メール配信方式 = **方式 2 パスワード保護 PDF 添付**
  - PW = 生年月日 4 桁（MMDD）or 社員番号下 4 桁（実装時に最終決定）
  - 重要前提: Garden ログイン社内 PC 限定 → メール配信が自宅確認の唯一経路（Root Phase B-5 連携）
  - 新規テーブル提案: `bud_salary_pdf_deliveries`（A-07 spec §4.5 参照）
  - 実装ヒント: `@react-pdf/renderer`（既存）+ `bcryptjs`/`pdf-lib`（PW 保護、追加要）+ Resend/SendGrid（メール、要相談）
  - 詳細: `docs/bud-a07-hearing-items.md` §「東海林判断: 採択結果」§「論点 3 の拡張採択」

---

## 1. 目的とスコープ

### 目的
B-01/B-02 で確定した `bud_salary_records` から**個別従業員向け給与明細 PDF**を生成し、Tree マイページでの閲覧・ダウンロードを可能にする。MF クラウド給与の明細発行機能を**Garden で完全代替**する。

### 含める
- 給与明細 PDF テンプレート（A4 1 枚 / 勤怠・支給・控除・差引）
- 明細一括生成バッチ（月次、全従業員）
- Supabase Storage `bud-salary-statements/` 格納
- Tree マイページでの閲覧・DL UI 指示（本実装は Tree 側だが、API 契約を定義）
- 手渡し現金受給者向けの扱い（A-07 論点 3 と連動）
- 「明細発行」の status 遷移（draft → calculated → **confirmed** → paid）

### 含めない
- 本文以外の PDF レイアウト詳細（デザイン要件は段階調整）
- 配信メール通知（マイページで閲覧する前提、メール通知は Phase C）
- 複数月まとめた年間明細（Phase C、年末調整時）
- 源泉徴収票（年次、Phase C）

---

## 2. 既存実装との関係

### Phase 0 / A-1 成果物
- 既存 PDF 生成ライブラリ: Forest 側で `@react-pdf/renderer` 利用実績あり（`feature/bloom-workboard-20260424` 等で実装済）→ **同ライブラリを Bud でも採用**

### Batch 2-4 Forest 関連
- T-F6-03 Download ZIP Edge Function — 同パターンで PDF 生成 Edge Function を構築

### B-01 / B-02 との接続
- 入力: `bud_salary_records.status='confirmed'` のレコード
- 本 spec で **'confirmed' → 'paid' 遷移時**に PDF 生成・保管

---

## 3. 依存関係

```mermaid
flowchart TB
    A[bud_salary_records<br/>status=confirmed] --> B[PDF 生成 Edge Function]
    B --> C[@react-pdf/renderer<br/>React Component]
    C --> D[PDF Buffer]
    D --> E[Supabase Storage<br/>bud-salary-statements/]
    E --> F[bud_salary_statements<br/>メタデータ]

    F --> G[Tree マイページ<br/>本人閲覧 UI]
    F --> H[admin 一覧画面<br/>全体発行状況]
    F --> I[Chatwork DM 通知<br/>本人宛]
```

---

## 4. データモデル提案

### 4.1 `bud_salary_statements` — 発行済明細のメタデータ

```sql
CREATE TABLE bud_salary_statements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id    uuid NOT NULL REFERENCES bud_salary_records(id) ON DELETE CASCADE,
  employee_id         text NOT NULL REFERENCES root_employees(employee_id),
  target_month        date NOT NULL,            -- B-01 と同じ

  -- PDF 格納情報
  storage_path        text NOT NULL,            -- Storage 内パス
  file_size_bytes     bigint NOT NULL,
  pdf_version         text NOT NULL,            -- テンプレバージョン（例: 'v1.0'）

  -- 発行状況
  issued_at           timestamptz NOT NULL DEFAULT now(),
  issued_by           uuid NOT NULL REFERENCES auth.users(id),

  -- 閲覧・DL トラッキング
  first_viewed_at     timestamptz,              -- 本人初回閲覧時刻
  last_viewed_at      timestamptz,
  view_count          int NOT NULL DEFAULT 0,
  first_downloaded_at timestamptz,
  download_count      int NOT NULL DEFAULT 0,

  -- 発行メタ
  is_superseded       boolean NOT NULL DEFAULT false,    -- 再発行時に旧版を true に
  superseded_by       uuid REFERENCES bud_salary_statements(id),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_bud_salary_statement_current
    UNIQUE (salary_record_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX bud_salary_statements_employee_month_idx
  ON bud_salary_statements (employee_id, target_month DESC);
CREATE INDEX bud_salary_statements_issued_idx
  ON bud_salary_statements (issued_at DESC);
```

### 4.2 Storage bucket

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bud-salary-statements', 'bud-salary-statements', false, 2097152,  -- 2MB
  ARRAY['application/pdf'])
ON CONFLICT DO NOTHING;

-- RLS: 本人のみ自分の明細 read、admin は全員 read/write
CREATE POLICY bss_read_self ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bud-salary-statements'
    AND (storage.foldername(name))[1] = (
      SELECT employee_id FROM root_employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY bss_read_admin ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bud-salary-statements'
    AND (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
        IN ('admin', 'super_admin')
  );

CREATE POLICY bss_insert_admin ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bud-salary-statements'
    AND (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
        IN ('admin', 'super_admin')
  );
```

### 4.3 RLS for `bud_salary_statements`

```sql
ALTER TABLE bud_salary_statements ENABLE ROW LEVEL SECURITY;

-- 本人 read
CREATE POLICY bss_select_self ON bud_salary_statements FOR SELECT
  USING (
    employee_id = (SELECT employee_id FROM root_employees WHERE user_id = auth.uid())
  );

-- admin read/write
CREATE POLICY bss_rw_admin ON bud_salary_statements FOR ALL
  USING ((SELECT garden_role FROM root_employees WHERE user_id = auth.uid()) IN ('admin','super_admin'))
  WITH CHECK ((SELECT garden_role FROM root_employees WHERE user_id = auth.uid()) IN ('admin','super_admin'));

-- 閲覧・DL カウンタは本人のみ UPDATE 可（UPDATE トリガで制限推奨）
-- Phase B は trust client、Phase C で RPC 経由に強化
```

---

## 5. PDF テンプレート設計

### 5.1 React コンポーネント構造（`@react-pdf/renderer`）

```tsx
// src/app/bud/_lib/pdf/SalaryStatementPdf.tsx
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({ family: 'NotoSansJP', src: '/fonts/NotoSansJP-Regular.ttf' });

type Props = {
  record: BudSalaryRecord;
  employee: RootEmployee;
  company: RootCompany;
};

export function SalaryStatementPdf({ record, employee, company }: Props) {
  return (
    <Document title={`給与明細_${employee.name}_${record.target_month}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>給　与　明　細　書</Text>
          <Text style={styles.subtitle}>{`${company.company_name}`}</Text>
          <Text style={styles.period}>
            {`支給対象期間: ${formatMonthRange(record.target_month)}`}
          </Text>
        </View>

        <View style={styles.employeeInfo}>
          <Text>{`社員番号: ${employee.employee_number}`}</Text>
          <Text>{`氏名: ${employee.name} 様`}</Text>
          <Text>{`雇用形態: ${record.employment_type}`}</Text>
        </View>

        {/* 勤怠 */}
        <SectionTitle title="勤怠" />
        <KintaiTable record={record} />

        {/* 支給 */}
        <SectionTitle title="支給" />
        <AllowanceTable record={record} />

        {/* 控除 */}
        <SectionTitle title="控除" />
        <DeductionTable record={record} />

        {/* 差引支給額 */}
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>差引支給額</Text>
          <Text style={styles.totalValue}>{fmtYen(record.net_pay)}</Text>
        </View>

        <View style={styles.footer}>
          <Text>{`発行日: ${formatDate(new Date())}`}</Text>
          <Text>{`発行: ${company.company_name}`}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

### 5.2 レイアウト要件

| セクション | 内容 |
|---|---|
| ヘッダー | タイトル / 法人名 / 支給対象期間 |
| 従業員情報 | 社員番号 / 氏名 / 雇用形態 |
| 勤怠 | 勤務日数 / 総労働時間 / 残業時間 / 深夜時間 / 休日労働 / 遅刻早退 / 欠勤 / 有休取得 |
| 支給 | 基本給 / 残業手当 / 深夜手当 / 休日手当 / 通勤手当 / 役職手当 / その他手当（列挙）/ **総支給額** |
| 控除 | 健康保険 / 厚生年金 / 雇用保険 / 所得税 / 住民税 / その他控除（列挙）/ **控除合計** |
| 差引支給額 | 目立つボックスで表示 |
| フッター | 発行日 / 発行元 |

### 5.3 Storage パス規則

```
bud-salary-statements/{employee_id}/{target_month(YYYY-MM)}.pdf
例: bud-salary-statements/EMP-0008/2026-05.pdf
```

再発行時は `_v2.pdf` / `_v3.pdf` と連番、最新版のメタデータで `is_superseded=true` / `superseded_by` セット。

---

## 6. API / Server Action 契約

### 6.1 単体発行
```typescript
export async function issueSalaryStatement(input: {
  salaryRecordId: string;
  force?: boolean;             // 既に発行済でも再発行
  reissueReason?: string;      // force=true 時は必須
}): Promise<{
  success: boolean;
  statementId?: string;
  pdfUrl?: string;             // signedURL（1h 有効）
  error?: string;
}>;
```

### 6.2 月次一括発行
```typescript
export async function issueBatchStatements(input: {
  targetMonth: string;         // YYYY-MM-DD（月初）
  notifyChatwork?: boolean;    // 本人 DM 通知
}): Promise<{
  batchId: string;
  issued: number;
  skipped: number;             // 既発行
  failed: Array<{ employeeId: string; error: string }>;
}>;
```

### 6.3 本人閲覧用 URL 取得
```typescript
// Tree マイページから呼出
export async function getMyStatementUrl(input: {
  targetMonth: string;
}): Promise<{
  success: boolean;
  signedUrl?: string;          // 10 分有効
  statementId?: string;
  error?: string;
}>;
// 内部で view_count / first_viewed_at / last_viewed_at を UPDATE
```

### 6.4 閲覧履歴取得（admin）
```typescript
export async function getStatementViewLog(input: {
  targetMonth: string;
  companyIds?: string[];
}): Promise<Array<{
  employeeId: string;
  employeeName: string;
  isIssued: boolean;
  isViewed: boolean;
  viewCount: number;
  lastViewedAt: string | null;
}>>;
```

---

## 7. 状態遷移

### `bud_salary_records.status` と本 spec の関係

```
calculated（B-01 完了）
  ↓ [明細確定ボタン、admin]
confirmed  ←─ ここで本 spec の PDF 生成がトリガ
  ↓ [B-04 振込完了マーク]
paid
```

**明細確定ボタン押下 = Bud 画面で「発行」ボタン**。押下時:
1. PDF 生成 → Storage 保存
2. `bud_salary_statements` INSERT
3. `bud_salary_records.status = 'confirmed'` に UPDATE
4. Chatwork 本人 DM（オプション）

再発行は `force=true` で旧版 superseded、新版発行。

---

## 8. Chatwork 通知

### 8.1 個別 DM（本人宛）
- **トリガ**: `issueBatchStatements({ notifyChatwork: true })`
- **通知先**: `root_employees.chatwork_account_id`（Phase B で追加想定カラム）
- **内容**:
  ```
  [Garden-Bud] 2026-05 給与明細が発行されました
  https://garden.app/tree/mypage/salary/2026-05
  ※ 10 分間有効な個人 URL です、他人に共有しないでください
  ```
- **タイミング**: 発行成功直後

### 8.2 Public チャネル投稿は禁止
給与情報は公開チャネルに投稿しない。**必ず DM のみ**。これは `src/lib/chatwork/client.ts` の `sendMessage()` の呼出時に room_id が DM ルームか検証（Phase B v2、運用で徹底）。

### 8.3 発行完了サマリ（admin 宛）
- **通知先**: 東海林さん + 経理担当 DM
- **内容**: `[Garden-Bud] 2026-05 給与明細発行: 成功 X 件 / 失敗 Y 件 / 既発行スキップ Z 件`
- **タイミング**: 一括発行完了直後

---

## 9. 監査ログ要件

- `bud_salary_statements.issued_at` / `issued_by` で発行履歴追跡
- 再発行は旧版を `is_superseded=true` で物理保持、新版を INSERT
- 閲覧ログ（`view_count` / `first_viewed_at`）は本人利便性 + 監査両用
- `root_audit_log` への併記は再発行時のみ（通常発行は bud_salary_statements で十分）

---

## 10. バリデーション規則

| # | ルール | 違反時 |
|---|---|---|
| V1 | `bud_salary_records.status = 'calculated'` or `'confirmed'` | エラー、draft は発行不可 |
| V2 | `net_pay ≥ 0` | エラー、負値はあり得ない |
| V3 | 既発行で force=false | skip、既発行の signedURL 返却 |
| V4 | force=true で reissueReason 空 | エラー |
| V5 | PDF 生成失敗（フォント欠損等）| エラー、admin アラート、1 時間後自動再試行 |
| V6 | Storage upload 失敗 | エラー、DB INSERT ロールバック |
| V7 | `employee_id` が存在しない | エラー |
| V8 | 退職者の明細発行 | 警告表示するが発行可（退職月分の発行）|

---

## 11. 受入基準

1. ✅ `bud_salary_statements` + Storage bucket + RLS 投入
2. ✅ `SalaryStatementPdf` React コンポーネント実装、ダミーデータで PDF 生成可
3. ✅ 日本語フォント埋込成功（NotoSansJP）
4. ✅ 正社員 / アルバイト両方で明細が正しく生成
5. ✅ 個別発行 API が動作、signedURL が返却
6. ✅ 一括発行が月次で動作、成功/失敗件数が正確
7. ✅ Tree マイページからの閲覧（Tree 側の実装連携、API 契約のみ本 spec で担保）
8. ✅ 閲覧カウンタが UPDATE される
9. ✅ 再発行で旧版が superseded、新版が発行される
10. ✅ Chatwork 個別 DM が動作（DM ルーム検証含む）
11. ✅ 手渡し現金受給者も明細 PDF は同等に発行される（A-07 判3=A 案準拠）

---

## 12. 想定工数（内訳）

| # | 作業 | 工数 |
|---|---|---|
| W1 | migration + Storage bucket + RLS | 0.05d |
| W2 | SalaryStatementPdf コンポーネント実装 | 0.15d |
| W3 | 日本語フォント埋込 + PDF レイアウト調整 | 0.05d |
| W4 | Edge Function（PDF 生成 + Storage upload）| 0.1d |
| W5 | `issueSalaryStatement` + `issueBatchStatements` Server Action | 0.05d |
| W6 | `getMyStatementUrl` + 閲覧カウンタ | 0.05d |
| W7 | Chatwork DM 連携（DM ルーム検証含む）| 0.05d |
| W8 | admin 向け発行一覧画面 | - (別 spec 候補)|
| **合計** | | **0.5d** |

---

## 13. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | PDF テンプレートのデザイン調整頻度 | MF クラウド給与互換の標準形を v1、カスタマイズは Phase C |
| 判2 | 手渡し現金受給者の扱い（A-07 判3）| **全員 Garden Tree マイページで閲覧**、紙同梱は Phase C オプション |
| 判3 | 明細の保存期間 | **永続**（税法上 7 年必要、Storage コストは許容）|
| 判4 | 閲覧メトリクスの粒度 | 初回閲覧と最終閲覧のみ（全閲覧ログは過剰）|
| 判5 | 再発行時の本人通知 | **通知する**（デフォルト ON、admin が抑止可）|
| 判6 | Tree マイページ UI 実装時期 | Phase D（Tree モジュール）と並行、本 spec は API 契約のみ |
| 判7 | 英語版 PDF（外国人従業員向け）| Phase C、現状は日本語のみ |
| 判8 | PDF ハッシュ（改ざん検出）| Phase C、セキュリティ強化時に `sha256` 列追加 |
| 判9 | ダウンロード URL の有効期限 | **10 分**（B-03 §6.3）、DL 中に切れる可能性は再発行で対応 |

---

## 14. Phase C 以降への繰越事項

- メール通知連携（マイページに来ない従業員向け）
- 年間明細（1-12 月まとめ、年末調整タイミング）
- 源泉徴収票の自動生成
- PDF 署名（電子署名・タイムスタンプ）
- 過去明細の一括 ZIP ダウンロード（退職者向け）

— end of B-03 spec —
