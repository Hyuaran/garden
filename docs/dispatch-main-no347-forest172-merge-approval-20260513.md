# dispatch main- No. 347 — Forest PR #172 機能変更承認（§1 A 案 = root_bank 統合 + §2 D 案 = timestamp renumber）

> 起草: a-main-025（清書: a-writer-001）
> 用途: a-forest-002 への PR #172 設計衝突対応 + 機能変更例外承認 dispatch
> 番号: main- No. 347
> 起草時刻: 2026-05-13(水) 11:51（powershell.exe Get-Date 取得済、UTF-8 明示）
> 投下経路: a-main-025 が東海林さんへ投下用短文を提示 → 東海林さんが a-forest-002 にペースト

---

## 東海林さん向け 状況サマリ（4 列テーブル）

| 論点 | 推奨 | 論点要約 | 推奨要約 |
|---|---|---|---|
| Forest の作業が「他人の名前変更」と衝突した（テーブル名）| §1 A 案 = Forest 側を新しい名前に合わせる | Forest が 5/7 に作った銀行テーブル `bud_bank_accounts` が、5/13 朝 Root の名前変更で `root_bank_accounts` に変わり、両立できない状態 | Forest 側のコードと migration を新名称 `root_bank_accounts` に書換、命名統一 |
| Forest の作業が「同じ日付の名札」と衝突した（migration ファイル名）| §2 D 案 = Forest 側の日付を 5/7 → 5/13 に振り替え | 同じファイル名（timestamp）の migration が複数あると、将来 CLI 導入時に片方が黙ってスキップされる罠 | Forest の 3 ファイルを `20260513000003〜005` に振り替えて重複回避 |
| 通常 rebase は「機能変更 NG」だが今回は例外 | ✅ 例外承認（東海林さん 11:40 決裁済）| 上流の名前変更に追従するための書換は機能変更扱いだが、Forest 機能本質（仕訳帳）は不変 | commit を `chore` と `feat` に分離して履歴を明示、admin merge GO |
| 完了判定 | 1 行報告 + CI green | 「設計衝突解消した」と分かる完了条件が必要 | `mergeable` 状態 + Vercel CI 緑 + 1 行報告で完了、その後 a-main-025 が手動 apply 検証 |

---

## 投下用短文（東海林さんがコピー → a-forest-002 にペースト）

~~~
🔴 main- No. 347
【a-main-025 → a-forest-002 への dispatch（PR #172 設計衝突 §1 A 案 + §2 D 案 承認 + 機能変更例外承認）】
発信日時: 2026-05-13(水) 11:51

# 件名
PR #172 rebase 試行中に発見した 2 つの設計衝突に対する東海林さん採択結果通知 + 例外的機能変更承認

# A. 前提
forest-002 が dispatch # 345 受領 → develop rebase 試行 → 2 つの設計衝突発見 → a-main-025 へ判断保留報告。
a-main-025 は本番 DB 4 PR 全 apply 完了済（2026-05-13 11:32 JST）、本番側は健全化済。

# B. 採択結果（東海林さん最終決裁、2026-05-13 11:40 JST）
- §1 同名テーブル概念衝突（bud_bank_accounts）→ **A 案** = forest の `bud_bank_accounts` を `root_bank_accounts` に統合
- §2 migration timestamp 衝突（3 件）→ **D 案** = forest 3 migration を `20260513000003〜005` に renumber

# C. §1 A 案 実装指示（root_bank_accounts への統合）

## C-1. 背景
- 5/7 forest-002 が `bud_bank_accounts` を含む B-min Phase 1 設計を起票
- 5/11 PR #159 alpha が `bud_bank_accounts` を別途作成（本番 apply 済、5/11 22:07）
- 5/13 PR #171 (a-root-002) が `bud_bank_accounts → root_bank_accounts` に rename（本番 apply 完了済、a-main-025 が 2026-05-13 11:30 JST に手動 apply）
- 結果: develop 上の本番 schema には `root_bank_accounts` のみ存在、forest の migration が CREATE TABLE bud_bank_accounts を試行すると衝突

## C-2. 修正対象ファイル
- `supabase/migrations/20260507000001_bud_shiwakechou_b_min.sql`（後述 §D D 案で renumber 対象）: `bud_bank_accounts` 系の CREATE TABLE を削除 or `root_bank_accounts` を参照する FK 修正に変更
- `supabase/migrations/20260507000002_bud_corporations_accounts_seed.sql`（同 renumber 対象）: seed 投入先テーブル名を `root_bank_accounts` に変更（列構成は既存と一致確認）
- `src/lib/shiwakechou/types.ts` 等 forest コード: `bud_bank_*` 参照を `root_bank_*` に書換（types / API route / page.tsx 全件）

## C-3. 列構成整合確認（最重要、rebase 前に必ず実施）
本番 `root_bank_accounts` の列構成を以下 SQL で取得し、forest 側 17 列想定と完全一致するか照合：

    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='root_bank_accounts'
    ORDER BY ordinal_position;

不一致がある場合は **即停止** し a-main-025 へ報告（forest 想定列を本番に合わせるか、本番側に ALTER ADD COLUMN 追加するかの判断必要）。

## C-4. 機能変更承認の根拠
通常 rebase は機能変更 NG（chore 限定）だが、本件は:
- 上流 PR #171 の rename による命名変更**追従**
- forest 側の機能本質（B-min 仕訳帳）は不変、データ蓄積先テーブル名のみ整合
- 東海林さん明示承認（2026-05-13 11:40 JST）

→ **例外的に機能変更承認**。commit メッセージは以下 2 種類に分離:
- `chore(forest): rebase onto develop (a-main- No. 347)`
- `feat(forest): bud_bank_* → root_bank_* 参照統合 (#171 rename 追従、a-main- No. 347)`

# D. §2 D 案 実装指示（migration timestamp renumber）

## D-1. renumber 対象
- `20260507000001_bud_shiwakechou_b_min.sql` → `20260513000003_bud_shiwakechou_b_min.sql`（bud_* 7 テーブル + RLS + trigger）
- `20260507000002_bud_corporations_accounts_seed.sql` → `20260513000004_bud_corporations_accounts_seed.sql`（6 法人 + 12 口座 seed）
- `20260507000003_bud_master_rules_seed.sql` → `20260513000005_bud_master_rules_seed.sql`（714 共通マスタ seed）

## D-2. 実施手順
1. `git mv` で 3 ファイルを renumber
2. ファイル内コメントの「対応 dispatch」「作成日」セクションに renumber 注記追加:

    -- 注記 (2026-05-13 a-forest-002): timestamp 5/7 → 5/13 系に renumber
    --   理由: Bud Phase D 13 migration (20260507000001〜) と衝突
    --   対応 dispatch: main- No. 347

3. forest 内の参照箇所（README / spec / 連動ドキュメント）も timestamp 更新

## D-3. timestamp 配置の理論的整合
renumber 後の本番 apply 順序:
- 20260513000001 — PR #171 (rename) ← 既 apply
- 20260513000001 — PR #174 (wrapper 化) ← 既 apply、衝突状態は memory ② で後日修正
- 20260513000002 — PR #173 (deleted_at filter) ← 既 apply
- 20260513000003 — forest B-min schema ← 本 dispatch で renumber 後
- 20260513000004 — forest seed (corp+account)
- 20260513000005 — forest seed (master_rules)

forest 3 件は **未 apply** なので、renumber 後の merge → 別途 apply 検証フェーズへ進む（apply は admin merge 後、a-main-025 が Chrome MCP で実施予定）。

# E. やってほしいこと（手順、6 ステップ）
1. **本番列照合 SQL を gh CLI or Supabase Studio で実行** → 17 列一致確認（不一致なら即停止 → a-main-025 報告）
2. **§C A 案 実装**: `bud_bank_*` 参照を `root_bank_*` に全件書換（types / API / page / migration / seed）
3. **§D D 案 実装**: 3 migration ファイルを `git mv` で renumber + 注記追加
4. **rebase 完了**: `git rebase --continue` or `git rebase origin/develop` で conflict 解消
5. **テスト維持確認**: `npm test src/lib/shiwakechou` で 155 tests 全 pass / 全体 1,040+ tests 全 pass / TypeScript 0 エラー
6. **`git push --force-with-lease`** で PR #172 更新 → 完了報告 1 行で a-main-025 へ返信（例: 「§1 + §2 反映完了、conflict 全件解消、CI green、admin merge GO」）

# F. 制約
- §1 + §2 以外の機能変更 NG（rebase + 上記 2 件のみ）
- 列構成不一致を検知したら**即停止** → a-main-025 報告
- commit メッセージは §C-4 の 2 種類フォーマット厳守
- commit メッセージに `[a-forest-002]` タグを含める

# G. 完了条件
- `gh pr view 172 --json mergeable` で `MERGEABLE`
- Vercel CI green
- a-main-025 への完了報告 1 行
- a-main-025 が admin merge → a-main-025 が Chrome MCP で 3 migration を手動 apply → 検証完了で 5/13 仕訳帳本番運用ゲート解放

# self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用（SQL / commit / 注記はインデント or inline code で表現）
- [x] 起草時刻 = 実時刻（UTF-8 明示 Get-Date 取得済、2026-05-13(水) 11:51）
- [x] 番号 = main- No. 347（v6 規格 +1 厳守、# 346 → # 347、派生命名なし）
~~~

---

## 参考情報（投下対象外、a-main / a-forest-002 内部参照用）

### 関連リソース
- handoff-025.md §1 / §2 No. 2
- 本番 DB 4 PR apply 完了報告（a-main-025、2026-05-13 11:32 JST）
- forest-002 判断保留報告（2026-05-13 朝、§1 §2 A〜D 案提示）
- memory ② `feedback_migration_timestamp_collision.md`（本日新規、timestamp 衝突地雷）
- memory ④ `feedback_cross_module_schema_collision.md`（本日新規、本件の構造的教訓）
- memory ⑤ `feedback_rebase_feature_change_approval.md`（本日新規、機能変更承認プロトコル）
- memory ⑥ `feedback_design_conflict_options_presentation_sop.md`（本日新規、選択肢提示 SOP）

### sentinel 5 項目代行チェック（a-writer-001 実施、AGENTS.md §3）

| # | 項目 | 結果 |
|---|---|---|
| 1 | 状態冒頭明示 | ✅ 私の応答冒頭で [稼働中、清書専門モード] 明示 |
| 2 | 提案 / 報告 = 厳しい目 N ラウンド発動済 | ✅ main 側で東海林さん 11:40 即決完了、清書段階は対象外 |
| 3 | dispatch v6 規格通過済 | ✅ # 347 単純 +1 / `-ack` `-rep` 派生なし / ~~~ ラップ + コードブロック不使用 / 冒頭 3 行規格 |
| 4 | ファイル参照 = ls で物理存在検証済 | ✅ draft ファイル + a-main-025 drafts 全件確認済 |
| 5 | 既存実装関与 = 客観検証 | ✅ draft 内 PR 番号 / migration timestamp / commit hash / apply 完了時刻は draft 出典として継承 |

### §11 大原則 実践記録（AGENTS.md §11 新設後 初実践）

| 項目 | 内容 |
|---|---|
| 曜日確認 | UTF-8 明示 Get-Date 取得 → (水) 確認、draft 記述 (水) と一致、§11-3 違反例の再発なし |
| 推測の混入 | なし。SQL / migration timestamp / commit hash は draft 出典の客観事実として継承 |
| 警告発信 | 該当なし。本 dispatch は東海林さん最終決裁済の正規承認 dispatch、3 ラウンド検証対象外 |
| 機能変更承認の例外性 | ~~~ 内 §C-4 で明示記述、通常規約からの逸脱を透明化 |
