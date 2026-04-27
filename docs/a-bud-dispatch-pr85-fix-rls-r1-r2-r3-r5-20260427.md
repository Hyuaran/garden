# a-bud への PR #85 修正 dispatch（Bud RLS R1/R2/R3/R5 4 件未修正）- 2026-04-27

> 起草: a-main 008
> 用途: a-review 重大指摘 R1/R2/R3/R5 計 4 件の修正依頼
> 前提: PR #85 (feature/bud-phase-0-auth-v2) は REQUEST CHANGES 状態、経理事故レベル

## 投下短文（東海林さんが a-bud にコピペ）

```
【a-main-008 から a-bud へ】PR #85 bud RLS #55 修正依頼（経理事故レベル 4 件、1-2 時間）

▼ 経緯
PR #85 (feature/bud-phase-0-auth-v2) は a-review レビューで以下判定:
- ✅ R4 (admin 例外パスワード処理) → design decision で解決
- ❌ **R1 / R2 / R3 / R5 → 未修正、REQUEST CHANGES（経理事故レベル）**

レビューレポート: docs/review-pr85-bud-rls-202604270*-a-review.md（branch: feature/review-bloom-shoji-status-20260426、commit 8210579）

▼ 重大指摘 4 件の内容

**R1: RLS の bt.id 参照誤り**
- 場所: bud_transfers RLS ポリシー
- 問題: `bt.id` 参照になっているが、bud_transfers の PK は `transfer_id`（migration コメント自体が矛盾を認識）
- 修正: `bt.id` → `bt.transfer_id` （1 行修正）
- 影響: 振込履歴の RLS が機能していない可能性、admin 以外も他人の振込見える状態

**R2: bud_statements の dual schema 定義（IF NOT EXISTS で silent 上書き喪失）**
- 場所: bud_statements migration
- 問題: スキーマが 2 箇所で定義 + IF NOT EXISTS で 後勝ち、最初の定義が silent に喪失
- 修正: 重複定義を統一、片方を削除 or rename
- 影響: 経理データテーブル定義が不確定、後続 migration が想定外動作

**R3: selfApproveAsSuperAdmin が status_history を残さず**
- 場所: src/app/bud/_lib/transfer-mutations.ts (推定)
- 問題: super_admin が承認する際、直接 UPDATE で status を変更、status_history テーブルにレコード残らず
- 修正: 直接 UPDATE → RPC（PostgreSQL function 経由）に変更、Trigger で status_history 自動 INSERT
- 工数: 10 行修正
- 影響: 経理監査履歴が欠損、追跡不能

**R5: matcher が 承認済 → 振込完了 直接遷移（DB ルール違反）**
- 場所: src/app/bud/_lib/statement-matcher.ts
- 問題: 承認済 → 振込完了 の遷移で **中間ステータス「振込中」を経由せず直接遷移**、DB の status flow ルール違反
- 修正案 B（推奨、東海林さん要判断）: 2 段階遷移（承認済 → 振込中 → 振込完了）
- 影響: 振込フロー監査ができない、不正検知漏れ

▼ 修正範囲

1. R1: bud_transfers RLS migration の `bt.id` → `bt.transfer_id`（1 行）
2. R2: bud_statements migration の重複定義整理（10-30 行）
3. R3: selfApproveAsSuperAdmin を RPC 経由に変更（10 行 + 関連 RPC SQL 追加）
4. R5: matcher の status 遷移ロジックを 2 段階化（東海林さん判断後）+ tests 追加

▼ 工数見込

- R1 修正: 5 分
- R2 修正: 30 分
- R3 修正: 30 分
- R5 修正（2 段階遷移）: 30-45 分（spec 改訂含む）
- tests 追加・更新: 30-45 分
- 結合確認: 15 分
- 合計: **約 1.5-2 時間**

▼ 制約

- branch: feature/bud-phase-0-auth-v2（既存 PR #85 のブランチ）
- 既存 commit 履歴は維持、追加 commit で対応
- R5 の 2 段階遷移化は spec 改訂含むため、東海林さん判断必要時は **a-main 経由で確認**してから着手
  - 暫定スタンス: 案 B（2 段階遷移）採用、実装後に東海林さんに最終確認

▼ 詰まり時

即停止 → a-main 経由で東海林さんに相談
特に R5 の status 遷移ルール変更は他モジュール（Bud 全体 / 関連業務フロー）に影響する可能性、判断保留があれば即停止

▼ 完了報告

修正 commit + push 完了次第、a-main 経由で a-review に再レビュー依頼。
5/3 GW 中盤までに merge 完了が目標。

▼ 報酬

これで a-review 重大指摘 #55 が完全修正、Bud 経理機能が安全に運用可能になる。
特に R3 (status_history) + R5 (2 段階遷移) は経理監査の根幹、修正効果大。
品質最優先で進めてください。
```

## 完了後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | a-bud が R1/R2/R3 修正実装 + push | a-bud |
| 2 | R5 修正前に a-main 経由で東海林さんに最終確認 | a-bud → a-main → 東海林さん |
| 3 | R5 修正実装 + push | a-bud |
| 4 | a-main 経由で a-review に再レビュー依頼 | a-main |
| 5 | a-review 再レビュー → APPROVE 期待 | a-review |
| 6 | merge 実行 | 東海林さん or a-main |

## 改訂履歴

- 2026-04-27 初版（a-main 008、a-review #85 REQUEST CHANGES 受領 → a-bud 4 件修正依頼、経理事故レベル）
