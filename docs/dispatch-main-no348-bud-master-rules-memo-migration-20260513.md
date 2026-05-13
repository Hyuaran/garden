# dispatch main- No. 348 — bud_master_rules.memo 列の正式 migration 化（5/13 手動 ALTER の source 整合性回復）

> 起草: a-main-026（清書: a-writer-001）
> 用途: a-forest-002 への手動 ALTER 永続化 + source/本番乖離 解消 dispatch
> 番号: main- No. 348
> 起草時刻: 2026-05-13(水) 15:13（powershell.exe Get-Date 取得済、UTF-8 明示）
> 投下経路: a-main-026 が東海林さんへ投下用短文を提示 → 東海林さんが a-forest-002 にペースト

---

## 東海林さん向け 状況サマリ（4 列テーブル）

| 論点 | 推奨 | 論点要約 | 推奨要約 |
|---|---|---|---|
| 「設計図と現物がズレている」状態を直す必要がある | 新しい migration を 1 件追加して整合 | 5/13 午後に SQL Editor で手動追加した `memo` 列が、ソースコード側に書かれていない | ソースコード側にも「memo 列を追加せよ」と書いた migration を 1 件起票、Forest 担当に依頼 |
| 急ぐ必要があるか | 🟡 中（本番は動作正常、源コードの整合のみ）| 本番 DB は memo 列がちゃんと動いていて困っていないが、新環境再構築や CLI 導入時に破綻リスク | 今のうちに直す。本番停止リスクなし、所要 30-45 分 |
| どの方式で直すか | B 案 = 新規 migration 追加（推奨）| A 案 既存ファイル書換は破壊的、B 案 新規追加は冪等（既に列があっても安全に NO-OP） | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS memo text;` を新 migration として起票 |
| 完了判定 | Chrome MCP で物理検証 + PR comment | 「本当に整合した」と確認できる証跡が必要 | 既存 memory「migration apply 検証 SOP」準拠、検証結果 + screenshot を PR comment 貼付 |

---

## 投下用短文（東海林さんがコピー → a-forest-002 にペースト）

~~~
🟡 main- No. 348
【a-main-026 → a-forest-002 への dispatch（bud_master_rules.memo 列の正式 migration 化、source 整合性回復）】
発信日時: 2026-05-13(水) 15:13

# 件名
bud_master_rules.memo 列の正式 migration 化（5/13 手動 ALTER の source 整合性回復、PR #172 merge 後の追加タスク）

# A. 依頼内容
5/13 午後に a-main-025 が SQL Editor で手動 ALTER した `bud_master_rules.memo` 列を、source repository へ正式 migration として登録する。新 migration 1 件起票 + merge + 物理検証で完結。

# B. 背景（客観事実）

## B-1. 5/13 m3 / m5 apply 経緯（handoff-026.md §0 遺言 2 より）
- Forest m3 apply: bud_corporations / bud_master_rules / bud_transactions / bud_files / bud_yayoi_exports / bud_audit_log 6 テーブル新規（14:30 頃 ✅）
- **手動 ALTER**: `ALTER TABLE bud_master_rules ADD COLUMN memo text;`（m5 apply 直前、a-main-025 が SQL Editor 直接 Run、✅）
- Forest m5 apply: 714 共通仕訳マスタ rules 投入、memo 列値含む 8 列の INSERT 文（14:42 頃 ✅）

## B-2. source 不整合の物理事実
- m3 source (`temp-m3.sql` L103-): `CREATE TABLE bud_master_rules` の列定義に `memo` 列なし
- m5 source (`temp-m5.sql` L12-): `insert into bud_master_rules (..., memo) values (..., '')` の 8 列目に memo を記述
- 本番 DB の現状: `memo text` 列が物理的に存在（手動 ALTER 経由）
- PR #172 で merge された Forest 5/13 migration の source: m3 に memo 列の追加なし

→ **本番 DB と source repository が乖離した状態**

## B-3. 何が問題か
- 新環境の再構築: source から本番を再現できない（memo 列が存在しない bud_master_rules テーブルが生成される）
- Supabase CLI 導入時: CLI が m3 source を正解として diff を取ると `memo` 列を「不要列」と判定して削除しかねない
- 開発者の認知: コード grep で memo 列を発見しても CREATE TABLE に存在せず混乱

# C. 修復方針（B 案 採用、a-main-026 推奨）

## C-1. 選択肢の比較
- A 案 = m3 ファイルの CREATE TABLE に memo 列を追記 + m3 を再 apply（既存 m3 DROP + CREATE 必要、破壊的）
- **B 案 ★採用** = 新 migration で `ALTER TABLE ... ADD COLUMN IF NOT EXISTS memo text;` を起票（冪等、非破壊的、CLI 導入時に正常追跡）
- C 案 = m3 ファイル直接書換 + 「本番 apply 不要」コメント明記（コメント漏れ事故リスク、git history 混乱）

## C-2. B 案 採用理由
- **冪等性**: `IF NOT EXISTS` で既存環境では NO-OP、新環境では ADD 実行 → どこで apply しても安全
- **CLI 導入時の正解パターン**: Supabase CLI が migration order で順次 apply する設計と一致
- **memory 準拠**: `feedback_migration_apply_verification_sop.md` の SOP に沿う

# D. やってほしいこと（実装フロー、6 ステップ）

## D-1. 起票前の事前検査（memory `feedback_migration_timestamp_collision.md` 準拠）
PowerShell で以下を実行し、衝突確認:

    ls supabase/migrations/20260513*
    ls supabase/migrations/20260514*

既存の memo 列追加 migration が無いことを確認:

    grep -r "ADD COLUMN.*memo" supabase/migrations/
    grep -r "bud_master_rules" supabase/migrations/

## D-2. timestamp 採番
- 既存 5/13 migration: `20260513000001` (PR #171 / #174 で衝突済 = 既知地雷) / `20260513000010` (forest m3 想定) / `20260513000020` (forest m4 想定) / `20260513000030` (forest m5 想定) など
- 新 migration 推奨 timestamp: **`20260513000040_add_memo_to_bud_master_rules.sql`**（forest m5 の次）
- **注**: 実際の forest m3/m4/m5 timestamp は a-forest-002 が現物で確認 + 衝突回避すること

## D-3. migration ファイル内容
ファイル `supabase/migrations/<timestamp>_add_memo_to_bud_master_rules.sql` を以下内容で作成（コードブロック禁止のためインデント表示、実際は通常 SQL ファイル）:

    -- 5/13 a-main-025 が SQL Editor で手動 ALTER した memo 列を、source repository へ正式登録
    -- 適用方法: Supabase Dashboard > SQL Editor で本ファイル内容を貼付し Run（既存環境では IF NOT EXISTS で NO-OP）
    -- 起源: handoff-026.md §0 遺言 2、dispatch # 348 (a-main-026)

    ALTER TABLE public.bud_master_rules
      ADD COLUMN IF NOT EXISTS memo text;

    COMMENT ON COLUMN public.bud_master_rules.memo IS '共通仕訳マスタの注釈欄（5/13 m5 投入時に追加、source 整合性回復 by # 348）';

    -- 動作検証 SQL
    -- SELECT column_name, data_type FROM information_schema.columns
    -- WHERE table_schema = 'public' AND table_name = 'bud_master_rules' AND column_name = 'memo';
    -- 期待結果: 1 行（memo / text）

## D-4. PR 起票
- ブランチ名: `feature/forest-bud-master-rules-memo-migration-20260513`
- base: `develop`
- タイトル: `feat(forest): bud_master_rules.memo 列を正式 migration 化（5/13 手動 ALTER の source 整合性回復、dispatch # 348）`
- 本文: 本 dispatch §B / §C / §D-3 内容 + 5/13 経緯の客観記述

## D-5. commit メッセージ（インデント表示、実際は通常 commit メッセージ）

    feat(forest): bud_master_rules.memo 列を正式 migration 化

    5/13 m5 apply 前に a-main-025 が SQL Editor で手動 ALTER した memo 列を、
    source repository へ正式登録（冪等 IF NOT EXISTS）。

    - m3 source の CREATE TABLE には memo 列定義なし
    - m5 INSERT 文は memo 列値を含む（手動 ALTER 経由で apply 済）
    - 新環境再構築時 / CLI 導入時の silent NO-OP 罠予防

    dispatch # 348 (a-main-026)
    related: handoff-026.md §0 遺言 2
    related memory: feedback_migration_apply_verification_sop / feedback_migration_timestamp_collision

    [a-forest-002]

    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## D-6. merge 後の検証（memory `feedback_migration_apply_verification_sop.md` 準拠）
1. Chrome MCP で Supabase Studio SQL Editor を開く
2. 検証 SQL 実行:

       SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'bud_master_rules' AND column_name = 'memo';

3. 期待結果: 1 行（`memo` / `text` / `YES`）
4. screenshot 取得
5. PR comment 貼付（標準フォーマット、インデント表示）:

       ✅ apply 完了 (a-forest-002, 2026-05-13 HH:MM JST)
       - 検証手段: Chrome MCP + Supabase Studio SQL Editor
       - 検証クエリ: <上記 SQL>
       - 検証結果: memo / text / YES（既存 1 行確認、新規 ADD なし、IF NOT EXISTS による NO-OP 動作）
       - 検証者: a-forest-002
       - screenshot: <attached>

# E. 制約
- B 案以外の方式は採用しない（A / C 案は東海林さん採択時点で不採用）
- timestamp 衝突を起票前に必ず確認（PowerShell ls + grep）
- 詰まったら**即停止** → a-main-026 へ状況報告
- commit メッセージに `[a-forest-002]` タグを含める
- migration ファイル冒頭の「適用方法」コメントは必ず記述（既存 Garden 規約準拠）

# F. 完了条件
- 新 migration `<timestamp>_add_memo_to_bud_master_rules.sql` が develop に merge 済
- Chrome MCP で物理検証完了（memo 列の存在 + IF NOT EXISTS による NO-OP 動作確認）
- PR comment に検証結果（手段 + クエリ + 結果 + 検証者 + screenshot 5 点）貼付済
- a-main-026 への完了報告 1 行
- 想定所要時間: 30-45 分（migration 1 件 + PR 起票 + Chrome MCP 検証のみ）

# self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用（SQL / commit メッセージ / 検証 comment は 4-space インデントで表現）
- [x] 起草時刻 = 実時刻（UTF-8 明示 Get-Date 取得済、2026-05-13(水) 15:13）
- [x] 番号 = main- No. 348（v6 規格 +1 厳守、# 347 → # 348、派生命名なし）
~~~

---

## 参考情報（投下対象外、a-main / a-forest-002 内部参照用）

### 関連リソース
- handoff-026.md §0 遺言 2（5/13 m3 / m5 apply 経緯）
- PR #172 (Forest B-min Phase 1 仕訳帳)
- 朝の dispatch # 347（forest172-merge-approval、§1 + §2 完了）
- a-main-025 が 5/13 午後に SQL Editor で実施した手動 ALTER（時刻不明、m5 apply 直前）

### 関連 memory（必読）

| memory | 関連性 |
|---|---|
| `reference_supabase_manual_apply.md` | Garden 本番 = 手動 apply 設計、本件もこの前提で動く |
| `feedback_migration_apply_verification_sop.md` | merge 後 30 分以内の物理検証 SOP、本 dispatch §D-6 が直接準拠 |
| `feedback_migration_timestamp_collision.md` | 起票前の ls 確認必須、本 dispatch §D-1 が直接準拠 |
| `feedback_migration_apply_verification.md` | apply 完了記述に検証手段 + 時刻 + 検証者 3 点併記必須、§D-6 PR comment フォーマット準拠 |

### sentinel 5 項目代行チェック（a-writer-001 実施、AGENTS.md §3）

| # | 項目 | 結果 |
|---|---|---|
| 1 | 状態冒頭明示 | ✅ 私の応答冒頭で [稼働中、清書専門モード] 明示 |
| 2 | 提案 / 報告 = 厳しい目 N ラウンド発動済 | ✅ main 側で B 案推奨 + A / C 案比較済、清書段階は対象外 |
| 3 | dispatch v6 規格通過済 | ✅ # 348 単純 +1 / 派生命名なし / ~~~ ラップ + コードブロック不使用（4-space インデント代替）/ 冒頭 3 行規格 |
| 4 | ファイル参照 = ls で物理存在検証済 | ✅ Test-Path で draft ファイル確認済（True） |
| 5 | 既存実装関与 = 客観検証 | ✅ draft 内の 5/13 apply 経緯 / PR 番号 / source ファイル名 / timestamp 配置は draft 出典の客観事実として継承 |

### §11 大原則 実践記録（AGENTS.md §11、2 回目の実践）

| 項目 | 内容 |
|---|---|
| 曜日確認 | UTF-8 明示 Get-Date 取得 → (水) 確認、draft 起草時刻「2026-05-13(水) 15:08」と私の取得「15:13」整合 |
| 推測の混入 | なし。手動 ALTER 時刻は draft が「a-main-025 が SQL Editor 直接 Run」「m5 apply 直前」と記述、推測補完なし |
| 警告発信 | 該当なし。本 dispatch は B 案採択済の正規実装承認 dispatch、3 ラウンド検証対象外 |
| 不確実情報の透明化 | forest m3/m4/m5 の実 timestamp は draft が「forest-002 が現物で確認」と注記、私は推測補完せず注記をそのまま継承 |
