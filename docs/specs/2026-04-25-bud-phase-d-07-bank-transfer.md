# Bud Phase D #07: 銀行振込連携（Bud A-04 振込フォームへの自動連携）

- 対象: Garden-Bud Phase D 給与・賞与の銀行振込実行（Phase A-04 連携）
- 優先度: **🔴 最高**（金銭フロー、ミスは即多額の損害）
- 見積: **1.0d**（連携 + 振込 FB データ生成 + 承認フロー）
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #07）
- 前提:
  - **Bud Phase A-04 振込作成フォーム**（既存）
  - **Bud Phase A-05 振込承認フロー**（既存）
  - **Bud Phase B-04 給与振込フロー**（設計済、本 spec で実装着手）
  - **Bud Phase D-02 / D-03**（給与・賞与結果）
  - 全銀協フォーマット（FB データ）

---

## 1. 目的とスコープ

### 1.1 目的

`bud_salary_records` / `bud_bonus_records` で確定した給与・賞与を、Phase A-04 で稼働中の**振込フォームへ自動連携**して銀行振込を実行する。複数法人 × 複数銀行に対応し、全銀協 FB データを生成して銀行アップロード、または個別振込の一括登録を行う。

### 1.2 含めるもの

- 給与・賞与 → 振込データ生成
- 全銀協 FB データ（総合振込）の出力
- Bud A-04 振込フォームへの自動エントリ
- 振込実行後の paid 状態反映
- 失敗時のロールバック
- 月末 25 日支給等の定型スケジュール

### 1.3 含めないもの

- 振込フォーム UI 自体 → A-04（既存）
- 承認フロー → A-05（既存）
- 給与計算 → D-02
- 賞与計算 → D-03
- 明細配信 → D-04

---

## 2. 振込パターン

### 2.1 振込種別

| 種別 | 件数 | 方式 |
|---|---|---|
| 給与振込（同一銀行内）| 1-30 件 | 個別振込（手数料安）|
| 給与振込（他行）| 1-30 件 | 個別振込 or 総合振込 |
| 給与振込（多人数）| 30+ 件 | **全銀協 FB データ**（総合振込）|
| 賞与振込 | 同上 | 同上 |

### 2.2 銀行口座マスタ

```sql
-- 既存（Phase A）
-- bud_company_bank_accounts: 法人の振込元口座
-- root_employees.bank_account_*: 従業員の振込先口座
```

D-02 / D-03 完了時点で振込先情報は既に揃っている前提。

---

## 3. 連携テーブル

### 3.1 `bud_payroll_transfer_batches`（給与振込バッチ）

```sql
CREATE TABLE public.bud_payroll_transfer_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL REFERENCES public.bud_payroll_periods(id),
  company_id uuid NOT NULL REFERENCES public.root_companies(id),
  source_bank_account_id uuid NOT NULL REFERENCES public.bud_company_bank_accounts(id),
  transfer_type text NOT NULL,                  -- 'salary' | 'bonus'
  scheduled_payment_date date NOT NULL,
  total_employees int NOT NULL,
  total_amount numeric(14, 0) NOT NULL,
  fb_data_path text,                            -- 全銀協 FB データの Storage パス
  status text NOT NULL DEFAULT 'draft',
    -- 'draft' | 'approved' | 'fb_generated' | 'uploaded_to_bank' | 'completed' | 'failed'
  approved_at timestamptz,
  approved_by uuid,
  fb_generated_at timestamptz,
  bank_uploaded_at timestamptz,
  completed_at timestamptz,
  failed_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,

  deleted_at timestamptz,
  deleted_by uuid,

  UNIQUE (payroll_period_id, company_id, transfer_type)
);
```

### 3.2 `bud_payroll_transfer_items`（個別明細）

```sql
CREATE TABLE public.bud_payroll_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.bud_payroll_transfer_batches(id) ON DELETE CASCADE,
  salary_record_id uuid REFERENCES public.bud_salary_records(id),
  bonus_record_id uuid REFERENCES public.bud_bonus_records(id),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),

  -- 振込情報スナップショット（A-04 連携用）
  recipient_bank_code text NOT NULL,
  recipient_branch_code text NOT NULL,
  recipient_account_type text NOT NULL,         -- '普通' | '当座'
  recipient_account_number text NOT NULL,
  recipient_account_holder text NOT NULL,       -- カナ

  -- 金額
  transfer_amount numeric(12, 0) NOT NULL,

  -- A-04 振込連携
  bud_furikomi_id uuid REFERENCES public.bud_furikomi(id),  -- 個別振込の場合
  fb_record_no int,                             -- FB データ内の連番

  -- 状態
  item_status text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'submitted' | 'completed' | 'failed' | 'rejected'
  failed_reason text,

  CHECK (
    (salary_record_id IS NOT NULL AND bonus_record_id IS NULL)
    OR (salary_record_id IS NULL AND bonus_record_id IS NOT NULL)
  )
);

CREATE INDEX idx_transfer_items_batch ON bud_payroll_transfer_items (batch_id);
```

---

## 4. 連携フロー（給与）

### 4.1 全体図

```
1. period.status = 'approved'（給与計算 + 承認完了）
2. /api/bud/payroll/prepare-transfer 実行
   - bud_payroll_transfer_batches 作成
   - bud_payroll_transfer_items を salary_records から作成
3. admin が振込内容確認 → status='approved'
4. 振込方式判定:
   - 30 件未満 + 単一銀行 → A-04 個別振込連携
   - 30+ 件 or 多銀行 → FB データ生成
5. 振込実行
6. status='completed'
7. salary_records.status='paid' 反映 + Chatwork 通知
```

### 4.2 prepare-transfer 関数

```typescript
async function prepareTransfer(
  payrollPeriodId: string,
  companyId: string,
  transferType: 'salary' | 'bonus'
): Promise<{ batchId: string; totalAmount: number }> {
  // 1. 該当 period の全 records を取得（status='approved'）
  const records = await fetchApprovedRecords(payrollPeriodId, companyId, transferType);

  // 2. batch 作成
  const batch = await supabase.from('bud_payroll_transfer_batches').insert({
    payroll_period_id: payrollPeriodId,
    company_id: companyId,
    source_bank_account_id: await fetchPrimaryBankAccount(companyId),
    transfer_type: transferType,
    scheduled_payment_date: await fetchPaymentDate(payrollPeriodId),
    total_employees: records.length,
    total_amount: records.reduce((s, r) => s + r.net_pay, 0),
    status: 'draft',
  }).single();

  // 3. items 作成（振込先情報を snapshot）
  for (const r of records) {
    await supabase.from('bud_payroll_transfer_items').insert({
      batch_id: batch.id,
      salary_record_id: transferType === 'salary' ? r.id : null,
      bonus_record_id: transferType === 'bonus' ? r.id : null,
      employee_id: r.employee_id,
      recipient_bank_code: r.employee.bank_code,
      recipient_branch_code: r.employee.branch_code,
      recipient_account_type: r.employee.account_type,
      recipient_account_number: r.employee.account_number,
      recipient_account_holder: r.employee.account_holder_kana,
      transfer_amount: transferType === 'salary' ? r.net_pay : r.net_bonus,
    });
  }

  return { batchId: batch.id, totalAmount: batch.total_amount };
}
```

### 4.3 個別振込連携（A-04 連携）

```typescript
// 30 件未満時、Bud A-04 振込フォームへ自動エントリ
async function linkToFurikomiForm(batchId: string): Promise<void> {
  const items = await fetchBatchItems(batchId);

  for (const item of items) {
    const furikomi = await supabase.from('bud_furikomi').insert({
      source_type: 'payroll',
      source_batch_id: batchId,
      recipient_bank_code: item.recipient_bank_code,
      // ... A-04 と同じスキーマで挿入
      amount: item.transfer_amount,
      scheduled_at: item.scheduled_payment_date,
      status: '5_approved',  // A-03 6 段階の「承認済」
      created_by_system: true,  // 給与経由の自動作成フラグ
    }).single();

    await supabase.from('bud_payroll_transfer_items').update({
      bud_furikomi_id: furikomi.id,
      item_status: 'submitted',
    }).eq('id', item.id);
  }
}
```

### 4.4 FB データ生成（30 件以上）

```typescript
async function generateFbData(batchId: string): Promise<string> {
  const batch = await fetchBatchWithItems(batchId);
  const lines: string[] = [];

  // ヘッダレコード（規格 1）
  lines.push(buildHeaderRecord(batch));

  // データレコード（規格 2）
  let totalAmount = 0;
  let recordNo = 1;
  for (const item of batch.items) {
    lines.push(buildDataRecord(item, recordNo));
    totalAmount += item.transfer_amount;
    recordNo += 1;
  }

  // トレーラレコード（規格 8）
  lines.push(buildTrailerRecord(batch.items.length, totalAmount));

  // エンドレコード（規格 9）
  lines.push(buildEndRecord());

  // Storage 保存
  const path = `bud-payroll-fb/${batch.id}.txt`;
  const fbContent = lines.join('\n');
  await supabase.storage
    .from('bud-payroll-fb')
    .upload(path, fbContent, { contentType: 'text/plain; charset=shift_jis' });

  await supabase.from('bud_payroll_transfer_batches').update({
    fb_data_path: path,
    fb_generated_at: new Date().toISOString(),
    status: 'fb_generated',
  }).eq('id', batchId);

  return path;
}
```

---

## 5. 全銀協 FB データフォーマット

### 5.1 レコード種別

| 規格 | 役割 | 桁数 |
|---|---|---|
| 1 | ヘッダレコード | 120 |
| 2 | データレコード（明細）| 120 |
| 8 | トレーラレコード（小計）| 120 |
| 9 | エンドレコード | 120 |

### 5.2 文字コード

- **Shift_JIS** + **JIS カナ**（半角カナのみ）
- 改行: CR LF（\r\n）

### 5.3 ヘッダレコード概要

```
位置 1: '1'（規格区分）
位置 2-3: '21'（種別 = 総合振込）
位置 4-13: コード区分（10 文字、依頼人コード）
位置 14-53: 依頼人名（半角カナ 40 桁）
位置 54-57: 振込指定日（MMDD）
位置 58-61: 仕向銀行番号
位置 62-76: 仕向銀行名（半角カナ 15 桁）
位置 77-79: 仕向支店番号
位置 80-94: 仕向支店名
位置 95-95: 預金種目（1=普通 / 2=当座）
位置 96-102: 口座番号
位置 103-120: ダミー（空白）
```

### 5.4 データレコード概要

```
位置 1: '2'（規格区分）
位置 2-5: 被仕向銀行番号
位置 6-20: 被仕向銀行名
位置 21-23: 被仕向支店番号
位置 24-38: 被仕向支店名
位置 39-42: 手形交換所番号（空白）
位置 43-43: 預金種目
位置 44-50: 口座番号
位置 51-80: 受取人名（半角カナ 30 桁）
位置 81-90: 振込金額
位置 91-91: 新規コード（空白）
位置 92-101: 顧客コード 1
位置 102-111: 顧客コード 2
位置 112-112: 振込指定区分（7 = 給与振込）
位置 113-113: 識別表示
位置 114-120: ダミー
```

### 5.5 半角カナ変換

```typescript
function toHankakuKana(input: string): string {
  // 全角カナ → 半角カナ変換
  // 濁点・半濁点の独立化（ガ → ｶﾞ）
  const conversionMap: Record<string, string> = {
    'ア': 'ｱ', 'イ': 'ｲ', // ... 全パターン
    'ガ': 'ｶﾞ', 'ギ': 'ｷﾞ', // ... 濁音
    'パ': 'ﾊﾟ', 'ピ': 'ﾋﾟ', // ... 半濁音
  };
  return [...input].map(c => conversionMap[c] ?? c).join('');
}
```

---

## 6. 月末・25 日支給スケジュール

### 6.1 定型スケジュール

| 法人 | 給与 | 賞与 |
|---|---|---|
| ヒュアラン | 月末 25 日 | 7/10, 12/10 |
| センターライズ | 月末 25 日 | 7/10, 12/10 |
| 他 4 法人 | 末日 | （個別）|

`bud_payroll_periods.payment_date` で個別管理、`scheduled_payment_date` から自動推測も可能。

### 6.2 銀行休業日対応

- 25 日が土日・祝日 → **前営業日**に振込
- カレンダー: `bud_bank_holidays` テーブル + 祝日 API（既存資産）

---

## 7. 振込実行後の状態反映

### 7.1 完了通知の処理

```
銀行から振込完了 CSV 受領 (or admin 手動 mark-completed)
  ↓
batch.status = 'completed'
items.item_status = 'completed'
salary_records.status = 'paid'
salary_records.paid_at = now()
  ↓
従業員へ Chatwork 通知（D-04 と連動）
```

### 7.2 部分失敗

- FB データに 1 件不正（口座番号誤り等）→ その 1 件のみ rejected
- 残りは `completed` で salary_records.status='paid'
- 失敗分は **個別 retry**（admin 手動修正）

### 7.3 全失敗時のロールバック

```sql
UPDATE bud_payroll_transfer_batches
SET status = 'failed', failed_reason = $reason
WHERE id = $batch_id;

UPDATE bud_payroll_transfer_items
SET item_status = 'failed', failed_reason = $reason
WHERE batch_id = $batch_id AND item_status = 'submitted';

-- salary_records は status='approved' のまま、再 batch 作成可
```

---

## 8. 法令対応チェックリスト

### 8.1 労働基準法

- [ ] 第 24 条: 通貨払い・全額払い・直接払い・毎月払い
- [ ] 第 24 条但書: 銀行振込（口座振込）は同意必要
- [ ] 第 109 条: 振込記録 5 年保管

### 8.2 全銀協ルール

- [ ] FB データのフォーマット準拠
- [ ] 仕向銀行（自社主取引銀行）の事前登録
- [ ] 振込指定日の銀行営業日

### 8.3 個人情報保護法

- [ ] 振込先口座情報の安全管理（pgcrypto 暗号化検討）
- [ ] FB データの一時保管（Storage RLS）

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `bud_payroll_transfer_batches` migration | a-bud | 0.5h |
| 2 | `bud_payroll_transfer_items` migration | a-bud | 0.5h |
| 3 | `prepareTransfer` 関数 | a-bud | 1h |
| 4 | A-04 振込フォーム連携 | a-bud | 1h |
| 5 | FB データ生成（ヘッダ・明細・トレーラ・エンド）| a-bud | 3h |
| 6 | 半角カナ変換ヘルパー | a-bud | 0.5h |
| 7 | 銀行休業日対応 | a-bud | 0.5h |
| 8 | 振込完了反映 + Chatwork 通知 | a-bud | 1h |
| 9 | RLS + 監査ログ | a-bud | 0.5h |
| 10 | 単体・統合テスト | a-bud | 1.5h |

合計: 約 10h ≈ **1.0d**（妥当）

---

## 10. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 個別振込 vs FB データの閾値 | **30 件で切替**、admin 手動指定可 |
| 判 2 | FB データの自動アップロード | **手動アップロード**で開始（ネットバンキングの自動連携は Phase E）|
| 判 3 | 振込先口座の暗号化 | 当面平文（A-04 既存スキーマと整合）、Phase E で再考 |
| 判 4 | 月末 25 日が土日 | **前営業日**（労使慣例）|
| 判 5 | 完了確認の方法 | **admin 手動 mark**、CSV 取込は Phase E |
| 判 6 | 退職者の最終給与 | **離職票発行と連動**、即時振込（月末 25 日に拘らず）|

---

## 11. 既知のリスクと対策

### 11.1 振込先口座の誤登録

- 1 桁間違いで他人に振込
- 対策: 入社時に口座番号を**確認画面で目視チェック**、admin 承認必須

### 11.2 FB データの文字化け

- 全角カナが混入 → 銀行で reject
- 対策: 生成時に半角カナのみであることをチェック、許可文字以外で警告

### 11.3 振込実行日のずれ

- 25 日に FB 提出忘れて 26 日になる
- 対策: 23-24 日にリマインダ Chatwork、当日確認

### 11.4 二重振込

- 同じ batch を誤って 2 回承認
- 対策: status 遷移制御（draft → approved → fb_generated → uploaded → completed）

### 11.5 退職者への振込ミス

- 既に閉鎖された口座へ振込 → 戻し処理
- 対策: 退職時に口座生存確認、`employees.bank_account_active=false` フラグ

### 11.6 巨額振込のセキュリティ

- 給与一括 1 億円以上等
- 対策: 1 batch 5,000 万円超は **2 段階承認**（admin + super_admin）

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-24-bud-a-04-furikomi-create-form.md`
- `docs/specs/2026-04-24-bud-a-05-furikomi-approval-flow.md`
- `docs/specs/2026-04-24-bud-b-04-salary-payment-flow.md`（設計書）
- `docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-04-statement-distribution.md`
- 全銀協「全国銀行協会 振込規格」最新版

---

## 13. 受入基準（Definition of Done）

- [ ] `bud_payroll_transfer_batches` / `_items` migration 適用済
- [ ] `prepareTransfer` 関数の動作確認（10 件 / 50 件 / 100 件）
- [ ] A-04 振込フォーム連携（30 件未満時）動作
- [ ] FB データ生成（ヘッダ + 明細 + トレーラ + エンド）が全銀協規格に準拠
- [ ] 半角カナ変換が濁音・半濁音含めて正答
- [ ] 銀行休業日対応（前営業日繰上げ）
- [ ] 振込完了反映 → salary_records.status='paid' + Chatwork 通知
- [ ] 部分失敗時のリトライ動作
- [ ] 5,000 万円超の 2 段階承認動作
- [ ] RLS（admin+ のみ閲覧 / 編集）pass
- [ ] 単体 + 統合テスト pass
