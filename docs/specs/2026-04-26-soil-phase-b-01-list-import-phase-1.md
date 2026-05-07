# Soil Phase B-01: リストインポート Phase 1（253 万件、初回 bulk import）

- 対象: Soil モジュール / `soil_lists` 本体テーブルへの初回大量取込
- 優先度: 🔴 最優先（Phase A-3 経理系完了後、現場投入前の必須）
- 見積: **1.50d**（0.25d 刻み、Phase 1 = 30 万件のみ。Phase 2/3 は別 spec）
- 担当セッション: a-soil（実装）/ a-root（権限・認証連携）/ a-bloom（レビュー観点）
- 作成: 2026-04-26（a-auto 007 / Batch 19 Soil Phase B-01）
- 前提:
  - **Batch 16 Soil 基盤 8 spec**（merge 済）
    - 特に `docs/specs/2026-04-25-soil-04-import-strategy.md`（インポート戦略書）を **本 spec の親**として踏襲
    - `docs/specs/2026-04-25-soil-01-data-model.md`（`soil_lists` スキーマ）
    - `docs/specs/2026-04-25-soil-02-encryption.md`（pgcrypto 個人情報暗号化）
    - `docs/specs/2026-04-25-soil-03-soft-delete.md`（論理削除 / 物理削除）
  - Kintone App 55（関電リスト、推定 30 万件、74 フィールド）
  - Fruit `fruit_companies_legal`（6 法人マスタ）
  - 関連 Cross 系 spec（横断 履歴・削除管理 Batch 14）

---

## 1. 目的とスコープ

### 1.1 目的
253 万件規模の営業リスト本体（`soil_lists`）の **初回 bulk import** を、現場投入前に **失敗なく完走**させる。Phase 1 では **関電リスト 30 万件のみ**を Kintone REST API 経由で取り込み、本番運用フローを確立する。これにより：
- Tree（架電アプリ）が Phase D で参照する母集団を準備
- Leaf 関電業務委託（Phase B）の母リストを早期に投入
- Bloom KPI が Phase C で参照する集計母数を確保

### 1.2 含めるもの
- Kintone REST API 経由の Phase 1 取込手順（App 55、30 万件）
- CSV 手動取込の **運用区分定義**（Phase 2/3 への送り分け規則のみ。実装は別 spec）
- 進捗 UI（admin 専用ダッシュボード、resume / retry / cancel）
- エラーリトライ戦略（chunked + trx 単位 rollback）
- 取込前後の整合性検証
- インデックス先付け / 後付け判断（30 万件は **先付け**、200 万件超は後付けを Phase 2 で再判断）
- マージ提案 UI（`soil_lists_merge_proposals` レビュー）
- staging テーブル方式（COPY → staging → upsert → `soil_lists`）

### 1.3 含めないもの
- コール履歴 335 万件のインポート → **B-02**
- 関電リストの定期連携・差分同期詳細 → **B-03**
- 全文検索 / 高速検索の性能チューニング → **B-04**
- バックアップ・リストア手順 → **B-05**
- RLS（Row Level Security）設計 → **B-06**
- 取込ジョブの監視・アラート → **B-07**

---

## 2. Phase 1 の範囲確定（Phase 2 / Phase 3 との切分け）

| Phase | データソース | 件数 | 取込方式 | 着手時期 |
|---|---|---|---|---|
| **Phase 1（本 spec）** | Kintone App 55 関電リスト | 30 万件 | REST API（cursor / GET records） | 即時着手 |
| Phase 2 | FileMaker エクスポート CSV | 約 200 万件 | CSV 手動取込（COPY） | Phase 1 完走 + 1 週間運用後 |
| Phase 3 | 旧システム CSV（光・クレカ等） | 約 20 万件 | CSV 手動取込（COPY） | Phase 2 完走後、商材別 |

**Phase 1 完走の定義**（DoD §15 と整合）:
1. Kintone App 55 から 30 万件全件が `soil_lists` に取り込み完了
2. 取込前後の件数差分 = 0（または明示的に判定済の除外件数のみ）
3. `phone_primary` 重複は `soil_lists_merge_proposals` に登録済
4. admin ダッシュボードで完了ステータス表示

---

## 3. データソース（Kintone API + CSV）

### 3.1 Kintone REST API 取込（Phase 1）

**App 55 関電リスト**:
- Endpoint: `GET /k/v1/records.json`（cursor API 使用、`/k/v1/records/cursor.json` で 500 件単位 pagination）
- フィールド数: 74（pgcrypto 暗号化対象は別 spec §3 参照）
- API レート: 100 req/sec（公式値）。本番は 10 req/sec で抑制
- 認証: API トークン（`KINTONE_APP_55_TOKEN` を `.env.local`、本番は Vercel env）

**取込ジョブの 3 段階**:
1. **Extract**: cursor で 500 件ずつ取得 → `soil_imports_staging` (raw JSONB) に COPY
2. **Transform**: staging で型変換・正規化（電話番号 E.164、住所 zenkaku→hankaku、業種コード正規化）
3. **Load**: staging → `soil_lists` へ upsert（`(source_app, source_record_id)` ユニーク制約）

### 3.2 CSV 手動取込の運用区分（Phase 2/3 への送り分け）

| 条件 | 区分 |
|---|---|
| Kintone App に存在 | API 取込（Phase 1 / Phase 3 商材別） |
| FileMaker のみ存在 | CSV 取込（Phase 2） |
| 旧 CSV ファイル | CSV 取込（Phase 3） |
| 重複（同一 `phone_primary`） | `soil_lists_merge_proposals` に登録 |

CSV 取込の実装詳細は本 spec のスコープ外（Phase 2 で別 spec 起草）。

### 3.3 staging テーブル方式

```
[ Kintone API ]
       ↓ (cursor pagination)
[ soil_imports_staging ]  -- raw JSONB, no constraints, COPY 高速
       ↓ (Transform: E.164 / zenkaku→hankaku / 業種コード)
[ soil_imports_normalized ] -- 型付き、検証済
       ↓ (upsert ON CONFLICT (source_app, source_record_id))
[ soil_lists ]              -- 本番テーブル、暗号化 + 制約適用
```

staging 方式の利点（既存 spec `2026-04-25-soil-04-import-strategy.md` §3 踏襲）:
- API 失敗時の resume が容易（staging に既取得分が残る）
- Transform エラーの切り分けが明確
- 本番テーブルへのロックを最小化

---

## 4. 進捗 UI 設計（admin 専用）

### 4.1 配置と権限
- パス: `/soil/admin/imports`
- 権限: `admin` / `super_admin` のみ（Root §RLS 連携）
- 一覧: `soil_list_imports` テーブル連動

### 4.2 ダッシュボード要素

| セクション | 表示内容 |
|---|---|
| ヘッダー | 現在進行中ジョブ件数 / 直近完了 / 失敗 |
| ジョブ一覧 | 1 行 = 1 import job（id / status / progress % / started_at / 件数） |
| 詳細パネル | chunk 単位の進捗、エラーログ、resume / retry / cancel ボタン |
| ライブログ | Server-Sent Events で chunk 完了を 5 秒間隔で更新 |

### 4.3 状態遷移

```
queued → running → (paused | failed | completed)
                ↓                ↑
              resume ←———————————┘
```

- **resume**: paused / failed から再開（最後に成功した chunk_id 以降を再取得）
- **retry**: failed から最初から再実行（staging を truncate）
- **cancel**: running → cancelled（staging データは保持、admin 判断で truncate）

### 4.4 admin 操作の監査ログ
- すべての resume / retry / cancel は `cross_history_admin_actions`（Batch 14 で起草済）に記録
- 操作者 user_id / timestamp / job_id / action を記録

---

## 5. エラーリトライ戦略

### 5.1 chunked 設計
- chunk size = **5,000 件**（30 万件 ÷ 5,000 = 60 chunks）
- 1 chunk = 1 トランザクション
- chunk 失敗時は **その chunk のみ rollback**、次の chunk は継続

### 5.2 リトライポリシー

| エラー種別 | アクション |
|---|---|
| Kintone API 一時エラー（5xx, 429） | 指数バックオフ（1s → 2s → 4s → 8s → 16s）、最大 5 回 |
| Kintone API 永続エラー（4xx 認証等） | 即時停止、admin に通知 |
| Transform エラー（型変換不可） | 該当レコードを `soil_imports_errors` に記録、chunk 内で skip |
| Load 失敗（INSERT 制約違反） | trx 単位 rollback、エラー内容を `soil_imports_errors` に記録、次 chunk へ continue |
| 同一 chunk が 3 回連続失敗 | ジョブ全体を failed に遷移、admin 判断待ち |

### 5.3 continue 判定の境界
- **continue する**: Transform エラー / 制約違反（個別レコード起因）
- **stop する**: 認証エラー / DB 接続切断 / 5 回連続 API タイムアウト

### 5.4 trx 単位 rollback の実装方針
- Supabase RPC または PostgreSQL function で chunk 単位の SAVEPOINT を使用
- chunk_id を `soil_imports_chunks` に記録（status: pending / running / completed / failed）

---

## 6. 整合性検証

### 6.1 取込前検証（Pre-flight check）
- [ ] Kintone API 認証成功
- [ ] App 55 のスキーマ取得（74 フィールド一致）
- [ ] 概算件数取得（`?totalCount=true`）→ 期待値 30 万件 ± 5%
- [ ] `soil_lists` の現在件数記録（baseline）
- [ ] staging テーブル空であること

### 6.2 取込後検証

| 検証項目 | 合格条件 |
|---|---|
| 件数差分 | `soil_lists` 件数増加 = Kintone 取得件数 - エラー件数 |
| `phone_primary` 重複 | 重複は `soil_lists_merge_proposals` に登録（直接 INSERT は失敗扱いではない） |
| 業種正規化漏れ | `industry_code IS NULL` の件数 < 0.5%（500 件以下） |
| 暗号化適用 | `phone_primary_encrypted` IS NOT NULL の率 = 100% |
| 6 法人タグ付与 | `legal_company_id` IS NOT NULL の率 = 100% |
| `source_app` / `source_record_id` | ペアでユニーク（重複ゼロ） |

### 6.3 検証レポート出力
- `docs/import-reports/YYYYMMDD-soil-phase-b-01.md` に自動出力（admin が手動実行）
- 失敗項目は admin ダッシュボードに通知

---

## 7. インデックス先付け / 後付け判断

### 7.1 Phase 1（30 万件）= 先付け
- 理由: 30 万件は INSERT 中もインデックス維持コストが現実的（実測 5〜10 分の遅延想定）
- 対象インデックス（`2026-04-25-soil-01-data-model.md` §インデックス節と整合）:
  - `(phone_primary)`
  - `(legal_company_id, status)`
  - `(industry_code)`
  - `(source_app, source_record_id)` UNIQUE
  - `(created_at DESC)`

### 7.2 Phase 2（200 万件超）= 後付け
- 理由: 200 万件 INSERT 時のインデックス更新コストが過大（既存 spec §7 踏襲）
- 手順:
  1. インデックス DROP
  2. INSERT 完了
  3. `CREATE INDEX CONCURRENTLY`（本番ロック回避）

### 7.3 判断境界
- **100 万件未満 → 先付け**
- **100 万件以上 → 後付け**
- Phase 1 は 30 万件のため先付け確定。Phase 2 で再判断。

---

## 8. マージ提案 UI

### 8.1 検出条件
- 取込時に `phone_primary` が既存レコードと一致 → `soil_lists_merge_proposals` に INSERT
- 一致条件の優先順位:
  1. `phone_primary` 完全一致
  2. `phone_primary` ハッシュ一致（暗号化後の決定的ハッシュ列で比較）

### 8.2 自動マージ vs 手動マージ

| 条件 | マージ方式 |
|---|---|
| `legal_company_id` 一致 + `name` 完全一致 | 自動マージ（同一顧客と判定） |
| `legal_company_id` 一致 + `name` 部分一致（80%↑） | 手動マージ（admin レビュー） |
| `legal_company_id` 不一致 | 手動マージ（別法人扱いの可能性） |
| その他 | 手動マージ |

### 8.3 マージ UI
- パス: `/soil/admin/merge-proposals`
- 一覧: 提案一覧（status: pending / approved / rejected）
- 詳細: 既存レコード vs 取込レコードの diff 表示
- 操作: approve（マージ実行）/ reject（提案破棄、両方残す）/ defer（保留）

---

## 9. 既存モジュール連携（Tree / Leaf / Bloom 参照）

### 9.1 Tree 連携
- 取込完了後、Tree は `soil_lists` を読み取り、架電キュー生成
- Phase 1 完了後、Tree 側で 30 万件の表示性能テスト（B-04 で実施）

### 9.2 Leaf 関電業務委託連携
- Phase B（Leaf）で関電案件化された顧客のみ Leaf テーブルに移行
- 移行時、Soil 側の `is_promoted_to_leaf` フラグを更新（既存 cross spec 準拠）

### 9.3 Bloom KPI 連携
- Bloom 側で母数集計（`COUNT(*) FROM soil_lists WHERE legal_company_id = ?`）
- 30 万件規模での集計性能は B-04 で検証

---

## 10. 法令対応チェックリスト
- [ ] **個人情報保護法**: 取得・利用目的の明確化（営業リスト管理目的）
- [ ] **個人情報保護法**: 安全管理措置（pgcrypto 暗号化、admin RLS）
- [ ] **個人情報保護法**: 第三者提供制限（6 法人内部利用のみ）
- [ ] **特商法**: 営業リストの利用範囲（架電業務における特定商取引）
- [ ] **電話勧誘販売規制**: Do Not Call リスト連携（既存 cross spec 準拠）
- [ ] **GDPR / APPI**: 越境移転なし（Supabase 東京リージョン）

---

## 11. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `soil_imports_staging` / `soil_imports_normalized` / `soil_imports_chunks` / `soil_imports_errors` マイグレーション | a-soil | 0.25d |
| 2 | Kintone App 55 cursor 取得サービス（リトライ + バックオフ） | a-soil | 0.25d |
| 3 | Transform 層（E.164 / zenkaku→hankaku / 業種コード） | a-soil | 0.25d |
| 4 | Load 層（chunk 単位 upsert、`soil_lists_merge_proposals` 登録） | a-soil | 0.25d |
| 5 | admin ダッシュボード（一覧 + 詳細 + resume/retry/cancel） | a-soil | 0.25d |
| 6 | 整合性検証ジョブ + レポート出力 | a-soil | 0.125d |
| 7 | a-root と権限連携（admin RLS 確認） | a-root | 0.0625d |
| 8 | a-bloom レビュー（KPI 観点で母数妥当性確認） | a-bloom | 0.0625d |
| **計** | | | **1.50d** |

---

## 12. 判断保留事項（最低 5 件）

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | Kintone API レート上限を 10 req/sec に抑制すべきか、より高速（50 req/sec）で攻めるか | **10 req/sec 推奨**（夜間バッチ前提、本番影響回避）。要東海林さん判断 |
| 2 | chunk size 5,000 件は妥当か（1,000 / 5,000 / 10,000 の選択） | **5,000 推奨**（30 万 ÷ 5,000 = 60 chunks、1 chunk 数十秒）。Phase 2 で再評価 |
| 3 | 自動マージの「`name` 完全一致」判定は厳密一致か、空白除去後一致か | **空白除去 + 全角半角正規化後の完全一致**を推奨。要東海林さん確認 |
| 4 | `phone_primary` 重複時、`legal_company_id` 不一致なら別法人として両方残すか、提案登録か | **提案登録（手動マージ）を推奨**。自動破棄は危険 |
| 5 | 取込中の admin ダッシュボードのライブ更新は SSE / WebSocket / polling どれか | **SSE 推奨**（5 秒間隔、Vercel 互換）。Supabase Realtime 検討も可 |
| 6 | Phase 1 の取込ウィンドウは夜間バッチ（22:00〜06:00）固定か、admin 任意起動か | **admin 任意起動 + 推奨ウィンドウ表示**。本番 Tree 影響回避のため夜間推奨 |
| 7 | 取込失敗時、staging データを保持する期間（resume 用）は何日か | **7 日推奨**。それ以降は admin 判断で truncate |
| 8 | `industry_code` 正規化漏れ 0.5% 超過時、取込を中断するか継続するか | **警告のみ + 継続**を推奨。後続バッチで補完可能 |

---

## 13. 既知のリスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| Kintone API レート超過で取込長時間化 | 30 万件取込が 10 時間超 | 10 req/sec 制限 + 夜間バッチ |
| staging テーブル肥大化（resume 用保持） | DB 容量圧迫 | 7 日後 admin 操作で truncate |
| 暗号化処理のボトルネック（pgcrypto CPU） | chunk 完了時間遅延 | chunk size を 5,000 に抑制、必要なら 2,000 に縮小 |
| 既存 `soil_lists` の重複大量検出 | merge_proposals が数万件膨張 | UI ページネーション + 自動マージ条件強化 |
| Phase 2（200 万件）でメモリ不足 | OOM Kill | Phase 2 で別 spec、staging を バッチ間で truncate |
| Tree / Leaf / Bloom が取込中に参照 | データ不整合表示 | 取込ウィンドウを夜間に集約 + 取込中バナー表示 |

---

## 14. 関連ドキュメント

- **親 spec**: `docs/specs/2026-04-25-soil-04-import-strategy.md`（インポート戦略、§3 staging / §7 インデックス判断を踏襲）
- **データモデル**: `docs/specs/2026-04-25-soil-01-data-model.md`（`soil_lists` スキーマ）
- **暗号化**: `docs/specs/2026-04-25-soil-02-encryption.md`（pgcrypto 個人情報暗号化）
- **論理削除**: `docs/specs/2026-04-25-soil-03-soft-delete.md`（削除パターン定義）
- **次 spec**: `docs/specs/2026-04-26-soil-phase-b-02-call-history-import.md`（コール履歴 335 万件、別 Batch）
- **Cross 系**: Batch 14 横断 履歴・削除管理 6 spec（`cross_history_admin_actions` 監査ログ参照）
- **Kintone**: App 55 関電リスト（74 フィールド）スキーマドキュメント（社内共有）

---

## 15. 受入基準（Definition of Done）

- [ ] Kintone App 55 から 30 万件 ± 5% の取込完了
- [ ] `soil_lists` の件数増加 = 取得件数 - エラー件数（差分 0）
- [ ] `phone_primary` 重複は全件 `soil_lists_merge_proposals` に登録
- [ ] 業種正規化漏れ 0.5% 以下
- [ ] 暗号化適用率 100%
- [ ] 6 法人タグ付与率 100%
- [ ] admin ダッシュボードで完了ステータス表示
- [ ] resume / retry / cancel が動作確認済（疑似失敗を起こして検証）
- [ ] 監査ログ（`cross_history_admin_actions`）に admin 操作が記録
- [ ] 整合性検証レポート（`docs/import-reports/YYYYMMDD-soil-phase-b-01.md`）が自動生成
- [ ] Tree / Leaf / Bloom から参照可能（read-only smoke test）
- [ ] effort-tracking.md に Phase 1 完走の実績時間を記録
- [ ] Phase 2 着手前の 1 週間運用検証で本番影響なし

---

（以上、Soil Phase B-01 spec / 起案: a-auto Batch 19）
