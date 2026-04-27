# a-auto への PR #87 修正 dispatch（cross-history NEW.id::text ハードコード問題）- 2026-04-27

> 起草: a-main 008
> 用途: a-review 重大指摘 #1 (NEW.id::text ハードコード) の修正依頼
> 前提: PR #87 (feature/cross-history-delete-specs-batch14-auto-v2) は REQUEST CHANGES 状態

## 投下短文（東海林さんが a-auto にコピペ）

```
【a-main-008 から a-auto へ】PR #87 cross-history #47 修正依頼（spec 30 分程度）

▼ 経緯
PR #87 (feature/cross-history-delete-specs-batch14-auto-v2) は a-review レビューで以下判定:
- ✅ #2 (search_path 固定) / #3 (whitelist) / #4 (regex) / #5 (DoS guard, revoke PUBLIC) → 完全修正
- ❌ **#1 NEW.id::text ハードコード問題 → 未修正、REQUEST CHANGES**

レビューレポート: docs/review-pr87-cross-history-202604270*-a-review.md（branch: feature/review-bloom-shoji-status-20260426、commit 8210579）

▼ 重大指摘 #1 の内容

cross-history Trigger 関数内で `NEW.id::text` が ハードコードされている。
- 対象: cross-history Trigger（cross_history_audit_log() 等）
- 問題: bud_transfers の PK は `id` ではなく `transfer_id`（テーブルごとに PK 列名が異なる）
- 影響: bud_transfers / leaf_kanden_cases / 他 PK が `id` 以外のテーブルで INSERT すると **SQL ERROR で 100% 失敗**
- 結果: 経理 / 関電業務 / 他多数の業務が止まる

▼ 修正案 A（Trigger 引数化、推奨）

```sql
-- 修正前（ハードコード）
CREATE TRIGGER trg_cross_history_xxx
  BEFORE INSERT ON bud_transfers
  FOR EACH ROW
  EXECUTE FUNCTION cross_history_audit_log();
  
-- Trigger 関数内: NEW.id::text ← ハードコード
INSERT INTO cross_history (entity_id, ...) VALUES (NEW.id::text, ...);

-- 修正後（引数化）
CREATE TRIGGER trg_cross_history_xxx
  BEFORE INSERT ON bud_transfers
  FOR EACH ROW
  EXECUTE FUNCTION cross_history_audit_log('transfer_id');  -- PK 列名を引数で渡す

-- Trigger 関数: TG_ARGV[0] で PK 列名を受け取り
DECLARE
  pk_col TEXT := TG_ARGV[0];
  pk_val TEXT;
BEGIN
  EXECUTE format('SELECT $1.%I::text', pk_col) USING NEW INTO pk_val;
  INSERT INTO cross_history (entity_id, ...) VALUES (pk_val, ...);
END;
```

▼ 修正範囲

1. spec ファイル: cross-history Trigger 仕様の引数化を明記
2. migration SQL: 全 cross-history Trigger 定義を引数付きに変更
3. 関連 Trigger 利用箇所（bud / leaf / forest / soil 等）の Trigger 定義を更新
4. tests: PK 列名が異なるテーブルでの動作確認

▼ 工数見込

- spec 改訂 + migration 修正: 30 分
- tests 追加: 30 分
- 結合確認: 30 分
- 合計: **約 1.5 時間**

▼ 制約

- branch: feature/cross-history-delete-specs-batch14-auto-v2（既存 PR #87 のブランチ）
- 既存 commit 履歴は維持、追加 commit で対応
- 修正完了後、a-main 経由で a-review に再レビュー依頼

▼ 詰まり時

即停止 → a-main 経由で東海林さんに相談
特に Trigger 関数の引数化が既存 spec 全体に与える影響範囲が大きい場合、判断保留可

▼ 完了報告

修正 commit + push 完了次第、a-main 経由で a-review に再レビュー依頼。
5/3 GW 中盤までに merge 完了が目標。

▼ 報酬

これで a-review 重大指摘 #47 が完全修正、cross-history Trigger が全モジュールで安全に動作。
品質最優先で進めてください。
```

## 完了後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | a-auto が修正実装 + push | a-auto |
| 2 | a-main 経由で a-review に再レビュー依頼 | a-main |
| 3 | a-review 再レビュー → APPROVE 期待 | a-review |
| 4 | merge 実行（cross-history 全モジュール影響、慎重に）| 東海林さん or a-main |
| 5 | conflict 解消（develop との 3 ahead / 11 behind 状態）| a-main or a-auto |

## 改訂履歴

- 2026-04-27 初版（a-main 008、a-review #87 REQUEST CHANGES 受領 → a-auto 修正依頼）
