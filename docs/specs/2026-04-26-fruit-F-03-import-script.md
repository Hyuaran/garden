# Fruit F-03: 取込スクリプト（Kintone REST API → Supabase）

- 対象: Kintone App 28（法人名簿）から Fruit テーブルへのデータ取込スクリプト（手動トリガ + 日次 cron）
- 優先度: 🔴
- 見積: **1.25d**
- 担当セッション: a-fruit（実装）/ a-root（連携）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Fruit F-03）
- 前提:
  - **F-01**（Migration、テーブル定義済）
  - **F-02**（Kintone マッピング、変換ルール定義済）
  - **Sprout v0.2 spec §13**（Fruit 連携）
  - **Cross History #04** 削除パターン統一規格

---

## 1. 目的とスコープ

### 1.1 目的
Kintone App 28（法人名簿）の 6 法人レコードを Fruit テーブルへ取込み、Sprout / Bud / Forest / Root から共通参照可能な状態にする。手動トリガ（admin が随時実行）と日次自動 cron の 2 系統で運用する。

### 1.2 含めるもの
- 取込スクリプトの実行モード（manual / scheduled / dryrun）
- Kintone REST API 認証・取得ロジック
- F-02 マッピングルールの実装（変換 / バリデーション / 暗号化）
- UPSERT トランザクション（親子テーブル一貫性）
- import_runs テーブル（実行履歴）
- 削除レコード検知（Kintone 削除 → Fruit 論理削除）
- エラーハンドリング・通知（Chatwork）
- Vercel Cron 配線（root の cron config パターン踏襲）

### 1.3 含めないもの
- UI トリガ（→ F-04 のセレクター UI 内に admin 用ボタン配置、本 spec で API は定義）
- Storage への添付ファイル同期（別バッチ、本 spec ではメタデータのみ）
- 双方向同期（Fruit → Kintone）

---

## 2. 設計方針 / 前提

- **配置**: `src/app/api/fruit/import/route.ts`（Next.js App Router）+ Vercel Cron
- **冪等性**: company_code または corporate_number で UPSERT、何度実行しても同一結果
- **トランザクション**: 親（fruit_companies_legal）→ 子テーブル の順、失敗時は法人単位でロールバック
- **バルク処理**: 6 法人なので逐次処理で十分、API レート制限を考慮
- **認証**: Kintone API トークン（環境変数 `KINTONE_API_TOKEN_APP28`）
- **削除検知**: Kintone 側で削除されたレコードは Fruit 側で論理削除（deleted_at = now()）
- **権限**: 手動トリガは admin / super_admin のみ（API ハンドラで RLS チェック）
- **通知**: 取込結果（成功 / 警告 / エラー件数）を Chatwork ルーム ID `fruit_import_log` に投稿
- **dryrun モード**: 取込せず、取込予定の差分を表示のみ

---

## 3. アーキテクチャ概要

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Kintone App 28  │───▶│ Next.js API      │───▶│ Supabase        │
│ (61 fields)     │    │ /api/fruit/import│    │ fruit_*  8tbls  │
└─────────────────┘    │                  │    └─────────────────┘
                       │ ┌──────────────┐ │
                       │ │ KintoneClient│ │    ┌─────────────────┐
                       │ ├──────────────┤ │───▶│ Chatwork        │
                       │ │ Mapper(F-02) │ │    │ fruit_import_log│
                       │ ├──────────────┤ │    └─────────────────┘
                       │ │ Validator    │ │
                       │ ├──────────────┤ │    ┌─────────────────┐
                       │ │ Encryptor    │ │───▶│ import_runs テー│
                       │ ├──────────────┤ │    │ ブル (履歴)     │
                       │ │ Upserter     │ │    └─────────────────┘
                       │ └──────────────┘ │
                       └──────────────────┘
                              ▲
                              │
                       ┌──────┴────────┐
                       │ Vercel Cron   │ (日次 03:00 JST)
                       │ /api/fruit/   │
                       │ import?cron=1 │
                       └───────────────┘
```

---

## 4. 実行モード

### 4.1 manual（admin 手動）
```
POST /api/fruit/import
Authorization: Bearer <session token>
Body: { mode: 'manual', dryrun: false }
```
- admin / super_admin のみ可
- 即時実行、結果を JSON で返却
- 結果は import_runs テーブルにも記録

### 4.2 scheduled（cron）
```
GET /api/fruit/import?cron=1
Header: x-vercel-cron-secret: <secret>
```
- Vercel Cron Job から呼び出し、`vercel.json` の crons 設定で 03:00 JST 日次
- secret 認証必須（root の cron 配線と同パターン）
- 結果は Chatwork に通知

### 4.3 dryrun
```
POST /api/fruit/import
Body: { mode: 'manual', dryrun: true }
```
- DB は変更しない、差分のみ計算して返却
- 取込前確認用

---

## 5. 取込フロー

```
1. 認証チェック（admin / cron secret）
2. import_runs に新規行 INSERT（status='running'）
3. Kintone REST API: GET /k/v1/records.json?app=28 で全レコード取得
   - 6 件想定、ページング不要だが念のため limit=500
4. 各レコードを順次処理：
   a. F-02 マッピングで Fruit 形式に変換
   b. バリデーション（error → スキップ、warning → 続行）
   c. 暗号化（口座番号 / 機微許認可番号）
   d. UPSERT トランザクション開始：
      - fruit_companies_legal を UPSERT（company_code or corporate_number）
      - fruit_representatives: kintone_row_id で UPSERT、Kintone 側にない行は論理削除
      - fruit_banks: 同上
      - fruit_licenses: 同上
      - fruit_insurances: 同上
      - fruit_contracts: 同上
      - fruit_documents: 添付ファイルメタのみ（実体同期は別バッチ）
   e. 履歴差分があれば fruit_history に INSERT
   f. COMMIT or ROLLBACK
5. Kintone 側削除検知:
   - Fruit にあって Kintone にない法人 → fruit_companies_legal.deleted_at = now()
   - 子テーブルも連鎖論理削除
6. import_runs を UPDATE（status='success'/'partial'/'failed'、件数記録）
7. Chatwork 通知（dryrun 以外）
```

---

## 6. import_runs テーブル

| 列名 | 型 | 説明 |
|---|---|---|
| id | uuid | PK |
| started_at | timestamptz | 開始 |
| ended_at | timestamptz | 終了 |
| mode | text | manual / scheduled / dryrun |
| triggered_by | uuid | FK root_employees（cron は NULL） |
| status | text | running / success / partial / failed |
| total_kintone | int | Kintone レコード数 |
| inserted | int | 新規挿入 |
| updated | int | 更新 |
| logically_deleted | int | 論理削除 |
| skipped | int | スキップ |
| warnings | jsonb | 警告ログ配列 |
| errors | jsonb | エラーログ配列 |
| dryrun_diff | jsonb | dryrun 時の差分プレビュー |

**インデックス**: `idx_fruit_import_runs_started` ON `started_at DESC`

---

## 7. エラーハンドリング

| エラー種別 | 動作 | 通知 |
|---|---|---|
| Kintone API 認証失敗 | 即時停止、import_runs.status='failed' | Chatwork 緊急通知 |
| Kintone API レート制限 | 5 秒待機 + リトライ最大 3 回 | リトライ成功時は warning ログ |
| バリデーション error | 該当法人スキップ、warnings.push | 通常通知に集約 |
| UPSERT トランザクション失敗 | 該当法人ロールバック、errors.push、次の法人へ | 通常通知 |
| 暗号化失敗 | 全体停止 | Chatwork 緊急通知 |
| Chatwork 通知失敗 | import_runs に記録のみ、処理は完了扱い | （ログのみ） |

---

## 8. Vercel Cron 配線

`vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/fruit/import?cron=1",
      "schedule": "0 18 * * *"
    }
  ]
}
```
- 18:00 UTC = 03:00 JST 日次
- 既存の root cron（daily-workings、phase A-3-d）と同パターン
- `x-vercel-cron-secret` 認証必須

---

## 9. Chatwork 通知フォーマット

```
[info][title]Fruit 法人マスタ取込完了 (2026-04-26 03:00)[/title]
モード: scheduled
件数: 6 / 6 件成功
内訳: 新規 0 / 更新 6 / 論理削除 0 / スキップ 0
警告: 2 件（インボイス番号未登録 - 株式会社A、業種コード不正 - 株式会社B）
エラー: 0 件
詳細: https://garden.example.com/fruit/import-runs/<id>
[/info]
```

---

## 10. 法令対応チェックリスト

- [ ] **個人情報保護法**: 取込時の代表者生年月日・口座番号は暗号化、ログには hint のみ出力
- [ ] **電子帳簿保存法**: import_runs 履歴を 10 年保持（Cross History #04 物理削除禁止）
- [ ] **インボイス制度**: invoice_number 取得時に CHECK 制約違反は warning として記録
- [ ] **派遣法**: license_type='haken' の有効期限切れを取込後に検知、Chatwork に別途通知（リマインダー仕様は別 spec）
- [ ] **会社法**: 代表者変更を fruit_history に自動記録（before/after diff）

---

## 11. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | KintoneClient（REST API ラッパ） | a-fruit | 0.15d |
| 2 | Mapper 実装（F-02 ルール反映） | a-fruit | 0.25d |
| 3 | Validator 実装 | a-fruit | 0.10d |
| 4 | Encryptor（pgcrypto Edge Function 連携） | a-fruit | 0.10d |
| 5 | Upserter（親子トランザクション） | a-fruit | 0.20d |
| 6 | API ハンドラ（manual / cron / dryrun） | a-fruit | 0.15d |
| 7 | import_runs テーブル + Migration | a-fruit | 0.05d |
| 8 | vercel.json cron 配線 | a-fruit | 0.05d |
| 9 | Chatwork 通知 | a-fruit | 0.10d |
| 10 | レビュー反映 | a-bloom | 0.10d |

---

## 12. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| F03-1 | Kintone API トークン管理（個別トークン or 共通） | App 28 専用トークンを推奨（権限最小化） |
| F03-2 | dryrun で添付ファイルメタ差分も計算するか | yes（別バッチで実体同期するため、メタだけは差分表示） |
| F03-3 | cron 失敗時の再試行戦略 | Vercel Cron は自動再試行なし、Chatwork 通知で手動対応 |
| F03-4 | 取込中のロック（並行実行防止） | import_runs に running 行があれば 409 返却 |
| F03-5 | Kintone API レート制限値（公称 100req/min） | 6 件なので問題なし、念のため 5 秒待機 |

---

## 13. 既知のリスクと対策

- **Kintone API 仕様変更**: REST API は安定だが、サブテーブル構造変更あれば再マッピング → F-02 の対応表を運用で更新
- **暗号化キー漏洩**: Supabase Vault 使用、ローカル開発では dev 用キー
- **取込中のデータ不整合**: トランザクション内で完結、部分更新は不可
- **削除誤検知**: Kintone API 一時障害で空配列を返した場合の論理削除暴走 → 取得件数 0 の場合は処理スキップ
- **secret 漏洩**: vercel env で管理、ローテーション運用

---

## 14. 関連ドキュメント

- F-01（Migration）/ F-02（マッピング）/ F-04（セレクター）/ F-05（RLS）
- Sprout v0.2 spec §13
- 既存の root cron 実装（feature/root-phase-a3-d-daily-workings）

---

## 15. 受入基準（Definition of Done）

- [ ] manual / scheduled / dryrun の 3 モードが動作確認済
- [ ] 6 法人の garden-dev 取込が成功（warning 含む）
- [ ] dryrun で差分プレビューが正確
- [ ] 削除検知（論理削除）が動作確認済
- [ ] import_runs テーブルに履歴が記録される
- [ ] Chatwork 通知が成功時・警告時・失敗時で出力される
- [ ] cron secret 認証が正しく動作
- [ ] 暗号化対象列が hint のみログ出力されることを確認
- [ ] レビュー（a-bloom）完了
