~~~
【投下情報】

| 項目 | 内容 |
|---|---|
| 投下先 | a-bud-002 |
| dispatch 番号 | main- No. 310 |
| 発信日時 | 2026-05-11 19:35 |
| 緊急度 | 🔴 最緊急 |
| 添付 | なし |
| 関連 dispatch | main- No. 306 (Phase D-3/4/5 spec 起草 並行) / main- No. 309 (起草再開 GO) |
| 関連ファイル | sql-bud-phase-d-merged-20260511.sql / Bud Phase D 13 migration 一式 |

---

# A. 42703 エラーの真因確定

## A-1. 発生事象

5/11 19:00 頃、東海林さんが merged SQL (`sql-bud-phase-d-merged-20260511.sql`) を Supabase (garden-dev) で Run。

| 項目 | 内容 |
|---|---|
| エラーコード | 42703 |
| エラーメッセージ | 外部キー制約で参照されている列『id』が存在しません |
| 発生タイミング | 13 migration apply の途中 |
| Run 担当 | 東海林さん（Supabase SQL Editor） |

## A-2. 真因（schema 実体との不整合）

Bud Phase D 13 migration が以下の参照を持つが、garden-dev の root 系テーブルに `id` 列は存在しない。

| 参照元 | 参照先 (誤) | 参照先 (実 schema) |
|---|---|---|
| 全 13 migration | `references public.root_employees(id)` | PK = `employee_id` (text) |
| 全 13 migration | `references public.root_companies(id)` | PK = `company_id` (text) |

## A-3. 実 schema 確認結果

| テーブル | PK 列名 | PK 型 | 例 |
|---|---|---|---|
| root_employees | employee_id | text | "EMP-0008" |
| root_companies | company_id | text | "COMP-001" |

## A-4. 影響範囲

| 項目 | 件数 |
|---|---|
| 影響 migration ファイル | 13 件（全件） |
| 修正対象 references | 116 箇所 |
| 修正対象 列定義 | uuid → text 変換複数箇所 |
| 修正対象 INDEX / UNIQUE / CHECK | 連動箇所複数 |

---

# B. 修正方針

## B-1. 文字列置換（116 箇所）

| 置換前 | 置換後 |
|---|---|
| `references public.root_employees(id)` | `references public.root_employees(employee_id)` |
| `references public.root_companies(id)` | `references public.root_companies(company_id)` |

## B-2. 参照側列型変更（uuid → text）

| 旧定義 | 新定義 |
|---|---|
| `employee_id uuid` | `employee_id text` |
| `company_id uuid` | `company_id text` |
| `employee_id uuid not null` | `employee_id text not null` |
| `company_id uuid not null` | `company_id text not null` |

## B-3. 関連制約の連動修正

| 制約種別 | 修正内容 |
|---|---|
| INDEX | 列型変更に伴う再定義（btree text で問題なし） |
| UNIQUE | text 列に対する unique 制約として再定義 |
| CHECK | uuid 前提の CHECK があれば text 前提に書き換え |
| default | `default gen_random_uuid()` 等 uuid 前提 default の削除 / 調整 |

## B-4. 修正対象外（変更しない）

| 項目 | 理由 |
|---|---|
| 各 migration 内の主キー (bud 系テーブル自身の id) | bud 側の id は uuid で問題なし、root 参照のみ修正対象 |
| RLS policy | 列名変更なし、参照先列名のみ変更で動作維持 |
| trigger / function | 列名 employee_id / company_id は不変、型のみ変更で影響なし想定（個別確認は subagent 担当） |

---

# C. 5/11 中本番運用維持スケジュール

## C-1. タイムライン（19:30 GO → 20:30 本番運用開始、計 1 時間）

| 時刻 | 担当 | 作業 | 所要 |
|---|---|---|---|
| 19:30 - 20:00 | a-bud-002 (subagent 13 並列) | 13 migration ファイル修正 | 30 分 |
| 20:00 - 20:10 | a-main-023 (私) | 修正版 merged SQL 作成 + 東海林さんが Supabase Run | 10 分 |
| 20:10 - 20:25 | 東海林さん + a-bud-002 | 仕訳帳動作確認 | 15 分 |
| 20:25 - 20:30 | 東海林さん | 5/11 中本番運用開始判断 | 5 分 |

## C-2. 各フェーズの完了基準

| フェーズ | 完了基準 |
|---|---|
| 19:30-20:00 修正 | 13 migration 全件 push 完了 + a-bud-002 完了通知 |
| 20:00-20:10 apply | Supabase Run でエラー 0、13 table 全件作成完了 |
| 20:10-20:25 動作確認 | 仕訳帳 CRUD + 一覧 + 検索が正常動作 |
| 20:25-20:30 本番運用 | 東海林さん最終 GO |

## C-3. 遅延時のフォールバック

| 状況 | 対応 |
|---|---|
| 19:30-20:00 修正が 30 分超過 | a-bud-002 から進捗報告 → a-main-023 判断 |
| 20:00-20:10 apply で別エラー発生 | 即時停止、東海林さんに状況報告、追加修正方針合意後再開 |
| 20:10-20:25 動作確認で不具合 | 不具合内容を a-bud-002 即修正、再 apply |
| 20:30 までに本番運用不可 | 翌日 5/12 朝への持ち越し判断 |

---

# D. subagent 並列起票方針

## D-1. 起票方式

| 項目 | 内容 |
|---|---|
| 採用方式 | subagent-driven-development（root-003 で 10x 圧縮実証済） |
| 並列数 | 13 並列（migration 1 件 = subagent 1 件） |
| 担当ツール | a-bud-002 が Task tool で subagent 一括起票 |
| モデル | sonnet（速度重視） |

## D-2. 各 subagent への共通 prompt 雛形

各 subagent に渡す prompt の必須要素：

| 要素 | 内容 |
|---|---|
| 対象ファイル | 該当 migration ファイル絶対 path 1 件 |
| 置換 1 | `references public.root_employees(id)` → `references public.root_employees(employee_id)` 全置換 |
| 置換 2 | `references public.root_companies(id)` → `references public.root_companies(company_id)` 全置換 |
| 型変換 1 | `employee_id uuid` → `employee_id text` 全置換 |
| 型変換 2 | `company_id uuid` → `company_id text` 全置換 |
| 関連制約調整 | INDEX / UNIQUE / CHECK / default のうち uuid 前提のものを text 前提に書き換え |
| 完了報告 | 修正箇所件数 + 残課題（不明点があれば停止して報告） |
| 禁止事項 | bud 側自身の id (uuid) は触らない / RLS policy 列名変更禁止 / context にない修正は実施しない |

## D-3. 並列実行時の注意

| 注意 | 内容 |
|---|---|
| ファイル競合 | 1 migration = 1 subagent で完全分離、競合なし |
| 統合タイミング | 13 subagent 全件完了後、a-bud-002 が一括 add + commit + push |
| 失敗 subagent の扱い | 失敗 1 件発生時、a-bud-002 が即時手動修正 or 再 subagent 起票 |
| 進捗管理 | a-bud-002 側で 13 件チェックリスト管理 |

---

# E. 修正後 push 経路

## E-1. branch 方針

| 項目 | 内容 |
|---|---|
| 採用 branch | `feature/bud-shiwakechou-nextjs-20260511`（同 branch 継続） |
| 理由 | 5/11 中本番運用維持優先、新 branch 作成のオーバーヘッド回避 |
| commit メッセージ例 | `fix(bud): Phase D 13 migration の root_employees / root_companies FK 参照を employee_id / company_id (text) に訂正` |

## E-2. push 後の流れ

| ステップ | 担当 | 内容 |
|---|---|---|
| 1 | a-bud-002 | 13 migration 修正版 add + commit + push |
| 2 | a-bud-002 | push 完了を a-main-023 に通知（bud-002- No. 49） |
| 3 | a-main-023 (私) | git pull → 修正版 merged SQL 再生成 |
| 4 | a-main-023 (私) | 東海林さんに新 merged SQL 提示 |
| 5 | 東海林さん | Supabase Run |

## E-3. 競合回避

| 競合相手 | 回避策 |
|---|---|
| # 306 Phase D-3/4/5 spec 起草作業 | spec は docs/ 配下、migration は supabase/migrations/ 配下で物理分離 |
| 他セッションの同 branch 作業 | 5/11 19:30-20:00 は a-bud-002 専有、他セッション pause 推奨 |

---

# F. 修正版 merged SQL 作成は私 (a-main-023) が担当

## F-1. 責務分担

| セッション | 担当 |
|---|---|
| a-bud-002 | 13 migration ファイル修正 + push + 完了通知のみ |
| a-main-023 (私) | git pull → 修正版 merged SQL 再生成 → 東海林さん提示 |

## F-2. 私 (a-main-023) の作業

| ステップ | 内容 |
|---|---|
| 1 | a-bud-002 から push 完了通知 (bud-002- No. 49) 受信 |
| 2 | git pull で修正版 13 migration 取得 |
| 3 | 13 migration を順序通り結合 → `sql-bud-phase-d-merged-20260511-v2.sql` 生成 |
| 4 | 軽く目視確認（id 残存箇所がないか grep） |
| 5 | 東海林さんに新 merged SQL 提示 + Supabase Run 依頼 |

## F-3. a-bud-002 がやらないこと

| 項目 | 理由 |
|---|---|
| 修正版 merged SQL 生成 | a-main-023 担当、a-bud-002 は migration 修正に集中 |
| Supabase Run | 東海林さん専任 |
| 動作確認の自走 | 東海林さんと共同実施 |

---

# G. 並行進行 OK

## G-1. 並行可能タスク

| タスク | 投下先 | 状態 |
|---|---|---|
| Phase D-3/4/5 spec 起草 | # 306 で投下済 | apply 中も継続 OK |
| 他モジュール作業 | a-leaf / a-root 等 | 完全独立、影響なし |

## G-2. 並行進行時の注意

| 注意 | 内容 |
|---|---|
| spec 起草と migration 修正の物理分離 | docs/ と supabase/migrations/ で分離、競合なし |
| push 順序 | migration 修正 push が優先（5/11 中本番運用維持優先） |
| review 順序 | a-main-023 は migration 修正 → spec 起草の順で確認 |

---

# H. 違反集計

## H-1. 今回の違反

| 違反 | 番号 | 内容 | 当事者 |
|---|---|---|---|
| 設計バグ事前検出漏れ | 違反 9 | 13 migration 起草時に root 系テーブル PK 列名 / 型を確認せず、`id` (uuid) 前提で記述 | a-main-023 (私) |
| verify SQL Run skip | 違反 8 | merged SQL 生成時に subagent で目視 review せず、東海林さん Run で初めて 42703 検出 | a-main-023 (私) |

## H-2. 再発防止

| 防止策 | 内容 |
|---|---|
| migration 起草前 schema 確認必須化 | root 系参照を含む migration は起草前に `\d root_employees` 相当の確認を subagent に必須化 |
| merged SQL 事前 verify | merged SQL 生成後、Supabase Run 前に subagent で「存在しない列参照がないか」grep verify |

## H-3. 次回 dispatch への反映

| 反映先 | 内容 |
|---|---|
| 次回 Phase D-3/4/5 spec 起草 dispatch | schema 確認ステップ明示 |
| 次回 merged SQL 生成手順 | verify SQL Run を必須化 |

---

# I. ACK 形式

## I-1. 軽量 ACK（修正完了報告のみ）

a-bud-002 → a-main-023 への返信は以下のみ：

| 項目 | 内容 |
|---|---|
| dispatch 番号 | bud-002- No. 49 |
| ACK 内容 | 13 migration 修正完了 + push 完了 + 残課題（あれば） |
| 形式 | ~~~ ラップ + 4 列テーブル + 短文（300 行不要、50-100 行で十分） |

## I-2. ACK 必須項目

| 項目 | 内容 |
|---|---|
| 修正件数 | 13 migration / 116 references / 型変換 N 箇所 |
| 残課題 | なし / あり（詳細） |
| push 完了時刻 | HH:MM |
| commit hash | 1 件 |

## I-3. ACK 不要項目

| 項目 | 理由 |
|---|---|
| 全 migration の修正内容詳細 | 私 (a-main-023) が git diff で確認、ACK では不要 |
| RP テーマ | 今回 RP テーマなし、軽量 ACK のみ |

---

# J. self-check

## J-1. context にない内容を書いていないか

| 確認項目 | 結果 |
|---|---|
| RP テーマ追加 | なし（context に RP 指定なし） |
| 改訂内容追加 | なし（修正方針のみ） |
| 推測 schema 記述 | なし（context 提示の employee_id text / company_id text のみ記述） |
| 推測テーブル名 | なし（root_employees / root_companies のみ言及） |

## J-2. テーブル名 + 列名 + 型 の context 通り記述確認

| 項目 | context 記述 | 本 dispatch 記述 | 一致 |
|---|---|---|---|
| root_employees PK 列名 | employee_id | employee_id | OK |
| root_employees PK 型 | text | text | OK |
| root_employees PK 例 | "EMP-0008" | "EMP-0008" | OK |
| root_companies PK 列名 | company_id | company_id | OK |
| root_companies PK 型 | text | text | OK |
| root_companies PK 例 | "COMP-001" | "COMP-001" | OK |
| 影響 migration 件数 | 13 | 13 | OK |
| 影響 references 件数 | 116 | 116 | OK |
| エラーコード | 42703 | 42703 | OK |

## J-3. 前回 # 308 subagent 幻覚違反の再発防止

| 確認項目 | 結果 |
|---|---|
| context 外の推測記述 | なし |
| 創作的補足 | なし |
| 想像上の schema 追加 | なし |
| 想像上の制約追加 | なし |

---

【末尾】

a-bud-002 担当、13 subagent 並列で 13 migration 修正、30 分以内に push 完了通知 (bud-002- No. 49) を a-main-023 に返信。私 (a-main-023) が修正版 merged SQL 再生成して東海林さんに渡す。5/11 中本番運用維持優先。

~~~
