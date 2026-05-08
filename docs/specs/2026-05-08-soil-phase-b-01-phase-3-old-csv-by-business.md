# Soil Phase B-01 Phase 3: 旧 CSV 商材別インポート（約 20 万件、30 商材）

- 対象: Soil モジュール / `soil_lists` への旧システム CSV からの商材別取込
- 優先度: 🟢 通常（Phase 2 完走後、商材ごとに段階的に取込）
- 見積: **1.0d**（商材別 Adapter + Phase 2 流用）
- 担当セッション: a-soil（実装）/ a-bloom（レビュー観点）
- 作成: 2026-05-08（a-soil / Batch 20 = Soil Phase B-01 Phase 2/3 拡張、Phase 3 第 2 弾）
- 前提:
  - **Batch 16 / Batch 19 spec 済**（基盤 + Phase B 7 件）
  - **B-01 Phase 1 実装完成**（Kintone API 30 万件、feature/soil-batch16-impl）
  - **B-01 Phase 2 spec 完成**（FileMaker CSV 200 万件、本 spec の親）
  - **Phase 2 完走 + 安定運用** が Phase 3 着手条件
  - 既存 staging テーブル群（migration 000007）

---

## 1. 目的とスコープ

### 1.1 目的

Garden 各商材（光回線 / クレジットカード等、約 30 商材）の旧管理システムから出力された CSV を、商材別 Adapter 経由で `soil_lists` に取り込む。Phase 1 (Kintone 関電 30 万) + Phase 2 (FileMaker 汎用 200 万) に続く第 3 段階で、合計約 250 万件の母リスト整備を完了させる。

商材別の理由:
- 旧システムは商材ごとに別管理（光は A 社、クレカは B 社、等）
- CSV フォーマットが商材ごとに異なる（列名 / エンコーディング / 件数）
- 1 ファイル = 1 商材で運用、商材単位で取込 / 失敗管理が独立

### 1.2 含めるもの

- 商材別 CSV フォーマット定義テンプレート（個別商材は `soil_business_csv_configs` で管理）
- 商材別 Adapter Pattern（Phase 2 の Kintone 互換 Adapter を一般化）
- 商材識別（`source_system` = `'old-csv-{business_code}'` 命名規約）
- 取込進捗の商材別追跡（既存 `soil_list_imports` を商材タグで運用）
- Phase 1 / Phase 2 跨り重複処理（Phase 2 の R1/R2 検出を再利用）
- 商材別取込スケジュール（Phase 2 完走後、商材ごとに段階的開始）

### 1.3 含めないもの

- Phase 1 Kintone 取込 → **B-01（実装完了）**
- Phase 2 FileMaker 取込 → **B-01 Phase 2（本 Batch 20 で起草済）**
- 商材別 Leaf テーブル設計 → **Leaf モジュール対象、Soil 範囲外**
- 商材別 KPI 集計 → **Bloom Phase A-2、Soil 範囲外**
- 取込後の商材別マッピング（`soil_lists.industry_type` ↔ Leaf 商材） → **B-08 で別途検討**

---

## 2. Phase 1 / Phase 2 / Phase 3 統合像

| Phase | データソース | 件数 | 商材数 | 実装ファイル | 状態 |
|---|---|---|---|---|---|
| Phase 1 | Kintone App 55 関電リスト | 約 30 万件 | 1（関電） | KintoneClient | ✅ 実装完了 |
| Phase 2 | FileMaker 汎用エクスポート | 約 200 万件 | 横断（業種・商材問わず） | (計画) Adapter | ⏳ spec 完成、実装待ち |
| **Phase 3（本 spec）** | **旧 CSV 商材別** | **約 20 万件** | **約 30 商材** | **(計画) 商材別 Adapter** | ⏳ **本 spec で起草** |

### 全 Phase 完走時の母リスト規模

- Phase 1: 30 万件（関電）
- Phase 2: 200 万件（FileMaker 汎用、Phase 1 と一部重複あり）
- Phase 3: 20 万件（商材別、Phase 1/2 と一部重複あり）
- **合計（重複統合後）**: 約 220-230 万件想定（重複 8-10% 想定）

### Phase 3 完走の定義

1. 30 商材分の旧 CSV が順次 `soil_lists` に取り込み完了（運用上は商材 1 件ずつ）
2. Phase 1 / Phase 2 既投入分との重複は `soil_lists_merge_proposals` に提案登録済
3. 商材別取込履歴が `soil_list_imports` で追跡可能（source_system タグで判別）
4. `soil_business_csv_configs` テーブルに 30 商材分のフォーマット定義登録済
5. admin ダッシュボードで商材別ジョブ完了ステータス表示

---

## 3. 商材別 CSV フォーマット定義

### 3.1 想定 30 商材（暫定リスト）

| business_code | 商材名 | 旧システム | 想定件数 |
|---|---|---|---|
| `hikari` | 光回線 | NTT 顧客管理 | ~30,000 |
| `creditcard` | クレジットカード | A 社カード CRM | ~25,000 |
| `mobile` | 携帯電話 | B 社 MVNO | ~20,000 |
| `gas` | 都市ガス | C 社ガス | ~15,000 |
| `electricity` | 電力（関電以外） | D 社電力 | ~10,000 |
| `water` | 水道事業 | 自治体出力 | ~8,000 |
| `solar` | 太陽光 | E 社販売 | ~5,000 |
| `insurance_life` | 生命保険 | F 社代理店 | ~5,000 |
| `insurance_general` | 損害保険 | G 社代理店 | ~5,000 |
| ... | ... | ... | ... |
| `business_30` | 30 商材目 | ... | ~3,000 |
| **合計** | | | **約 200,000** |

> **注**: 上記は暫定。実際の 30 商材リストは東海林さんが業務上把握しており、実装着手時に `soil_business_csv_configs` テーブルへ登録（runbook 参照）。

### 3.2 共通フィールド（全商材で必須）

| 抽象列名 | soil_lists 列 | 必須/任意 | 備考 |
|---|---|---|---|
| customer_id_legacy | `source_record_id` | 必須 | 旧システムの顧客 ID |
| name_kanji | `name_kanji` | 必須 | 漢字氏名 |
| phone_primary | `phone_primary` | 推奨 | normalizePhone 適用 |
| postal_code | `postal_code` | 任意 | |
| address_line | `address_line` | 任意 | |

### 3.3 商材固有フィールド

商材ごとに異なる列（例: 光回線の `回線速度`, クレジットカードの `カード種類`）は本 Phase 3 では**取り込まない**:
- 商材固有データは Leaf 各テーブルで管理する設計（CLAUDE.md §データ設計の基本方針）
- Soil は「全商材横断の顧客マスタ」のため、共通項のみ抽出

### 3.4 商材別マッピング設定テーブル `soil_business_csv_configs`

実装時に新設する設定テーブル:

```sql
CREATE TABLE public.soil_business_csv_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_code   text NOT NULL UNIQUE,                -- 'hikari' / 'creditcard' / ...
  business_label  text NOT NULL,                       -- '光回線' / 'クレジットカード' / ...
  source_system   text NOT NULL,                       -- 'old-csv-hikari' / 'old-csv-creditcard'
  industry_type_default text,                          -- soil_lists.industry_type 既定値
  encoding        text NOT NULL DEFAULT 'utf8',        -- 'utf8' | 'shiftjis' | 'cp932'
  delimiter       text NOT NULL DEFAULT ',',           -- ',' | '\t' | ';'
  has_header      boolean NOT NULL DEFAULT true,
  column_mapping  jsonb NOT NULL,                      -- { "csv_col": "soil_col" } 対応表
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  notes           text
);

CREATE INDEX idx_soil_business_csv_configs_active
  ON public.soil_business_csv_configs (active, business_code)
  WHERE active = true;
```

#### column_mapping の例（`hikari` 商材）

```json
{
  "顧客番号": "source_record_id",
  "氏名": "name_kanji",
  "氏名カナ": "name_kana",
  "電話番号": "phone_primary",
  "郵便番号": "postal_code",
  "都道府県": "prefecture",
  "市区町村": "city",
  "住所": "address_line",
  "回線種別": "_ignored",
  "契約日": "_ignored"
}
```

`_ignored` は商材固有列で Soil に取り込まない列を明示する規約。

---

## 4. 取込パイプライン（Phase 2 設計流用）

### 4.1 全体フロー

```
[ 商材別 旧 CSV (config に従ったフォーマット) ]
       ↓ admin が /soil/admin/imports/phase3 から開始
       ↓ business_code を選択
[ scripts/soil-import-csv-phase3.ts （npx tsx 実行）]
       ↓ 1. soil_business_csv_configs から business_code の設定を読込
       ↓ 2. CSV を staging に COPY（business_code でタグ付け）
[ soil_imports_staging (raw_payload + source_system='old-csv-{business_code}') ]
       ↓ 3. 商材別 Adapter で正規化
       ↓    column_mapping に基づき動的に列マッピング
[ soil_imports_normalized ]
       ↓ 4. Phase 1 / Phase 2 既投入分との重複検出
       ↓    R1: phone + name / R2: source_record_id（同 source_system 内）
[ soil_lists_merge_proposals ]
       ↓ 5. Load (chunkSize=10,000、ON CONFLICT)
[ soil_lists (商材別追加) ]
```

### 4.2 Phase 2 との差分

| 観点 | Phase 2 | Phase 3 |
|---|---|---|
| データソース | 単一の FileMaker CSV | 商材別 30 ファイル（順次） |
| 件数 | 200 万件 / 1 ファイル | 平均 6,700 件 / 1 ファイル × 30 |
| Adapter | 単一の FileMaker Adapter | **動的 Adapter**（config の column_mapping から生成） |
| chunkSize | 10,000 件 | **5,000 件**（小規模なので Phase 1 と同じ） |
| INDEX 戦略 | 後付け必須（200 万件規模） | **先付け維持**（商材毎の小規模追加で許容範囲） |
| 取込時間 | 3-4 時間（一晩） | 5-15 分 / 商材 |
| 取込時間帯 | 22:00-7:00 | 営業時間外推奨だが緊急時は日中可 |
| 商材識別 | `source_system='filemaker-list2024'` | `source_system='old-csv-{business_code}'` |

### 4.3 動的 Adapter 設計

Phase 2 の Adapter は固定列マッピング（FileMaker 列 → KintoneApp55Record 互換）。Phase 3 は商材ごとに列が異なるため、**設定駆動の Adapter** を使用:

```typescript
// src/lib/db/soil-import-csv-dynamic-adapter.ts（実装フェーズで作成）
import type { KintoneApp55Record } from "./soil-import-transform";

export type CsvBusinessConfig = {
  business_code: string;
  source_system: string;
  industry_type_default: string | null;
  column_mapping: Record<string, string>;        // { csv_col: soil_col | "_ignored" }
};

/**
 * 商材設定に基づき CSV 行を KintoneApp55Record 互換形に変換する。
 *
 * column_mapping の値が "_ignored" なら無視。
 * 既知の soil_col（name_kanji / phone_primary 等）は KintoneApp55Record の対応 field にマッピング。
 */
export function csvRowToKintoneRecordViaConfig(
  row: Record<string, string>,
  config: CsvBusinessConfig,
): KintoneApp55Record {
  const result: KintoneApp55Record = {
    $id: { value: "" },
  };

  for (const [csvCol, soilCol] of Object.entries(config.column_mapping)) {
    if (soilCol === "_ignored") continue;
    const value = row[csvCol] ?? "";

    switch (soilCol) {
      case "source_record_id":
        result.$id = { value };
        break;
      case "name_kanji":
        result.漢字 = { value };
        break;
      case "name_kana":
        result.カナ = { value };
        break;
      case "phone_primary":
        result.電話番号 = { value };
        break;
      case "postal_code":
        result.郵便番号 = { value };
        break;
      case "prefecture":
        result.都道府県 = { value };
        break;
      case "city":
        result.市区町村 = { value };
        break;
      case "address_line":
        result.住所 = { value };
        break;
      case "industry_type":
        result.業種 = { value };
        break;
      // 他の soil_col も同様に拡張
    }
  }

  return result;
}
```

> **設計の核心**: `transformKintoneApp55ToSoilList` は Phase 1 / 2 / 3 すべてで再利用、変更なし。違いは Adapter のみ。

---

## 5. Phase 1 / Phase 2 跨り重複処理（Phase 2 設計流用）

### 5.1 重複の発生源（Phase 3 特有）

- 同一顧客が複数商材を契約（光 + クレカ + 携帯等）→ 商材ごとに別レコード化済の旧データ
- Phase 1 / 2 と異なる商材では同名顧客でも別契約 = 別レコード扱いの判断あり
- Phase 3 取込時に Phase 1 / 2 と跨り重複が発生する可能性

### 5.2 マッチング戦略（Phase 2 と同じ + 同一 business_code 内重複）

Phase 2 spec §5.2 の R1/R2 をそのまま利用:
- R1: `phone_primary` + `name_kanji` 完全一致 → confidence 0.95、自動 merge_proposal 登録
- R2: `source_record_id` 一致（同 business_code 内の旧 CSV 再取込時） → confidence 0.99、自動承認可

加えて Phase 3 固有:
- **R3**: 同一 business_code 内で `source_record_id` 既存（再取込検出） → 既存レコードを ON CONFLICT で UPDATE、merge_proposal は不要

### 5.3 同一商材内の再取込

旧 CSV を再エクスポートして取込し直すケース:
- ON CONFLICT (source_system, source_record_id) DO UPDATE で同 business_code 内では既存レコード更新
- 別の商材から同顧客（phone+name 一致）はそのまま別レコード（→ R1 で merge_proposal 登録、admin が承認後統合）

---

## 6. インデックス戦略（Phase 3 = 先付け維持）

### 6.1 商材ごと取込のため INDEX 影響軽微

各商材 5,000-30,000 件規模 = 既存 INDEX 維持で取込時間影響軽微（数分単位）。

→ **Phase 2 のような INDEX 一時 OFF は不要**。

### 6.2 トリガ INDEX の再考慮

仮に 1 商材で 50,000 件超など大規模に達した場合は：
- 当該商材取込時のみ INDEX を一時 OFF / ON
- spec §11 受入基準で「1 商材あたりの取込時間 > 30 分なら INDEX 後付け検討」

---

## 7. エラー処理 / リトライ（Phase 1/2 流用）

### 7.1 Phase 3 固有のエラー

| エラー | 動作 |
|---|---|
| `business_code` が `soil_business_csv_configs` に存在しない | scripts 即停止、admin に「config 登録が必要」通知 |
| エンコーディング誤り（cp932 / shiftjis 検出失敗） | scripts 即停止、admin が手動で UTF-8 変換後 retry |
| column_mapping に登録外の列が CSV にある | warning として記録、`_ignored` として扱い処理続行 |
| 必須列（name_kanji 等）が空 | 該当行を `soil_imports_errors` に記録、chunk 内で skip |

### 7.2 既存 Phase 1/2 リトライ機構の再利用

`runSoilImport` の retry / resume / cancel 機能はそのまま再利用。商材別ジョブも同じ orchestrator で動作。

---

## 8. 進捗 UI 拡張

### 8.1 既存 `/soil/admin/imports` の拡張

- source_system フィルタに「商材別」セレクトを追加（business_code でフィルタ）
- ジョブ一覧に「商材」列を追加（source_system から business_code 抽出して表示）

### 8.2 新規ページ案: `/soil/admin/imports/configs`

`soil_business_csv_configs` 管理画面（admin / super_admin のみ）:
- 30 商材の config 一覧（business_code / business_label / encoding / column_mapping）
- column_mapping の編集 UI（JSON エディタ + 構文検証）
- active / inactive 切替

---

## 9. 監査ログ

Phase 2 と同じ `cross_history_admin_actions` を使用、action 名のみ Phase 3 用に変更:
- `soil.phase3_import_start` (business_code 引数あり)
- `soil.phase3_config_create` / `soil.phase3_config_update`
- `soil.phase3_import_pause` / `resume` / `retry` / `cancel`

---

## 10. パフォーマンス目標

### 10.1 取込時間（1 商材あたり）

| 件数規模 | 目標時間 |
|---|---|
| ~5,000 件 | ~3 分 |
| ~10,000 件 | ~5 分 |
| ~30,000 件 | ~15 分 |

### 10.2 30 商材合計

順次取込で**全件完走 5-8 時間**目安（中休憩含む、商材間で admin 確認時間あり）。

---

## 11. 受入基準（Definition of Done）

- [ ] `soil_business_csv_configs` テーブル新設 + 30 商材分の config 登録
- [ ] 商材別 CSV 取込 scripts (soil-import-csv-phase3.ts) 動作確認
- [ ] 動的 Adapter (`csvRowToKintoneRecordViaConfig`) TDD 完成
- [ ] 30 商材中、最低 5 商材分の本番取込完走（α 版）
- [ ] Phase 1 / Phase 2 跨り重複検出 + merge_proposals 登録確認
- [ ] admin ダッシュボードで商材別ジョブ完了ステータス表示
- [ ] 監査ログ（cross_history_admin_actions）に Phase 3 操作記録
- [ ] runbook（docs/runbooks/old-csv-import-runbook.md）整備完了
- [ ] 1 商材あたりの取込時間 ≤ 30 分達成

---

## 12. 実装タスク分解（次セッション以降）

| # | タスク | 工数 | 依存 |
|---|---|---|---|
| 1 | `soil_business_csv_configs` migration | 0.2d | spec 連動 |
| 2 | `src/lib/db/soil-import-csv-dynamic-adapter.ts` + TDD | 0.3d | Phase 1/2 完成済 |
| 3 | `scripts/soil-import-csv-phase3.ts`（business_code 引数） | 0.2d | dynamic adapter 完成 |
| 4 | 30 商材 config 初期データ投入（東海林さんヒアリング） | 0.3d | runbook 整備と並行 |
| 5 | `/soil/admin/imports/configs` config 管理 UI | 0.3d | Phase 1 UI 完成済 |
| 6 | runbook 整備（docs/runbooks/old-csv-import-runbook.md） | 0.2d | 東海林さん運用ヒアリング |
| 7 | α 版取込（5 商材分） | 0.3d | 上記すべて完了後 |
| **合計** | | **1.8d** | |

---

## 13. 判断保留事項

| # | 論点 | a-soil スタンス（暫定） |
|---|---|---|
| 判 1 | 30 商材リストの確定 | 東海林さんが運用上把握、実装着手時に `soil_business_csv_configs` 初期投入で確定 |
| 判 2 | column_mapping のスキーマ厳格化 | jsonb で柔軟運用、UI 側で JSON Schema 検証 |
| 判 3 | エンコーディング自動判定 | scripts で BOM + chardet ライブラリ簡易検出、誤判定時は admin が手動指定 |
| 判 4 | 同一 business_code の再取込時の挙動 | ON CONFLICT で UPDATE（spec §5.3 通り）、admin に件数差分通知 |
| 判 5 | 商材間の merge proposal 自動承認 | 異なる business_code 間の重複は manual review（誤統合リスク回避） |
| 判 6 | config 編集権限 | super_admin のみ（spec #06 RLS 連動、誤設定で全件破壊リスク） |
| 判 7 | 商材別ジョブの順序制御 | 順次実行（並列禁止）、admin の手動キュー制御 |

---

## 14. 既知のリスクと対策

### 14.1 商材別フォーマット差異の漏れ
- 対策: `soil_business_csv_configs` で構造化、column_mapping は JSON Schema で検証

### 14.2 エンコーディング不整合
- 対策: BOM + chardet で自動判定 + admin 指定 fallback、誤判定時は scripts 即停止

### 14.3 30 商材分の config 登録漏れ
- 対策: 取込スクリプト起動時に config 不在を検出 → 即停止 + admin 通知

### 14.4 同名異人の誤統合
- 対策: R1 (phone+name) のみ自動 proposal、異 business_code 間は manual review 必須

### 14.5 大量 config 編集の事故
- 対策: super_admin のみ編集可、変更履歴を `cross_history_admin_actions` に記録

### 14.6 商材独自列の取りこぼし
- 対策: 仕様上 Soil は共通項のみ、商材固有列は Leaf 側で別途管理（設計の役割分担堅持）

---

## 15. 関連ドキュメント

- `docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md`（B-01 Phase 1）
- `docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md`（B-01 Phase 2、本 spec の親）
- `docs/specs/2026-04-25-soil-04-import-strategy.md`（インポート戦略親書）
- `docs/specs/2026-04-25-soil-05-index-performance.md`（INDEX 戦略連動）
- `docs/runbooks/old-csv-import-runbook.md`（実装フェーズで起草）
- `supabase/migrations/20260507000007_soil_imports_staging.sql`（staging 既存）
- `src/lib/db/soil-importer.ts`（Phase 1/2/3 共通 orchestrator）
- `src/app/soil/admin/imports/page.tsx`（Phase 1/2/3 共通 UI）

---

## 16. Phase 2 との一体運用

本 Phase 3 spec は **Phase 2 の延長線上**として設計:
- 95% Phase 1/2 既存実装を再利用
- 唯一の新規実装は **動的 Adapter**（config 駆動の列マッピング）
- 取込パイプライン全体は同じ
- Phase 2 完走後 1-2 週間で Phase 3 着手可能（商材別段階展開）

→ Batch 20 = Phase 2 + Phase 3 = **B-01 全 Phase spec 揃う**、Phase B 第 2 段階準備完了。

---

## 17. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-08 | v1.0 | 初版起草、a-main-014 main- No. 137 dispatch 対応、B-01 Phase 2 spec の延長として Phase 3 を起草 | a-soil |

— end of B-01 Phase 3 spec —
