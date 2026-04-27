# Calendar C-06: 通知統合（リマインダー: Chatwork / メール / LINE）

- 対象: Calendar イベントのリマインダー通知（面接前日 + シフト前日 + 営業予定リマインド）
- 優先度: 🟡
- 見積: **2.00d**（0.25d 刻み）
- 担当セッション: a-calendar（実装）/ a-rill（Chatwork API）/ a-root（連絡先マスタ）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Calendar C-06）
- 前提:
  - **Sprout v0.2 spec §15**（Calendar 設計）
  - **Calendar C-01 / C-02 / C-03 / C-04**（同期と UI 完了）
  - **Rill 既存 Chatwork Bot**（Phase C 着手範囲、本 spec 連携時は a-rill 側仕様確認必要）
  - メール送信基盤（既存: Resend / SendGrid 想定、要確認）
  - LINE Messaging API は Phase 2 ロードマップ（v1 は scaffold のみ）

---

## 1. 目的とスコープ

### 1.1 目的
- Calendar イベントの**事前リマインダー通知**を Chatwork / メール / LINE 経由で配信する
- 面接前日 / シフト前日 / 営業予定リマインドの 3 シナリオを既定で対応
- ユーザーごとに通知時刻 / 媒体を設定できる
- 通知失敗時のリトライ + 監査ログ

### 1.2 含めるもの
- 通知設定 UI（ユーザー単位 / event_type 単位）
- リマインダー実行ジョブ（Vercel Cron）
- Chatwork / メール 配信の実装（v1 必須）
- LINE 配信の scaffold（v2 で実装）
- 通知履歴テーブル（audit）
- 配信失敗時の自動リトライ + 通知

### 1.3 含めないもの
- スマホプッシュ通知（C-05 と組み合わせて v2）
- 応募者向け通知（Sprout 側で管理、本 spec 対象外）
- カスタム通知文面エディタ（v1 はテンプレ固定）
- LINE の friend 認証フロー（v2）

---

## 2. 設計方針 / 前提

- **配信媒体優先**: Chatwork（社内既存）→ メール（補完）→ LINE（v2）
- **ジョブ駆動**: 5 分間隔の Vercel Cron で「これから 60 分以内 + 通知未送付」のイベントをスキャン
- **通知時刻の既定**:
  - 面接: 前日 18:00（担当者）+ 当日 9:00（担当者）
  - シフト: 前日 18:00（本人）
  - 営業予定: 開始 30 分前（担当者）
- **設定の階層**: グローバル既定 ← event_type 既定 ← ユーザー override
- **冪等性**: `calendar_notification_log` で送信済み判定、二重送信防止

---

## 3. テーブル定義（追加）

### 3.1 `calendar_notification_settings`

```sql
CREATE TABLE calendar_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN ('interview', 'shift', 'sales_meeting', 'personal', 'other', 'global')
  ),
  channel text NOT NULL CHECK (channel IN ('chatwork', 'email', 'line', 'none')),
  lead_minutes int NOT NULL,  -- 何分前に通知するか
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, event_type, channel)
);
```

### 3.2 `calendar_notification_log`

```sql
CREATE TABLE calendar_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL,
  sent_at timestamptz,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (event_id, user_id, channel, scheduled_for)
);

CREATE INDEX idx_notif_log_scheduled ON calendar_notification_log (scheduled_for, status);
```

---

## 4. ジョブ設計

### 4.1 Cron スケジュール

- `*/5 * * * *`（5 分毎）: 通知キュー処理
- `0 3 * * *`（毎日 03:00 JST）: 当日分の通知 schedule を事前キューイング

### 4.2 キューイングロジック（疑似）

```
for each calendar_event in (start_at >= today AND status='confirmed'):
  for each attendee_user in event:
    settings = resolve_settings(attendee_user, event.event_type)
    for setting in settings:
      scheduled_for = event.start_at - setting.lead_minutes
      INSERT INTO calendar_notification_log (
        event_id, user_id, channel, scheduled_for, status='queued'
      ) ON CONFLICT DO NOTHING
```

### 4.3 配信ロジック（5 分毎）

```
for log in (status='queued' AND scheduled_for <= now() + 5min):
  try:
    if channel='chatwork': call rill_chatwork_send(...)
    if channel='email': call resend_send(...)
    if channel='line': call line_messaging_push(...)  # v2 で scaffold のみ
    log.status = 'sent'
    log.sent_at = now()
  except err:
    log.retry_count += 1
    if retry_count > 3:
      log.status = 'failed'
      notify_admin(...)
```

---

## 5. メッセージテンプレート

### 5.1 面接前日（Chatwork）

```
[info]
[title]面接リマインド[/title]
明日 5/10(月) 13:00 から面接予定です。
応募者: 山田太郎
場所: 本社 3F 会議室A
[/info]
```

### 5.2 シフト前日

```
明日 5/10(月) のシフト
時間: 10:00 - 19:00
拠点: 大阪駅前ビル
休憩: 60 分
```

### 5.3 営業予定 30 分前

```
30分後に営業予定があります
A社 訪問
13:00 - 14:00
場所: 渋谷区...
```

---

## 6. 通知設定 UI（C-02 と統合）

### 6.1 個人設定画面 `/calendar/settings`

```
通知設定
├ グローバル既定
│   - チャネル: [Chatwork ▼]
│   - 既定リード: 30 分前
├ event_type 別
│   - 面接: Chatwork / 24h前 + 1h前 ✓
│   - シフト: Chatwork / 24h前 ✓
│   - 営業予定: Email / 30min前 ✓
│   - 個人: なし
```

### 6.2 アクセス権限

- 個人設定: 自分のみ編集可
- グローバル既定: admin のみ
- 他人の設定変更: 不可

---

## 7. 連絡先マスタ（Root 連携）

通知配信に必要な連絡先は Root の `employees` マスタから取得：

| 媒体 | 取得元 |
|---|---|
| chatwork | employees.chatwork_account_id |
| email | employees.email_work |
| line | employees.line_user_id（v2） |

連絡先未登録時は status='skipped'、ログに記録、admin に週次レポート。

---

## 8. 法令対応チェックリスト

- [ ] 個人情報保護法: 通知本文に第三者の個人情報を含めない（応募者氏名は通知 OFF を選択肢に）
- [ ] 個人情報保護法: 通知ログの保管期限 = 90 日（自動削除ジョブ要 / v1 は手動）
- [ ] 特定電子メール法: メール通知のフッターに送信元 / 配信停止リンク必須
- [ ] LINE 利用規約: 業務利用は法人アカウント必須、ユーザー同意フロー（v2）
- [ ] 労働基準法: シフト前日通知の業務時間外配信ルール（22:00 以降は翌朝 7:00 にズラす）

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | テーブル `calendar_notification_settings` / `_log` Migration | a-calendar | 0.25d |
| 2 | キューイング Cron（毎日 03:00） | a-calendar | 0.25d |
| 3 | 配信 Cron（5 分毎） + Chatwork 統合 | a-calendar + a-rill | 0.50d |
| 4 | メール配信統合（Resend / SendGrid） | a-calendar | 0.25d |
| 5 | LINE scaffold（v2 用 stub） | a-calendar | 0.25d |
| 6 | 通知設定 UI `/calendar/settings` | a-calendar | 0.25d |
| 7 | 連絡先マスタ参照（Root employees 連携） | a-calendar + a-root | 0.25d |

合計: 2.00d

---

## 10. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | LINE 配信の v1 実装スコープ | scaffold のみ。v2 で実装 |
| 2 | 通知失敗時の admin への通知方法 | Chatwork（既存運用ルームに集約）|
| 3 | 通知文面のカスタマイズ | v1 はテンプレ固定、v2 でユーザー編集可 |
| 4 | 当日朝の一括通知（複数イベントまとめ） | v1 は個別配信、v2 で集約モード |
| 5 | 営業予定通知の lead 時間既定 | 30 分前。要望に応じて 1h / 15min を追加 |
| 6 | 22:00 〜 翌 7:00 の配信抑制 | 既定で抑制（労働環境配慮）、緊急時は override |
| 7 | 応募者への面接リマインド | Sprout 側で実装、Calendar からは送らない |
| 8 | 通知履歴の閲覧 UI | v1 は admin のみ簡易ビュー、v2 で本格化 |

---

## 既知のリスクと対策

- **リスク 1**: Chatwork API レート制限 → バッチ 1 回 30 件まで、超過時 5 分後リトライ
- **リスク 2**: メール spam 判定 → Resend / SendGrid のドメイン認証 (SPF / DKIM / DMARC) 整備済か要確認
- **リスク 3**: 通知遅延（Cron ずれ） → スケジュール時刻 ± 10 分の許容、許容超は admin 通知
- **リスク 4**: 同時刻に多数のイベント → キュー処理を user 単位で集約、1 ユーザー 1 通知に圧縮（v2）
- **リスク 5**: テンプレ修正の管理 → templates/ ディレクトリで markdown 管理、変更時はレビュー必須
- **リスク 6**: 機微情報を Chatwork に流す事故 → 面接通知の応募者氏名はマスク選択肢を用意（個人設定）

---

## 関連ドキュメント

- `docs/specs/2026-04-26-calendar-C-01-migrations.md`
- `docs/specs/2026-04-26-calendar-C-02-business-schedule-ui.md`
- `docs/specs/2026-04-26-calendar-C-03-interview-slot-sync.md`
- `docs/specs/2026-04-26-calendar-C-04-tree-shift-integration.md`
- 既存: Rill Chatwork Bot 仕様（a-rill 担当）
- 既存: Root employees マスタ仕様（a-root 担当）

---

## 受入基準（Definition of Done）

- [ ] `calendar_notification_settings` / `calendar_notification_log` が garden-dev に適用済み
- [ ] 毎日 03:00 のキューイング Cron が動作し、当日分の通知レコードが queue される
- [ ] 5 分間隔の配信 Cron で Chatwork 通知が送信される
- [ ] 面接前日 18:00 に担当者へ Chatwork 通知が届く
- [ ] シフト前日 18:00 に本人へ Chatwork 通知が届く（22:00-7:00 抑制）
- [ ] 営業予定 30 分前にメール通知が届く
- [ ] `/calendar/settings` でユーザーが lead_minutes / channel を変更できる
- [ ] 同一 (event_id, user_id, channel, scheduled_for) で二重送信されない
- [ ] 配信失敗時に retry_count が増え、3 回失敗で status='failed' + admin 通知
- [ ] 連絡先未登録のユーザーは status='skipped' で記録される
- [ ] LINE は scaffold（API stub）のみ、enabled=false 既定
- [ ] レビュー（a-rill + a-bloom）承認 + α版で東海林さん受信確認

---

## 11. 将来拡張ポイント（2026-04-26 改訂）

> **改訂背景**: 給与明細配信 Y 案 + フォールバック確定（memory `project_payslip_distribution_design.md`）に伴い、Calendar 連携の将来拡張ポイントを明記。**Phase B 時点では実装不要**、設計の橋頭堡として残す。

### 11.1 給与配信日通知（Phase C 以降）

#### 概要

Bud D-04 給与明細配信日に Calendar イベントを自動生成、本人にリマインダー通知:

```
event_type: 'payroll_distribution'
title: '2026 年 4 月分 給与明細 配信'
start_at: 配信日（既定: 月末 25 日 09:00 JST）
end_at: 配信日 + 24h（PW 有効期限と同じ）
attendee_user_ids: [配信対象全員の user_id]
visibility: 'private'  -- 本人のみ閲覧
notes: 'メールに DL リンクをお送りしました。LINE 友だちの方は LINE Bot 通知も届きます。'
```

#### calendar_event_links での連動

```sql
-- Bud D-04 配信時に link 作成
INSERT INTO calendar_event_links (
  event_id, source, source_id
) VALUES (
  $calendar_event_id,
  'bud',
  $payslip_distribution_id  -- bud_payslip_distributions.id 等
);
```

#### 通知タイミング（既定案）

| タイミング | 対象 | チャネル | 内容 |
|---|---|---|---|
| 配信 1h 前 | 全員 | Chatwork | 「もうすぐ給与明細を配信します」 |
| 配信時刻 | 全員 | メール（既存）| 給与明細 DL リンク |
| 配信時刻 | LINE 友だち | LINE Bot（既存）| 通知メッセージ |
| 配信 + 24h（マスク）| 未確認者 | Chatwork | 「PW がマスクされます、まだ確認していない方は急いでください」 |

#### Phase B 時点では未実装

理由:
- Calendar / Bud / Sprout の 3 モジュール統合が必要
- まずは Phase B で Calendar / Sprout / Bud それぞれの基盤を揃える
- Phase C 統合フェーズで一括実装

### 11.2 LINE 通知連動の本実装（Phase B 後半）

C-06 §3 で `notification_channel` enum に 'line' は既出だが、実装は scaffold のみ。Phase B 後半で:

- Sprout S-05 §16 の `sendPayslipNotificationViaLine()` を Calendar 通知でも流用
- カレンダーイベントのリマインダーを LINE 友だちに送信可
- 設定 UI で「Chatwork / メール / LINE」を本人が選択

### 11.3 給与明細マスクリマインダー

Tree マイページ給与明細 PW 確認画面（`docs/specs/2026-04-26-tree-mypage-payslip-password.md`）と連動:

```typescript
// /api/cron/payslip-pw-mask-reminder (毎月末 17:00 JST)
// 当月分 PW を未確認の従業員に Chatwork DM
const unconfirmed = await fetchUnconfirmedPasswords();
for (const u of unconfirmed) {
  await sendChatworkDM(u.user_id,
    `2026 年 4 月分の給与明細 PW がまだ未確認です。
     社内 PC で Tree マイページからご確認ください。
     6 時間後（23:59）にマスクされます。`
  );
}
```

実装は Phase C 以降、本 spec の通知基盤を流用。

### 11.4 関連 spec

- `docs/specs/2026-04-26-tree-mypage-payslip-password.md`（フォールバック画面）
- `docs/specs/2026-04-26-sprout-S-05-line-bot.md` §16（Y 案 LINE 通知）
- Bud Phase D-04 spec（給与明細配信本体）
