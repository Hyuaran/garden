# Bud Phase D #04: 給与明細配信（PDF 生成 + 案 D 準拠）

- 対象: Garden-Bud Phase D 給与明細・賞与明細の PDF 生成と配信
- 優先度: **🔴 高**（従業員 UX、法定要件）
- 見積: **1.0d**（PDF テンプレ + 配信フロー + 通知）
- 担当セッション: a-bud（実装）/ a-rill（Chatwork 通知）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #04）
- 前提:
  - **Bud Phase B-03 給与明細 PDF**（設計済、本 spec で実装着手）
  - **Bud Phase D-02 給与計算ロジック**
  - **Bud Phase D-03 賞与計算**
  - **Cross Cutting spec-cross-storage**（Storage バケット運用）
  - **Cross Cutting spec-cross-chatwork**（Bot 通知）
  - 案 D = **署名 URL 不流通、Garden ログイン誘導**（東海林さん確定済）

---

## 1. 目的とスコープ

### 1.1 目的

確定した給与・賞与のデータを **PDF 明細**として生成し、各従業員に**安全に**届ける。案 D（署名 URL を流通させず、Garden ログイン経由で取得）で個人情報漏洩リスクを最小化する。

### 1.2 含めるもの

- `@react-pdf/renderer` での PDF 生成
- Storage バケット `bud-salary-statements` への保存
- 案 D 配信フロー（Chatwork 通知 → Garden ログイン → PDF DL）
- 給与明細 / 賞与明細の 2 テンプレート
- 複数月の一括ダウンロード（自分の過去明細）
- ダウンロード履歴の監査

### 1.3 含めないもの

- 給与計算自体 → D-02 / D-03
- 振込連携 → D-07
- 年末調整書類の配信 → D-06 + Phase C C-03 連携

---

## 2. 案 D の流通方針（再掲）

### 2.1 やらないこと

- ❌ 署名 URL（presigned URL）を Chatwork や メールで流通
- ❌ PDF 添付メール
- ❌ パスワード PDF を流通

### 2.2 やること

- ✅ Storage に PDF を保存（RLS 同等の制限）
- ✅ Chatwork で**短い案内**のみ（「明細が公開されました。Garden にログインしてください」）
- ✅ Garden ログイン後に **/bud/my-statements** で PDF を表示・DL
- ✅ ダウンロードは **Server Action 経由**（短時間有効な内部署名 URL を 1 リクエスト 1 回限り）

---

## 3. PDF テンプレート

### 3.1 給与明細（A4 縦）

```
┌─────────────────────────────────────────┐
│  株式会社 ヒュアラン  給与明細                │
│  支給日: 2026-04-25  対象期間: 2026-03-21〜04-20│
├─────────────────────────────────────────┤
│  社員番号: H001234   氏名: 山田太郎       │
│  部門: 営業部       役職: 主任             │
├─────────────────────────────────────────┤
│  【支給】                                 │
│  基本給              280,000               │
│  時間外手当            42,000               │
│  深夜手当               8,000               │
│  通勤手当              12,000               │
│  住宅手当              20,000               │
│  ─────────────────────              │
│  支給合計            362,000               │
│                                         │
│  【控除】                                 │
│  健康保険料            17,955               │
│  厚生年金              33,148               │
│  雇用保険料             2,172               │
│  介護保険料             3,030               │
│  所得税                 8,420               │
│  住民税                14,800               │
│  ─────────────────────              │
│  控除合計             79,525               │
├─────────────────────────────────────────┤
│  差引支給額          282,475               │
└─────────────────────────────────────────┘
```

### 3.2 賞与明細（A4 縦）

```
┌─────────────────────────────────────────┐
│  株式会社 ヒュアラン  賞与明細                │
│  2026年 夏季賞与   支給日: 2026-07-10        │
├─────────────────────────────────────────┤
│  社員番号: H001234   氏名: 山田太郎       │
├─────────────────────────────────────────┤
│  【支給】                                 │
│  基本賞与            500,000               │
│  業績加算             50,000               │
│  ─────────────────────              │
│  支給合計            550,000               │
│                                         │
│  【控除】                                 │
│  健康保険料            27,390               │
│  厚生年金              50,325               │
│  雇用保険料             3,300               │
│  所得税（算出率 4.084%） 22,462              │
│  ─────────────────────              │
│  控除合計            103,477               │
├─────────────────────────────────────────┤
│  差引支給額          446,523               │
└─────────────────────────────────────────┘
```

### 3.3 共通仕様

- フォント: 日本語対応の Noto Sans JP（CJK）
- ページサイズ: A4 縦（210 × 297 mm）
- フッタ: 法人印（オプション、画像）+ 発行日 + ドキュメント ID

---

## 4. PDF 生成

### 4.1 ライブラリ

- `@react-pdf/renderer`（既存依存、新規追加なし）
- 既存 Forest 決算書 PDF と同パターン

### 4.2 サーバーサイド生成

```typescript
// src/app/api/bud/payroll/generate-statement/route.ts
export const runtime = 'nodejs';  // Buffer / Node API 使用のため

export async function POST(req: NextRequest) {
  const { salary_record_id } = await req.json();
  // 認証 + admin+ チェック
  const record = await fetchSalaryRecord(salary_record_id);
  const employee = await fetchEmployee(record.employee_id);

  const pdf = await renderToBuffer(
    <SalaryStatementDocument record={record} employee={employee} />
  );

  // Storage 保存
  const path = `${employee.id}/${record.payroll_period_id}.pdf`;
  await supabase.storage
    .from('bud-salary-statements')
    .upload(path, pdf, { upsert: true });

  // 監査ログ
  await logOperation({
    action: 'statement_generated',
    target: salary_record_id,
  });

  return Response.json({ ok: true, path });
}
```

### 4.3 一括生成（給与確定時）

```typescript
// src/app/api/bud/payroll/generate-all-statements/route.ts
// period.status = 'approved' になった時点でトリガ

export async function POST(req: NextRequest) {
  const { payroll_period_id } = await req.json();
  const records = await fetchAllRecords(payroll_period_id);

  // 並列生成（同時 5 件まで）
  const results = await Promise.allSettled(
    records.map(r => limit(() => generateStatement(r)))
  );

  return Response.json({
    ok: true,
    success: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  });
}
```

---

## 5. Storage 設計

### 5.1 バケット構成

```
bud-salary-statements/
├─ {employee_uuid}/
│  ├─ {payroll_period_id}.pdf        … 月次給与明細
│  └─ {payroll_period_id}_bonus.pdf  … 賞与明細（同期間に賞与あれば）
├─ ...
```

### 5.2 RLS

- バケット: **public=false**
- ファイルパスに employee_uuid を含める → RLS で employee 自身か admin+ のみアクセス可
- service_role 経由のアップロードのみ

```sql
CREATE POLICY statement_select_self
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bud-salary-statements'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM root_employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY statement_select_admin
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bud-salary-statements'
    AND (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
        IN ('admin', 'super_admin')
  );
```

### 5.3 保管期間

- 給与関連: 5 年（労基法 109 条）→ Cross Ops #05 §2.2
- 期限経過後は archive バケットへ移動 → 7 年経過で物理削除

---

## 6. 配信フロー（案 D）

### 6.1 全体図

```
1. 給与計算完了 → period.status = 'approved'
2. PDF 一括生成 Cron 起動
3. 完了後、Chatwork に短文通知
   「2026年4月分 給与明細を公開しました。
    Garden にログインして確認してください。
    https://garden.example.com/bud/my-statements」
4. 各従業員が Garden ログイン
5. /bud/my-statements で一覧表示（自分の分のみ）
6. ダウンロードボタン → Server Action → Storage signed URL（1 分有効） → DL
```

### 6.2 Chatwork 通知の文面

```
📄 給与明細公開のお知らせ

2026年4月支給分の給与明細を公開しました。
Garden にログインして確認してください。

▼ ログイン URL
https://garden.example.com/bud/my-statements

ご不明点は経理担当までご連絡ください。
```

### 6.3 ダウンロード Server Action

```typescript
// src/lib/bud/statements/download.ts
'use server';

export async function getStatementDownloadUrl(
  salaryRecordId: string
): Promise<{ url: string; expiresAt: number }> {
  const supabase = createServerClient();

  // RLS で自動的にフィルタ（自分 or admin+ のみ）
  const { data: record } = await supabase
    .from('bud_salary_records')
    .select('employee_id, payroll_period_id')
    .eq('id', salaryRecordId)
    .maybeSingle();
  if (!record) throw new Error('NOT_FOUND');

  const path = `${record.employee_id}/${record.payroll_period_id}.pdf`;
  const { data: signed } = await supabase.storage
    .from('bud-salary-statements')
    .createSignedUrl(path, 60);  // 60 秒有効

  // ダウンロード履歴
  await logOperation({
    action: 'statement_downloaded',
    target: salaryRecordId,
  });

  return {
    url: signed.signedUrl,
    expiresAt: Date.now() + 60_000,
  };
}
```

### 6.4 一覧画面 `/bud/my-statements`

```
┌─────────────────────────┐
│  自分の給与明細             │
├─────────────────────────┤
│  2026年4月  給与  📥DL    │
│  2026年3月  給与  📥DL    │
│  2026年7月  賞与  📥DL    │
│  ...                    │
└─────────────────────────┘
```

過去 5 年分まで閲覧可。

---

## 7. 監査ログ

### 7.1 記録タイミング

| イベント | 記録 |
|---|---|
| PDF 生成 | `action='statement_generated'` |
| Chatwork 通知 | `action='statement_notified'` |
| ダウンロード | `action='statement_downloaded'` |
| admin が他人の明細を閲覧 | `action='statement_admin_view'` + 対象 employee_id |

### 7.2 異常検知

- 同一 employee が 1 日 10 回以上 DL → 警告
- admin が短時間に多数の他人 DL → 警告（情報持ち出し懸念）

---

## 8. テーブル定義

### 8.1 `bud_salary_statements`（生成記録）

```sql
CREATE TABLE public.bud_salary_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id uuid REFERENCES public.bud_salary_records(id),
  bonus_record_id uuid REFERENCES public.bud_bonus_records(id),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  statement_type text NOT NULL,             -- 'salary' | 'bonus'
  storage_path text NOT NULL,               -- bud-salary-statements/uuid/period.pdf
  file_size_bytes int NOT NULL,
  pdf_checksum text NOT NULL,               -- SHA256（改ざん検知）
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid,
  notification_sent_at timestamptz,
  notification_chatwork_message_id text,
  download_count int NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by uuid,

  CHECK (
    (salary_record_id IS NOT NULL AND bonus_record_id IS NULL AND statement_type = 'salary')
    OR (salary_record_id IS NULL AND bonus_record_id IS NOT NULL AND statement_type = 'bonus')
  )
);

CREATE INDEX idx_statements_employee ON bud_salary_statements (employee_id, generated_at DESC);
```

---

## 9. RLS

```sql
ALTER TABLE bud_salary_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY statements_select_self
  ON bud_salary_statements FOR SELECT
  USING (employee_id = (SELECT id FROM root_employees WHERE user_id = auth.uid()));

CREATE POLICY statements_select_admin
  ON bud_salary_statements FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('admin', 'super_admin')
  );

-- INSERT は service_role のみ
-- UPDATE は download_count / last_downloaded_at のみ self-update 許可
-- DELETE 完全禁止
```

---

## 10. 法令対応チェックリスト

### 10.1 労働基準法

- [ ] 第 24 条: 給与明細書の交付義務（書面 or 電子）
- [ ] 電子交付は**従業員の同意が必要**（雇用契約 or 別途同意書）
- [ ] 第 109 条: 5 年保管

### 10.2 個人情報保護法

- [ ] 第 23 条: 安全管理措置（署名 URL を流通させない = 適切）
- [ ] アクセス権限の最小化（RLS）
- [ ] 監査ログ（誰がいつ閲覧 / DL したか）

### 10.3 電子帳簿保存法

- [ ] 検索性の確保（`/bud/my-statements` で検索可）
- [ ] 改ざん防止（pdf_checksum SHA256）
- [ ] タイムスタンプ（generated_at）

---

## 11. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `bud_salary_statements` migration | a-bud | 0.5h |
| 2 | Storage バケット `bud-salary-statements` 作成 + RLS | a-bud | 0.5h |
| 3 | 給与明細 React PDF コンポーネント | a-bud | 2h |
| 4 | 賞与明細 React PDF コンポーネント | a-bud | 1h |
| 5 | PDF 生成 API + 一括生成 Cron | a-bud | 1.5h |
| 6 | Chatwork 通知（a-rill 経由）| a-bud + a-rill | 1h |
| 7 | `/bud/my-statements` UI | a-bud | 1.5h |
| 8 | ダウンロード Server Action + 短時間 signed URL | a-bud | 0.5h |
| 9 | 監査ログ統合 + 異常検知 | a-bud | 0.5h |
| 10 | 単体・統合テスト | a-bud | 1h |

合計: 約 10h ≈ **1.0d**（妥当）

---

## 12. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 電子交付の同意取得 | **入社時の雇用契約に明記**、既存従業員は別途同意書（東海林さん要決定）|
| 判 2 | 法人印の表示 | **オプション**、`root_companies.seal_image_path` 使用 |
| 判 3 | 紙明細を希望する従業員 | **個別出力可** + 経理が手渡し（運用ルール）|
| 判 4 | 過去明細の表示期間 | **5 年**（法定通り）、UI フィルタは「全期間」も可 |
| 判 5 | Chatwork 文面の言語 | 日本語のみ（英語版は Phase E）|
| 判 6 | 暗号化 PDF | **不採用**（案 D で十分、PW 管理コスト過大）|

---

## 13. 既知のリスクと対策

### 13.1 PDF 生成の失敗（一括時）

- 100 名分中 3 名失敗
- 対策: Promise.allSettled で部分成功、失敗分を再生成キューへ

### 13.2 Storage 容量

- 1 名 × 12 ヶ月 × 5 年 = 60 ファイル × 100KB = 6MB
- 100 名で 600MB → Cross Ops #02 のバックアップ対象

### 13.3 改ざん検知

- 担当者が PDF を直接編集
- 対策: SHA256 を generated_at 時点で記録、DL 時に検証

### 13.4 短時間 signed URL の漏洩

- 60 秒以内に共有される
- 対策: URL は server → client 直送（HTTP レスポンス内）、ログにも残さない

### 13.5 Chatwork 通知の到達失敗

- API 制限・ネットワーク障害
- 対策: 失敗時は Garden 管理画面で警告、再送ボタン

### 13.6 賞与と給与の同月発生

- 7 月で給与 + 夏季賞与
- 対策: それぞれ別 PDF、`statement_type` で分離

---

## 14. 関連ドキュメント

- `docs/specs/2026-04-24-bud-b-03-salary-statement-pdf.md`（設計書）
- `docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md`
- `docs/specs/cross-cutting/spec-cross-storage.md`
- `docs/specs/cross-cutting/spec-cross-chatwork.md`
- `docs/specs/2026-04-26-cross-ops-05-data-retention.md`

---

## 15. 受入基準（Definition of Done）

- [ ] `bud_salary_statements` migration 適用済
- [ ] Storage バケット作成 + RLS（自分 + admin+）動作
- [ ] 給与明細 PDF 生成（A4 縦、Noto Sans JP）動作
- [ ] 賞与明細 PDF 生成 動作
- [ ] 一括生成 Cron で 100 名分完走
- [ ] Chatwork 通知（短文 + Garden URL）到達
- [ ] `/bud/my-statements` で自分の過去明細閲覧可
- [ ] ダウンロード Server Action（60 秒 signed URL）動作
- [ ] 監査ログ（generated / notified / downloaded）記録
- [ ] 異常 DL 検知が動作
- [ ] SHA256 改ざん検知が動作
