# Soil Phase B-02: コール履歴インポート Phase 2（335 万件、パーティション戦略）

- 対象: Garden-Soil の `soil_call_history` 大量初期投入
- 優先度: **🔴 最高**（Tree 架電 KPI 連続性、335 万件規模の本番投入）
- 見積: **2.0d**（パーティション準備 + 時系列投入 + 整合性検査）
- 担当セッション: a-soil（実装）/ a-tree（既存 INSERT 競合確認）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 007 / Batch 19 Soil Phase B-02）
- 前提:
  - **Batch 16 Soil 基盤**（特に `2026-04-25-soil-02-call-history-schema.md`）
  - **既存戦略書**（`2026-04-24-soil-call-history-partitioning-strategy.md`、案 A 月次レンジパーティション採択済）
  - **B-01 リストインポート完了**（`soil_lists` に list_id が存在前提）

---

## 1. 目的とスコープ

### 1.1 目的

335 万件のコール履歴を月次レンジパーティション（戦略書 案 A）に分割投入する。直近 6 ヶ月 = ホット / 6-24 ヶ月 = ウォーム / 24+ ヶ月 = コールド の SLA 差別化を運用に乗せる。

### 1.2 含めるもの

- パーティション準備（投入対象月の事前 CREATE、不足月の自動補充）
- 時系列分割投入（古い月 → 新しい月の順）
- COPY 方式 + chunk 化（100 万件超の月対応）
- インデックス先付け / 後付け判断
- 参照頻度分析（直近 6 ヶ月 vs 古い分の SLA 差別化）
- アーカイブ判断（24 ヶ月超の別 tablespace 退避）
- 取込前後の整合性検証
- Tree 既存 INSERT との競合制御
- パーティション単位ロールバック

### 1.3 含めないもの

- リスト本体インポート → B-01
- 関電マスタ整合 → B-03
- 検索性能最適化 → B-04
- バックアップ → B-05
- RLS → B-06
- 監視 → B-07

---

## 2. Phase 1 / Phase 2 の前提

| 段階 | 内容 | 状態 |
|---|---|---|
| Phase 1 | リスト本体（`soil_lists`）30 万件 | B-01 で実装、本 spec の前提 |
| **Phase 2 = 本 spec** | コール履歴 335 万件 | **B-02** |
| Phase 3 | リスト残（FileMaker 200 万 + 旧 CSV 20 万）| B-01 の続き |

`soil_call_history` の `list_id` は `soil_lists.id` を参照するため、**B-01 完了後に B-02 着手**が原則。

---

## 3. パーティション準備

### 3.1 対象期間の特定

```sql
-- 既存コール履歴 CSV から min/max 日付を取得
SELECT
  MIN(call_datetime) AS earliest,
  MAX(call_datetime) AS latest
FROM staging_call_history;
-- 想定: 2021-01-01 〜 2026-04-30、約 64 ヶ月
```

### 3.2 必要パーティション数

64 ヶ月 + 未来 3 ヶ月 = **67 パーティション**（既存 12 ヶ月分は Batch 16 で作成済の場合あり）。

### 3.3 一括 CREATE スクリプト

```sql
DO $$
DECLARE
  m date := '2021-01-01';
  next_m date;
BEGIN
  WHILE m < '2026-08-01' LOOP
    next_m := m + interval '1 month';
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS soil_call_history_%s PARTITION OF soil_call_history
       FOR VALUES FROM (%L) TO (%L)',
      to_char(m, 'YYYYMM'), m, next_m
    );
    m := next_m;
  END LOOP;
END $$;
```

### 3.4 default パーティションの保護

`soil_call_history_default` への INSERT は事故サイン。投入前に空であることを確認、投入後も監視（B-07）。

---

## 4. 時系列分割投入

### 4.1 投入順序

```
古い月（2021-01）→ 新しい月（2026-04）の昇順
```

理由:
- パーティション pruning が効く
- 古い月は静的 → 後続パーティション索引で探さない
- 最新月は最後 → 既存 Tree INSERT と競合最小

### 4.2 月別 chunk 化

| 月の規模 | 投入方式 |
|---|---|
| 1 万件未満 | 単 COPY（数十秒）|
| 1-10 万件 | 単 COPY（数分）|
| 10-100 万件 | chunk 化 5 万件単位 COPY × N |
| 100 万件超 | chunk 化 2 万件単位 + 並列度抑制 |

335 万件 / 64 ヶ月 = 平均 5.2 万件 / 月。最近月は 8-10 万件想定。

### 4.3 並列度

- 月内チャンクは**順次**（同一パーティション競合）
- 月跨ぎは**最大 2 並列**まで（共通 INDEX 競合制御）

---

## 5. COPY 方式 + chunk 化

### 5.1 staging テーブル経由

```sql
-- 月別 staging
CREATE TEMP TABLE staging_call_history_202601 (LIKE soil_call_history INCLUDING DEFAULTS);

-- COPY 投入（INDEX なし、最速）
COPY staging_call_history_202601
  FROM '/tmp/calls_202601.csv' (FORMAT csv, HEADER true);

-- 親テーブルへ INSERT（パーティション自動振り分け）
INSERT INTO soil_call_history
  SELECT * FROM staging_call_history_202601;

DROP TABLE staging_call_history_202601;
```

### 5.2 直接 COPY も可

`soil_call_history` 親テーブルへ直接 COPY すると Postgres が partition routing を行う。staging を経由する利点は **整合性検査 + リトライ容易性**。

### 5.3 性能目標

- COPY: 5 万件 / 1 秒（インデックスなし）
- INSERT 親経由: 5 万件 / 5-10 秒（partition routing オーバーヘッド）
- 全件 335 万件 想定: **約 1.5 時間**（連続実行の場合）

---

## 6. インデックス先付け / 後付け判断

### 6.1 後付け推奨

- **理由**: COPY 中の INDEX 維持コストは 30-50%
- パーティション単位で INDEX 作成（親テーブルから自動継承）
- 全件投入完了後に CREATE INDEX

### 6.2 例外: 取込中も Tree 稼働

- Tree が既存月への INSERT を続けている場合、最新 6 ヶ月分は INDEX 維持
- 過去月は後付けで OK

### 6.3 投入後の処理

```sql
-- 親テーブルに INDEX 作成（PG15 で子に自動継承）
CREATE INDEX idx_soil_call_history_user_dt
  ON soil_call_history (user_id, call_datetime DESC);
-- ... 他 5 個

-- 統計情報更新
ANALYZE soil_call_history;
```

35 個 ≒ 5 INDEX × 7 主要パーティション 程度を順次。

---

## 7. 参照頻度分析と SLA 差別化

### 7.1 ステージ定義（戦略書 §5）

| 期間 | ステージ | アクセス頻度 | SLA |
|---|---|---|---|
| 0-6 ヶ月 | ホット | 日次クエリ多数 | p95 < 200ms |
| 6-24 ヶ月 | ウォーム | 月次集計のみ | p95 < 1s |
| 24-60 ヶ月 | コールド | 年次・監査時 | p95 < 5s |
| 60+ ヶ月 | アーカイブ | 法定保管のみ | 別途 |

### 7.2 自動 SLA 監視（B-07 連動）

- pg_stat_statements で月別パーティションのクエリ時間を集計
- SLA 超過時 Chatwork 通知

---

## 8. アーカイブ判断（24 ヶ月超）

### 8.1 トリガ条件

- パーティションの `call_datetime` 上限が **24 ヶ月以上前**
- 過去 90 日のクエリ実行回数が **10 回未満**
- 容量逼迫時（Storage 80% 超）優先候補

### 8.2 退避手順

```sql
-- 1. パーティションを別 tablespace へ移動
ALTER TABLE soil_call_history_202401 SET TABLESPACE archive_ts;

-- 2. INDEX 縮小（部分 INDEX のみ残す）
DROP INDEX idx_soil_call_history_202401_callback;  -- 不要
```

Supabase 上では tablespace 切替が制約あり → **論理レプリケーションで別 DB に逃がす**案を Phase D 以降で検討。

### 8.3 即時アーカイブは不要

B-02 段階では**全件ホット保持**で OK。

**東海林さん指示（2026-04-26、follow-up §1.1）**:
- **当面アーカイブ機能なし**
- **将来拡張可能な設計**（hooks / 拡張点を残す）
- アーカイブ機能の実装は将来必要時、当面はパーティション維持
- 容量逼迫時の判断トリガは Cross Ops #02 §10 で監視（Soil 容量警告 80% / 90% / 95%）

#### 拡張点（将来実装時）

```sql
-- アーカイブ用 tablespace 定義（事前作成のみ、実 DDL は将来）
-- CREATE TABLESPACE archive_ts LOCATION '/path/to/archive';

-- アーカイブ対象判定 helper（IMMUTABLE、将来 cron が呼出）
CREATE OR REPLACE FUNCTION is_archive_eligible_partition(p_partition_name text)
RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    -- パーティション名から年月抽出（soil_call_history_YYYYMM）
    (regexp_replace(p_partition_name, '^soil_call_history_', '')::text)::date
    < (current_date - interval '24 months');
$$;
-- 現在は呼出なし、将来の cron 実装時に活用
```

将来アーカイブ実装時は Cross Ops #05 data-retention の `archive_policies` テーブルに soil_call_history を登録する想定。

---

## 9. 整合性検証

### 9.1 取込前検査

```sql
-- 既存 soil_call_history 件数
SELECT COUNT(*) FROM soil_call_history;

-- staging 投入予定総件数
SELECT COUNT(*), MIN(call_datetime), MAX(call_datetime)
FROM staging_call_history;

-- list_id 不整合チェック（FK 違反を事前検出）
SELECT COUNT(*) FROM staging_call_history s
WHERE NOT EXISTS (SELECT 1 FROM soil_lists WHERE id = s.list_id);
```

### 9.2 取込後検査

```sql
-- 月別件数分布
SELECT
  date_trunc('month', call_datetime) AS month,
  COUNT(*) AS records
FROM soil_call_history
GROUP BY 1 ORDER BY 1;

-- user_id 集計（架電者の偏り確認）
SELECT user_id, COUNT(*) AS calls
FROM soil_call_history
GROUP BY user_id ORDER BY calls DESC LIMIT 20;

-- list_id 紐付率（不整合の最終確認）
SELECT COUNT(*) AS orphan_calls
FROM soil_call_history c
WHERE NOT EXISTS (SELECT 1 FROM soil_lists WHERE id = c.list_id);
```

### 9.3 アラート閾値

| 検査項目 | 警告 | エラー |
|---|---|---|
| 件数差分（投入前後）| ±0.5% | ±2% |
| orphan_calls | >0.1% | >1% |
| user_id 上位 1 名集中 | >50% | >80%（誤データ）|
| 月別空白（連続 0 件）| >1 月 | >3 月 |

---

## 10. Tree 既存 INSERT との競合制御

### 10.1 競合パターン

- B-02 投入中の最新月パーティションへ Tree 架電中 INSERT
- 同じ index ページの WAL 書込競合 → 性能劣化

### 10.2 対策

> **【重要】§13 判 1 「土日も人が入る非稼働日なし」前提に伴う 主軸格上げ**（2026-04-27 a-review R-2 反映）
>
> 「業務閑散時投入」は §13 判 1（毎日深夜 3-4 時開始 / 朝 6-7 時完了 / 非稼働日なし）と矛盾するため、**B 並列許容を主軸**に格上げ、A は限定運用に降格する。

#### B. 最新月のみ並列許容（**主軸**）

- 過去月は **Tree 影響なし**（参照のみ）
- 最新月は Tree INSERT と並走可（行レベルロック）
- 性能劣化 30% 程度を**許容前提**として運用、§13 判 1（非稼働日なし）前提と整合
- 実投入時間帯 03:00-07:00 JST は Tree 架電（業務開始 9 時）外のため、最新月並列でも実害は限定的（要 §15.5 検証）

#### A. 業務閑散時投入（限定的 fallback）

- B 案で性能劣化が業務影響レベル（架電開始 9 時時点で投入未完）に至った場合のみ、土曜深夜 〜 日曜朝へ振替
- 全件 1.5 時間想定 → 通常運用で 03:00-07:00 帯で完結する想定、A 案は緊急時のみ

### 10.3 INSERT 一時停止（最終手段）

Tree 側に Garden カレンダー連動の `feature_flags.tree_insert_enabled = false` を用意（既存 spec-cross-feature-flags 連動）。投入完了後に `true` 戻す。**深夜 3-7 時帯で Tree 架電 INSERT が原則発生しないため、本フラグは緊急時のみ発動**。

---

## 11. パーティション単位ロールバック

### 11.1 失敗時の選択肢

| 失敗 | 復旧 |
|---|---|
| 1 月失敗（5 万件）| 該当 staging を捨て、再投入 |
| 5 月連続失敗 | 既投入分も含め当該 5 月を TRUNCATE → 再投入 |
| 全件失敗（致命）| `soil_call_history` 全 TRUNCATE → 再投入 |

### 11.2 TRUNCATE による高速ロールバック

```sql
-- 1 月単位
TRUNCATE soil_call_history_202401;

-- 全件
TRUNCATE soil_call_history;  -- 親、子も連動
```

ただし `soil_call_history.created_at` 等の自動付与列は再投入で値が変わる。整合性検証で前後一致を確認。

### 11.3 PITR 復元

- Supabase PITR で投入前時刻に復元（最終手段）
- 7 日以内に判断
- 復元時は B-01 完了済の状態に戻る

---

## 12. 法令対応チェックリスト

### 12.1 個人情報保護法

- [ ] 第 17 条: 利用目的の特定（架電実績管理 / KPI 集計）
- [ ] 第 23 条: 安全管理措置（暗号化、RLS、監査）
- [ ] 通話メモ（`memo`）の機微情報チェック

### 12.2 特定商取引法

- [ ] 第 17 条: 不招請勧誘の記録（`outcome='rejected'` で追跡）
- [ ] do-not-call 履歴の連続性

### 12.3 労働基準法

- [ ] 第 109 条: 業務記録 5 年保管（コール履歴は永続保持）

---

## 13. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | パーティション一括 CREATE スクリプト | a-soil | 1h |
| 2 | staging テーブル + COPY 投入 | a-soil | 1.5h |
| 3 | 月別 chunk 化スクリプト | a-soil | 1.5h |
| 4 | 整合性検証 SQL + アラート | a-soil | 1h |
| 5 | INDEX 後付け + ANALYZE 自動化 | a-soil | 1h |
| 6 | Tree 競合制御（feature flag）| a-soil + a-tree | 1h |
| 7 | リハーサル（dev で全件投入）| a-soil | 3h |
| 8 | 本番投入 + 検証 | a-soil + a-main | 3h |
| 9 | パーティション単位ロールバック手順書 | a-soil | 1h |
| 10 | 監視（B-07 連動）| a-soil | 1h |

合計: 約 15h ≈ **2.0d**

---

## 14. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 投入実行時刻 | **毎日 深夜 3-4 時開始 / 朝 6-7 時完了**（東海林さん指示 2026-04-26、follow-up §1.1）。9 時稼働開始に確実に間に合う。非稼働日なし前提（土日も人が入る可能性）。335 万件規模で 1 夜完了が厳しい場合は複数夜分割投入も視野。cron `0 3-6 * * *` 連続実行帯。 |
| 判 2 | INDEX 後付けの並列度 | 最大 2 並列、それ以上は I/O 飽和 |
| 判 3 | 24 ヶ月超アーカイブ即実施 | **当面アーカイブ機能なし**（東海林さん指示 2026-04-26、follow-up §1.1）。将来拡張可能な設計（hooks / 拡張点を残す）。Phase B-1 段階ではパーティション維持、容量逼迫時に再評価。§13 §13.1 アーカイブ戦略参照。 |
| 判 4 | Tree INSERT 一時停止判断 | 業務閑散時投入で原則不要、緊急時のみ feature flag |
| 判 5 | リハーサル必須回数 | dev で 1 回、性能基準達成必須 |
| 判 6 | 並列投入上限 | 月跨ぎ 2 並列、月内は順次 |
| 判 7 | orphan_calls の扱い | エラーで停止 + 該当 list_id を補完 or staging 修正後再投入 |

---

## 15. 既知のリスクと対策

### 15.1 パーティション pruning 失敗

- WHERE 句に `call_datetime` 範囲がないクエリ → 全パーティション走査
- 対策: ORM レイヤで強制、主要クエリで EXPLAIN 確認

### 15.2 default パーティションへの誤 INSERT

- staging データに想定外の古い月（例: 2018 年）が混入
- 対策: 投入前に min/max 検査、不足月を CREATE してから投入

### 15.3 容量逼迫

- 335 万件 + INDEX で約 3GB
- 対策: 投入前に容量確認、80% 超で警告（B-07 連動）

### 15.4 Tree 既存 INSERT のデッドロック

- 同一行の更新で稀にデッドロック
- 対策: 投入時刻を業務閑散時に固定、INSERT は append-only 設計で防止

### 15.5 統計情報陳腐化

- ANALYZE 忘れでプランナ誤判断
- 対策: 各パーティション投入完了直後に ANALYZE

### 15.6 BLOAT 蓄積

- INSERT のみだが UPDATE（誤入力訂正）で bloat
- 対策: 投入完了後に `pg_stat_user_indexes` 確認、必要なら REINDEX CONCURRENTLY

---

## 16. 関連ドキュメント

- `docs/specs/2026-04-25-soil-02-call-history-schema.md`
- `docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md`（戦略書）
- `docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md`（前提）
- `docs/specs/2026-04-26-soil-phase-b-04-search-optimization.md`（後続）
- `docs/specs/2026-04-26-soil-phase-b-07-monitoring-alerting.md`
- `docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`

---

## 17. 受入基準（Definition of Done）

- [ ] パーティション 67 個（過去 64 + 未来 3）作成済
- [ ] default パーティション空状態を投入前後で確認
- [ ] 月別 chunk 化スクリプト動作（dev で 100 万件月で 5 分以内）
- [ ] 整合性検証 SQL 自動実行 + 警告 / エラー区分
- [ ] INDEX 後付け + ANALYZE 完走
- [ ] Tree feature flag が動作（停止 / 再開）
- [ ] dev リハーサル 1 回完走（335 万件、所要時間計測済）
- [ ] 本番投入 + 検証 green
- [ ] パーティション単位ロールバック手順書を `docs/runbooks/soil-call-history-rollback.md` に転記
- [ ] B-07 監視に Soil 特有カテゴリ追加完了
