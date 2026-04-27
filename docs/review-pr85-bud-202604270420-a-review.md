# PR #85 レビュー — bud RLS + Phase 1a 認証基盤（a-review #55 対応）

- **対象**: PR #85 / branch `feature/bud-phase-0-auth-v2`
- **base**: `develop`
- **mergeStateStatus**: `CLEAN`（ただし設計面で merge blocker あり）
- **diff**: 21251 additions / 28 deletions / 125 files
- **作成**: 2026-04-27（a-review GW セッション）

## 📋 概要

a-review が PR #55 で指摘した 4 重大事項（R1〜R5、R4 はカラム整合性）について、**1 件は design decision で解決、3 件は依然として未修正**。特に **R1 (RLS の `bt.id` 参照誤り) は migration コメント自体が「id uuid は存在しない」と認めているのに policy 側で誤参照が残存**しており、staff ロールの履歴閲覧が完全に機能しない致命的バグ。

## 🔍 4 重大指摘の修正状況

| # | 指摘内容 | 状態 |
|---|---|---|
| R1 | status_history RLS の `bt.id` 参照誤り（PK は `transfer_id`）| ❌ **未修正（マージブロッカー）** |
| R2 | `bud_statements` のスキーマ二重定義 | ❌ **未修正（マージブロッカー）** |
| R3 | `selfApproveAsSuperAdmin` が status_history を残さず監査漏れ | ❌ **未修正（マージブロッカー）** |
| R4 | `confirmed_at`/`approved_at` の RPC vs 直接 UPDATE 不整合 | ✅ **design decision で解決** |
| R5 | 自動照合の遷移ルール違反（`承認済み → 振込完了` を直接遷移）| ❌ **未修正（マージブロッカー）** |

---

## ❌ 未修正（4 件、すべて 🔴 マージブロッカー）

### R1. `bt.id` 参照誤り — Self-evident bug（コメントが矛盾を認識）

`scripts/bud-a03-status-history-migration.sql:205-214`:

```sql
DROP POLICY IF EXISTS bud_tsh_select_staff_own ON bud_transfer_status_history;
CREATE POLICY bud_tsh_select_staff_own ON bud_transfer_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bud_transfers bt
      WHERE bt.id = bud_transfer_status_history.transfer_id  -- ❌ bt.id 列は存在しない
        AND bt.created_by = auth.uid()
    )
  );
```

**矛盾の証拠**: 同 migration の冒頭コメント (line 15)：
```sql
-- 実 PK は transfer_id (text, FK-YYYYMMDD-NNNNNN)。id uuid は存在しない。
```

**bud_transfers の実 schema** (`scripts/bud-schema.sql:46-49`):
```sql
CREATE TABLE IF NOT EXISTS bud_transfers (
  transfer_id              text PRIMARY KEY,          -- FRK-2026-04-0001
  status                   text NOT NULL DEFAULT '下書き'
  ...
```

**実害**: staff / closer / cs / toss ロールが status_history を SELECT する際、`bt.id` カラムが存在しないため policy 評価が SQL ERROR → 結果として **「自分が起票した振込の履歴も閲覧不可」**。経理担当の業務遂行が完全に止まる。

**修正案** (1 行):
```sql
WHERE bt.transfer_id = bud_transfer_status_history.transfer_id  -- bt.id → bt.transfer_id
```

---

### R2. `bud_statements` のスキーマ二重定義 — 静かな上書き喪失

両ファイルが同じテーブルを定義：

**`scripts/bud-schema.sql:91-93`**:
```sql
-- 3. bud_statements（入出金明細）
CREATE TABLE IF NOT EXISTS bud_statements (
  ...
);
```

**`scripts/bud-a06-statements-migration.sql:39-42`**:
```sql
-- 2. bud_statements（入出金明細）
CREATE TABLE IF NOT EXISTS bud_statements (
  ...  -- 別カラム構成
);
```

**実害**: `IF NOT EXISTS` のため、bud-schema.sql が先に走れば a06 のスキーマは silent に無効化。逆順なら schema-sql 側が無効化。**どちらが本物かが run order 依存で確定不能**。アプリ側の TypeScript は a06 想定、DB に schema-sql 側が立っていれば全 query が失敗。

**修正案 A（推奨）**: bud-schema.sql から `bud_statements` 定義を削除、a06-statements-migration.sql に集約。Phase 0 移行時の整合性を SQL コメントで明記。

**修正案 B**: bud-a06 側を `ALTER TABLE bud_statements ADD COLUMN ...` の差分形式に書き換え（bud-transfers-v2.sql と同じパターン）。

---

### R3. `selfApproveAsSuperAdmin` — status_history 記録なしの直接 UPDATE

`src/app/bud/_lib/transfer-mutations.ts:223-252`:

```ts
export async function selfApproveAsSuperAdmin(
  transferId: string,
  actorUserId: string,
): Promise<BudTransfer> {
  const now = new Date().toISOString();

  // super_admin スキップ時は confirmed_by / confirmed_at を NULL のまま残し...
  const { data, error } = await supabase
    .from("bud_transfers")
    .update({                              // ❌ 直接 UPDATE、RPC 経由でない
      status: "承認済み",
      approved_by: actorUserId,
      approved_at: now,
    })
    .eq("transfer_id", transferId)
    .eq("status", "下書き")
    .eq("created_by", actorUserId)
    .select("*")
    .single<BudTransfer>();
  ...
}
```

**問題**: 他のステータス遷移は `bud_transition_transfer_status()` RPC（atomic UPDATE + status_history INSERT）を経由しているのに、**`selfApproveAsSuperAdmin` だけ直接 UPDATE で status_history INSERT が起きない**。

**実害**:
1. **監査トレイル断絶** — super_admin 自己承認分だけ status_history に記録が残らない。後日「いつ誰が承認したか」を `bud_transfer_status_history` JOIN で集計しようとすると super_admin 案件が抜け落ちる
2. **遷移ルール bypass** — `bud_can_transition('下書き', '承認済み', 'super_admin')` のチェックがアプリ側 `.eq("status", "下書き")` のみ。DB 関数の特例ルール（`super_admin AND old=下書き AND new=承認済み THEN true`）が記述されているのに使われていない（line 68-69）
3. **RPC がすでに super_admin スキップロジックを持つ** — `bud_transition_transfer_status` の SECURITY DEFINER 内で reason='自起票' 自動挿入する設計（line 89）。**これを呼ばない理由がない**

**修正案**:
```ts
// 直接 UPDATE を廃止、RPC 経由に統一
const result = await supabase.rpc("bud_transition_transfer_status", {
  p_transfer_id: transferId,
  p_to_status: "承認済み",
  p_reason: "自起票（super_admin スキップ）",
});
```

これで status_history 自動記録 + 遷移ルール検証 + super_admin 特例の DB 側集約が一括達成される。

---

### R5. matcher の遷移ルール違反 — `承認済み → 振込完了` 直接遷移

`src/app/bud/_lib/statement-import.ts:222-231`:

```ts
// 振込側を 振込完了 に遷移（best-effort、失敗してもスキップ）
const transitionResult = await transitionTransferStatus({
  transferId: m.result.transferId,
  toStatus: "振込完了",
});
if (transitionResult.success) {
  matchedCount++;
}
```

**`bud_can_transition` ルール表** (`bud-a03-status-history-migration.sql:67-80`):

```
下書き      → 確認済み / 差戻し
確認済み    → 承認待ち / 下書き
承認待ち    → 承認済み / 差戻し
承認済み    → CSV出力済み                    ★ ここで止まる
CSV出力済み → 振込完了                       ★ ここから振込完了
差戻し      → 下書き
super_admin: 下書き → 承認済み（自起票特例）
```

**問題**: matcher は `承認済み` の振込（=  CSV 出力前）に銀行明細をマッチさせようとするが、遷移ルールでは `承認済み` → `CSV出力済み` → `振込完了` の 2 段階必須。matcher の `toStatus: "振込完了"` は遷移表に存在しない。

**実害**:
1. `bud_can_transition('承認済み', '振込完了', any_role)` → `false` を返す
2. RPC が `RAISE EXCEPTION` するか false を返す
3. `transitionResult.success === false` で `matchedCount` がインクリメントされない
4. **bud_statements 側は `matched_transfer_id` 設定済み（line 215-219、ROLLBACK されない）**
5. → 「明細は照合済み、振込は依然として承認済み」の **silent inconsistency が量産される**

**修正案 2 通り**:

#### 案 A: 遷移表を改訂（matcher を「CSV 出力をスキップ」設計に）
```sql
WHEN old_status = '承認済み' AND new_status = '振込完了' THEN true  -- matcher 用
```
※ ただし「CSV 出力済み」工程の意義（経理が CSV を実際に持ち出して銀行に持っていく確認）が無くなる。業務フロー的に NG の可能性大。

#### 案 B: matcher を「2 段階遷移」に変更（推奨）
```ts
// 1. 承認済み → CSV出力済み（matcher 側で自動進行）
const cs = await transitionTransferStatus({
  transferId: m.result.transferId, toStatus: "CSV出力済み",
  reason: "matcher: 銀行明細マッチによる CSV 出力済みマーク",
});
if (!cs.success) continue;

// 2. CSV出力済み → 振込完了
const tr = await transitionTransferStatus({
  transferId: m.result.transferId, toStatus: "振込完了",
  reason: "matcher: 銀行明細マッチによる振込完了確定",
});
if (tr.success) matchedCount++;
```

A-07 ヒアリング結果に「CSV 出力工程をスキップしたい」要望があれば案 A、現行業務維持なら案 B。**東海林さん要判断**。

---

## ✅ design decision で解決（1 件）

### R4. `confirmed_at`/`approved_at` の RPC vs 直接 UPDATE 不整合

`selfApproveAsSuperAdmin` の comment (line 228-230):

```ts
// super_admin スキップ時は confirmed_by / confirmed_at を NULL のまま残し、
// 「二重チェックをスキップした」という事実を明示する（設計判断: I-2 B 案）。
// 監査は created_by（起票）と approved_by（承認）の 2 カラムで追跡可能。
```

**評価**: I-2 B 案で「`confirmed_*` が NULL = super_admin スキップの fingerprint」と意味付け。**意図的な NULL 化として整合**。ただし：
- 集計 query で `WHERE confirmed_at IS NOT NULL` を使っている箇所があれば、super_admin 案件が抜け落ちる → 横断確認推奨
- comment line 232 の「監査は ... 追跡可能」は **R3 の status_history 不在が解消されない限り片手落ち**（status_history JOIN ができないため、結局 `bud_transfers.approved_by` のみが頼り）

R3 修正後に再確認推奨。

---

## 📚 known-pitfalls.md 横断チェック

- #1 timestamptz 空文字: ⚠️ **要確認** — `selfApproveAsSuperAdmin` の `approved_at: now` は問題なし、ただし `updateDraftTransfer` の `Partial<CreateTransferInput>` 経由で空文字が混入する経路がないか確認推奨
- #2 RLS anon 流用: ✅ Server Action 経路で OK（PR #66 の `getSupabaseClient` 想定）
- #3 空 payload insert: ⚠️ `selfApproveAsSuperAdmin` は `.eq("status", "下書き")` の条件付き UPDATE で安全、ただし起票時の `createTransfer` 等は要確認（本 PR 範囲外）
- #6 garden_role CHECK 制約: ✅ `bud_can_transition` 内の `user_role = 'super_admin'` リテラル比較は意図的、CHECK 制約と整合
- #8 deleted_at vs is_active: ✅ 該当なし

## 🎯 重大度サマリ

| 修正 | 件数 | 詳細 |
|---|---|---|
| 🔴 重大 | **4** | R1 bt.id / R2 bud_statements 二重 / R3 selfApprove 直接 UPDATE / R5 matcher 遷移違反 |
| 🟡 推奨 | **1** | R1 修正後、staff ロールでの実機 RLS テスト（curl + 別ユーザー） |
| 🟢 任意 | 1 | R3 修正後に R4 集計 query の `confirmed_at IS NOT NULL` 経路を再確認 |

## 🚦 判定

### ❌ REQUEST CHANGES（マージブロッカー 4 件）

**マージ前必須対応** (1〜2 時間で全件修正可能):

1. 🔴 **R1**: `bud-a03-status-history-migration.sql:210` の `bt.id` を `bt.transfer_id` に修正（1 行）
2. 🔴 **R2**: `bud_statements` 定義をどちらか 1 ファイルに集約 + 他方を ALTER 差分形式に統一
3. 🔴 **R3**: `selfApproveAsSuperAdmin` を `bud_transition_transfer_status` RPC 経由に書き換え（10 行程度）+ テスト追加
4. 🔴 **R5**: matcher を 2 段階遷移（案 B）に書き換え or 業務フロー検討で 案 A 採択 — **東海林さん要判断**

修正後、`bud_transfer_status_history` への INSERT 動作を staff 実ユーザーで確認、matcher 結合テストで 承認済み 振込が正しく 振込完了 まで到達することを green 確認推奨。

**経理業務への影響度**: 🔴 R1/R3/R5 はそれぞれ「履歴閲覧不可」「監査トレイル欠落」「明細マッチが silent fail」で、すべて経理事故レベル。merge 前必須対応。

---

🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
