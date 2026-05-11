# dispatch main- No. 295 — a-bud-002 へ Phase D 14 件 apply 状況精密確認 + 修復計画起草依頼

> 起草: a-main-023
> 用途: a-audit-001 audit-001- No. 15 発見「Bud Phase D 14 件 全件未適用（最致命モジュール）」の周知 + apply 状況精密確認依頼 + 修復計画起草依頼
> 番号: main- No. 295
> 起草時刻: 2026-05-11(月) 17:30
> 緊急度: 🔴 最緊急（致命 5 件 # 5 + 11 連動、5/13 ① 仕訳帳本番運用に影響）
> 投下先: a-bud-002（C:\garden\a-bud-002）
> 添付: なし（本 dispatch md のみで自己完結）
> ファイル markdown link: [dispatch-main-no295-bud-phase-d-apply-status-20260511.md](./dispatch-main-no295-bud-phase-d-apply-status-20260511.md)

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 295
【a-main-023 から a-bud-002 への dispatch（Phase D 14 件 全件未適用 audit 発見 + 修復計画起草依頼）】
発信日時: 2026-05-11(月) 17:30

# 件名
Bud Phase D 14 件 全件未適用（audit # 15 致命 # 5 + 連動 # 11）の精密確認 + 修復計画起草

# A. audit # 15 発見の周知

5/11 17:15 a-audit-001 から audit-001- No. 15 で**致命発見**が周知されました。
Bud モジュールは**過去 30 日で main 到達 migration が 0 件**で、Phase D で起票した
**全 14 件の migration が本番 (main) に届いていない**状態です。

- 致命 # 5: `20260507000001_bud_phase_d01_attendance_schema` 未適用
  → Phase D 基盤の attendance_records / attendance_imports / attendance_records_history
    が main DB に存在しない可能性が極めて高い
- 致命 # 11: 上記 + Phase D-2 (給与計算 schema) / Phase D-3 (仕訳・弥生連携) /
    Phase D-4 (源泉徴収) / Phase D-5 (賞与) 系の連動 migration が全て未適用
- 影響範囲: モジュール別 **最多** の未適用 migration 件数（14 件）
- 過去 30 日の main 到達 migration 0 件 = develop merge は走っているが
    main への昇格パイプラインが Bud だけ機能していない疑い

# B. 確認依頼（3 項目）

## B-1. 14 件の実機 apply 状況（必須・即着手）

下記いずれかの方法で **main 接続の本番 DB** に対して実機検証してください：

(a) Supabase REST 経由
   curl -H "apikey: $SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        "$SUPABASE_URL/rest/v1/information_schema.tables?select=table_name&table_schema=eq.public" \
     | jq '.[] | select(.table_name | startswith("attendance_") or startswith("payroll_") or startswith("journal_") or startswith("withholding_") or startswith("bonus_")) | .table_name'

(b) psql 経由（推奨・取りこぼし防止）
   SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE 'attendance\_%'
        OR table_name LIKE 'payroll\_%'
        OR table_name LIKE 'journal\_%'
        OR table_name LIKE 'withholding\_%'
        OR table_name LIKE 'bonus\_%')
    ORDER BY table_name;

期待結果: Phase D で定義した全テーブルが列挙されること
実態予想: 0 件 or 一部のみ存在（attendance_records が無い等）

→ 結果を **テーブル形式**で報告（テーブル名 / 存在有無 / 列数 / RLS 有無）

## B-2. 各 migration 内容把握（必須・B-1 並列）

supabase/migrations/ 配下の Phase D 14 件を Read で精読し、下記を整理：

| 順 | migration ファイル名 | 作成テーブル | 依存先（先行 migration） | 主要制約 |
|---|---|---|---|---|
| 1 | 20260507000001_bud_phase_d01_attendance_schema | attendance_records 他 | なし（基盤） | FK to employees |
| 2 | 20260507000002_..._attendance_imports | attendance_imports | # 1 | UNIQUE(period, source) |
| ... | ... | ... | ... | ... |

特に注目：
- 基盤 schema（# 1）が他 13 件の前提になっているか
- 外部キー (employees / corporations / partners) の参照先が main DB に存在するか
- RLS ポリシー定義の有無
- Tree D-01 で発覚した **silent NO-OP 罠**（IF NOT EXISTS 多用で既存テーブルに当たると無音で skip）
   と同じパターンがあるか

## B-3. silent NO-OP 罠検出（必須・B-2 と同時）

各 migration 内で下記パターンを grep：
- CREATE TABLE IF NOT EXISTS
- ALTER TABLE ... ADD COLUMN IF NOT EXISTS
- CREATE INDEX IF NOT EXISTS
- DROP ... IF EXISTS

→ これらが既存テーブル（先行 develop 環境で部分作成済）に当たると
   **何も変更せず成功**として処理が完了し、本来必要な列/制約/index が抜けたまま
   apply 完了扱いになる罠。

→ 衝突可能性のある先行テーブルが本番 DB に存在しないか B-1 と突き合わせて確認。

# C. 修復計画起草依頼（B 完了後、即着手）

## C-1. 依存順序確認

B-2 の表をもとに、apply 必須順序を確定：

例:
1. # 1 attendance_schema（基盤）
2. # 2 attendance_imports（# 1 依存）
3. # 3 attendance_records_history（# 1 依存）
4. # 4 payroll_schema（# 1, employees 依存）
...

循環依存・FK 先行不足が見つかった場合は **即停止**して a-main-023 経由で
東海林さん判断仰ぎ（勝手に migration 内容を改変しないこと）。

## C-2. apply 順序 SQL（順序固定）

下記成果物を起草：

`supabase/migrations/_phase_d_apply_order.md`
```
# Bud Phase D apply 順序（main 修復用 / 2026-05-11 起草）

## 順序固定リスト
1. 20260507000001_bud_phase_d01_attendance_schema.sql
2. 20260507000002_..._attendance_imports.sql
...
14. ...

## apply 単位
全 14 件を 1 トランザクションでは **走らせない**（rollback 時の影響範囲を分離）。
1 件ずつ supabase migration apply で順次 Run、各回 B-1 の検証 SQL で
テーブル/列/制約が期待通り作成されたか確認後、次に進む。
```

## C-3. 検証 SQL（テーブル存在 / 列存在 / 制約存在）

各 migration 1 件につき、apply 後検証用 SQL を 1 セット起草：

例: # 1 attendance_schema 検証
```sql
-- テーブル存在
SELECT count(*) FROM information_schema.tables
 WHERE table_schema='public' AND table_name='attendance_records';
-- 期待: 1

-- 列存在（全 N 列）
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='attendance_records'
 ORDER BY ordinal_position;
-- 期待: id, employee_id, work_date, start_time, end_time, ...（migration 定義通り）

-- 制約存在
SELECT conname, contype FROM pg_constraint
 WHERE conrelid = 'public.attendance_records'::regclass;
-- 期待: PK + FK(employee_id → employees.id) + UNIQUE(employee_id, work_date) 等

-- RLS 有効化
SELECT relrowsecurity FROM pg_class WHERE relname='attendance_records';
-- 期待: true
```

## C-4. 起草成果物の保存先

| 成果物 | 保存先 |
|---|---|
| 依存順序表（B-2） | docs/bud-phase-d-migration-dependency-20260511.md |
| apply 順序 SQL（C-2） | supabase/migrations/_phase_d_apply_order.md |
| 検証 SQL セット（C-3） | docs/scripts/verify-bud-phase-d-{01..14}.sql（14 ファイル） |
| 集約検証 runner | docs/scripts/verify-bud-phase-d-all.ps1（PowerShell で 14 件一括 Run） |
| 修復計画レポート | docs/bud-phase-d-recovery-plan-20260511.md（C-1 〜 C-3 集約） |

# D. apply タイミング

| 日時 | 担当 | 内容 |
|---|---|---|
| 5/11(月) 17:30〜深夜 | a-bud-002 | B-1 / B-2 / B-3 完了 → C-1 〜 C-4 起草 |
| 5/12(火) 朝 | a-main-023 + 東海林さん | 修復計画レビュー、apply Go 判断 |
| 5/12(火) 午前〜午後 | a-bud-002 + a-main-023 連携 | 14 件順次 apply + 各回検証 |
| 5/13(水) 朝 | 東海林さん | ① 仕訳帳 5/13 本番運用 Go/NoGo 最終判断 |

apply 中の事故（FK 不足 / silent NO-OP / RLS 衝突）を a-bud-002 が即検出 →
a-main-023 経由で東海林さんに即報告 → 1 件ずつ判断、を厳守。

**a-bud-002 単独で apply を走らせないこと**（必ず a-main-023 と東海林さんの Go 判断後）。

# E. 並列進行可能タスク（中断不要）

下記は本 dispatch と並行して **継続 OK** です：

- PR #160 / #161 merge 後の Phase D-3（CSV import 弥生 export）着手準備
- Phase D-3 仕訳帳 alpha の 5/13 本番運用見通し作業（**ただし F 評価依頼の結果次第で停止判断あり**）
- Phase D-4 / D-5（源泉徴収 / 賞与）の設計起草

注意: 上記 D の apply 修復が完了するまで **本番環境への新 migration 追加・新 PR は一旦保留**
（main の Phase D 14 件が揃ってから次フェーズに進む方が事故を防げる）。

# F. ① 仕訳帳 5/13 本番運用への影響評価依頼（最重要）

5/13(水) 朝に予定されている ① 仕訳帳 alpha の本番運用について、下記を評価：

| 観点 | 確認内容 | 評価依頼 |
|---|---|---|
| schema 依存 | 仕訳帳 alpha は Phase D-3 journal_* テーブル / D-1 attendance_* テーブルに依存？ | 完全独立 / 部分依存 / 完全依存 のいずれか |
| schema 不在時の挙動 | 仮に attendance_records / journal_entries が main に無い場合、仕訳帳 UI はどう動く？ | 起動不能 / 一部動作 / 完全動作（mock） |
| 単体動作のリスク | Phase D apply 修復前に 5/13 本番運用開始するリスク | 低 / 中 / 高 + 具体的失敗パターン |
| 5/13 Go 判断条件 | 修復完了が間に合わない場合の Plan B | 仕訳帳 alpha を mock データで限定運用 / 5/14 以降に延期 / 等 |

→ B 完了後、F の評価結果を C の修復計画レポートに **「5/13 ① 仕訳帳本番運用 影響評価」セクション**
   として追記してください。

# G. ACK 形式

修復計画起草完了で報告 = **bud-002- No. NN** で a-main-023 へ返信。

報告内容:
1. B-1 結果（14 件の apply 実態 / テーブル形式）
2. B-2 結果（依存順序表）
3. B-3 結果（silent NO-OP 罠検出有無）
4. C-1 〜 C-4 起草完了（保存先パス列挙）
5. F 評価結果（5/13 ① 仕訳帳 影響評価）
6. apply Go/NoGo 推奨（a-bud-002 視点）
7. 判断保留事項（あれば）

# H. self-check（着手前に必ず確認）

- [ ] 本 dispatch を最後まで読んだ
- [ ] audit-001- No. 15 の全文を読んだ（無ければ a-main-023 に依頼）
- [ ] 現在の作業ブランチを確認した（feature/bud-* on a-bud-002 worktree）
- [ ] main 接続の本番 DB 情報（SUPABASE_URL / SERVICE_ROLE_KEY）を .env.local で保有
- [ ] apply 系 SQL を **a-main-023 + 東海林さん Go 判断前に勝手に Run しない** ことを理解
- [ ] silent NO-OP 罠（Tree D-01 教訓）を理解
- [ ] B → C → F の順序を守る
- [ ] 判断保留事項は **即停止 → a-main-023 経由で東海林さんに照会**

開始時に「main- No. 295 受領、B 着手します」で ACK し、B-1 完了時点で 1 度中間報告、
C-4 完了で最終報告（G 形式）してください。

並列進行 (E) は許可済みなので、判断疲れない範囲で同時並列 OK。
~~~

---

## 補足（東海林さん向け / a-bud-002 に貼り付けない）

### この dispatch の狙い

1. **致命 # 5 + 連動 # 11 の正体把握**
   - audit が「14 件全件未適用」と報告したが、実機で本当にそうなのか、それとも一部は
     develop merge 経由で main に届いている可能性があるのか、a-bud-002 に実機検証させる
   - Tree D-01 で発覚した silent NO-OP 罠（IF NOT EXISTS の罠）と同じ事故が
     Bud でも起きていないか、内容精読で先回り検出

2. **5/13 ① 仕訳帳本番運用への影響を最優先で評価**
   - schema 不在のまま仕訳帳 alpha を 5/13 に動かすと、起動不能 or 中途半端な動作で
     後道さんへの印象を悪化させるリスク
   - 修復が間に合わない場合の Plan B（mock データ限定運用 / 5/14 延期）を a-bud-002 に
     起草させ、東海林さんが 5/12 朝に最終 Go/NoGo 判断できる材料を揃える

3. **apply は必ず a-main-023 + 東海林さん経由で順次 Run**
   - a-bud-002 単独で migration を本番に流させない（事故時の rollback が複雑化する）
   - 14 件を 1 トランザクションで走らせない（1 件ずつ検証 → 次へ、で影響範囲分離）

### 想定回答シーケンス

| 時刻 | a-bud-002 出力 |
|---|---|
| 5/11 17:30 直後 | 「main- No. 295 受領、B 着手」（ACK） |
| 5/11 18:00 頃 | B-1 中間報告（14 件の apply 実態テーブル） |
| 5/11 19:00 頃 | B-2 / B-3 完了報告 |
| 5/11 20:00 頃 | C-1 〜 C-4 起草完了 + F 評価結果（最終報告 = bud-002- No. NN） |

### 東海林さんへのお願い

- 5/11 夜のうちに本 dispatch を a-bud-002 にコピペ投下してください
- a-bud-002 からの中間報告（B-1 完了時点）が来たら a-main-023 にも共有願います
   → silent NO-OP 罠の有無で 5/13 Go 判断の難易度が変わるので、a-main-023 が先回りで
     Plan B（5/13 mock 運用 / 延期）の準備を始められます
- 5/12(火) 朝に a-main-023 + 東海林さんで apply Go 判断ミーティング想定

### 連動 dispatch

- main- No. 293 / 294（audit # 15 連動 # 11 周知 / 他モジュール）と本 dispatch (No. 295) は
  **連動**しており、Bud は最致命のため No. 295 を最優先処理
- audit-001- No. 15 全文は a-audit-001 セッションの最新出力を参照

---

## self-check（a-main-023 起草時）

- [x] memory `feedback_dispatch_header_format` v5 準拠（投下先 / ファイル markdown link / 添付有無 / 緊急度 先頭明示）
- [x] 投下用短文を `~~~` で完全ラップ
- [x] dispatch 番号（main- No. 295）を冒頭と短文先頭で明示
- [x] 発信日時を短文内に明記
- [x] 緊急度（🔴 最緊急）を先頭表示
- [x] A〜H のセクション構成で起草
- [x] silent NO-OP 罠（Tree D-01 教訓）を反映
- [x] apply は a-main-023 + 東海林さん経由で順次 Run、a-bud-002 単独禁止 を明記
- [x] 5/13 ① 仕訳帳影響評価（F）を独立セクション化
- [x] 並列進行可能タスク（E）を明示し、a-bud-002 が完全停止せず動けるよう配慮
- [x] ACK 形式（G）と self-check（H）を a-bud-002 用に明記
- [x] 全文 300-400 行範囲内（実測 約 320 行）
- [x] 日本語起草
- [x] memory `feedback_my_weak_areas` に従い、a-bud-002 専門領域（schema / migration / RLS）の
       具体的検証手順を箇条書きで委譲（a-main-023 単独判定を避ける）
