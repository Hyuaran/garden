# Sprout S-02: バイトル → Sprout データ取込

- 対象: バイトル（Baitoru）求人プラットフォームから応募者データを Sprout に取込む経路設計
- 優先度: 🔴
- 見積: **1.25d**（0.25d 刻み）
- 担当セッション: a-sprout / a-rill（外部 API 連携）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Sprout S-02）
- 前提:
  - **Sprout v0.2 spec**（PR #76 merge 済）
  - 関連 spec: S-01（migrations: sprout_applicants）、S-05（LINE Bot で初回応答）
  - **API 利用可否は要確認**: バイトル公式 API は 2026-04 時点で限定提供。一次手段として API、フォールバックとして CSV 手動取込を併記する。

---

## 1. 目的とスコープ

### 1.1 目的

バイトル経由の応募者を Sprout `sprout_applicants` に最短経路で取込み、応募 → 面接予約案内までの自動化リードタイムを 24 時間以内に短縮する。

### 1.2 含めるもの

- バイトル API 経由取込フロー（API 利用可と判明した場合の標準ルート）
- CSV 手動取込フロー（API 不可・取得遅延時のフォールバック）
- 取込時の重複検出・正規化ルール
- 取込後の自動アクション（LINE 友だち登録案内 SMS / メール送信）
- 取込ログ・エラー処理

### 1.3 含めないもの

- バイトル管理画面操作の自動化（RPA は別 spec）
- Indeed / リクナビ等の他媒体（同様の枠組みは流用可、対象外）
- LINE Bot のシナリオ詳細（S-05）
- 応募者向け面接予約 UI（S-03）

---

## 2. 設計方針 / 前提

- **二段構え**: API 経路を優先、API 未提供時は CSV 取込
- **冪等性**: source_external_id（バイトル応募 ID）でユニーク制約 → 重複 INSERT を排除
- **正規化**: 電話番号は E.164、生年月日は ISO 8601、氏名は前後空白除去・全角統一
- **取込元の明示**: `source='baitoru'`, `source_external_id` 必須
- **PII 取扱い**: 取込直後から RLS 適用、暗号化対象列は S-01 準拠

---

## 3. API 経路（標準ルート）

### 3.1 認証

- バイトル提供の OAuth2 client_credentials を使用想定（要確認）
- アクセストークンは Supabase Vault に保管、Edge Function 起動時に取得

### 3.2 取得エンドポイント（仮）

```
GET https://api.baitoru.com/v1/applications?since={ISO8601}&legal_entity={code}
```

レスポンス（仮スキーマ）：

```json
{
  "applications": [
    {
      "application_id": "BTR-2026-0001",
      "applied_at": "2026-04-25T10:00:00+09:00",
      "applicant": {
        "family_name": "山田",
        "given_name": "太郎",
        "family_name_kana": "ヤマダ",
        "given_name_kana": "タロウ",
        "birthday": "2000-04-01",
        "gender": "male",
        "phone": "090-1234-5678",
        "email": "yamada@example.com",
        "address": "東京都新宿区..."
      },
      "job": {
        "code": "JOB-001",
        "title": "コールセンタースタッフ",
        "legal_entity_code": "HYU01"
      }
    }
  ],
  "next_cursor": "..."
}
```

### 3.3 取込フロー

1. Cron（毎時 0 分）で Edge Function `sprout-baitoru-pull` 起動
2. 前回取込時刻 since を `system_settings` から取得
3. API 呼出 → applications 配列を取得
4. 各 application を以下の順で処理：
   - phone を E.164 正規化（`+8190...`）
   - 既存 applicant を `(legal_entity_id, source='baitoru', source_external_id)` で検索
   - ヒット → SKIP（更新は別バッチで対応）
   - 未ヒット → INSERT
   - INSERT 成功 → `sprout_baitoru_import_log` に成功記録
5. since を最終取込時刻に更新

### 3.4 エラーハンドリング

- API 5xx: 3 回リトライ → 失敗時は Chatwork 通知
- 必須項目欠損: ログに `validation_error` で記録し SKIP
- 重複: ログに `duplicate` で記録し SKIP

---

## 4. CSV フォールバック経路

### 4.1 想定運用

- バイトル管理画面から週次 / 日次 CSV を手動 DL
- admin が Sprout 管理画面の「CSV 取込」から UPLOAD
- Edge Function `sprout-baitoru-csv-import` が処理

### 4.2 CSV フォーマット定義

| 列 | 物理名 | 必須 | 形式例 |
|---|---|---|---|
| A | application_id | ◯ | BTR-2026-0001 |
| B | applied_at | ◯ | 2026-04-25 10:00 |
| C | family_name | ◯ | 山田 |
| D | given_name | ◯ | 太郎 |
| E | family_name_kana |   | ヤマダ |
| F | given_name_kana |   | タロウ |
| G | birthday |   | 2000-04-01 |
| H | gender |   | male/female/other |
| I | phone | ◯ | 090-1234-5678 |
| J | email |   | yamada@example.com |
| K | address |   | 東京都新宿区... |
| L | desired_position |   | コールセンター |
| M | desired_start_date |   | 2026-05-01 |
| N | legal_entity_code | ◯ | HYU01 |

文字コード: UTF-8 BOM 付き（バイトル既定に合わせる）。

### 4.3 取込フロー

1. CSV を Storage bucket `sprout-imports` にアップロード
2. Edge Function 起動：行ごとに API 経路と同じバリデータで処理
3. 結果サマリ（件数 / 成功 / 重複 / エラー）を画面表示
4. エラー行のみ別 CSV としてダウンロード可能

### 4.4 重複検出ロジック

優先順：

1. `(legal_entity_id, source='baitoru', source_external_id)` ユニーク
2. `(legal_entity_id, phone)` 直近 30 日以内に重複あれば warning（手動判定）
3. `(legal_entity_id, email)` 直近 30 日以内に重複あれば warning

---

## 5. 取込後の自動アクション

### 5.1 LINE 友だち登録案内

- INSERT 成功時、phone があれば SMS（Twilio 想定）or メール送信
- メッセージ例：

  > 山田太郎様、ご応募ありがとうございます。下記 LINE を友だち追加し、面接予約をお進めください。
  > https://line.me/R/ti/p/...

- ヒュアラン_info の友だち追加後、応募者コードと紐付け（S-05 シナリオで実施）

### 5.2 面接予約 URL 生成

- applicant_code をクエリパラメータに含む短縮 URL を生成
- 期限 14 日

---

## 6. 取込ログテーブル

```sql
CREATE TABLE sprout_baitoru_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_type TEXT NOT NULL CHECK (source_type IN ('api','csv')),
  external_id TEXT,
  result TEXT NOT NULL CHECK (result IN ('inserted','duplicate','validation_error','api_error')),
  error_message TEXT,
  raw_payload JSONB,
  applicant_id UUID REFERENCES sprout_applicants(id)
);
CREATE INDEX idx_baitoru_log_imported_at ON sprout_baitoru_import_log(imported_at DESC);
CREATE INDEX idx_baitoru_log_result ON sprout_baitoru_import_log(result);
```

---

## 7. 法令対応チェックリスト

- [ ] **個人情報保護法 第17条**: 取得時の利用目的明示（バイトル応募フォームに記載されていることを確認）
- [ ] **個人情報保護法 第20条**: 安全管理措置（取込経路 TLS、ログ raw_payload は 30 日で削除）
- [ ] **個人情報保護法 第27条**: 第三者提供制限（バイトル → Sprout は本人同意済の前提で取り込む）
- [ ] **特商法**: 当面該当なし（応募者は消費者ではなく労働者）
- [ ] **労働基準法 第15条**: 労働条件明示は内定時（S-07）に対応、本 spec では応募データ取込のみ

---

## 8. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | バイトル API 仕様確認・トークン取得 | a-sprout / 東海林さん | 0.25d |
| 2 | Edge Function `sprout-baitoru-pull` 実装 | a-sprout | 0.25d |
| 3 | CSV 取込 Edge Function 実装 | a-sprout | 0.25d |
| 4 | 取込ログテーブル + RLS | a-sprout | 0.25d |
| 5 | SMS / メール送信連携（Twilio or SendGrid） | a-sprout / a-rill | 0.25d |

---

## 9. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | バイトル API 提供有無の確定 | 東海林さん経由でバイトル営業に確認、判明まで CSV 経路を主軸に開発 |
| 2 | SMS 送信媒体（Twilio / NTT Communications / SoraCom） | コスト比較未実施、判断保留 |
| 3 | 取込頻度（毎時 / 毎日） | 毎時案を提案、API レート制限により調整 |
| 4 | 取込時の自動アサイン（拠点別担当者） | 当面手動、将来拡張 |
| 5 | 重複時の手動マージ UI 必要性 | β版以降に検討、α版では warning 表示のみ |
| 6 | CSV ファイルの保存期間 | 30 日案を提案 |
| 7 | バイトル以外（Indeed 等）の同枠組み拡張時期 | Phase B 以降 |

---

## 10. 既知のリスクと対策

- **リスク**: API 仕様変更
  - **対策**: 仕様変更時のアラート（取込件数 0 が 24h 続いたら通知）
- **リスク**: 手動 CSV の文字コード差異
  - **対策**: BOM 検出 + Shift_JIS フォールバック
- **リスク**: 個人情報の意図しない第三者送信
  - **対策**: SMS 送信前に admin 承認を求める運用も選択肢として検討

---

## 11. 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md`
- `docs/specs/2026-04-26-sprout-S-01-migrations.md`
- `docs/specs/2026-04-26-sprout-S-05-line-bot.md`

---

## 12. 受入基準（Definition of Done）

- [ ] CSV 経路で 100 件投入時、エラーログが正しく出力される
- [ ] 重複 application_id は SKIP され、ログに `duplicate` が記録される
- [ ] phone/email の正規化が正しく動作する
- [ ] 取込成功時に SMS or メール送信ジョブが enqueue される
- [ ] API 経路は仕様判明後に追加 PR で対応（暫定 stub で OK）
- [ ] 法令対応チェックリスト 5 項目レビュー済
