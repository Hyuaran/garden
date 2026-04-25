# 🔍 a-review レビュー — Bud Phase D 給与処理 8 件（Batch 17 / A-07 採択反映済）

## 📋 概要

Garden-Bud Phase D（給与処理）の実装着手版 spec 8 件（合計 4,040 行 / 実装見積 約 6.0d）。勤怠取込スキーマ / 給与計算 / 賞与計算 / 明細配信 / 社会保険 / 年末調整連携 / 銀行振込 / テスト戦略。A-07 採択結果（payment_method ENUM の bank_transfer/cash/other 分岐）を反映済。Phase A 282 tests 流儀踏襲。CLAUDE.md §16 で「金銭関連 = 厳格」指定モジュール。

## ✅ 良い点

1. **金銭計算の境界条件・法令準拠を網羅**: D-05 §1.1 で標準報酬月額（健保 50 / 厚年 32 等級）+ 都道府県別料率 + 月変判定 + 算定基礎届 + 産休育休免除 を一括包含。労基法 24/32/37/39/109、所得税法 183/186/190/226 の根拠条文付き。memory「品質最優先」に完全合致。
2. **A-07 採択結果の徹底反映**: D-02 §1.4 / D-04 §2.5 / D-07 §1.4 で payment_method = bank_transfer/cash/other の分岐を一貫して記述。「給与計算は同ロジック、配信先と振込先で分岐」という設計判断が spec 横断で整合。
3. **冪等性とスナップショット設計（D-01 §2.1）**: KoT 遡及修正可能性に対して「Bud で確定したらスナップショット固定」+ override テーブルでの監査トレイル。再計算可能性が業務継続上重要。
4. **A-07 採択の現金手渡し受給者特別扱い（D-04 §2.5）**: Tree マイページ + メール **+ 受領確認ボタン** + 紙の受領書 という多層化。bud_transfers の `transfer_type='給与(手渡し)'` で CSV/FB から除外する処理も spec 内で明示。現場運用の細部まで考慮されている。
5. **CHECK 制約による計算結果の整合性保証（D-02 §3.1）**:
   ```sql
   CHECK (gross_pay >= 0),
   CHECK (net_pay = gross_pay - total_deductions)
   ```
   DB レベルで net_pay 計算ミスを禁止。known-pitfalls 予防として優秀。
6. **Phase A 282 tests 流儀踏襲（D-08）**: fixture 50+ + 単体 280+ + E2E + 法令テスト の構成。`tests/legal/` で労基法・所得税法・健保厚年法の準拠テストを明示分離。金銭処理として最厳格基準。
7. **マイナンバー pgcrypto 暗号化（D-06）**: 個人情報保護法 23/25 + マイナンバー法 27-29 への配慮。D-08 統合テストで pii-encryption.test.ts 配置。

## 🔴 / 🟡 / 🟢 指摘事項

### 🔴 D-04 §2.2 「PW 規則: 生年月日 4 桁 (MMDD) or 社員番号下 4 桁」が脆弱

```
PW 規則: 生年月日 4 桁（MMDD）or 社員番号下 4 桁（実装時に最終決定）
```
**MMDD は最大 366 通り、社員番号下 4 桁も従業員規模では推測可能**。給与明細という機密情報の保護として暗号強度が低すぎる。

→ 具体策:
- (a) 生年月日 8 桁（YYYYMMDD）+ 社員番号下 4 桁の組み合わせ
- (b) 初回受信時に従業員ごと固有 PW を Garden で発行（Tree マイページに表示、メール本文には含めない）
- (c) パスワードレス（メールには Tree マイページの URL のみ送信、自宅からは Tree マイページ閲覧不可なので案内のみ）

memory「品質最優先」+ 個人情報保護法 25 条（安全管理措置）に基づき、**マージ前に PW 規則を判断保留として東海林さんに確認**することを強く推奨。

### 🔴 D-02 §3.1 source_root_attendance_id への参照のみで遡及修正検知が不十分

```sql
source_root_attendance_id uuid REFERENCES public.root_attendance(id),
source_synced_at timestamptz NOT NULL,
```
KoT 遡及修正は `root_attendance.updated_at` で検知できるが、**spec で「source_root_attendance_id」のみ保存**だと、参照先が後から変わった時に検知しづらい。

→ `source_attendance_hash text NOT NULL` を追加し、勤怠合計値の sha256 を保存。再計算判定ロジック（D-01 §4.x）でハッシュ比較する設計に。known-pitfalls #1 timestamptz 空文字とも別軸で、**監査の根本要件**として Phase D-01 で対応すべき。

### 🔴 D-07 §3.1 unique 制約 `(payroll_period_id, company_id, transfer_type)` が不正な業務状況を許容

```sql
UNIQUE (payroll_period_id, company_id, transfer_type)
```
1 期間 + 1 法人 + 1 種別（salary/bonus）= 1 バッチ。**しかし、再振込（失敗 → 再生成）のシナリオで 2 つ目のバッチが作れない**。

→ 解決策 2 つ:
- (a) `status NOT IN ('failed', 'cancelled')` を含む partial unique index
- (b) 失敗時は新規バッチでなく既存バッチを reset してリトライ（リトライ counter 列追加）

(b) が監査トレイル上望ましい。spec で明示要。

### 🔴 D-01 §3.2 `paid_leave_days numeric(4, 2)` の `numeric(4, 2)` で半休扱い不可

```sql
paid_leave_days numeric(4, 2) NOT NULL DEFAULT 0,  -- 半休 0.5 日 単位許容
```
`numeric(4, 2)` は **整数部 2 桁 + 小数部 2 桁 = 最大 99.99**。1 ヶ月の有給休暇日数として 99.99 は十分だが、**`numeric(4, 2)` の解釈は「全 4 桁中小数 2 桁」 = 整数部 **2** 桁**で、99.99 が上限。年間 30 日付与 + 繰越 30 日 = 60 日を超える可能性は低いが、**繰越 + 当期付与で 99 を超えるとエラー**。

→ `numeric(5, 2)` に拡張推奨。同様に paid_leave_remaining も。

### 🔴 D-04 メール配信の SPF/DKIM/DMARC が spec 内未言及

PDF パスワード保護メールを送信する spec だが、**Garden が使うメール送信基盤（SendGrid / SES / Resend / Supabase 標準）が spec 内で言及なし**。SPF/DKIM/DMARC の設定がないと Gmail/Outlook がスパム判定 → 給与明細メールが届かない事故。

→ D-04 §6 配信ステータス管理の前段に「§5.5 メール送信基盤の選定 + 認証設定」を追加。known-pitfalls の事前予防として記録すべき。Cross Ops #01（PR #51）の監視と連動。

### 🟡 D-02 §3.1 `kou_otsu_at_calculation` / `dependents_count_at_calculation` のスナップショット保存はあるが、`base_calculation_method` のスナップショットなし

```sql
kou_otsu_at_calculation text NOT NULL,        -- 'kou' | 'otsu'（計算時点のスナップショット）
dependents_count_at_calculation int NOT NULL,
```
これは正しい設計だが、**残業単価・所定労働時間・住宅手当規則等もマスタが時系列変動する**。これらが計算根拠から外れている。

→ `salary_system_id_at_calculation uuid` + `salary_system_snapshot jsonb` を追加し、計算根拠を完全凍結。または `bud_salary_records` を別テーブル（`bud_salary_calculation_basis`）で保管。法令対応上重要。

### 🟡 D-04 §3.1 PDF 生成時のフォント埋め込みが spec で未定義

@react-pdf/renderer での PDF 生成だが、**日本語フォント（NotoSansJP 等）の埋め込みが spec 内未言及**。デフォルトでは漢字が豆腐化する既知の落とし穴。

→ §3 §3.1 PDF テンプレートの直前に「§3.0 フォント設定: NotoSansJP-Regular.ttf を Storage 配置 + Document の Font.register」追加。known-pitfalls 候補。

### 🟡 D-05 §3.2 `bud_insurance_rates.effective_to nullable` で重複範囲チェック制約なし

```sql
effective_from date NOT NULL,
effective_to date,                            -- NULL = 現行
```
**effective_from < effective_to を保証する CHECK 制約なし**。同一料率タイプ・同一県で期間重複が発生しうる。

→ exclusion constraint で防衛:
```sql
EXCLUDE USING gist (
  prefecture WITH =,
  daterange(effective_from, COALESCE(effective_to, 'infinity'::date)) WITH &&
)
```
社保料率の改定は年度切り替え時に必発、間違いが起こりうるポイント。

### 🟡 D-07 §3.1 `bud_payroll_transfer_batches` の RLS 設計未記載

金銭関連テーブルなのに RLS spec が未記載。**memory「権限ポリシー設定変更可能設計」 + #51 cross-ops の admin 権限階層との連動が必要**。

→ D-07 §X として RLS spec 追加。`role >= 'admin'` で更新、`role >= 'manager'` で閲覧 等。実装フェーズで漏れる懸念高。

### 🟡 D-08 §2.1 fixture 命名が gettext 化に弱い

```typescript
employeeFixtures = {
  regular_30_kou_0: { ... },
  regular_45_kou_2_care: { ... },
}
```
**雇用形態 / 年齢 / 甲乙 / 扶養数 / 介護有無 を `_` 区切りで命名する規則は読みやすいが、追加属性（管理職か / 通勤手当ありか / 賞与対象か）が増えると名前が長大化**。

→ `regular_30_kou_0` のようなショートキーは fixture._index_ として残し、本体は `EMP_FIXTURES.regularKou30Dependents0` 等のオブジェクトキー + `description` プロパティ付きの構造化推奨。

### 🟢 D-01 §3.1 `period_type 'final_settlement'` の意味が不明確

```sql
period_type text NOT NULL,           -- 'monthly' | 'bonus_summer' | 'bonus_winter' | 'final_settlement'
```
**final_settlement = 年末調整？退職時の最終精算？** spec 内で説明なし。D-06 年末調整連携と関係するなら D-06 へリンク追加要。

### 🟢 D-04 §1.2 「過去 5 年分の給与明細・賞与明細を一覧表示」の保持期間

「過去 5 年」が D-04 内で定義されているが、**Cross Ops #05 data-retention の保持期間表（給与: 5 年 / 振込: 7 年）と連動**。spec 内で参照リンク追加すると整合性が分かりやすい。

### 🟢 D-08 §2.1 `e2e/year-end-flow.spec.ts` が D-06 と重複

D-06 でも年末調整 E2E に言及している場合、テスト spec の責務分担を明確化（D-08 が一元管理 / D-06 でも個別記述）が望ましい。

## 📚 横断整合チェック

### known-pitfalls.md との整合
- ✅ #1 timestamptz 空文字: `created_at NOT NULL DEFAULT now()` で safe
- ⚠️ **#2 RLS anon 流用**: Server Action で書込みする給与計算で JWT 転送パターンが spec 未記載（D-07 RLS 未定義と関連）
- ✅ #3 空オブジェクト insert: `gross_pay >= 0` 等 CHECK 制約で防衛
- ✅ #5 Vercel Cron: D-01 §4.2 で `/api/cron/bud-payroll-lock` の CRON_SECRET 検証パターンに沿う見込み
- ✅ #6 garden_role CHECK: payment_method を ENUM ではなく text + CHECK で実装している（D-04 §2.5 から推察、明示要）
- ✅ #8 deleted_at vs is_active: D-02 §3.1 の `deleted_at` / `deleted_by` / `deleted_reason` で論理削除独立軸を明示

### 既存 spec / CLAUDE.md との矛盾
- ✅ §16 リリース前バグ確認 - Bud は厳格基準。D-08 で 7 種テスト準拠
- ✅ §17 段階展開 - α/β は別 spec（cross-ops #04 リリース手順）に委譲、責務分離 OK
- ⚠️ **PR #47 cross-history-delete との連動**: bud_salary_records が `garden_change_history` Trigger 適用対象になるか D-02 で言及なし。マイナンバー暗号化された値が history に流入する PII 配慮も要

### memory ルールとの整合
- ✅ **削除パターン**: `deleted_at` / `deleted_by` 統一規格準拠
- ⚠️ **権限ポリシー設定変更可能設計**: D-07 RLS 未定義、D-04 「ダウンロード履歴の監査」程度しか権限言及なし → admin 設定で承認閾値変更可能な設計を spec で明示要
- ✅ **品質最優先 / リリース遅延は許容**: 法令準拠 / fixture 50+ / 単体 280+ ケース / 法令テスト独立配置 → 妥協なし
- ✅ **SQL inline 表示**: SQL は full inline、コピペ実装可能

## 🚦 判定

**REQUEST CHANGES**

理由（マージ前修正必須）:
1. 🔴 D-04 §2.2 PDF パスワード規則の脆弱性（生年月日 MMDD or 社員番号下 4 桁）→ 東海林さん判断仰ぐ + 強化方式へ修正
2. 🔴 D-04 メール送信基盤（SendGrid 等）の SPF/DKIM/DMARC が未定義 → §5.x に追加
3. 🔴 D-01 `paid_leave_days numeric(4, 2)` の桁不足 → `numeric(5, 2)`
4. 🔴 D-07 unique 制約が再振込シナリオで詰まる → status partial index or リトライ counter
5. 🔴 D-01 source_root_attendance_id だけでは遡及修正検知不十分 → hash 列追加

軽度修正（マージ後フォロー可）:
- 🟡 D-02 給与体系マスタの計算時凍結（snapshot jsonb）
- 🟡 D-04 PDF 日本語フォント埋め込み手順明示
- 🟡 D-05 effective_from/to 重複防止 exclusion constraint
- 🟡 D-07 RLS 設計
- 🟡 PR #47 cross-history-delete との連動明示

**Bud は §16 で「🔴 厳格」指定モジュール、特に金額・振込系のエッジケース必須**。マージ前修正の費用対効果が極めて高い。網羅性自体は最高水準で、上記 5 点を spec 修正すれば即 LGTM。

D-08 テスト戦略は Phase A 流儀踏襲で完成度高く、これだけでも Phase A 同等の品質保証は実現可能。

A-07 採択結果反映の整合性は素晴らしい。3 spec（D-02 / D-04 / D-07）+ D-03 / D-06 / D-08 で payment_method 分岐が一貫しており、現場運用と直結した設計。

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
