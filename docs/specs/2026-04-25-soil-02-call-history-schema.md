# Soil #02: コール履歴スキーマ（パーティション戦略確定版）

- 対象: Garden-Soil の `soil_call_history`（335 万件級、月 5〜10 万件増）
- 優先度: **🔴 最高**（Tree からのリアルタイム書込 + Bloom 集計の起点）
- 見積: **1.0d**（テーブル + パーティション + Cron + 負荷試験）
- 担当セッション: a-soil（実装）/ a-tree（書込側調整）/ a-bloom（読込側調整）
- 作成: 2026-04-25（a-auto 004 / Batch 16 Soil #02）
- 前提:
  - **`docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md`**（戦略書、案 A 採択済）
  - `docs/specs/2026-04-25-soil-01-list-master-schema.md`
  - `docs/specs/2026-04-25-soil-05-index-performance.md`（インデックス詳細）

---

## 1. 目的とスコープ

### 1.1 目的

戦略書（partitioning-strategy）で**案 A: 日付別レンジパーティション**を採択した方針を、**実装可能な完成版スキーマ**に落とし込む。Tree からの架電中リアルタイム INSERT、Bloom からの月次集計、Soil ダッシュボードからの全件検索を、335 万件超でも 1 秒以内で処理可能にする。

### 1.2 含めるもの

- `soil_call_history` の確定スキーマ（戦略書を全フィールド化）
- パーティション運用（手動初期 + Cron 自動 + アーカイブ）
- 重複検出・誤タップフラグ（戦略書 §8 判 5）
- Tree 側 INSERT との契約
- Bloom / Soil ダッシュボードからの SELECT パターン

### 1.3 含めないもの

- インデックス詳細の数値検証 → #05
- RLS → #06
- インポート（既存 335 万件の流し込み）→ #04
- Tree UI 側の架電中フォーム → Tree 側の責務

---

## 2. 戦略書からの主要決定（再掲）

| 論点 | 決定 |
|---|---|
| 案 A / B / C / D | **案 A（日付別レンジ）採用**、12 ヶ月後に再評価で C へ昇格可 |
| 削除 | **削除しない**（RLS の UPDATE 制限 + 監査ログ）|
| 全文検索（memo）| Phase C 後期、pg_trgm GIN 追加 |
| 案件リレーション | `case_id` nullable（架電時点で未案件化を許容）|
| 重複コール検出 | 同 `user_id` × 同 `list_id` × 60 秒以内 → 誤タップフラグ |

---

## 3. 確定スキーマ

### 3.1 親テーブル

```sql
CREATE TABLE public.soil_call_history (
  id bigserial,                          -- パーティション必須により合成 PK
  list_id uuid NOT NULL,                 -- soil_lists.id（FK は #05 で制約論議）
  case_id uuid,                          -- nullable: 架電時点で未案件化のことあり
  case_module text,                      -- 'leaf_kanden' | 'leaf_hikari' | ... 案件モジュール
  user_id uuid NOT NULL,                 -- 架電者 = root_employees.user_id
  call_datetime timestamptz NOT NULL,    -- 架電開始時刻
  call_ended_at timestamptz,             -- 架電終了時刻
  call_duration_sec int,                 -- end - start（DB トリガで自動計算）
  call_mode text NOT NULL,               -- 'sprout' | 'branch' | 'leaf' | 'bloom' | 'fruit' | 'noresponse' | 'misdial'
  result text NOT NULL,                  -- 'connected' | 'voicemail' | 'busy' | 'noanswer' | 'rejected' | 'wrongnumber'
  outcome text,                          -- 業務的成果 'apointment_set' | 'denied' | 'callback_requested' | 'sale_done' | NULL
  callback_requested_at timestamptz,
  callback_target_at timestamptz,
  memo text,
  voice_recording_url text,              -- Storage 上の通話録音 URL（任意）
  is_misdial boolean NOT NULL DEFAULT false,  -- 誤タップフラグ（§4.4）
  is_billable boolean NOT NULL DEFAULT true,  -- KPI 集計対象か（誤タップ等は false）
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, call_datetime)        -- パーティションキー必須
) PARTITION BY RANGE (call_datetime);
```

### 3.2 月次パーティション

```sql
-- 直近過去 12 ヶ月 + 当月 + 未来 3 ヶ月 を初期作成
CREATE TABLE soil_call_history_202501 PARTITION OF soil_call_history
  FOR VALUES FROM ('2025-01-01 JST'::timestamptz) TO ('2025-02-01 JST'::timestamptz);
-- ... 月毎に CREATE
CREATE TABLE soil_call_history_202604 PARTITION OF soil_call_history
  FOR VALUES FROM ('2026-04-01 JST'::timestamptz) TO ('2026-05-01 JST'::timestamptz);
CREATE TABLE soil_call_history_202607 PARTITION OF soil_call_history
  FOR VALUES FROM ('2026-07-01 JST'::timestamptz) TO ('2026-08-01 JST'::timestamptz);
```

#### 命名規則

- `soil_call_history_YYYYMM`（PostgreSQL 標準慣例）
- インポート時の過去パーティションは `soil_call_history_YYYYMM_imported` 等の suffix を**付けない**（クエリの単純化のため）

### 3.3 アーカイブ用 default

```sql
-- 想定外の古い時刻の INSERT を捕捉
CREATE TABLE soil_call_history_default PARTITION OF soil_call_history DEFAULT;
```

`_default` は監視対象 → INSERT があれば監視通知（#01 monitoring の category=`call_history_default_insert`）。

---

## 4. カラム設計の詳細

### 4.1 `call_mode` の意味（Garden 7 段階）

| 値 | 意味 | 業務シナリオ |
|---|---|---|
| `sprout` | 初回着信 | 新規開拓 |
| `branch` | 関係構築通話 | 興味喚起 |
| `leaf` | 商談化通話 | 提案・見積 |
| `bloom` | クロージング通話 | 契約直前 |
| `fruit` | アフターフォロー通話 | 成約後 |
| `noresponse` | 無応答（応答音なし）| カウントのみ |
| `misdial` | 誤タップ | KPI から除外 |

これは Garden の世界観命名規則を踏襲（Soil → Sprout → Branch → ...）。

### 4.2 `result` × `outcome`

`result` は通話の到達結果、`outcome` は業務的成果（連動するが別軸）:

| result | 主な outcome 候補 |
|---|---|
| `connected` | `appointment_set` / `denied` / `callback_requested` / `sale_done` / NULL |
| `voicemail` | `callback_requested` / NULL |
| `busy` | NULL |
| `noanswer` | NULL |
| `rejected` | `denied` |
| `wrongnumber` | NULL |

### 4.3 `call_duration_sec` の自動計算

```sql
CREATE OR REPLACE FUNCTION soil_call_history_compute_duration()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.call_ended_at IS NOT NULL AND NEW.call_datetime IS NOT NULL THEN
    NEW.call_duration_sec :=
      EXTRACT(EPOCH FROM (NEW.call_ended_at - NEW.call_datetime))::int;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_soil_call_history_compute_duration
  BEFORE INSERT OR UPDATE ON soil_call_history
  FOR EACH ROW EXECUTE FUNCTION soil_call_history_compute_duration();
```

### 4.4 誤タップ検出（戦略書 判 5）

```sql
-- INSERT 後トリガで検出
CREATE OR REPLACE FUNCTION soil_call_history_detect_misdial()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prev_call_id bigint;
BEGIN
  -- 同 user × 同 list で 60 秒以内の直前の架電を検索
  SELECT id INTO prev_call_id FROM soil_call_history
  WHERE user_id = NEW.user_id
    AND list_id = NEW.list_id
    AND id <> NEW.id
    AND call_datetime > NEW.call_datetime - interval '60 seconds'
    AND call_datetime < NEW.call_datetime
  ORDER BY call_datetime DESC LIMIT 1;

  IF prev_call_id IS NOT NULL THEN
    NEW.is_misdial := true;
    NEW.is_billable := false;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_soil_call_history_detect_misdial
  BEFORE INSERT ON soil_call_history
  FOR EACH ROW EXECUTE FUNCTION soil_call_history_detect_misdial();
```

判定ロジックは将来変えやすいよう関数化、テスト容易性重視。

---

## 5. インデックス（要点、詳細 #05）

```sql
-- 主要クエリ用、親テーブルに定義 → 子に自動継承（PG15+）
CREATE INDEX ON soil_call_history (list_id, call_datetime DESC);
CREATE INDEX ON soil_call_history (user_id, call_datetime DESC);
CREATE INDEX ON soil_call_history (case_id) WHERE case_id IS NOT NULL;
CREATE INDEX ON soil_call_history (call_mode, call_datetime DESC)
  WHERE call_mode IN ('sprout', 'branch', 'leaf', 'bloom');
CREATE INDEX ON soil_call_history (callback_target_at)
  WHERE callback_target_at IS NOT NULL AND callback_target_at > now();
```

部分インデックスで空間効率を上げる戦略。

---

## 6. パーティション運用

### 6.1 月初自動作成 Cron

```typescript
// src/app/api/cron/soil-partition-rotate/route.ts
// 毎月 25 日 03:00 JST（来月分を作成）

export async function GET() {
  const next = nextMonthRange(); // 例: 2026-05 のパーティションを作成

  await runSql(`
    CREATE TABLE IF NOT EXISTS soil_call_history_${next.yyyymm} PARTITION OF soil_call_history
      FOR VALUES FROM ('${next.from}'::timestamptz) TO ('${next.to}'::timestamptz);
  `);

  await recordMonitoringEvent({
    module: 'soil',
    category: 'partition_rotate',
    severity: 'low',
    source: '/api/cron/soil-partition-rotate',
    message: `パーティション ${next.yyyymm} を作成しました`,
  });

  return Response.json({ ok: true, created: next.yyyymm });
}
```

### 6.2 失敗時の対応

- Cron 失敗 → Cross Ops #01 経由で Chatwork 通知
- 当月末までに修正できないと**翌月の INSERT が `_default` に入る**
- `_default` を監視 → 件数が増えたら緊急対応（手動で当該月パーティション作成 + INSERT 移動）

### 6.3 アーカイブ運用（24 ヶ月超）

```sql
-- 例: 2024-01 を低頻度ストレージへ
ALTER TABLE soil_call_history_202401 SET TABLESPACE archive_ts;
```

Supabase 上では tablespace 切替は標準では難しいため、**論理レプリケーションで別 DB に逃がす**案を検討（Phase D 以降）。

---

## 7. Tree からの INSERT 契約

### 7.1 INSERT 経路

```
Tree クライアント (架電中フォーム)
  ↓
Tree API /api/tree/calls/start  → soil_call_history INSERT (call_datetime 確定、ended_at NULL)
  ↓ 通話終了
Tree API /api/tree/calls/end    → soil_call_history UPDATE (ended_at + result + outcome)
```

`call_duration_sec` は UPDATE 時にトリガで自動計算。

### 7.2 必須フィールド

```typescript
type CreateCallInput = {
  list_id: string;            // 必須
  case_id?: string;           // 任意
  case_module?: string;       // case_id があれば必須
  user_id: string;            // 必須（auth.uid() と一致）
  call_datetime: string;      // 必須（架電開始）
  call_mode: 'sprout' | ... ; // 必須
  result: 'connected' | ...;  // 必須
};
```

### 7.3 INSERT のレート制限

- 1 ユーザー 1 秒 1 回まで（架電中タップ連打への防御）
- Edge ミドルウェアで実装、超過時は 429
- 誤タップフラグ（§4.4）と併用

---

## 8. Bloom / Soil ダッシュボードからの SELECT パターン

### 8.1 Q-A: 個人の本日コール一覧

```sql
SELECT * FROM soil_call_history
WHERE user_id = $1
  AND call_datetime >= '2026-04-26 JST'
  AND call_datetime < '2026-04-27 JST'
ORDER BY call_datetime DESC;
```

→ **当月パーティション 1 つにのみ pruning**、index `(user_id, call_datetime DESC)` 利用、想定 50ms 以内。

### 8.2 Q-B: 案件の全履歴

```sql
SELECT * FROM soil_call_history
WHERE case_id = $1
ORDER BY call_datetime DESC;
```

→ 全パーティションスキャン、index `(case_id) WHERE case_id IS NOT NULL` 利用、案件あたり数十件想定で 100ms 以内。

### 8.3 Q-C: 月次集計（Bloom）

```sql
SELECT user_id, COUNT(*) FILTER (WHERE call_mode IN ('sprout','branch','leaf','bloom'))
  AS billable_calls,
  COUNT(*) FILTER (WHERE outcome = 'appointment_set') AS appointments
FROM soil_call_history
WHERE call_datetime >= date_trunc('month', $1::timestamptz)
  AND call_datetime < date_trunc('month', $1::timestamptz) + interval '1 month'
GROUP BY user_id;
```

→ **対象月パーティション 1 つにのみ pruning**、200ms〜500ms 想定（GROUP BY コスト）。

### 8.4 Q-D: コールバック予定一覧（Tree TODO）

```sql
SELECT * FROM soil_call_history
WHERE callback_target_at IS NOT NULL
  AND callback_target_at > now()
  AND callback_target_at < now() + interval '1 day'
ORDER BY callback_target_at ASC;
```

→ **partial index `WHERE callback_target_at IS NOT NULL ...`** 利用、ほぼ即時。

---

## 9. 削除の扱い

### 9.1 物理削除しない

戦略書 判 2 に従い、**コール履歴は永続保持**。修正は UPDATE で履歴ログを残す。

### 9.2 「誤入力の取り消し」

```sql
-- 誤入力を「無効化」する
UPDATE soil_call_history
SET is_billable = false,
    memo = COALESCE(memo, '') || ' [取消: ' || $reason || ']'
WHERE id = $id;

-- 監査ログにも記録（#06 / spec-cross-audit-log）
```

---

## 10. 既知のリスクと対策

### 10.1 パーティション pruning が効かないケース

- WHERE 句に `call_datetime` の範囲条件がないクエリは**全パーティションスキャン**
- 対策: 主要クエリは必ず `call_datetime` 範囲を含める、ORM レイヤで強制

### 10.2 INSERT のロック競合

- 同月の 1 パーティションに集中 INSERT
- 対策: PostgreSQL の row-level locking で済む想定、必要なら HOT update でカバー

### 10.3 月跨ぎ INSERT のタイミング

- 23:59:59 開始 → 00:00:01 終了 のコール
- 対策: `call_datetime` 基準でパーティション選択、ended_at は別月でも OK

### 10.4 `_default` への誤 INSERT

- 移行時の古いデータ流し込みで、対応パーティション未作成
- 対策: インポート前に**範囲を確認 → 必要なパーティションを先に作成**

### 10.5 重複検出の誤検知

- 同 user × 同 list で**意図的に 2 回かける**（例：留守電 → 1 分後再架電）
- 対策: 60 秒は**やや長め**、運用後ヒアリングで調整可。誤検知時は手動で `is_misdial=false` に戻せる UI

### 10.6 全文検索の負荷

- memo 全文検索（pg_trgm GIN）はパーティション × 件数で重い
- 対策: Phase C 後期、最初は実装しない（OR 検索 / Q-A〜Q-D 経由でカバー）

---

## 11. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | 親テーブル + 過去 12 ヶ月パーティション migration | a-soil | 0.5h |
| 2 | デフォルトパーティション + 監視 | a-soil | 0.25h |
| 3 | duration / misdial トリガ | a-soil | 0.5h |
| 4 | インデックス（部分含む 5 本）| a-soil | 0.5h |
| 5 | RLS（→ #06）| a-soil | 1h |
| 6 | パーティション自動作成 Cron | a-soil | 1h |
| 7 | Tree 側 INSERT API スケルトン | a-tree | 1h |
| 8 | サンプル 1 万件投入 + Q-A〜Q-D 性能計測 | a-soil | 1.5h |
| 9 | 単体 / 統合テスト | a-soil | 1.5h |

合計: 約 7.75h ≈ 1.0d

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md`（戦略書 v1）
- `docs/specs/2026-04-25-soil-01-list-master-schema.md`
- `docs/specs/2026-04-25-soil-04-import-strategy.md`
- `docs/specs/2026-04-25-soil-05-index-performance.md`
- `docs/specs/2026-04-25-soil-06-rls-design.md`
- `docs/specs/2026-04-25-soil-08-api-contracts.md`
- Tree CLAUDE.md（架電フロー）

---

## 13. 受入基準（Definition of Done）

- [ ] `soil_call_history` 親テーブル + 過去 12 ヶ月 + 当月 + 未来 3 ヶ月 のパーティション作成済
- [ ] `_default` パーティション作成済 + 監視
- [ ] duration / misdial トリガが動作
- [ ] インデックス 5 本（部分含む）作成済
- [ ] RLS（→ #06）動作確認
- [ ] パーティション自動作成 Cron が稼働
- [ ] Tree 側 `/api/tree/calls/start` `/api/tree/calls/end` スケルトン実装
- [ ] サンプル 1 万件で Q-A〜Q-D が想定内（A:50ms / B:100ms / C:500ms / D:即時）
- [ ] 単体 + 統合テスト pass
- [ ] Soil CLAUDE.md にコール履歴セクション追記
