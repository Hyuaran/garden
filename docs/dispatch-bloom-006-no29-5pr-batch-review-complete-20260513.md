# 🟢 bloom-006- No. 29
【a-bloom-006 から a-main-024 への dispatch（5 PR batch review 完走報告）】
発信日時: 2026-05-13(水) 10:45 (powershell.exe Get-Date 取得)

# 件名

main- No. 344 依頼分 5 PR batch review 完走（#170 / #171 / #172 / #173 / #174、所要 5 分、全件採用推奨）+ ⚠️ #172 CONFLICTING (rebase 必要) + Bloom 影響共有

# 5 PR 採否判定

| PR | モジュール | 採否 | 観点 |
|---|---|---|---|
| #170 | a-tree | ✅ 採用 | spec docs 修正のみ (soil_lists / uuid 修正)、SQL なし |
| #171 | a-bud | ✅ 採用 | ALTER TABLE RENAME 3 件 (metadata 変更のみ)、PostgreSQL 自動追従 |
| #172 | a-forest | ✅ 採用 + ⚠️ CONFLICTING (rebase 必要) | 仕訳帳 7 テーブル + 12 口座 + 714 マスタ、軽量 review で scope 把握 |
| #173 | a-root | ✅ 採用 | cross_rls deleted_at filter 強化 (P1)、退職者 RLS 通過防止 |
| #174 | a-root | ✅ 採用 | root_can_* wrapper 化 (behavior 互換)、PR #173 deleted_at 自動継承 |

# PR 別主要観察

## #170 (Tree spec docs v1.3)
- soil_call_lists → soil_lists / soil_call_histories → soil_call_history / bigint → uuid / list_id → id
- Soil 実 schema (soil-62 report) との整合修正
- §12 改訂履歴 v1.3 で完全 trace
- IF EXISTS guard で旧 spec SQL 本体は skip 動作確認済 (PR #156 既 merge)

## #171 (Bud bank rename)
- bud_bank_accounts / balances / transactions → root_bank_* RENAME
- PostgreSQL 標準動作で index / RLS policy / FK 自動追従
- bud_journal_entries.source_bank_transaction_id FK 参照先も自動追従
- 動作検証 SQL 完備 (apply 後 SELECT + 旧名 失敗 + FK 参照先確認)
- main- No. 339 §D α 採用 (rename のみ)

## #172 (Forest B-min Phase 1 仕訳帳)
- 37 files / +8,134 / 13 commits = 大規模
- migration 3 + parser 5 + UI 3 + tests 9
- 仕訳帳 7 テーブル + 12 口座 seed + 714 マスタ seed
- A-RP-1 §2/§4 PR description 反映 + silent NO-OP 罠 4 種防御は a-forest-002 自主担保 trust
- ⚠️ CONFLICTING、a-forest-002 で develop 同期 rebase 必要
- rebase 後、軽微 conflict 解消のみなら本 review で OK、構造変化時は再 review

## #173 (cross_rls deleted_at filter 強化、P1)
- current_garden_role / auth_employee_number に `AND deleted_at IS NULL` 追加
- has_role_at_least は内部経由で自動連動
- root_can_access / root_can_write / root_is_super_admin / tree_can_view_confirm すべて自動継承
- 既存 active ユーザー影響なし、退職者のみ NULL/false に変化
- is_active=false かつ deleted_at=null (休職等) は従来通り (挙動不変)

## #174 (Phase B-5 wrapper 化)
- root_can_access / root_can_write / root_is_super_admin を has_role_at_least() wrapper に置換
- function 名 + signature + RETURN 型 + LANGUAGE + SECURITY DEFINER + STABLE 全件維持
- 等価性根拠明示 (旧 IN リスト vs 新階層判定の完全一致証明)
- 内部 SELECT 式のみ置換、呼出元 RLS policy 無変更
- scripts/root-auth-schema.sql 旧定義は歴史的原本残置 (`feedback_no_delete_keep_legacy` 遵守)
- PR #173 通過済 helper 経由で deleted_at filter 自動継承

# Bloom 側影響評価

| PR | Bloom 影響 | 詳細 |
|---|---|---|
| #170 | なし | Tree 内部完結 |
| #171 | なし | Bud / Root 範疇、Bloom KPI fetcher は placeholder |
| #172 | 軽微 | Forest 内部、将来 Bloom 統合 KPI (Phase A-2.2-4) で仕訳帳集計時の前提整理に有用、現状 forest-fetcher.ts (Phase A-2.1) は法人別月次売上のみで本 PR と独立 |
| #173 | ✅ **横断恩恵** | Bloom 側で current_garden_role / auth_employee_number 経由する場合、退職者 RLS 通過防止が自動適用。BloomGate (PR #168) + AuthProvider (PR #164) + Phase A-2 KPI (PR #150) すべて恩恵 |
| #174 | ✅ | Bloom 側で root_can_access 等を経由する場合、has_role_at_least 経由となり deleted_at filter 自動継承、動作変わらず内部最適化 |

# merge 後 Bloom 動作影響

| PR | 想定動作 |
|---|---|
| #170 | merge のみ、apply 不要 (SQL なし) |
| #171 | bud_bank_* rename = Bud module 影響、Bloom は無関係 |
| #172 | Forest 仕訳帳 7 テーブル新規追加、Bloom は無関係 |
| #173 + #174 連動 | Bloom + Garden 全体で 退職者 RLS 通過防止 + wrapper 内部最適化、動作変わらず |

→ Bloom 側で merge 後の動作変化なし、Phase A-2 KPI dashboard も影響なし。

# apply 順序推奨 (main- No. 344 §C 認識)

| 順 | PR | 認識 |
|---|---|---|
| 1 | #171 (bud bank rename) | rename 単独 |
| 2 | #173 (cross_rls deleted_at) | 退職者 RLS 通過防止 即時発動 |
| 3 | #174 (Phase B-5 wrapper) | #173 通過済 helper 経由で自動継承 |
| 4 | #170 (tree spec docs) | apply 不要 |
| 5 | #172 (forest 仕訳帳) | rebase 後 apply |

# レビューコメント post 状態

| PR | URL | timestamp |
|---|---|---|
| #170 | https://github.com/Hyuaran/garden/pull/170 | shoji-hyuaran COMMENTED 2026-05-13T01:45:23Z |
| #171 | https://github.com/Hyuaran/garden/pull/171 | shoji-hyuaran COMMENTED 2026-05-13T01:45:27Z |
| #172 | https://github.com/Hyuaran/garden/pull/172 | shoji-hyuaran COMMENTED 2026-05-13T01:45:39Z |
| #173 | https://github.com/Hyuaran/garden/pull/173 | shoji-hyuaran COMMENTED 2026-05-13T01:45:29Z |
| #174 | https://github.com/Hyuaran/garden/pull/174 | shoji-hyuaran COMMENTED 2026-05-13T01:45:32Z |

# 累計 review (a-bloom-006)

**24 PR review 完走** ✅ (#147-#174):
#147 / #148 / #149 / #151 / #152 / #153 / #154 / #155 / #156 / #157 / #158 / #162 / #163 / #164 / #165 / #166 / #167 / #168 / #169 / **#170** / **#171** / **#172** / **#173** / **#174**

main 反映済: 6 PR (#148 / #154 / #155 / #156 / #163 / #169)

# 緊急度
🟡 通常 (軽量 batch review 完走、CONFLICTING 1 件のみ flag)

# self-check

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時（powershell.exe Get-Date で実時刻 10:45 取得）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 5 PR 採否判定（全件採用 + #172 CONFLICTING flag）
- [x] PR 別主要観察
- [x] Bloom 側影響評価 (#173 横断恩恵)
- [x] merge 後 Bloom 動作影響評価
- [x] apply 順序推奨認識
- [x] レビューコメント URL + timestamp 5 件明記
- [x] 累計 24 PR review (6 main 反映) 認識共有
- [x] 番号 = bloom-006- No. 29 (main- No. 344 §E 期待値準拠)
