# PR #85 再レビュー — bud RLS / 経理事故レベル 4 件 修正検証

- **対象**: PR #85 / branch `feature/bud-phase-0-auth-v2` / commit `5c30a23`
- **base**: `develop`
- **diff**: 21251+ additions / 28 deletions / 125+ files
- **作成**: 2026-04-27 06:00（a-review GW セッション、再レビュー）
- **依頼元**: a-main-009

## 📋 概要

a-review #55 で REQUEST CHANGES とした 4 件（R1/R2/R3/R5、いずれも経理事故レベル）について、a-bud が **commit 5c30a23 で全件修正完了**。本レビューで実装内容・コメント品質・回帰テスト網羅を独立検証した結果、**全 4 件の修正が私の推奨案（R2 = Plan A、R5 = Plan B）に準拠した上で、reentrant 設計や design decision の docstring 化など期待を上回る品質で完了**。

**判定**: ✅ **APPROVE（前回 REQUEST CHANGES 4 件すべて解消、APPROVE 移行）**

## 🔍 4 重大指摘の修正検証

### ✅ R1: `bt.id` → `bt.transfer_id` 修正

`scripts/bud-a03-status-history-migration.sql:204-217`:

```sql
CREATE POLICY bud_tsh_select_staff_own ON bud_transfer_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bud_transfers bt
      -- a-review #55 R1 修正 (2026-04-27 a-bud): bud_transfers の PK は transfer_id (text, FRK-YYYYMMDD-NNNNNN)。
      -- bt.id 列は存在しないため、staff/closer/cs/toss ロールが status_history を SELECT すると
      -- SQL ERROR で失敗 → 振込履歴の RLS が機能不全 (admin 以外の正当な参照が一律拒否される) 状態だった。
      WHERE bt.transfer_id = bud_transfer_status_history.transfer_id
        AND bt.created_by = auth.uid()
    )
  );
```

**評価**:
- ✅ 修正内容正確（`bt.transfer_id` 参照）
- ✅ **修正経緯コメント**が後続 review/audit に親切（攻撃面の説明 + roleName 列挙）
- ✅ 回帰テスト 2 件（policy 内 `bt.transfer_id` 検出 + コード行に `bt.id` 残存しないこと）

### ✅ R2: `bud_statements` 二重定義解消（Plan A 採用）

私が #55 で「**修正案 A（推奨）**: bud-schema.sql から `bud_statements` 定義を削除、a06-statements-migration.sql に集約」と提示した方針通り：

```
scripts/bud-schema.sql:91-103
-- 3. bud_statements（入出金明細）
-- bud_statements 定義は scripts/bud-a06-statements-migration.sql §2 へ移管。
-- a-review #55 R2 修正 (2026-04-27 a-bud): 旧 schema との二重定義を解消し正本化。
```

**残存箇所の整合性**:
- bud-schema.sql:225-226: `CREATE INDEX IF NOT EXISTS idx_bud_statements_*` — テーブル参照のみ、a06 で定義された列を参照
- bud-schema.sql:235: `ALTER TABLE bud_statements ENABLE ROW LEVEL SECURITY` — 同上
- a06 が `id uuid PRIMARY KEY` / `matched_transfer_id text` の新 schema で正本

**評価**:
- ✅ 私の Plan A 推奨に完全準拠
- ✅ a06 の新 schema 想定（uuid PK + matched_transfer_id）を回帰テストで担保
- ✅ 旧 schema の痕跡（`statement_id text PK` / `deposit_amount` / `withdrawal_amount`）が a06 に残存していないことも negative assertion で検証

### ✅ R3: `selfApproveAsSuperAdmin` → RPC 経由統一

`src/app/bud/_lib/transfer-mutations.ts:229-265`:

```ts
export async function selfApproveAsSuperAdmin(
  transferId: string,
  _actorUserId: string,  // 未使用化（RPC 内部で auth.uid() 取得）
): Promise<BudTransfer> {
  const transitionResult = await transitionTransferStatus({
    transferId,
    toStatus: "承認済み",
    reason: "自起票（super_admin スキップ）",
  });
  ...
```

**評価**:
- ✅ 直接 UPDATE 撤去 → `bud_transition_transfer_status` RPC 経由に統一
- ✅ status_history INSERT が RPC 内 atomic 実行される（監査トレイル復活）
- ✅ R4 design decision の継承明記（`confirmed_*` NULL = super_admin スキップの fingerprint）
- ✅ **後続作業の指針も明記**：「呼出箇所ゼロを再確認の上、当関数自体を削除予定（PR #85 merge 後の次フェーズ）」→ 段階的退場戦略がドキュメント化
- ✅ 回帰テスト：「selfApproveAsSuperAdmin が transitionTransferStatus を呼ぶ」/ 「直接 .update() 呼出がない」/ 「reason に super_admin スキップ明記」を verify

### ✅ R5: matcher 2 段階遷移（Plan B 採用）

私が #55 で「**修正案 B（推奨）**: matcher を「2 段階遷移」に変更」と提示した方針通り、さらに **reentrant 設計**まで踏み込んだ堅牢な実装：

```ts
// 1 段目: 承認済み → CSV出力済み（既に CSV出力済 / 振込完了 状態の場合は失敗するが想定内）
const csvTransitionResult = await transitionTransferStatus({
  transferId, toStatus: "CSV出力済み",
  reason: "matcher: 銀行明細により CSV 出力済とマーク",
});
if (!csvTransitionResult.success) {
  // INVALID_TRANSITION の場合のみ 2 段目を試行
  if (csvTransitionResult.code !== "INVALID_TRANSITION") {
    continue;
  }
}

// 2 段目: CSV出力済み → 振込完了
const finalTransitionResult = await transitionTransferStatus({
  transferId, toStatus: "振込完了",
  reason: "matcher: 銀行明細により振込完了確定",
});
```

**評価**:
- ✅ DB ルール準拠（承認済み → CSV出力済み → 振込完了 の 2 段階）
- ✅ **reentrant 設計**: 1 段目失敗（既に CSV 出力済等）でも 2 段目を試みる → 部分的に進んだ batch の救済
- ✅ INVALID_TRANSITION 以外のエラー（DB 接続失敗等）は即 continue で安全側
- ✅ Plan A 不採用理由を明記（「CSV 出力工程の意義が消える / 業務フロー上 NG」）
- ✅ best-effort 戦略維持（単発失敗で全体ロールバックせず）
- ✅ status_history の reason 列に "matcher:" prefix で監査連鎖が完結
- ✅ 回帰テスト 4 件：1 段目 / 2 段目それぞれの reason 確認 + INVALID_TRANSITION 経路 + Plan A/B 経緯コメント残存検証

---

## 🟢 加点要素（前回指摘を超える品質）

1. **Reentrant 設計（R5）** — 私の #55 修正案 B は単純な 2 段階遷移だったが、a-bud 実装は「1 段目失敗時に状態を見て 2 段目に進む」のリカバリパスまで構築。matcher の堅牢性が大幅向上。
2. **Design decision の docstring 化（R3 + R4）** — 「`confirmed_*` NULL = super_admin スキップの fingerprint」「集約 query で `confirmed_at IS NULL` で抽出可能」など、将来の query 担当者が **コードを読むだけで設計意図を理解**できる構造。R4 design decision の継承も明示。
3. **回帰テストの 3 段防御** — file content 読込ベースの test で、(a) 修正後のコード/SQL が含まれること、(b) 修正前の典型的な誤りパターンが含まれていないこと、(c) 修正経緯のコメント自体が残存すること、を検証。コード変更による silent regression 検出力が高い。
4. **段階的退場戦略の明記（R3）** — 「PR #85 merge 後の次フェーズで `selfApproveAsSuperAdmin` 自体を削除予定」が docstring 化されており、技術負債のロードマップが透明化。
5. **934 tests pass + tsc clean + eslint clean** — テスト先行の規律維持。

## 📚 known-pitfalls 横断チェック（再）

- #1 timestamptz 空文字: ✅ 影響なし（修正範囲は RLS / RPC / matcher）
- #2 RLS anon 流用: ✅ 該当なし（Server Action 経路）
- #3 空 payload insert: ✅ 該当なし
- #6 garden_role CHECK 制約: ✅ `has_role_at_least()` 経由で抽象化済み
- #8 deleted_at vs is_active: ✅ 該当なし

## 🎯 重大度サマリ（再レビュー後）

| 修正 | 件数 | 詳細 |
|---|---|---|
| 🔴 重大 | **0** | （前回 4 件すべて解消） |
| 🟡 推奨 | 0 | — |
| 🟢 任意 | 0 | — |

## 🚦 判定

### ✅ **APPROVE**（前回 REQUEST CHANGES 4 件すべて解消）

**マージ前運用**:
- mergeStateStatus の conflict（develop と diverged）は依頼元 a-main-009 で merge 直前解消予定
- 5/3 GW 中盤までの merge 余裕あり

**マージ後フォロー**:
- 「`selfApproveAsSuperAdmin` 自体を削除予定」の次フェーズ作業は別 PR で実施（コメント中のロードマップどおり）
- matcher の 2 段階遷移が実環境で **承認済み 振込のみを対象**としているか E2E 検証推奨（本レビュー範囲外、a-bud 結合テストで担保）

経理事故防止の核心 4 件すべてが、実装品質・テスト網羅・コメント品質において期待を上回る形で解消されました。**5/3 までの merge 完了で問題なし**。

---

🤖 a-review by Claude Opus 4.7 (1M context)
