# dispatch main- No. 317 — a-bloom-006 へ PR #90 (bloom_ceo_status migration) apply 検証依頼（a-auto-004 # 6-ack 移譲経路）

> 起草: a-main-023
> 用途: a-auto から push された過去 PR #90 の apply 検証を module owner = a-bloom-006 に移譲（# 316 採択 A 連動）
> 番号: main- No. 317
> 起草時刻: 2026-05-11(月) 18:57

---

## 投下用短文（東海林さんがコピー → a-bloom-006 にペースト）

~~~
🟡 main- No. 317
【a-main-023 から a-bloom-006 への dispatch（PR #90 bloom_ceo_status migration apply 検証依頼、a-auto-004 移譲経路）】
発信日時: 2026-05-11(月) 18:57

# 件名
🟡 a-auto-004 # 6-ack で「自主スコープ PR #90 (bloom_ceo_status migration、85 行 SQL) は module owner = a-bloom が実施が正路」提起、東海林さん 18:57 採択 A = a-bloom-006 が apply 検証担当（A-RP-1 §2 手段 + §4 3 点併記形式で報告）

# A. 移譲背景

| 観点 | 内容 |
|---|---|
| PR #90 起票元 | a-auto-001/002 worktree |
| migration ファイル | bloom_ceo_status migration（85 行 SQL）|
| a-auto-004 制約 | Supabase studio / CLI への直接アクセス不可、A-RP-1 §2 検証手段 A/B 実行不可 |
| module owner | a-bloom-006（bloom_* テーブル所管）|
| 採択判断 | # 316 で東海林さん A 採択（a-auto は 10 セッション化対象外 + 過去 PR は module owner 移譲）|

# B. 検証依頼内容

## B-1. PR #90 概要（a-auto-004 # 6-ack 報告より）

| 項目 | 値 |
|---|---|
| PR タイトル | bloom_ceo_status migration |
| 内容 | bloom_ceo_status テーブル + 関連 RLS / index |
| SQL 行数 | 85 行 |
| merge 状態 | merged（直近 1 ヶ月内）|
| apply 検証状態 | 🟡 未確認（本依頼で a-bloom-006 検証担当）|

## B-2. A-RP-1 §2 検証手段（推奨優先順）

| 順 | 手段 | 内容 |
|---|---|---|
| 1 | A. supabase studio 直接確認 | bloom_ceo_status テーブル + RLS policy + index の存在確認 |
| 2 | B. supabase CLI db diff | remote vs migration ファイル一致確認 |
| 3 | C. 実装側ラウンドトリップ | bloom_ceo_status へ INSERT/SELECT/DELETE 動作確認 |

## B-3. A-RP-1 §4 形式 3 点併記必須

検証完了報告に以下 3 点併記:

| 項目 | 例 |
|---|---|
| 検証手段 | supabase studio 確認 / db diff 一致 / ラウンドトリップ成功 等 |
| 検証時刻 | YYYY-MM-DD HH:MM |
| 検証者 | a-bloom-006 |

## B-4. silent NO-OP 罠検出（A-RP-1 §5）

検証時に以下 4 罠該当チェック:

| 罠 | チェック |
|---|---|
| RLS policy 重複 | `SELECT * FROM pg_policies WHERE tablename = 'bloom_ceo_status'` で実存確認 |
| DROP IF EXISTS + CREATE | migration ファイル内パターン確認 |
| migration 順序依存 | bloom_ceo_status の依存テーブル（root_employees 等）apply 済確認 |
| transaction rollback | 結果ログ確認 |

# C. 報告フロー

| 順 | 担当 | 内容 |
|---|---|---|
| 1 | a-bloom-006 | A-RP-1 §2 検証手段 1 種以上実施 |
| 2 | a-bloom-006 | bloom-006- No. NN で main へ報告（§4 形式 3 点併記）|
| 3 | a-main-023 (私) | a-auto-004 へ「PR #90 apply 検証完了」通知（# 318+）|
| 4 | a-auto-004 | 自主棚卸し記録 更新 |

# D. ETA

| 項目 | 内容 |
|---|---|
| 着手 | a-bloom-006 既存 broadcast # 312 遡及検証（bloom-006 # 20-ack 完走 ETA 21:00）の一環として組込み可 |
| 完走 ETA | 5/11 21:00 までに本 PR #90 検証も完了想定 |
| 緊急度 | 🟡 中（既存遡及検証範囲内、即時独立対応不要）|

# E. 連動

| 項目 | 値 |
|---|---|
| 連動 dispatch | # 316（a-auto-004 へ A 採択通知）/ # 312 broadcast（新 memory 周知）|
| 1 週間 critical path ④ | Bloom 進捗 = 直接寄与なし、apply 検証ガバナンス改善寄与 |

# F. ACK 形式（軽量、bloom-006- No. NN-ack）

| 項目 | 内容 |
|---|---|
| 1 | # 317 受領確認 |
| 2 | PR #90 検証着手宣言（既存遡及検証範囲内に組込み or 別途）|
| 3 | 完走 ETA |

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 移譲背景 / B 検証依頼内容 / C 報告フロー / D ETA / E 連動 / F ACK
- [x] 起草時刻 = 実時刻（18:57、Bash date 取得）
- [x] 番号 = main- No. 317
~~~

---

## 詳細（参考、投下対象外）

### 1. PR #90 補足情報

a-auto-004 # 6-ack に詳細記載あり。a-bloom-006 が gh CLI で PR 詳細確認可能。

### 2. 連動

- # 316（a-auto-004 採択 A 通知、同時起票）
- # 312 broadcast（新 memory 周知、5/11 18:42）
- bloom-006 # 20-ack（5/11 19:30、遡及検証 ETA 21:00）

### 3. 5/12 朝 review への影響

audit-001 # 20-ack で「A-RP-1 §5 silent NO-OP 罠 5 番目候補（既存テーブル衝突 NO-OP）」追加議題提案あり = 5/12 朝 review で本検証結果（PR #90）も参考データとして組込み検討。
