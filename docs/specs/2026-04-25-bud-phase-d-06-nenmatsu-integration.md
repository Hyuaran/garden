# Bud Phase D #06: 年末調整連携（Phase C 連動 + 源泉徴収反映）

- 対象: Garden-Bud Phase D 月次給与・賞与と年末調整 (Phase C) の連携
- 優先度: **🔴 高**（年末の精算、誤差は従業員不利益 / 過剰徴収の還付遅延）
- 見積: **0.75d**（連携 + 反映 + 暗号化対応）
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #06）
- 前提:
  - **Bud Phase C-01 nenmatsu_chousei スキーマ**（既存）
  - **Bud Phase C-02 源泉徴収簿**（既存）
  - **Bud Phase D-02 給与計算 / D-03 賞与計算**
  - 所得税法（年末調整）
  - pgcrypto 暗号化（マイナンバー等）

---

## 1. 目的とスコープ

### 1.1 目的

月次給与・賞与で控除した源泉徴収を、年末（12 月給与 or 1 月給与）で**正確に精算**するため、Phase C（年末調整）モジュールとの連携設計を確定する。マイナンバー等の機微情報は暗号化保管し、最小権限で参照する。

### 1.2 含めるもの

- Phase C `bud_nenmatsu_chousei` との連携（参照 / 書込フロー）
- 12 月（or 1 月）給与での年末調整精算
- 源泉徴収簿の月次累計 → Phase C への引き渡し
- マイナンバーの pgcrypto 暗号化
- 還付・追加徴収の処理

### 1.3 含めないもの

- 年末調整 UI 自体 → Phase C-05
- 法定調書合計表 → Phase C-04
- 支払調書 → Phase C-03
- 給与計算ロジック → D-02
- 賞与計算 → D-03

### 1.4 源泉徴収票 / 年末調整書類の配信

源泉徴収票（給与所得の源泉徴収票）等の年末調整書類の配信も **D-04 の配信ロジック流用**。
`bud_salary_notifications` に `notification_type='gensen_choshu_hyo'` 等を追加して同パスで配信。

---

## 2. 年末調整の流れ（全体、2026-04-26 [a-bud] 改訂: 1 月精算へ変更）

> **改訂理由**: 元 a-auto 推奨「12 月給与で精算」を東海林さん再判断で**翌年 1 月給与精算**に変更。
> 確定根拠: `decisions-kintone-batch-20260426-a-main-006.md` + `spec-revision-followups-20260426.md` §2 #2
>
> **採用理由（東海林さん指示）**:
> - **年末手取りの安定**: 12 月精算で還付 / 追徴が混じると年末ボーナス時期の手取り変動が大きい。1 月精算なら 12 月手取りは月次源泉のままで安定
> - **賞与との分離**: 12 月賞与（夏冬制でない場合の冬季賞与）と精算が同月だと処理が混在し誤り誘発。1 月精算なら賞与処理と完全分離
> - **退職者対応シンプル**: 12 月末退職者は 12 月給与で精算が必要だが、1 月精算ベースなら**月途中退職と同じ「即時精算（最終給与で精算）」フロー**に統一可（例外フローを減らせる）

```
1. 年初〜12 月: D-02 / D-03 で月次給与・賞与に源泉徴収（仮計算）
2. 11 月頃: 各従業員から扶養控除等申告書・保険料控除申告書を回収（Phase C-05）
3. 12 月初〜中: Phase C で年税額を計算（年収 - 各種控除 → 年税額）
4. 12 月給与: 月次源泉徴収のみ（精算は実施せず、12 月手取り安定）
5. **翌年 1 月給与で精算**（精算月変更 2026-04-26）
   - 年税額 < 既徴収累計 → **還付**（過納額を 1 月給与に上乗せ返金）
   - 年税額 > 既徴収累計 → **追徴**（不足額を 1 月給与から控除徴収）
6. 1 月末: 源泉徴収票（給与所得）を交付（Phase C-02）
7. 1 月末: 法定調書合計表 提出（Phase C-04）
```

### 2.1 退職者の例外フロー（1 月精算統一の利点）

| 退職タイミング | 旧設計（12 月精算） | 新設計（1 月精算統一）|
|---|---|---|
| 1〜11 月退職 | 最終給与で精算（即時精算） | 同じ |
| 12 月末退職 | 12 月給与で精算（年末調整と同月）| **最終給与（12 月給与）で即時精算**、1 月精算対象外 |
| 翌年 1 月退職（在籍が 12 月で終わり） | 該当なし | 12 月給与で月次源泉のみ → 1 月精算は実施せず（在籍中従業員のみ）|

**利点**: 12 月末退職者は「月途中退職と同じ即時精算」で扱える。年末調整精算（1 月）からは除外。

---

## 3. 連携テーブル

### 3.1 既存（Phase C）

| テーブル | 役割 |
|---|---|
| `bud_nenmatsu_chousei` | 年末調整本体（年税額・控除額）|
| `bud_gensen_choshu_bo` | 月次源泉徴収簿（D-02 が書込、Phase C が読込）|
| `bud_shiharai_chosho` | 支払調書 |
| `bud_hotei_chosho_goukei` | 法定調書合計表 |

### 3.2 新規（D-06 で追加）

#### `bud_year_end_settlements`（精算記録）

```sql
CREATE TABLE public.bud_year_end_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year int NOT NULL,                     -- 2026
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  nenmatsu_chousei_id uuid NOT NULL REFERENCES public.bud_nenmatsu_chousei(id),

  -- 既徴収累計（D-02 / D-03 から）
  total_withheld_to_november numeric(10, 0) NOT NULL,  -- 11 月までの累計
  december_salary_withheld numeric(10, 0) NOT NULL,    -- 12 月給与の予定徴収額
  bonus_withheld_total numeric(10, 0) NOT NULL,        -- 賞与累計

  -- 年税額（Phase C 計算結果）
  annual_tax_amount numeric(10, 0) NOT NULL,

  -- 精算
  settlement_amount numeric(10, 0) NOT NULL,    -- + 追徴 / - 還付
  settlement_type text NOT NULL,                -- 'refund' | 'additional' | 'zero'
  settlement_period_id uuid NOT NULL REFERENCES public.bud_payroll_periods(id),  -- 12 月給与 or 1 月給与

  -- 状態
  status text NOT NULL DEFAULT 'calculated',
    -- 'calculated' | 'approved' | 'reflected' | 'cancelled'

  -- メタ
  calculated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  reflected_at timestamptz,                     -- 給与計算に反映済の日時

  notes text,
  deleted_at timestamptz,
  deleted_by uuid,

  UNIQUE (fiscal_year, employee_id)
);
```

---

## 4. 月次源泉徴収簿との連携

### 4.1 D-02 から書込

```typescript
// 給与計算完了時、自動的に源泉徴収簿へ累計
async function appendToGensenChoshuBo(
  fiscalYear: number,
  employeeId: string,
  salaryRecordId: string
): Promise<void> {
  const record = await fetchSalaryRecord(salaryRecordId);
  await supabase.from('bud_gensen_choshu_bo').insert({
    fiscal_year: fiscalYear,
    employee_id: employeeId,
    period_type: 'monthly',
    payment_date: record.payment_date,
    gross_pay: record.gross_pay,
    social_insurance_total: record.total_social_insurance,
    withholding_tax: record.withholding_tax,
    source_salary_record_id: salaryRecordId,
  });
}
```

### 4.2 D-03 から書込

賞与も同テーブルへ `period_type='bonus'` で記録。

### 4.3 Phase C からの読込

```sql
SELECT
  fiscal_year,
  employee_id,
  SUM(gross_pay) AS annual_gross,
  SUM(social_insurance_total) AS annual_social,
  SUM(withholding_tax) AS annual_withheld
FROM bud_gensen_choshu_bo
WHERE fiscal_year = 2026
  AND employee_id = $1
GROUP BY fiscal_year, employee_id;
```

---

## 5. 翌年 1 月給与での精算（2026-04-26 [a-bud] 改訂: 12 月精算 → 1 月精算）

### 5.1 通常の精算フロー

```
1. 11 月末〜12 月初: Phase C で各従業員の年税額を計算（保険料控除等を反映）
2. 12 月給与計算: 月次源泉徴収のみ実施（精算は行わず、年末手取り安定）
3. 12 月末〜翌 1 月初:
   - bud_year_end_settlements 作成（payroll_approver 承認待ち）
4. payroll_approver 承認 → status='approved'
5. 翌 1 月給与計算実行:
   - 月次 withholding_tax を通常計算
   - settlement_amount を月次源泉に上乗せ / 控除
   - settlement_type='refund' なら 1 月給与にプラス（還付）
   - settlement_type='additional' なら 1 月給与からマイナス（追徴、不足分は 2 月以降に分割可）
6. 1 月給与確定 → settlements.status='reflected'
7. 1 月末: 源泉徴収票交付 + 法定調書提出
```

**ポイント**:
- 12 月給与は精算を含まず月次源泉のみ → 12 月手取りは安定
- 1 月精算は **「在籍中従業員のみ」**（12 月末退職者は最終給与で即時精算済、§2.1 参照）
- 還付 / 追徴の額は 12 月時点で確定 → 1 月給与計算時に `bud_year_end_settlements.settlement_amount` を読込

### 5.2 計算式（疑似コード）

```typescript
async function applyYearEndSettlement(
  payrollRecordId: string
): Promise<void> {
  const settlement = await fetchActiveSettlement(employeeId, fiscalYear);
  if (!settlement || settlement.status !== 'approved') return;

  const record = await fetchSalaryRecord(payrollRecordId);

  // 12 月給与の通常源泉徴収（仮）
  const normalWithholding = record.withholding_tax;

  // 精算後の控除額に置換
  const finalWithholding = normalWithholding + settlement.settlement_amount;

  await supabase.from('bud_salary_records').update({
    withholding_tax: finalWithholding,
    total_deductions: record.total_deductions - normalWithholding + finalWithholding,
    net_pay: record.gross_pay - (record.total_deductions - normalWithholding + finalWithholding),
  }).eq('id', payrollRecordId);

  await supabase.from('bud_year_end_settlements').update({
    status: 'reflected',
    reflected_at: new Date().toISOString(),
  }).eq('id', settlement.id);
}
```

### 5.3 還付額が大きい場合（12 月給与超過）

- 12 月給与の `net_pay` 計算結果が異常（例: gross_pay の 50% 超還付）→ 警告
- 翌月以降に分割可（事前運用判断）

### 5.4 追加徴収が大きい場合（不足分）

- 12 月給与で全額徴収すると `net_pay` がマイナス
- 翌月以降に分割（最長 12 ヶ月）→ `bud_year_end_settlement_installments` テーブル（Phase E で詳述）

---

## 6. マイナンバーの暗号化

### 6.1 保管箇所

```sql
CREATE TABLE public.root_employees_pii (
  employee_id uuid PRIMARY KEY REFERENCES public.root_employees(id),
  my_number_encrypted bytea,                    -- pgcrypto AES-256
  encryption_key_id text NOT NULL,              -- 鍵管理用 ID
  encrypted_at timestamptz NOT NULL DEFAULT now(),
  encrypted_by uuid NOT NULL,
  last_accessed_at timestamptz,
  access_count int NOT NULL DEFAULT 0
);

ALTER TABLE root_employees_pii ENABLE ROW LEVEL SECURITY;
```

### 6.2 暗号化キー管理

- Vercel 環境変数 `PII_ENCRYPTION_KEY`（32 バイト、base64）
- 鍵ローテーション: 年 1 回
- 暗号化方式: `pgp_sym_encrypt(data, key)` / `pgp_sym_decrypt(data, key)`

### 6.3 アクセス制御（最小権限）

```sql
-- super_admin のみ参照可
CREATE POLICY pii_select_super_admin
  ON root_employees_pii FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      = 'super_admin'
  );

-- 復号自体は Server Action で（クライアントには平文を渡さない）
```

### 6.4 アクセス監査

```sql
-- アクセスのたびに last_accessed_at / access_count を更新 + 監査ログ
INSERT INTO operation_logs (
  user_id, module, action, target_type, target_id, details
) VALUES (
  auth.uid(), 'bud', 'pii_access', 'root_employees_pii', employee_id::text,
  jsonb_build_object('purpose', 'year_end_settlement', 'fiscal_year', 2026)
);
```

---

## 7. RLS

```sql
-- bud_year_end_settlements
-- 自分の精算は閲覧可
CREATE POLICY settlement_select_own
  ON bud_year_end_settlements FOR SELECT
  USING (employee_id = (SELECT id FROM root_employees WHERE user_id = auth.uid()));

-- admin+ は全件
CREATE POLICY settlement_select_admin
  ON bud_year_end_settlements FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('admin', 'super_admin')
  );

-- INSERT / UPDATE は admin+ のみ
```

---

## 8. 法令対応チェックリスト

### 8.1 所得税法

- [ ] 第 190 条: 年末調整の実施義務（給与所得者）
- [ ] 第 191 条: 還付・追徴の精算義務
- [ ] 第 226 条: 源泉徴収票の交付（翌年 1/31 まで）

### 8.2 マイナンバー法（行政手続番号利用法）

- [ ] 第 27-29 条: 安全管理措置（暗号化、アクセス制限、監査）
- [ ] 第 25 条: 利用目的の限定（年末調整 / 法定調書のみ）
- [ ] 第 19 条: 第三者提供制限

### 8.3 個人情報保護法

- [ ] 第 23 条: 安全管理措置
- [ ] 第 25 条: 委託先の監督

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `bud_year_end_settlements` migration | a-bud | 0.5h |
| 2 | `root_employees_pii` migration + pgcrypto 設定 | a-bud + a-root | 1h |
| 3 | 月次源泉徴収簿への自動書込（D-02 連携）| a-bud | 0.5h |
| 4 | 賞与の源泉徴収簿書込（D-03 連携）| a-bud | 0.25h |
| 5 | Phase C → 年税額算出時の集計クエリ | a-bud | 0.5h |
| 6 | 12 月給与での精算反映ロジック | a-bud | 1.5h |
| 7 | マイナンバー暗号化 / 復号 helper | a-bud | 1h |
| 8 | 還付 / 追徴の警告 + 分割提案 | a-bud | 1h |
| 9 | RLS + 監査ログ | a-bud | 0.5h |
| 10 | 単体・統合テスト | a-bud | 1.5h |

合計: 約 8.25h ≈ **0.75d**（妥当）

---

## 10. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 精算月（12 月 or 1 月）| ~~12 月給与で精算（一般的、運用シンプル）~~ → **🎯 東海林確定 (2026-04-26)**: **翌年 1 月給与で精算**（年末手取り安定 + 賞与分離 + 退職者対応シンプル化、§2 採用理由参照） |
| 判 2 | 不足分の分割 | **最長 12 ヶ月**、payroll_approver 個別判断（#18 反映） |
| 判 3 | マイナンバー保管期間 | **退職後 7 年で物理削除**（法定）→ Cross Ops #05 |
| 判 4 | マイナンバーの新規登録 UI | Phase C-05 既存（年末調整 UI）に組込 |
| 判 5 | 年末調整対象外（中途退職等）| 退職時に源泉徴収票を即発行、年末調整なし。**12 月末退職者は 12 月給与で即時精算**（1 月精算対象外、§2.1 参照） |
| 判 6 | 給与所得者の扶養親族とマイナンバー | 扶養家族のマイナンバーも保管必須（暗号化） |
| 判 7 | 1 月精算時の月次源泉計算順序 | **月次源泉徴収を先に計算 → settlement_amount を加減算**（withholding_tax は月次のまま、精算は別欄で表示） |

---

## 11. 既知のリスクと対策

### 11.1 月次源泉徴収簿の整合性崩れ

- D-02 / D-03 から二重書込
- 対策: UNIQUE (employee_id, payment_date, period_type) 制約

### 11.2 マイナンバー誤公開

- 取得時に暗号化忘れ / ログに残る
- 対策: helper 経由必須、平文をログに出さない（ESLint カスタムルール）

### 11.3 鍵紛失

- 暗号化キーを失えば全マイナンバー復号不可
- 対策: Cross Ops #02 §9.2 に従い、鍵を 2 箇所保管

### 11.4 1 月給与の還付額過大（2026-04-26 改訂: 12 月 → 1 月精算）

- 控除申告書の入力誤りで還付額が異常
- 対策: 還付額が gross_pay の 30% 超なら警告 + 確認モーダル
- 1 月精算で還付額が大きい場合、月次源泉と同月計算で 1 月手取りが想定外に増える可能性あり → 警告閾値を **20%** に引き下げ検討（運用判断）

### 11.5 退職者の年末調整漏れ（2026-04-26 改訂: 1 月精算統一）

- ~~12 月退職で対象判定誤り~~ → 1 月精算ベースで簡素化
- **新ルール**: 当年中に退職した従業員は退職時最終給与で源泉徴収票を即発行、1 月精算からは除外
- 12 月末退職者も「最終給与＝12 月給与」で即時精算（1 月精算対象外）
- 対策: `root_employees.deleted_at` が当年内なら退職扱い、bud_year_end_settlements に NULL or `excluded_reason='retired_in_year'` で記録

### 11.6 扶養家族の年内変動

- 結婚・出産・離婚等で扶養人数変動
- 対策: `dependents_count` の履歴を年単位で snapshot、月別累計時に各月の値を使用

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-25-bud-phase-c-01-nenmatsu-chousei-schema.md`
- `docs/specs/2026-04-25-bud-phase-c-02-gensen-choshu.md`
- `docs/specs/2026-04-25-bud-phase-c-03-shiharai-chosho.md`
- `docs/specs/2026-04-25-bud-phase-c-04-hotei-chosho-goukei.md`
- `docs/specs/2026-04-25-bud-phase-c-05-nenmatsu-chousei-ui.md`
- `docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md`
- `docs/specs/cross-cutting/spec-cross-audit-log.md`
- `docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`（鍵保管）
- `docs/specs/2026-04-26-cross-ops-05-data-retention.md`（マイナンバー保管）

---

## 13. 受入基準（Definition of Done）

- [ ] `bud_year_end_settlements` migration 適用済
- [ ] `root_employees_pii` 暗号化テーブル + pgcrypto 動作
- [ ] D-02 / D-03 から `bud_gensen_choshu_bo` への自動書込動作
- [ ] Phase C-01 の年税額計算で源泉徴収簿の集計値を参照
- [ ] 12 月給与での精算（還付・追徴）が D-02 と連携して動作
- [ ] マイナンバー暗号化 helper（暗号化 + 復号 + 監査ログ）動作
- [ ] アクセス監査（last_accessed_at / access_count）更新
- [ ] 還付額過大の警告動作
- [ ] RLS（自分 / admin / super_admin）テスト pass
- [ ] 単体 + 統合テスト pass

---

## ⚙️ Kintone 解析判断 #18 + #25 反映 (2026-04-26)

> a-main 006 確定の 32 件のうち、本 spec に直接影響する 2 件を末尾追記。
> 確定ログ: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`

### #18 給与計算権限境界（4 ロール）

本 spec の RLS / role 列挙に以下 4 ロールを追加：

| ロール | 担当 | 主な権限 |
|---|---|---|
| `payroll_calculator` | 計算者（上田） | 給与計算実行 / 修正 / インポート |
| `payroll_approver` | 承認者（宮永・小泉） | 承認 / 差戻し（V6: 自起票承認禁止と同等の自己承認禁止） |
| `payroll_disburser` | MFC インポート実行（上田） | MFC CSV ダウンロード / 振込 CSV 出力 |
| `payroll_auditor` | 監査（東海林・admin） | 全件閲覧 / 目視チェック |

実装: `bud.has_payroll_role(roles text[])` ヘルパー関数を **D-09 §4** で定義、本 spec で再利用。
RLS は role 別に USING / WITH CHECK を分割（Phase A-1 V6 自己承認禁止と同パターン）。
4 ロールは `root.employee_payroll_roles` テーブル（本 batch では未起票、Root spec で別途定義予定）。

### #25 「東海林頼んだ Excel」フィールド廃止

Kintone App 21（給与一覧）が保持していた **「東海林頼んだ Excel」フィールド**は、
月次報告資料 Excel への外部参照だった。Garden 移行時：

- 当該フィールドは **migration 対象外**（廃止）
- `bud_payroll_records`（D-10）が直接 master、月次報告資料 Excel への参照は不要
- 旧運用フローの「Excel 確認 → 給与確定」は **Bud Phase D 内で完結**（D-10 + D-11）
- field mapping spec（Kintone → Garden 移行時）に `excluded_fields` として明記

詳細は **D-10（給与計算統合）** + **D-11（MFC CSV 出力）** を参照。

### 影響箇所

本 spec の以下のセクションは上記 2 件を**自動的に継承**:

- §RLS / 役割定義 → 4 ロールヘルパー関数経由
- §field mapping（該当する場合）→ 「東海林頼んだ Excel」を `excluded_fields` リストに追加
- §migration 計画（該当する場合）→ Kintone App 21 移行時の field skip ルール
