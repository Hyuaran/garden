# Soil #04: インポート戦略（FileMaker / CSV / Kintone → Soil）

- 対象: Garden-Soil への大量データ投入手順
- 優先度: **🔴 高**（Phase B-1 で関電 Kintone 30 万件、Phase C で 200 万件級 FileMaker）
- 見積: **1.0d**（バッチ + 整合性検査 + リハーサル）
- 担当セッション: a-soil（実装）/ a-main（運用判断）
- 作成: 2026-04-25（a-auto 004 / Batch 16 Soil #04）
- 前提:
  - `docs/specs/2026-04-25-soil-01-list-master-schema.md`
  - `docs/specs/2026-04-25-soil-02-call-history-schema.md`
  - `docs/specs/2026-04-25-soil-03-kanden-list-integration.md`
  - 既存 `scripts/`（Forest 等の Python 投入スクリプト先例）

---

## 1. 目的とスコープ

### 1.1 目的

複数ソース（Kintone / FileMaker / CSV）から Garden-Soil へ**安全に・整合性を保ちながら・段階的に**大量データを投入する手順を定義する。最終目標は 253 万件のリスト本体 + 335 万件のコール履歴。

### 1.2 含めるもの

- データソースごとの抽出方針（Kintone API / FileMaker エクスポート / CSV）
- 正規化・クレンジングルール（電話番号 / 住所 / 業種 / 名前）
- 重複検出と統合戦略
- 投入バッチの実装パターン（COPY / chunked INSERT）
- リハーサル → 本番投入の段取り
- ロールバック手順

### 1.3 含めないもの

- Kintone 列のマッピング詳細 → #03（関電）+ 各 Leaf 商材 spec
- インデックスの先付け / 後付け戦略 → #05
- RLS 制約下での投入 → #06

---

## 2. データソースと優先順位

### 2.1 ソース一覧

| ソース | 対象 | 件数概算 | 取得方式 | 取得難易度 |
|---|---|---|---|---|
| Kintone App 55（関電リスト）| 関電顧客 | 30 万件 | Kintone REST API | 🟢 容易 |
| FileMaker LIST2024 | 全商材リスト | 200 万件 | FileMaker Pro エクスポート（CSV）| 🟡 中 |
| 旧 CSV（過去配布）| 雑多 | 20 万件 | Google Drive / 共有 | 🟡 中 |
| Kintone App 38（営業用名簿）| 業務委託先 | 〜数千件 | Kintone REST API | 🟢 容易（Root へ）|

### 2.2 投入優先順位

```
Phase B-1: Kintone 関電 30 万件（業務即時必要）
  ↓
Phase C 前半: FileMaker LIST2024 200 万件（一括）
  ↓
Phase C 後半: 旧 CSV 20 万件（重複検出してから）
  ↓
Phase D: 増分メンテナンス（毎週 Kintone から差分取込）
```

---

## 3. 共通の正規化・クレンジングルール

### 3.1 電話番号

```typescript
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  // 1. 全半角カナ・空白を半角化
  // 2. ハイフン / 括弧 / スペース除去
  // 3. 国番号正規化（+81- / 0- 統一）
  // 4. 桁数チェック（10〜11 桁、それ以外は null）
  const cleaned = raw
    .replace(/[\s\-\(\)・]/g, '')
    .replace(/^\+81-?/, '0')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  if (!/^0\d{9,10}$/.test(cleaned)) return null;
  return cleaned;
}
```

### 3.2 名前（漢字・カナ）

- 全角空白 → 半角に統一
- カナは全カナ化（ひらがな含むものは検出 → 警告）
- 「株式会社」「有限会社」等の前後表記ゆれを正規化（最後尾に固定）
- 法人 / 個人の判定（株式会社等の含み）→ `customer_type` 自動判定

### 3.3 住所

- 都道府県を抽出 → `prefecture` カラム
- 市区町村を抽出 → `city` カラム
- 残り → `address_line`
- 郵便番号は数字 7 桁に正規化（ハイフンは UI 側のみ）
- 「番地」「号室」「ビル名」までは構造化せず `address_line` に格納（人手で必要時整理）

### 3.4 業種

```typescript
const INDUSTRY_DICT: Record<string, string> = {
  '工場照明': '工場照明',
  '工場': '工場照明',          // 派生
  '理容洗濯': '理容・洗濯',
  '理容': '理容・洗濯',
  '洗濯': '理容・洗濯',
  '街路灯': '街路灯その他',
  // ... 50〜100 パターンの揺れを吸収
  'その他': 'その他',
};

function normalizeIndustry(raw: string): string {
  return INDUSTRY_DICT[raw?.trim()] ?? 'その他';
}
```

辞書は `soil_lists_industry_dict` テーブル（#01 §2.5）で管理、追加・修正可能。

### 3.5 メールアドレス

- 小文字化
- 前後の空白除去
- RFC 5322 簡易チェック（通らないものは `email_primary = NULL`、原文を `email_alternates` に保管）

---

## 4. 重複検出と統合戦略

### 4.1 重複検出アルゴリズム

```
1. インポート前の事前重複検出（バッチ内重複）
   - 同一 `phone_primary` でグループ化
   - 同一 `name_kana` + `postal_code` でグループ化
   - グループに 2 件以上あれば「インポート前統合候補」として保留

2. インポート時の既存データ重複検出
   - 既存 `soil_lists` の `phone_primary` と一致 → UPSERT 候補
   - 既存 `source_record_id` と一致 → 同じソースの再インポート → UPDATE
   - どちらも一致しない → 新規 INSERT
```

### 4.2 自動マージ vs 手動判断

| 状況 | 動作 |
|---|---|
| `source_record_id` 完全一致 | **自動 UPDATE**（同じソースの再インポート）|
| `phone_primary` 一致 + `name_kana` 一致 | **自動 UPDATE**（既存に新情報を適用）|
| `phone_primary` 一致 + 名前不一致 | **保留 + 警告**（手動マージへ）|
| 名前一致 + 住所一致 のみ | **保留 + 警告** |
| マッチなし | **新規 INSERT** |

### 4.3 マージ提案テーブル

```sql
CREATE TABLE public.soil_lists_merge_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES soil_list_imports(id),
  staging_record jsonb NOT NULL,        -- インポート対象の生データ
  candidate_existing_id uuid REFERENCES soil_lists(id),
  match_reason text NOT NULL,           -- 'phone+name' | 'phone-only' | ...
  match_confidence numeric NOT NULL,    -- 0-1
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'merged' | 'created_new' | 'skipped'
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 4.4 マージ提案レビュー UI

- `/soil/imports/{id}/merge-proposals` にて一覧表示
- 各提案に「マージする / 新規作成 / スキップ」ボタン
- 一括「90% 信頼度以上はマージする」操作も提供

---

## 5. ソース別の取得手順

### 5.1 Kintone REST API

```typescript
// scripts/soil-import-kintone.ts
const KINTONE_BATCH = 500; // API 制限（1 リクエスト 500 件）

async function fetchKintoneApp55() {
  let cursor = 0;
  while (true) {
    const records = await kintoneApi.records.get({
      app: 55,
      query: `order by 管理番号1 asc limit ${KINTONE_BATCH} offset ${cursor}`,
    });
    if (records.records.length === 0) break;
    await stagingInsert(records.records);
    cursor += KINTONE_BATCH;
    await sleep(200); // レート制限対策
  }
}
```

#### 注意点

- Kintone API は **1 日 100 万 API 呼び出し制限**（運用条件依存、契約確認）
- 30 万件 / 500 = 600 リクエスト → 余裕、ただし他用途と共有なら注意
- 進捗を `soil_list_imports.error_summary` ではなく専用テーブル `staging_imports` に保存（再実行時の冪等性）

### 5.2 FileMaker エクスポート（CSV）

- FileMaker Pro から **UTF-8 BOM 付き CSV** でエクスポート（東海林さん手作業）
- ファイル例: `LIST2024_export_20260501.csv`（200 万件、約 800MB）
- Google Drive 経由で受け渡し → ローカルにダウンロード → スクリプト投入

```bash
# ローカル PC で実行（本番接続不可、staging or local Supabase へ）
python scripts/soil-import-csv.py \
  --source LIST2024 \
  --file ./LIST2024_export_20260501.csv \
  --batch 5000
```

### 5.3 旧 CSV（雑多）

- ファイル形式が**個別に異なる**（カラム順 / エンコーディング / 区切り文字）
- 各ファイルごとに**マッピング設定 YAML** を準備:

```yaml
# scripts/soil-import-configs/old-csv-2023.yaml
source_label: "2023 年配布リスト"
encoding: "Shift_JIS"
delimiter: ","
columns:
  - csv_name: "顧客名"
    soil_field: "name_kanji"
  - csv_name: "TEL"
    soil_field: "phone_primary"
    transform: "normalizePhone"
  # ...
```

スクリプトは YAML を読んで動的にマッピング。

---

## 6. 投入バッチの実装パターン

### 6.1 staging テーブル方式（推奨）

```sql
-- 1. 一時テーブルへ COPY 投入（インデックスなし、最速）
CREATE TEMP TABLE staging_soil_lists (LIKE soil_lists INCLUDING ALL);
ALTER TABLE staging_soil_lists DROP CONSTRAINT staging_soil_lists_pkey;
COPY staging_soil_lists FROM '/tmp/list_normalized.csv' CSV;

-- 2. 重複検出 → マージ提案テーブルへ書き出し
INSERT INTO soil_lists_merge_proposals (...)
SELECT ... FROM staging_soil_lists s
WHERE EXISTS (SELECT 1 FROM soil_lists WHERE phone_primary = s.phone_primary);

-- 3. 重複なしのものを soil_lists に挿入
INSERT INTO soil_lists (...)
SELECT ... FROM staging_soil_lists s
WHERE NOT EXISTS (SELECT 1 FROM soil_lists WHERE phone_primary = s.phone_primary);

-- 4. staging を破棄
DROP TABLE staging_soil_lists;
```

### 6.2 chunked Server Action 方式（小規模 < 1 万件）

```typescript
// 5,000 件ずつ分割して INSERT
const CHUNK = 5000;
for (let i = 0; i < records.length; i += CHUNK) {
  const chunk = records.slice(i, i + CHUNK);
  await supabase.from('soil_lists').insert(chunk);
  await sleep(100); // pooler 過負荷回避
}
```

### 6.3 性能比較

| 方式 | 100 万件投入時間 | インデックス | 推奨用途 |
|---|---|---|---|
| COPY → staging | 5〜10 分 | 後付け | 大量初期投入 |
| chunked INSERT | 30〜60 分 | 既存維持 | 小規模 / 増分 |

---

## 7. インデックス先付け vs 後付け

### 7.1 大量初期投入時

```
1. soil_lists テーブル作成（インデックスなし）
   ↓
2. COPY で 200 万件投入（5〜10 分）
   ↓
3. CREATE INDEX 一括（10〜30 分）
   ↓
4. ANALYZE soil_lists（統計情報更新）
```

### 7.2 増分投入時

- インデックス維持のまま INSERT（既存運用パターン）
- 数千件 / 日 程度なら影響軽微

---

## 8. リハーサル → 本番投入

### 8.1 段階

```
Phase 1: スキーマ確定（dev 環境で migration 適用）
  ↓
Phase 2: サンプル 1,000 件投入（dev、エンドツーエンド確認）
  ↓
Phase 3: 全件投入リハーサル（dev、所要時間計測 + 整合性検査）
  ↓
Phase 4: 本番投入（業務閑散時、Cron 停止下）
  ↓
Phase 5: 整合性検査（件数 / 重複 / マージ提案 / RLS）
  ↓
Phase 6: 業務再開
```

### 8.2 整合性検査 SQL（投入後の必須確認）

```sql
-- 件数チェック
SELECT
  source_system,
  COUNT(*) AS total,
  COUNT(DISTINCT phone_primary) AS unique_phones,
  COUNT(*) FILTER (WHERE phone_primary IS NULL) AS missing_phone,
  COUNT(*) FILTER (WHERE customer_type = 'individual') AS individuals,
  COUNT(*) FILTER (WHERE customer_type = 'corporate') AS corporates
FROM soil_lists
WHERE created_at >= $import_started_at
GROUP BY source_system;

-- 重複（phone 一致）
SELECT phone_primary, COUNT(*)
FROM soil_lists
WHERE phone_primary IS NOT NULL
GROUP BY phone_primary
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC LIMIT 50;

-- 業種正規化漏れ（'その他' に集約されすぎ）
SELECT industry_type, COUNT(*)
FROM soil_lists
GROUP BY industry_type
ORDER BY COUNT(*) DESC;
```

### 8.3 失敗時のロールバック

```sql
-- import_id を全て削除
DELETE FROM soil_lists
WHERE id IN (
  SELECT id FROM staging_link_table WHERE import_id = $import_id
);

DELETE FROM soil_list_imports WHERE id = $import_id;
```

事前に `staging_link_table` を作っておく（どのインポートで投入されたかを追跡）。

---

## 9. 増分インポート（Phase D 以降）

### 9.1 Kintone 差分取込

```typescript
// 毎週月曜 06:00 JST
const lastImport = await getLastSuccessfulImport('kintone-app-55');
const sinceDate = lastImport?.imported_at ?? '2000-01-01';

const records = await kintone.records.get({
  app: 55,
  query: `更新日時 > "${sinceDate}" order by 更新日時 asc`,
});

// UPSERT（source_record_id 一致で UPDATE、なければ INSERT）
for (const r of records.records) {
  await upsertByOrigin(r);
}
```

### 9.2 整合性チェック（毎週）

- Kintone 側件数 vs Soil 側件数の差分が ±10% 以内か
- 大幅乖離があれば Chatwork 通知（Cross Ops #01 連動）

---

## 10. 既知のリスクと対策

### 10.1 文字エンコーディング誤り

- FileMaker → CSV 出力時に UTF-8 を選び忘れ → 文字化け
- 対策: スクリプトで文字化け検出（`?` 記号比率が高い行を flag）

### 10.2 電話番号の重複検出ミス

- ハイフン有無 / 全角半角の差で別人扱い
- 対策: 正規化を**事前に staging 側で実施**してから比較

### 10.3 Kintone API レート制限

- 1 日 100 万呼出制限、他用途と共有なら危険
- 対策: 大量投入は **1 日かけて分散**、週末実行を推奨

### 10.4 200 万件投入中の DB 負荷

- COPY 中は他クエリが詰まる
- 対策: **業務閑散時（土曜深夜等）**に実行、事前に Chatwork 通知

### 10.5 投入後の RLS 不整合

- 投入直後はインデックス不在で RLS 評価が遅い
- 対策: ANALYZE 直後に主要 RLS クエリを実行 → 速度確認

### 10.6 マージ提案の山積み

- 30 万件中 5 万件がマージ候補 → 人手判断不能
- 対策: 自動マージ閾値（信頼度 0.95+）を緩めて自動実行 + 残りは月次で消化

### 10.7 業種辞書のメンテ漏れ

- インポート後「その他」が異常に多い → 辞書漏れ
- 対策: 整合性検査（§8.2）で「その他」比率 30% 超なら警告 → 辞書追補

---

## 11. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | Kintone API クライアント整備 | a-soil | 1h |
| 2 | 正規化ヘルパー（phone / address / name / industry）| a-soil | 1.5h |
| 3 | staging テーブル + COPY 投入スクリプト | a-soil | 1.5h |
| 4 | マージ提案テーブル + UI | a-soil | 2h |
| 5 | FileMaker CSV インポートスクリプト | a-soil | 1h |
| 6 | 旧 CSV YAML 設定方式 | a-soil | 0.5h |
| 7 | 整合性検査 SQL + 自動レポート | a-soil | 0.5h |
| 8 | リハーサル（dev で全件流し）| a-soil | 1h |
| 9 | 本番投入計画書（time / 順序 / ロールバック）| a-soil + a-main | 0.5h |

合計: 約 9.5h ≈ 1.0d（リハーサル時間込み、本番投入は別途）

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-25-soil-01-list-master-schema.md`
- `docs/specs/2026-04-25-soil-02-call-history-schema.md`
- `docs/specs/2026-04-25-soil-03-kanden-list-integration.md`
- `docs/specs/2026-04-25-soil-05-index-performance.md`
- `docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`（投入前バックアップ）
- `docs/specs/2026-04-26-cross-ops-04-release-procedure.md`（運用閑散時投入）

---

## 13. 受入基準（Definition of Done）

- [ ] 正規化ヘルパー（phone / address / name / industry）の単体テスト pass
- [ ] staging → soil_lists の COPY 投入が dev で 100 万件 5 分以内
- [ ] マージ提案テーブル + レビュー UI が動作
- [ ] Kintone API 取得スクリプトが 30 万件取得を完走（dev）
- [ ] FileMaker CSV インポートスクリプトが 200 万件投入を完走（dev）
- [ ] 整合性検査 SQL（§8.2）が自動実行 + Chatwork 通知
- [ ] ロールバック手順を 1 度実施成功
- [ ] 本番投入計画書を東海林さんレビュー済
- [ ] Phase B-1 で Kintone 関電 30 万件本番投入成功
