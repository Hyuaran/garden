# Garden-Root × KING OF TIME（KoT）API 連携 要件書

- 作成: 2026-04-24（a-auto / Phase A 先行 batch1 #P12）
- 作業ブランチ: `feature/phase-a-prep-batch1-20260424-auto`
- 対象: Root モジュール（マスタ管理）の「KoT 連携画面」設計および段階実装ガイド
- 前提:
  - Garden リリース後も **KoT は解約せず契約継続**（親 CLAUDE.md §4 / Root CLAUDE.md）
  - KoT が**勤怠の正式記録保持**（給与計算・労基対応の正本）
  - Garden 側は KoT API 経由で同期（段階実装：CSV 手動 → API 自動の 3 段階）

---

## 1. ユースケース

| UC | 対象ユーザー | 利用画面 | KoT ↔ Root 向き |
|---|---|---|---|
| UC1 新入社員登録 | staff+（Tree 側 UI）| Tree「＋新しいアカウントを追加」 | KoT → Root（片方向） |
| UC2 マスタ再同期 | admin / super_admin | Root「KoT 連携」画面 | KoT → Root（片方向・強制） |
| UC3 勤怠データ取込 | admin / super_admin | Root「KoT 連携 → 勤怠」タブ | KoT → Root（月次 or 日次） |
| UC4 連携エラー確認 | admin / super_admin | Root「KoT 連携」画面のログセクション | Root → Admin（通知） |
| UC5 手動 CSV インポート | admin / super_admin | Root「KoT 連携」画面のアップロードUI | CSV → Root（Phase 1） |

---

## 2. 取込項目マッピング（KoT → Garden Root）

### 2.1 従業員基本情報（KoT → `root_employees`）

| Garden フィールド | 型 | KoT API のキー（予想）| 扱い |
|---|---|---|---|
| `employee_no` | text(4) | `employee_code` | PK（既存の 4 桁社員番号） |
| `name` | text | `name` | 氏名 |
| `hired_on` | date | `hired_on` | 入社日 |
| `retired_on` | date | `retired_on` | 退職日（nullable） |
| `company_id` | text | `company_code` | 法人コード → `root_companies.company_id` マップ |
| `employment_type` | text | `employment_type` | 正社員 / アルバイト / 業務委託 |
| `email` | text | `email` | KoT 登録メール（給与明細配信用） |
| `phone` | text | `phone` | 任意 |
| **`birthday`** | date | **取込しない** | **本人入力必須**（Tree 初回ログイン時）|
| **`garden_role`** | text | **取込しない** | Garden 内で super_admin が設定 |
| **住所・緊急連絡先** | — | **取込しない** | MF 電子契約が source of truth |
| **振込口座** | — | **取込しない** | MF 電子契約が source of truth |

### 2.2 勤怠データ（KoT → `root_attendance`）

| Garden フィールド | 型 | KoT API のキー（予想） |
|---|---|---|
| `employee_no` | text | `employee_code` |
| `work_date` | date | `target_date` |
| `clock_in_at` | timestamptz | `clock_in` |
| `clock_out_at` | timestamptz | `clock_out` |
| `break_minutes` | int | `break_minutes` |
| `overtime_minutes` | int | `overtime_minutes` |
| `leave_type` | text | `leave_type`（有休/特休/欠勤 等） |
| `source` | text | 固定値 `'kot-api'` |
| `imported_at` | timestamptz | 取込時刻 |

---

## 3. 取込頻度と方式

### 3.1 段階実装の 3 段階（CLAUDE.md §4 準拠）

| Phase | 時期 | 方式 | 頻度 |
|---|---|---|---|
| **Phase 1** | 現在〜Phase A-1 | **CSV 手動インポート** | 月次（15 日頃、経理と合わせて） |
| **Phase 2** | Phase A-2 以降 | API バッチ取込（Vercel Cron） | 日次（深夜 03:00 JST） |
| **Phase 3** | Phase D 後（Tree 全員投入後） | **リアルタイム同期**（Garden 打刻 → KoT API 書込）| 打刻ごとリアルタイム |

### 3.2 Phase 1（現状の代替運用）

- KoT 管理画面から CSV エクスポート
- Root「KoT 連携」画面のアップロード UI にドラッグ＆ドロップ
- Parse → プレビュー → 取込ボタンで `root_employees` / `root_attendance` へ upsert

### 3.3 Phase 2（API バッチ）

- Vercel Cron `0 18 * * *`（UTC）= 03:00 JST
- API エンドポイント: KoT API v3（要契約確認）
- 取得範囲: 前日 1 日分の勤怠 + 従業員マスタ差分
- 差分があれば `root_attendance` に INSERT、`root_employees` に UPSERT

### 3.4 Phase 3（リアルタイム）

- Tree 打刻 → Garden API → KoT API `POST /timecards` でリアルタイム書込
- KoT を正本としたまま、Garden は打刻 UI の役割
- KoT 側の集計（月次給与・労基帳票）が引き続き正本

---

## 4. 認証方式

### 4.1 KoT API 認証

- **認証方式**: API キー（KoT エンタープライズプランで発行可能と想定）
- **格納先**: Vercel 環境変数 `KOT_API_TOKEN`（Production / Preview 別）
- **ローカル開発**: `.env.local` に同名で記載、Git 除外
- **クライアント側からは絶対にアクセスさせない**: Server Action または Route Handler でのみ利用

### 4.2 環境変数一覧

```bash
# Vercel Project Settings > Environment Variables
KOT_API_BASE_URL=https://api.kingoftime.jp/v3    # 仮
KOT_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxx             # 契約時発行
KOT_COMPANY_CODE=hyuaran                          # 自社の KoT 顧客コード
```

### 4.3 Supabase Edge Function 経由案（Phase 2 以降の検討）

- Vercel から直接 KoT API を叩く代わりに、Supabase Edge Function を経由する案
- メリット: Supabase RLS と統合、Vercel の Cron 枠節約
- デメリット: Edge Function のメモリ制限（256MB）、Deno ランタイム特有の制約
- **判断保留**: Phase 2 着手時に再検討

---

## 5. エラーハンドリング

### 5.1 想定エラーと対応

| # | エラー | 発生原因 | 対応 |
|---|---|---|---|
| E1 | HTTP 401 Unauthorized | API トークン期限切れ / revoke | Chatwork 管理者アラート、Phase 1 フォールバック |
| E2 | HTTP 429 Too Many Requests | レート制限超過 | 指数バックオフ（1m → 5m → 15m）で再試行 |
| E3 | HTTP 5xx KoT 側障害 | KoT のメンテナンス等 | 翌日リトライ、連続 3 日で Chatwork 警告 |
| E4 | レスポンス形式変更 | KoT API バージョンアップ | 契約テスト（JSON schema 検証）で検出、CSV 手動フォールバック |
| E5 | `employee_code` 不一致 | KoT にいるが Root にない | Tree「＋新しいアカウント追加」候補にリストアップ |
| E6 | `company_code` マッピング失敗 | 新法人が KoT 側だけで追加された | 管理者アラート、手動補正 |
| E7 | 同一日重複データ | KoT → Root の再取込 | UPSERT で冪等、`imported_at` 更新 |
| E8 | 勤怠時刻フォーマット異常 | 夜勤跨ぎ / 翌日打刻 | 明示的に `is_overnight` フラグで識別 |

### 5.2 通知・ロギング

- **成功時**: `root_kot_sync_log` テーブルに行追加（レベル INFO）
- **警告時**: Chatwork `Garden 運用` ルームへ投稿（レベル WARN）
- **致命時**: Chatwork + 東海林さん DM（レベル ERROR）

### 5.3 ログテーブル案

```sql
CREATE TABLE root_kot_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_kind       text CHECK (sync_kind IN ('employees','attendance','both')),
  method          text CHECK (method IN ('csv_manual','api_batch','api_realtime')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text CHECK (status IN ('running','success','partial','failed')),
  imported_rows   int,
  skipped_rows    int,
  error_rows      int,
  error_summary   text,
  created_by      uuid REFERENCES auth.users(id)
);
```

---

## 6. 段階実装案（詳細）

### 6.1 Phase 1（CSV 手動、M1 前半）

**スコープ**:
1. Root に「KoT 連携」画面（`/root/kot`）を追加
2. CSV アップロード（従業員マスタ 1 枚、勤怠 1 枚）
3. プレビュー表示（差分ハイライト）
4. 取込ボタンで `root_employees` / `root_attendance` UPSERT
5. 取込ログを `root_kot_sync_log` に記録

**工数見積**: 1.0d
**担当セッション**: a-root

### 6.2 Phase 2（API バッチ、M2 前半）

**スコープ**:
1. `src/lib/kot/client.ts` で KoT API クライアント実装
2. `/api/root/kot/sync/route.ts` Vercel Cron エンドポイント
3. 従業員マスタ差分取込 + 前日勤怠取込
4. 異常時の Chatwork 通知
5. 契約テスト（JSON schema 検証）

**工数見積**: 1.5d
**担当セッション**: a-root（Phase 1 の拡張として）

### 6.3 Phase 3（リアルタイム、Phase D 以降）

**スコープ**:
1. Tree 打刻 → Garden `/api/tree/clock`
2. Garden → KoT API `POST /timecards` リアルタイム書込
3. 失敗時のキューイング + リトライ（最大 24h）
4. KoT 正本 + Garden 補助の二重管理

**工数見積**: 2.0d
**担当セッション**: a-tree 主導、a-root サポート

---

## 7. データ整合性保証

### 7.1 冪等性
- 取込はすべて UPSERT（PK: employee_no または (employee_no, work_date)）
- 再取込で差分のみ反映、タイムスタンプ `imported_at` 更新

### 7.2 整合性チェック
- 月次レビュー時に KoT 側と Root 側の件数比較（`COUNT(*)` 突合）
- 差異があれば Chatwork 通知

### 7.3 リカバリ
- Phase 1 の手動 CSV をいつでも叩き直せる運用を維持（Phase 2/3 稼働中も）
- API 障害時のフォールバックとして CSV 運用は常備

---

## 8. 権限設計

| 画面 / 操作 | ロール |
|---|---|
| `/root/kot` 閲覧 | admin / super_admin |
| CSV アップロード | admin / super_admin |
| Cron 手動トリガ | super_admin のみ |
| ログ閲覧 | admin / super_admin |
| API トークン編集 | super_admin のみ（環境変数直接のため GUI なし） |

RLS ポリシー（`root_kot_sync_log`）:
```sql
ALTER TABLE root_kot_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY rksl_read  ON root_kot_sync_log FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
    IN ('admin','super_admin')
  );
CREATE POLICY rksl_write ON root_kot_sync_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);  -- サーバサイド経由のみ
```

---

## 9. 画面構成（/root/kot）

```
/root/kot（admin+）
  ├── ヘッダー：最終同期日時・成功/失敗件数サマリ
  ├── タブ１：従業員マスタ
  │    ├── CSV アップロード（ドロップゾーン）
  │    ├── プレビュー（新規/更新/退職の差分ハイライト）
  │    └── 取込ボタン（upsert 実行）
  ├── タブ２：勤怠データ
  │    ├── 対象月セレクタ
  │    ├── CSV アップロード
  │    ├── プレビュー
  │    └── 取込ボタン
  ├── タブ３：API 連携（Phase 2 以降）
  │    ├── 今日の実行状況
  │    ├── 手動トリガボタン（super_admin）
  │    └── 次回自動実行時刻
  └── タブ４：連携ログ
       └── `root_kot_sync_log` をテーブル表示（降順、50 件 / ページ）
```

---

## 10. MF 電子契約連携との関係

| 項目 | 正 | 取込先 |
|---|---|---|
| 社員番号・氏名・入社日・雇用形態・法人 | KoT | Root（本ドキュメントで整理） |
| 住所・緊急連絡先 | MF 電子契約 | Root 非取込（締結済 PDF 手動運用） |
| 振込口座 | MF 電子契約 | Root 非取込（同上） |
| 誕生日 | 本人申告 | Tree 初回ログイン時に `root_employees.birthday` へ直接保存 |
| garden_role | Garden 内部 | Root 内部（super_admin が UI で設定） |

KoT と MF は**source of truth が明確に分離**されているため、どちらから来たかでマージする必要はない。

---

## 11. 実装順序（a-root への引き渡し）

| # | タスク | 工数 | 依存 | 対応 Phase |
|---|---|---|---|---|
| R1 | `root_kot_sync_log` テーブル + RLS | 0.25d | — | P1 |
| R2 | `/root/kot` 画面スケルトン（タブ構造）| 0.25d | R1 | P1 |
| R3 | CSV アップロード + プレビュー（従業員 + 勤怠）| 1.0d | R2 | P1 |
| R4 | 取込バッチ関数（upsert）| 0.5d | R3 | P1 |
| R5 | `src/lib/kot/client.ts` 実装 | 1.0d | — | P2 |
| R6 | `/api/root/kot/sync/route.ts` + Vercel Cron | 0.5d | R5 | P2 |
| R7 | Chatwork 通知連携 | 0.25d | R1, R6 | P2 |
| R8 | 契約テスト（JSON schema）| 0.25d | R5 | P2 |
| R9 | Tree リアルタイム同期（Phase D 合流）| 2.0d | R5 | P3 |

**Phase 1+2 合計**: 約 **4.0d**（移植計画 P12 の「2.0d」より詳細分解、実装本体含む）

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | KoT API v3 の正式仕様確定 | Phase 2 着手前に KoT 事業者に照会（CS 窓口） |
| 判2 | Vercel Cron vs Supabase Edge Function | Phase 2 実装時に一次判断。初期は Vercel Cron |
| 判3 | Phase 1（CSV 手動）を Phase A-1 で完走させるか | **完走推奨**（Bud 給与計算の前提となるため） |
| 判4 | `root_attendance` の粒度（日次 1 行 or 打刻単位複数行） | **日次 1 行**（給与計算の前提、残業時間は集計済） |
| 判5 | KoT エクスポート CSV のフォーマット | KoT 管理画面の「汎用エクスポート」仕様に合わせる（要実機確認） |

---

## 13. 参考

- 親 CLAUDE.md §4（認証ポリシー、KoT 契約継続方針、新入社員登録フロー）
- Root CLAUDE.md（7 マスタ定義、KoT 連携の段階実装方針）
- Root マスタ定義書 v2（`Garden-Root_マスタ定義書_GardenBud用_20260416_v2.md`）
- 関連メモリ: `project_garden_account_flow` / `project_garden_mf_integration`

— end of kot integration requirements v1 —
