# PR #83 レビュー — leaf SECURITY DEFINER 修正（a-review #65 対応）

- **対象**: PR #83 / branch `feature/leaf-a1c-task-d1-pr-v2`
- **base**: `develop`
- **mergeStateStatus**: `CLEAN` ✅
- **diff**: 1772 additions / 1 deletion / 6 files
- **作成**: 2026-04-27（a-review GW セッション）

## 📋 概要

a-review が PR #65 で指摘した 2 件の重大セキュリティ事項を、**期待を上回る厳格さ**で修正完了。`search_path = ''`（pg_catalog すら含まない最小権限）+ schema 完全修飾 + サーバー側 bcrypt 化で、攻撃面を最小化。

## 🔍 2 重大指摘の修正状況

| # | 指摘内容 | 状態 |
|---|---|---|
| 1 | SECURITY DEFINER 関数 4 本に `search_path` 未設定（schema poisoning） | ✅ **完全修正（提案より厳格）** |
| 2 | `set_image_download_password` がクライアント hash 受取 → 平文格納事故余地 | ✅ **完全修正（client bcrypt 撤廃）** |

---

## ✅ #65-1 SECURITY DEFINER search_path — 模範的修正

### 検出 4 関数すべてに `SET search_path = ''` 適用

| 関数 | 行（migration） | 行（scripts patch） | search_path | 修飾 |
|---|---|---|---|---|
| `public.leaf_user_in_business(biz_id text)` | 1308 | 1766 | `''` | ✅ |
| `public.leaf_kanden_attachments_history_trigger()` | 1492 | 1944 | `''` | ✅ |
| `public.verify_image_download_password(input_password text)` | 1563 | 2013 | `''` | ✅ |
| `public.set_image_download_password(new_password text)` | 1590 | 2037 | `''` | ✅ |

### 評価ポイント

1. **`search_path = ''` を採用** — 私が a-review #65 で推奨した `pg_catalog, public, pg_temp` よりさらに厳格。schema poisoning に対する完璧な防御。pg_catalog すら明示参照を要求 → `pg_catalog.now()` 等のフルパス記述を強制。
2. **schema 完全修飾**: `public.leaf_user_in_business` / `extensions.crypt()` / `extensions.gen_salt()` でテンプレートインジェクション無効化
3. **`auth.uid()` を `(SELECT auth.uid())` で囲む防御的記述** — search_path が空でも sub-SELECT で確実解決
4. **`EXECUTE format('SELECT ($1).%I::text', col_name)` の安全性**:
   - `col_name` は `information_schema.columns` 由来（実在識別子のみ）
   - `%I` で識別子クオート
   - `$1` は USING プレースホルダ
   - → SQL injection 不可

### 更に良い点（spec の自己記述）

migration コメント (line 20-35) に「**ANY user が自分のスキーマに `crypt` / `auth.uid` 等の同名関数を作っても、SECURITY DEFINER 関数の動作を乗っ取れない**」と理由を明記。後続セッションが本パターンを再利用しやすい。

---

## ✅ #65-2 set_image_download_password — 設計レベルで根治

### 修正前（client hash 渡し）→ 修正後（server hash）

```sql
-- 修正前（脆弱）
CREATE FUNCTION set_image_download_password(new_hash text)  -- ★ クライアント hash
  -- クライアントが bcryptjs で hash 化 → サーバへ hash 送信
  -- → クライアント hash ロジックがバグれば平文格納

-- 修正後（堅牢）
CREATE FUNCTION public.set_image_download_password(new_password text)  -- ★ 平文受取
  ...
  -- サーバ内で extensions.crypt(new_password, extensions.gen_salt('bf', 12)) で hash 化
```

### 副次的な良い変更

- **client bcryptjs 不要化** → plan v3.1 Task A.7 が「平文 PW 入力 → 直接 RPC 送信」に簡略化
- **`bcryptjs` npm パッケージ削除候補化**（line 89: 別 PR で削除予定）→ a-review #70 で指摘した「npm 5 個 PR スコープ齟齬」の bcryptjs が、本修正で実際に不要になり整合性向上
- **bcrypt rounds = 12** で 2026 年水準の計算コスト確保

### 唯一の懸念（軽微 🟢）

サーバー側で平文 PW を受け取るため、**TLS 終端後のサーバーログに PW が出力されないか**は要確認。Supabase Edge Function / Postgres ログ設定で `LOG: statement: SELECT set_image_download_password('actual-password')` が記録される設定だと事故になる。

**推奨**: Supabase ダッシュボードで `log_statement = 'none'` または `'ddl'` を確認、`'all'` / `'mod'` だと PW がログに残る危険。runbook に「postgres ログ確認」項を追加するとさらに堅牢。

---

## 📚 known-pitfalls.md 横断チェック

- #1 timestamptz 空文字: ✅ 該当なし
- #2 RLS anon 流用: ✅ Route Handler 経由（PR #66 で確認済）
- #3 空 payload insert: ✅ 該当なし
- #4-#7 KoT 関連: ✅ 該当なし
- #8 deleted_at vs is_active: ✅ 該当なし

## 🚦 判定

### ✅ APPROVE（マージ可、軽微な提案 1 件）

**マージ後 Phase 2 で対応推奨**:
- 🟢 **Postgres ログ設定確認**: `set_image_download_password` の RPC 呼出時に PW が postgres ログに出力されないか確認、runbook 追記推奨

`mergeStateStatus: CLEAN` で conflict なし、Vercel preview build 確認後 merge 進めて問題ありません。

## 🎯 重大度サマリ

| 修正 | 件数 | 詳細 |
|---|---|---|
| 🔴 重大 | 0 | — |
| 🟡 推奨 | 0 | — |
| 🟢 任意 | 1 | postgres ログ設定確認・runbook 追記 |

---

🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
