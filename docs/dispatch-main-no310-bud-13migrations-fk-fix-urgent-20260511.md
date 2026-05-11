# dispatch main- No. 310 — a-bud-002 へ Bud Phase D 13 migration FK 修正依頼（id 列不在 → employee_id / company_id + text 型変換、5/11 中本番運用維持）

> 起草: a-main-023
> 用途: Bud Phase D 13 migration の root 系 FK 参照を実 schema に整合修正、5/11 中仕訳帳本番運用維持
> 番号: main- No. 310
> 起草時刻: 2026-05-11(月) 18:35

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 310
【a-main-023 から a-bud-002 への dispatch（Bud Phase D 13 migration FK 修正依頼、5/11 中本番運用維持）】
発信日時: 2026-05-11(月) 18:35

# 件名
🔴 Bud Phase D 13 migration が root_employees(id) / root_companies(id) を参照しているが、garden-dev に id 列は不在（実 PK = employee_id / company_id、text 型）。13 件全件 subagent 並列で 30 分以内修正 → 5/11 中本番運用維持

# A. 42703 エラーの真因確定

| 観点 | 値 |
|---|---|
| エラーコード | 42703 |
| エラーメッセージ | 外部キー制約で参照されている列『id』が存在しません |
| 発生 | 5/11 19:00 東海林さん Supabase Run 時 |
| 影響 migration | 13 件全件 |
| 修正対象 references | 116 箇所 |

# B. 実 schema 確認結果

| テーブル | PK 列名 | PK 型 | 例 |
|---|---|---|---|
| root_employees | employee_id | text | "EMP-0008" |
| root_companies | company_id | text | "COMP-001" |

# C. 修正方針

## C-1. 文字列置換（116 箇所）
| 置換前 | 置換後 |
|---|---|
| references public.root_employees(id) | references public.root_employees(employee_id) |
| references public.root_companies(id) | references public.root_companies(company_id) |

## C-2. 参照側列型変更（uuid → text）
| 旧 | 新 |
|---|---|
| employee_id uuid | employee_id text |
| company_id uuid | company_id text |
| 同 not null 等修飾子 | 修飾子維持で型のみ変更 |

## C-3. 関連制約の連動修正
| 制約種別 | 修正内容 |
|---|---|
| INDEX | text 列で再定義（btree text で問題なし）|
| UNIQUE | text 列に対する unique 制約として再定義 |
| CHECK | uuid 前提 CHECK あれば text 前提に書き換え |
| default | default gen_random_uuid() 等 uuid 前提 default 削除 / 調整 |

## C-4. 修正対象外（変更しない）
| 項目 | 理由 |
|---|---|
| 各 migration 内の主キー (bud 系テーブル自身の id, uuid) | bud 側 id は uuid で問題なし、root 参照のみ修正対象 |
| RLS policy | 列名変更なし、参照先列名のみ変更で動作維持 |
| trigger / function | 列名 employee_id / company_id は不変、型のみ変更で影響なし想定（subagent 個別確認）|

# D. 5/11 中本番運用維持スケジュール

現在 18:35 → 19:30 本番運用開始目標（約 55 分）

| 時刻 | 担当 | 作業 | 所要 |
|---|---|---|---|
| 18:35-19:05 | a-bud-002 (subagent 13 並列) | 13 migration ファイル修正 | 30 分 |
| 19:05-19:10 | a-main-023 (私) | git pull + 修正版 merged SQL 再生成 + 東海林さん提示 | 5 分 |
| 19:10-19:15 | 東海林さん | Supabase Run | 5 分 |
| 19:15-19:30 | 東海林さん + a-bud-002 | 仕訳帳動作確認 | 15 分 |
| 19:30 | 東海林さん | 5/11 中本番運用開始判断 | — |

# E. subagent 並列起票方針

| 項目 | 内容 |
|---|---|
| 採用方式 | subagent-driven-development（root-003 で 10x 圧縮実証済）|
| 並列数 | 13 並列（migration 1 件 = subagent 1 件）|
| 担当ツール | a-bud-002 が Task tool で subagent 一括起票 |
| モデル | sonnet（速度重視）|

各 subagent に渡す prompt 必須要素:
- 対象 migration ファイル絶対 path 1 件
- 置換 1: references public.root_employees(id) → references public.root_employees(employee_id) 全置換
- 置換 2: references public.root_companies(id) → references public.root_companies(company_id) 全置換
- 型変換 1: employee_id uuid → employee_id text
- 型変換 2: company_id uuid → company_id text
- 関連制約調整: INDEX / UNIQUE / CHECK / default のうち uuid 前提を text 前提に
- 禁止事項: bud 側自身の id (uuid) は触らない / RLS policy 列名変更禁止 / context にない修正禁止
- 完了報告: 修正箇所件数 + 残課題

# F. 修正後 push 経路

| 順 | 担当 | 内容 |
|---|---|---|
| 1 | a-bud-002 | 13 migration 修正版 add + commit + push（branch: feature/bud-shiwakechou-nextjs-20260511 同 branch 継続）|
| 2 | a-bud-002 | push 完了を a-main-023 に通知（bud-002- No. 49、軽量 ACK）|
| 3 | a-main-023 (私) | git pull → 修正版 merged SQL 再生成 |
| 4 | a-main-023 (私) | 東海林さんに新 merged SQL 提示 |
| 5 | 東海林さん | Supabase Run |

# G. 並行進行 OK

# 306 Phase D-3/4/5 spec 起草継続可。docs/ と supabase/migrations/ で物理分離、競合なし。

# H. ACK 形式（軽量、bud-002- No. 49）

| 項目 | 内容 |
|---|---|
| 修正件数 | 13 migration / 116 references / 型変換 N 箇所 |
| 残課題 | なし / あり（詳細）|
| push 完了時刻 | HH:MM |
| commit hash | 1 件 |

50-100 行で十分、全 migration 修正内容詳細は私が git diff で確認。

# I. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 真因確定 / B 実 schema / C 修正方針 / D スケジュール / E subagent 並列 / F push 経路 / G 並行 / H ACK
- [x] 番号 = main- No. 310
- [x] context にない RP テーマ追加なし（# 308 幻覚再発防止）
~~~

---

## 詳細（参考、投下対象外）

### 1. 違反集計（私 a-main-023 の認知）

| 違反 # | 内容 |
|---|---|
| 8 | verify SQL Run skip（事前検出機会逃し）|
| 9 | 設計バグ事前検出漏れ（root 系 schema 未確認で uuid 前提）|
| 10 | 時刻自己推測（「19:30 頃」断定、実は 18:31）|
| 11 | # 310 起草 subagent prompt 不十分による v5 形式違反（本ファイル冒頭が ~~~ で開始）→ 訂正済 |

### 2. 連動 dispatch

- # 306（a-bud-002 Phase D-3/4/5 spec 並行起草、apply 中も継続 OK）
- # 309（a-analysis-001 起草再開 GO）

### 3. 5/11 中本番運用維持の意義

5/13 仕訳帳本番運用 → 5/11 中本番運用に約 2 日前倒し、後道さんデモ前の品質確認時間確保。
