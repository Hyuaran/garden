# main- No. 53 dispatch - a-root に日報蓄積テーブル 3 件 + state.txt 取り込み雛形作成依頼 - 2026-05-05

> 起草: a-main-012
> 用途: Garden 開発進捗ページの実データ化に向けた、Garden Root 配下の日報蓄積テーブル 3 件と state.txt 取り込み機能の雛形作成
> 番号: main- No. 53
> 起草時刻: 2026-05-05(火) 19:00
> 緊急度: 🔴 5/8 デモまでに「裏側で実データ蓄積」状態を作る（Phase 1a）

---

## 投下用短文（東海林さんが a-root にコピペ）

~~~
🔴 main- No. 53
【a-main-012 から a-root への dispatch（日報蓄積テーブル 3 件 + state.txt 取り込み雛形）】
発信日時: 2026-05-05(火) 19:00

Garden Bloom 開発進捗ページ（/bloom/progress）の実データ化を Phase 1a〜2 で進めます。Phase 1a として a-root に Root 配下のテーブル設計 + 取り込み雛形を依頼します。

【Phase 全体像】

| Phase | 期間 | 内容 |
|---|---|---|
| **Phase 1a** | 〜 5/7 | **a-root にテーブル 3 件 + state.txt 取り込み雛形 ← 本依頼** |
| Phase 1b | 5/8 デモ | iframe + 静的データで見せる + 「裏で実データ蓄積中」紹介 |
| Phase 2 | 5/9〜5/22 | sync 自動化 + Bloom React 化（a-bloom-003 担当）|

【データソース】

- 既存: `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\006_日報自動配信\state\state.txt`
- 形式: JSON（拡張子 .txt は claude.ai Drive コネクタの application/json MIME 不可制約による）
- 構造（典型例）:
  ```json
  {
    "date": "2026-04-25",
    "workstyle": "自宅作業",
    "is_irregular": true,
    "irregular_label": "GW期間",
    "work_logs": [
      "Garden Tree：架電アプリ確定事項10件を反映...",
      "Garden Forest：進行期データを画面で編集できる機能完成..."
    ],
    "tomorrow_plans": [...],
    "carryover": [],
    "planned_for_today": [...],
    "sent": false
  }
  ```
- 過去ログ: send_log.txt（4/16〜4/24 の 7 日分送信履歴）+ state バックアップ数件（断片的）
- 4 月初旬〜4/15 期間: 記録なし、東海林さんが箇条書きで提供予定（後追い insert dispatch）

【テーブル設計（3 件、Phase 1a で作成）】

# 1: root_daily_reports（日報ヘッダー）

```sql
CREATE TABLE root_daily_reports (
  date DATE PRIMARY KEY,
  workstyle TEXT,                 -- 'office' / 'home' / 'irregular' / null
  is_irregular BOOLEAN DEFAULT FALSE,
  irregular_label TEXT,           -- 'GW期間' 等
  chatwork_sent BOOLEAN DEFAULT FALSE,
  chatwork_sent_at TIMESTAMPTZ,
  source TEXT DEFAULT 'state.txt', -- 'state.txt' | 'manual' | 'reconstructed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_root_daily_reports_updated_at
  BEFORE UPDATE ON root_daily_reports
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();
```

# 2: root_daily_report_logs（日報明細、1 行 = 1 work_log エントリ）

```sql
CREATE TABLE root_daily_report_logs (
  id BIGSERIAL PRIMARY KEY,
  report_date DATE NOT NULL REFERENCES root_daily_reports(date) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('work', 'tomorrow', 'carryover', 'planned', 'special')),
  module TEXT,                    -- 'Bloom' / 'Forest' / 'Tree' / 'Root' / ... / null（モジュール属性なし）
  content TEXT NOT NULL,
  ord INT DEFAULT 0,              -- 表示順
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_root_daily_report_logs_date ON root_daily_report_logs(report_date);
CREATE INDEX idx_root_daily_report_logs_module ON root_daily_report_logs(module);
```

# 3: root_module_progress（モジュール別進捗）

```sql
CREATE TABLE root_module_progress (
  module TEXT PRIMARY KEY,        -- 'Bloom' / 'Forest' / 'Tree' / 'Root' / ... 12 種
  progress_pct INT NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
  phase TEXT,                     -- 'A' / 'B' / 'C' / 'D'
  status TEXT,                    -- '進行中' / '完了' / 'Phase 待ち' 等
  summary TEXT,                   -- 短い説明文
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_root_module_progress_updated_at
  BEFORE UPDATE ON root_module_progress
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();
```

【RLS（既存 root_kot_sync_log 参照）】

```sql
-- 全テーブル共通
ALTER TABLE root_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_daily_report_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_module_progress ENABLE ROW LEVEL SECURITY;

-- 読み取り: admin / super_admin
-- 書き込み: service_role のみ（sync スクリプト経由）
-- 既存 root_kot_sync_log の RLS パターンを参照して同等構造で実装
```

【取り込み雛形（Phase 1a）】

a-root に以下を実装してください:

# 雛形 1: state.txt → Root 取り込みスクリプト（Node.js / TypeScript）

```typescript
// scripts/import-state-to-root.ts
// 想定: state.txt を読み込み、root_daily_reports + root_daily_report_logs に upsert
//
// 1. state.txt をパース
// 2. root_daily_reports に date キーで upsert
// 3. root_daily_report_logs から report_date でまず DELETE（重複防止）
// 4. work_logs / tomorrow_plans / carryover / planned_for_today 各配列を行単位で挿入
// 5. content からモジュール抽出: "Garden XXX：内容" → module="XXX", content="内容"
//    "Garden XXX(YYY)：内容" → module="XXX", content="(YYY)：内容"
//    マッチしない場合 → module=null
// 6. ord を配列順で 0, 1, 2, ... 設定
// 7. category マッピング:
//    - work_logs → "work"
//    - tomorrow_plans → "tomorrow"
//    - carryover → "carryover"
//    - planned_for_today → "planned"
//    - 特記事項（state.txt にないが、後で追加されたら） → "special"
```

→ 4/16〜現在の state.txt（最新累積版）を 1 回限り insert する初期化スクリプト。

# 雛形 2: Phase 2 用 sync 関数 雛形（コメントベース）

```typescript
// scripts/sync-state-to-root.ts (Phase 2 で実装、雛形のみ)
// Vercel Cron or Edge Function 経由で起動
// 1. Drive 上の state.txt を取得（drive API）
// 2. 上記 import-state-to-root.ts と同じ処理
// 3. ログを root_kot_sync_log と同じパターンで残す
// 4. 失敗時も main 処理ブロックしない（既存 root_kot_sync_log パターン踏襲）
```

→ Phase 2 で完成させる。本依頼ではコメント雛形のみで OK。

# 雛形 3: root_module_progress 初期データ insert

12 module 全部 0% で初期化（後で更新可能）:

```sql
INSERT INTO root_module_progress (module, progress_pct, phase, status, summary) VALUES
  ('Bloom',    65, 'B', '進行中', 'グループ全体の動きと業績を見える化'),
  ('Forest',   70, 'B', '進行中', '法人別経営ダッシュボード'),
  ('Tree',    100, 'D', '実装完了', '架電アプリ（FileMaker代替）'),
  ('Bud',      55, 'A', '進行中', '経理・収支・給与'),
  ('Leaf',     60, 'B', '進行中', '商材×商流ごとの個別アプリ'),
  ('Root',    100, 'A', '実装完了', '組織・従業員・マスタ'),
  ('Rill',     35, 'C', 'Phase待ち', 'Chatwork 代替メッセージング'),
  ('Sprout',    0, '-', '未着手', '採用・入社フロー'),
  ('Calendar',  0, '-', '未着手', '営業予定・シフト'),
  ('Soil',      0, '-', '未着手', 'DB・大量データ基盤'),
  ('Fruit',     0, '-', '未着手', '法人格の実体・登記・許認可'),
  ('Seed',      0, '-', '未着手', '新事業・新商材枠')
ON CONFLICT (module) DO UPDATE SET
  progress_pct = EXCLUDED.progress_pct,
  phase = EXCLUDED.phase,
  status = EXCLUDED.status,
  summary = EXCLUDED.summary,
  updated_at = now();
```

→ v29 HTML の進捗 % と整合する初期値（要確認後採用）。

【Migration ファイル名（既存パターン踏襲）】

```
supabase/migrations/20260505000NNN_root_daily_reports.sql
supabase/migrations/20260505000NNN_root_daily_report_logs.sql
supabase/migrations/20260505000NNN_root_module_progress.sql
```

NNN は a-root セッション側で連番採番。既存 migration の最新（20260425000001 等）から続ける。

【削除禁止ルール】

- 新規 migration / scripts は legacy 不要
- 既存ファイル編集時のみ legacy 保持（おそらく新規追加のみで OK）

【完了報告フォーマット】

root-NN で:
- commit hash + push 状態
- 3 migration ファイル名 + 簡易 schema 確認
- import-state-to-root.ts 実装結果（行数 / 主要ロジック）
- 4/16〜現在の state.txt 取り込み結果（root_daily_reports + root_daily_report_logs の件数）
- root_module_progress 初期データ insert 結果（12 件）
- legacy 保持ファイル一覧
- 完了時刻

【期限】

🔴 5/7 夜まで（5/8 デモで「裏側で実データ蓄積中」と紹介可能な状態）

【dispatch counter】

a-main-012: 次 main- No. 54
a-root: root-NN で完了報告予定

工数見込み: 90〜120 分（migration 3 件 + import script + 初期データ insert + 検証）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 19:00 初版（a-main-012、Phase 1a 実装依頼）
