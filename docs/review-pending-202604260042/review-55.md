# a-review レビュー — Bud Phase A-1 完結（振込 + 明細）

## 概要

Garden-Bud Phase A-1 として、振込管理 6 段階遷移（A-03/A-04/A-05）と銀行明細 CSV 取込 + 自動照合（A-06）を 123 ファイル / +20,976 行で実装した PR。SQL migration 2 本（status_history、statements）、RPC 1 本（atomic 遷移）、Server Action 1 本（Chatwork 通知）、Server-side テスト 282/282 緑。spec 修正（A-08）と Phase B 着手前ヒアリング整理（A-07）も同梱。

**Bud は CLAUDE.md §16 で🔴最厳格モジュール（金銭関連）扱い**。本レビューは known-pitfalls.md #1/#2/#3 に加え、二重決済・トランザクション原子性・楽観ロックを重点的に確認。

## 良い点

1. **TDD 実践**: ピュア関数（chatwork-formatter / business-day / batch-transitions / statement-matcher / csv-parser / aggregator）を分離し、282 件のテストで 120 件追加。
2. **重複振込防止**: `bud_transfers.duplicate_key`（GENERATED 列）+ 部分 UNIQUE INDEX による DB レベル防御は強力。`duplicate_flag = false` のみ unique にする設計も妥当。
3. **status_history の追記型 RLS**: UPDATE/DELETE を policy `USING (false)` で完全に塞ぐ設計は監査面で正しい。
4. **Atomic RPC**: `bud_transition_transfer_status()` で UPDATE と history INSERT を 1 トランザクションにまとめ、行ロック（`FOR UPDATE`）+ 自己承認禁止 + 差戻し reason 必須の検証もインライン化。
5. **dedupe NULLS NOT DISTINCT**: `bud_statements` の UNIQUE 制約に `NULLS NOT DISTINCT` を入れて、time が NULL の楽天 CSV でも重複検知が効く設計。

## 🔴 重大指摘事項

### R1. `bud_transfer_status_history` の RLS が **必ず実行時エラー**になる（致命）

`scripts/bud-a03-status-history-migration.sql:210`

```sql
CREATE POLICY bud_tsh_select_staff_own ON bud_transfer_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bud_transfers bt
      WHERE bt.id = bud_transfer_status_history.transfer_id   -- ★ bt.id は存在しない
        AND bt.created_by = auth.uid()
    )
  );
```

`bud_transfers` の PK は `transfer_id text`（`scripts/bud-schema.sql:47` で定義）。`bt.id` というカラムは存在しません。同 migration の冒頭コメント（line 15）でも「実 PK は transfer_id (text)。id uuid は存在しない」と明記しているのに、policy 内で参照を間違えています。

**影響**: staff ロールが自分の起票した振込の history を参照しようとした瞬間に `column bt.id does not exist` エラー。RLS 評価時のエラーは結果として「行が見えない」になるので、**staff は履歴タブを開くと空 or エラー**になります。admin policy（line 194）は別なので admin だけ動いて見えるため、α版で発見が遅れる可能性大。

**修正案**:
```sql
WHERE bt.transfer_id = bud_transfer_status_history.transfer_id
  AND bt.created_by = auth.uid()
```

### R2. `bud_statements` のスキーマ二重定義（旧 schema が勝つ）

`scripts/bud-schema.sql:93` で既に `bud_statements` を作成済み（PK `statement_id text`、`deposit_amount`/`withdrawal_amount` 別カラム）。一方 `scripts/bud-a06-statements-migration.sql:42` は **同名テーブルを `CREATE TABLE IF NOT EXISTS`** で作ろうとしています（PK `id uuid`、`amount bigint` 単一）。

PR description「SQL 適用順序」では `bud-schema.sql` も含意。先に schema が走っていれば **a06 migration の CREATE TABLE は no-op になり、新スキーマは作成されない**。アプリ側コード（`statement-import.ts:99` の `onConflict: "bank_account_id,..."`、`statement-import.ts:98` の `bud_statements` への upsert、`statement-matcher.ts` の `matched_transfer_id`）は新スキーマ前提なので、**全クエリが column does not exist で失敗**します。

**修正案**:
1. a06 migration の冒頭で `DROP TABLE IF EXISTS bud_statements CASCADE;` する（破壊的だが Phase A-1 段階）
   または
2. `bud-schema.sql` から `bud_statements` 定義を削除し、a06 migration を唯一の正とする
   または
3. ALTER TABLE で旧スキーマから新スキーマへ移行する migration を別途用意

東海林さんの手動適用順を間違えると一発で気付かない地雷です。**Bud は金銭モジュールにつき最も慎重に**。

### R3. `selfApproveAsSuperAdmin` は **history を残さない**（監査漏れ）

`src/app/bud/_lib/transfer-mutations.ts:200-229`

`selfApproveAsSuperAdmin` は `supabase.from("bud_transfers").update({...}).eq(...)` で**直接 UPDATE** しており、`bud_transfer_status_history` への INSERT を伴いません。一方、a03 migration の RPC `bud_transition_transfer_status` は同じ `下書き → 承認済み (super_admin 自起票)` パスを RPC 経由でも処理可能で、こちらは history を書きます。

**結果**: super_admin が UI 経由でどちらのパスを通るかでログが残ったり残らなかったりします。仕様書の「super_admin 自起票時の reason は『自起票』固定」（A-03 判3、a03 migration line 8）も RPC 側にしか実装されておらず、直接 UPDATE 側からは `created_by, approved_by` の情報しか得られません。

**修正案**: `selfApproveAsSuperAdmin` を廃止し、`transitionTransferStatus({ toStatus: '承認済み' })` に統一して RPC 経由で history を必ず記録。RLS policy 5（`bud_transfers_update_self_approve_super_admin`、`bud-rls-v2.sql:83-93`）も RPC 一本化なら不要（RPC は SECURITY DEFINER で RLS をバイパスするため）。

### R4. 二重パス（直接 UPDATE と RPC）の併存

R3 の延長。`updateTransferStatus`（直接 UPDATE）と `transitionTransferStatus`（RPC）の 2 系統が共存しています。

- 直接 UPDATE 系: `confirmed_at` 等の専用カラム更新あり、history 無し、RLS policy で守る
- RPC 系: history 必ず INSERT、RLS バイパス、`status_changed_at`/`status_changed_by` のみ更新

`confirmed_by`/`confirmed_at`/`approved_by`/`approved_at`/`csv_exported_*`/`executed_*` 等の専用カラムは RPC では一切更新されません。**この PR では UI からどちらを呼ぶか明示されていない**ため、運用中に「あれ、approved_by が NULL」「history と confirmed_at が違う」が起こり得ます。

**修正案**: 1 系統に統合。RPC 側を拡張して `to_status` ごとに対応する `*_by/*_at` を更新するのが筋。

### R5. 自動照合の遷移先 `振込完了` が遷移ルール違反

`src/app/bud/_lib/statement-import.ts:222-230`

```ts
const transitionResult = await transitionTransferStatus({
  transferId: m.result.transferId,
  toStatus: "振込完了",
});
```

しかし `bud_can_transition`（a03 migration line 75）が許す `振込完了` への遷移は **`CSV出力済み → 振込完了`** のみ。matcher 側 `MATCHABLE_STATUSES = ["承認済み", "CSV出力済み"]`（`statement-matcher.ts:26-29`）なので、`承認済み` の transfer がマッチした場合は遷移が DB 側で常に拒否されます。

`if (transitionResult.success)` で握り潰しているため、**マッチしたのに transfer 側のステータスが進まない silent failure** が頻発します。実運用では「明細は照合済みになるけど振込は承認済みのまま」という不整合が量産される可能性あり。

**修正案**: matcher の `MATCHABLE_STATUSES` を `["CSV出力済み"]` だけにするか、または `承認済み` マッチ時は `承認済み → CSV出力済み → 振込完了` の 2 ホップを順に呼ぶ。spec で意図を明確化する必要あり。

### R6. 自動照合のデータ整合性（マッチ更新が先、遷移が後）

`statement-import.ts:213-230`

`bud_statements.matched_transfer_id` を update した**後**で transfer 側を遷移しています。R5 の通り遷移が失敗すると、明細は match 済みなのに transfer は未完了という不整合が残ります。再実行で復旧する手段がないと積み上がります。

**修正案**: 1) transfer 遷移を先に実行 → 成功時のみ statement の matched_transfer_id をセット、または 2) 失敗時に matched_transfer_id を巻き戻す補償ロジック追加。

## 🟡 推奨指摘事項

### Y1. CSV パーサ `amount = 0` のサイレント受理

`src/app/bud/_lib/statement-csv-parser.ts:212-216`

```ts
const withdrawal = withdrawalIdx >= 0 ? parseAmount(values[withdrawalIdx] ?? "") : null;
const deposit = depositIdx >= 0 ? parseAmount(values[depositIdx] ?? "") : null;
if (withdrawal && withdrawal > 0) amount = -withdrawal;
else if (deposit && deposit > 0) amount = deposit;
else amount = 0;       // ← 出金/入金欄が両方空なら 0 円明細として通る
```

みずほ・PayPay 形式で「入金欄も出金欄も空」の行が来ると、エラーにせず amount=0 で投入されます。dedupe key は `(date,time,amount,description)` なので、0 円明細が複数あると衝突して上書きが発生する可能性あり。

**修正案**: `else { errors.push({ rowIndex: i, message: "入金/出金が両方空" }); continue; }` で除外。

### Y2. JST と UTC のズレ（known-pitfalls 関連）

`transfer-mutations.ts:84` `today.toISOString().substring(0, 10)` は UTC 日付を返します。9 時間時差で **00:00-09:00 JST は前日 UTC** になり、`request_date` が前日記録に。実運用で月跨ぎの請求書で 1 日ずれが出ると経理ミス扱いになる可能性。

**修正案**:
```ts
const todayJst = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo"
}).format(new Date());
```
（PR #60 ではこの方法を採用済）

### Y3. `updateDraftTransfer` が sanitize されていない（known-pitfalls #1 関連）

`transfer-mutations.ts:234-251`

`updates: Partial<CreateTransferInput>` をそのまま `update(updates)` に渡しています。フォーム経由で `due_date: ""` や `scheduled_date: ""` を含む payload が来ると、timestamptz/date 型で `invalid input syntax for type date: ""` エラー。known-pitfalls.md #1（timestamptz 空文字 insert）の date 版が再発する可能性。

**修正案**: Root の `sanitize-payload.ts` 系を Bud にも導入し、UPDATE 前に空文字 → undefined 変換。

### Y4. `payee_account_holder_kana` の検証不足（CB Y1 で重要）

`bud-schema.sql:66` `payee_account_holder_kana text` で長さ・文字種ともに無制限。**全銀協 EDI 規約**ではカナ・記号 30 桁制限が事実上業界標準。承認済 → CSV 出力時に拒否されると差戻し戻しが発生します。`zengin-library` plan が同梱されているので近い内に統合される予定と推察しますが、Phase A-1 完結時点でも UI 側で長さ警告は欲しい。

### Y5. `csv_exported_by/csv_exported_at` の更新ルートが未確定

A-05 で CSV 出力遷移が含まれますが、`updateTransferStatus`（直接 UPDATE）でしかこれら専用カラムが入りません。R4 と合わせて要整理。

### Y6. RLS UPDATE policy 4 の自分の差戻し不可

`bud-rls-v2.sql:67-78`

```sql
CREATE POLICY "bud_transfers_update_approval_admin" ON bud_transfers
  FOR UPDATE
  USING (status = '承認待ち' AND bud_is_admin() AND created_by <> auth.uid())
  WITH CHECK (status IN ('承認済み', '差戻し') AND bud_is_admin() AND created_by <> auth.uid());
```

起票者本人（admin であっても）が自分の `承認待ち` の transfer を**取り下げて 差戻し**にすることが直接 UPDATE では不可。一方 RPC（SECURITY DEFINER）からは通る（自己承認禁止のチェックは `承認済み` のみ）。意図的な設計か運用混乱の温床になるかは不明。spec で言語化を推奨。

### Y7. Chatwork 通知の冪等性

`chatwork-notify.ts:38-45`

通知側は最低限のリトライ無し・冪等キー無しのため、ネットワーク断で重複通知される可能性あり。決裁通知が二重に飛ぶと現場が困惑する可能性。Phase A-1 完結時点では諦め、Phase B で job queue 化することを推奨。

### Y8. テスト「マスタ + 統合」シナリオが少ない

ピュア関数 unit test は 282 件と充実していますが、`transfer-mutations.ts` の RPC エラーマッピング・補償・並行更新（同じ transfer に同時に承認と差戻しが来た場合）の **integration test** が 0 件に見えます。RLS が効く Supabase 経由の動作確認は東海林さんの手動 SQL 適用後実機テストに依存。Tree が🔴最厳格なら Bud も同等。Phase A-1 cut-over 前に最低限の Supabase 接続 e2e は欲しい。

## 🟢 軽微指摘

### G1. `bud_transfers.transfer_id` 採番の race
`fetchNextSequence`（`transfer-mutations.ts:70`）の実装を見ていませんが、`MAX+1` パターンだと並行 INSERT で衝突の可能性。`UNIQUE` 制約があるので失敗するだけですが、UI には「もう一度押してください」が出る可能性。`SELECT ... FOR UPDATE` ベースのシーケンス採番か pg sequence を推奨。

### G2. `notifyTransferApproved` 等が `console.warn` のみ
失敗ログが `console.warn` だけで Sentry / 構造化ログ無し。本番運用前に最低限 Vercel Logs に乗る形へ。

### G3. `cashback_application_status` の値が `pending` 等英語、`status` は日本語
名前空間がバラバラ。Phase B Leaf 連携時に統一推奨。

### G4. `bud-schema.sql` と a03/a06 の差異が migration 順依存
Supabase の migration ベース運用でない限り、東海林さんが順序を間違えると詰まる。`supabase/migrations/` ベースに整理することを Phase B 入る前に推奨。

## known-pitfalls.md 横断チェック

| # | タイトル | 関連有無 | 備考 |
|---|---|:---:|---|
| #1 | timestamptz 空文字 insert | 🟡 Y3 | `updateDraftTransfer` で sanitize 無し、再発リスクあり |
| #2 | RLS anon クライアント流用 | 該当無し | Server Action は `"use server"` 明示 + Chatwork は env 直読 |
| #3 | 空オブジェクト insert | 該当無し | `transfer-create-schema.ts` で zod 検証済（テスト 257 行）|
| #4 | KoT IP 制限 | 関係無し | Bud は KoT 連携無し |
| #5 | Vercel Cron + Fixie | 関係無し | 同上 |
| #6 | garden_role CHECK 制約 | 関係無し | 既存制約に依存のみ、新規追加無し |
| #7 | KoT date 形式 | 関係無し | 同上 |
| #8 | deleted_at vs is_active | 🟡 微妙 | Bud で従業員参照する箇所がまだ薄い、Phase B 給与で要注意 |

## spec / plan 整合

PR 自体に spec 修正（A-08 オリコ追加）と Phase B 着手前ヒアリング整理（A-07）が同梱。実装と spec のドリフトは小さい印象。ただし R5（matcher の遷移ルール違反）は spec で「自動照合は CSV出力済み → 振込完了」と明示するか、ロジック修正が必要。

## 判定

**REQUEST CHANGES**

理由（Bud は🔴最厳格、本番投入で経理事故になり得るため）：
1. **R1（status_history RLS の bt.id 参照誤り）**: staff ロール全員が履歴タブで動かない
2. **R2（bud_statements 二重定義）**: migration 適用順次第でアプリが全件失敗
3. **R5（自動照合の遷移ルール違反）**: マッチしたのに transfer が進まない silent failure
4. **R3/R4（直接 UPDATE と RPC の二重パス）**: 監査漏れと専用カラム未更新

R1 R2 R5 は α版投入直後に必ず露見します。R3 R4 は監査要件が出てくる β版で問題化。**マージ前に上記 4 件の対応を強く推奨**。Y1-Y8 は Phase A-1 cut-over までに対応 / 後続 PR でも可。

東海林さんの手動 SQL 適用前に必ず以下も確認してください：
- [ ] 開発環境で R1 のクエリを実機検証（staff ロールで履歴タブを開く）
- [ ] `bud_statements` の実テーブル定義確認（`\d bud_statements`）。新スキーマが入っていることを確認
- [ ] R5 の matcher ロジックを spec で明文化（「承認済 → 振込完了 直接遷移を allow する」かどうか）

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
