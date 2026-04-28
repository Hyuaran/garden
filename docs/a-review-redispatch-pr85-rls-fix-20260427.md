# a-review 再レビュー依頼短文 - PR #85 (a-bud RLS 修正完了) - 2026-04-27

> 起草: a-main-009
> 用途: PR #85 (a-bud Phase 0 認証 + RLS) の R1/R2/R3/R5 修正完了に伴う再レビュー依頼
> 前提: Phase 2 重大指摘 5 PR レビュー済（#82/#83/#84 ✅、#85/#87 REQUEST CHANGES）

## 投下短文（東海林さんが a-review にコピペ）

```
【a-main-009 から a-review へ】PR #85 a-bud RLS 修正完了 → 再レビュー依頼

▼ 経緯
- 4/27 a-review 初回レビューで R1/R2/R3/R5 の経理事故レベル 4 件指摘
- a-bud 側で全件修正完了、commit 5c30a23 push 済（feature/bud-phase-0-auth-v2）

▼ 修正内容サマリ

| 指摘 | 内容 | 修正箇所 |
|---|---|---|
| R1 | bud_transfers RLS の bt.id 参照誤り | scripts/bud-a03-status-history-migration.sql:210 → bt.transfer_id（1 行 + 経緯コメント）|
| R2 | bud_statements 重複 schema 定義（IF NOT EXISTS で silent 上書き喪失）| bud-schema.sql から旧定義削除 → a06 を唯一の正本化（Plan A）+ 旧 BudStatement interface に @deprecated |
| R3 | selfApproveAsSuperAdmin の status_history 漏れ | src/app/bud/_lib/transfer-mutations.ts:223-252 直接 UPDATE 撤去 → bud_transition_transfer_status RPC 経由に統一 |
| R5 | matcher の 承認済 → 振込完了 直接遷移（DB ルール違反）| src/app/bud/_lib/statement-import.ts:222-231 2 段階遷移（承認済 → CSV 出力済 → 振込完了、Plan B）+ reentrant 設計 |

▼ 検証結果

- ✅ 934 tests pass（既存 919 + 新規 15 リグレッションテスト）
- ✅ tsc --noEmit clean
- ✅ eslint clean
- 新規テスト: src/app/bud/_lib/__tests__/review-pr85-fixes.test.ts（15 tests / 4 describe = R1/R2/R3/R5 各リグレッション検出可能）

▼ 期待アクション

- 再レビュー → APPROVE 判定 期待
- 5/3 GW 中盤までに merge 完了目標
- conflict 状態（develop と diverged）は merge 直前に解消予定

▼ 備考

- Bud は §16 で🔴厳格扱い（金額・振込系）、CL R3/R5 はまさに金銭事故防止の核心
- 修正方針は a-review 推奨（Plan A / Plan B）に準拠
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-review に上記短文投下 | 東海林さん |
| 2 | a-review が再レビュー実施 | a-review |
| 3 | APPROVE → conflict 解消 → merge | a-main-009 / 東海林さん |
| 4 | REQUEST CHANGES → a-bud へ追加修正 dispatch | a-main-009 |

## 改訂履歴

- 2026-04-27 初版（a-main-009、a-bud 修正完了 5c30a23 push 済の即時再レビュー依頼）
