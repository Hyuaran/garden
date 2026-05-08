# Bloom Daily Report Post-MVP 拡張 spec

> **起草経緯:** dispatch main- No. 139 DD 案 GO（2026-05-08 15:00）。Daily Report MVP（5/7 commit `8b73a97`）の post-MVP 機能（メール配信 / Chatwork 通知 / 上長閲覧 / 過去日報編集 / 一般従業員向け）を 5/13 以降の段階実装計画として spec 化。
>
> **目的:** MVP 完成済の Daily Report に対して、5/13 以降に追加する機能群を整理し、各機能の依存・優先度・工数見積を確定。
>
> **スコープ:** spec のみ、実装着手は 5/13 以降（β投入 + 統合テスト後）。

---

## 1. MVP 完成状況（5/7 19:04 commit `8b73a97`）

| 項目 | 状態 |
|---|---|
| 入力フォーム（workstyle radio + log entries 動的）| ✅ 完成 |
| Supabase write（upsert + delete-and-insert 置換）| ✅ 完成 |
| 当日表示（自分の root_daily_reports + logs）| ✅ 完成 |
| dev mock fallback | ✅ 完成 |
| data validation | ✅ 完成 |
| Chrome MCP 視覚確認 | ✅ 完成 |

→ MVP は東海林さん 1 人の日報入力 + 表示が動作する状態。

---

## 2. Post-MVP 機能 4 件（5/13 以降）

### 2-1. メール配信（毎日定時、上長宛）

| 項目 | 内容 |
|---|---|
| **目的** | 東海林さん日報を上長（取締役 / 役員）にメール自動配信 |
| **トリガー** | Cron 21:00 JST 毎日（既存 `/api/bloom/cron/` 配信基盤流用）|
| **配信内容** | 当日 root_daily_reports + logs を HTML メール化（既存 progress-html template の縮小版）|
| **配信先** | 上長メールアドレス（root_employees.email or 別 admin 設定）|
| **依存** | 既存 cron 基盤（aggregator.ts）+ メール送信 API（要選定: Resend / SendGrid 等）|
| **工数** | 約 0.5d（cron 連携 0.2d + テンプレート 0.2d + 配信先設定 UI 0.1d）|

### 2-2. Chatwork 通知

| 項目 | 内容 |
|---|---|
| **目的** | 東海林さん日報を Garden Bot 経由で Chatwork に投稿 |
| **トリガー** | Cron 21:00 JST 毎日（メール配信と同時）|
| **配信内容** | 日報サマリ（workstyle + 主要 work / tomorrow 各 3 件、絵文字付き）|
| **配信先** | Chatwork 「経営状況」ルーム（既存通知 Bot 流用）|
| **依存** | memory `project_chatwork_bot_ownership.md` の Garden Bot |
| **工数** | 約 0.3d（既存 Chatwork API 呼び出しコード参照）|

### 2-3. 上長閲覧（一覧 + フィルタ）

| 項目 | 内容 |
|---|---|
| **目的** | 上長が部下の日報を一覧 + フィルタで閲覧 |
| **UI** | 新規ルート `/bloom/daily-report/admin`（admin / super_admin / manager 限定）|
| **機能** | 日付範囲フィルタ + 従業員フィルタ + module フィルタ + CSV エクスポート |
| **権限** | manager 以上のみ閲覧、admin / super_admin で全社員可、manager で部下のみ（Phase A-3 完了後）|
| **依存** | 一般従業員向け日報スキーマ（2-5）が完成後、または既存 root_daily_reports（1 人運用）で先行実装可 |
| **工数** | 約 1.0d（一覧 UI 0.5d + フィルタ 0.3d + CSV 0.2d）|

### 2-4. 過去日報の編集

| 項目 | 内容 |
|---|---|
| **目的** | 提出済日報の修正（typo / 誤分類 / 追記）|
| **UI** | 既存 `/bloom/daily-report?date=YYYY-MM-DD` で過去日付選択 → 編集モード |
| **機能** | 編集 → POST 上書き（既存 upsert + delete-and-insert ロジック流用）|
| **権限** | 自分の日報のみ編集可（admin は全員分可）|
| **編集履歴** | root_daily_report_logs のメタテーブル（root_daily_report_edits）追加検討 |
| **工数** | 約 0.3d（編集モード切替 0.1d + 履歴記録 0.2d）|

### 2-5. 一般従業員向け日報（新規スキーマ）

| 項目 | 内容 |
|---|---|
| **目的** | 全従業員（toss/closer/cs/staff/outsource）が自分の日報を提出 |
| **新規スキーマ** | `root_employees_daily_reports`（employee_id + date PK）+ `root_employees_daily_report_logs` |
| **UI 流用** | MVP の `/bloom/daily-report` を employee_id ベースに拡張 |
| **権限** | 自分の日報のみ書込、上長は閲覧（2-3 と連動）|
| **依存** | a-root-002 連携（テーブル設計 + RLS）|
| **工数** | 約 1.5d（スキーマ設計 0.3d + UI 拡張 0.5d + 権限テスト 0.4d + 統合テスト 0.3d）|

---

## 3. 優先度マトリクス

| # | 機能 | 価値 | 工数 | 依存 | 優先度 |
|---|---|---|---|---|---|
| 2-2 | Chatwork 通知 | 🟡 中（東海林さん 1 人 + 即時性高）| 0.3d | 低 | 🔴 最優先（5/13 以降即着手）|
| 2-1 | メール配信 | 🟡 中（経営者層リーチ）| 0.5d | 中 | 🟡 推奨 |
| 2-4 | 過去日報編集 | 🟢 低（東海林さん 1 人で頻度低）| 0.3d | 低 | 🟢 後回し可 |
| 2-3 | 上長閲覧 | 🔴 高（全社運用の前提）| 1.0d | 高（2-5 依存）| 🟡 2-5 後 |
| 2-5 | 一般従業員向け | 🔴 高（全社展開）| 1.5d | 中（a-root-002）| 🟡 段階展開 |

---

## 4. 段階的実装計画（5/13-5/27 想定）

| Phase | 機能 | 想定日 | 工数 |
|---|---|---|---|
| **Phase B-1** | Chatwork 通知（2-2）| 5/14（デモ後即）| 0.3d |
| **Phase B-2** | メール配信（2-1）| 5/15-16 | 0.5d |
| **Phase B-3** | 過去日報編集（2-4）| 5/17 | 0.3d |
| **Phase C-1** | 一般従業員向けスキーマ + UI（2-5 part 1）| 5/19-21 | 1.0d |
| **Phase C-2** | 一般従業員向け権限 + 統合テスト（2-5 part 2）| 5/22-23 | 0.5d |
| **Phase C-3** | 上長閲覧 UI（2-3）| 5/26-27 | 1.0d |
| **計** | | | **約 3.6d** |

---

## 5. 判断保留事項

| # | 論点 | 推奨 | 確定タイミング |
|---|---|---|---|
| 1 | メール送信プロバイダ選定 | Resend（無料枠 100/day、Vercel 統合）| 5/14 |
| 2 | Chatwork ルーム ID | 「経営状況」ルーム（既存 Bot ルーム）| 即決 |
| 3 | 一般従業員向けスキーマの employee_id PK 形式 | root_employees.employee_id（4 桁 + 数字）| 5/19 |
| 4 | 上長 → 部下 mapping | root_employees.manager_id（自己参照外部キー）| a-root-002 確定後 |
| 5 | 編集履歴の保管期間 | 永続スタート（memory `feedback_data_retention_default_pattern.md`）| 即決 |

---

## 6. 制約遵守

dispatch main- No. 139 §「制約遵守」整合:
- ✅ 動作変更なし（spec のみ、実装は 5/14 以降）
- ✅ 新規 npm install 禁止（5/13 デモ前は依存追加なし、Phase B-2 メール配信時に Resend SDK 追加検討は東海林さん承認後）
- ✅ Bloom 独自認証独立性維持
- ✅ 設計判断・仕様変更なし（既存 MVP 拡張範囲）
- ✅ main / develop 直 push なし

---

## 7. 関連 dispatch / commit / spec

- main- No. 91 N 案 GO（5/7）#7 Daily Report 本実装 GO
- main- No. 139 DD 案 GO（5/8）自走 spec 起草
- a-bloom-004 commit `8b73a97`（Daily Report MVP、API + UI + legacy）
- 既存基盤: `src/app/api/bloom/cron/_lib/aggregator.ts`（メール配信 cron 流用元）
- memory `project_chatwork_bot_ownership.md`（Garden Bot 管理）
- memory `feedback_data_retention_default_pattern.md`（永続スタート標準）

---

## 8. β投入 + 5/13 デモ前リスク

5/13 デモ時点で MVP のみ稼働 = 東海林さん 1 人の日報入力 + 表示。**post-MVP は全て 5/14 以降**で、5/13 デモには影響なし。MVP の動作品質を 5/13 で確認（FF spec の Daily Report 確認チェックリスト 4 件）。
