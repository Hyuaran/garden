# Calendar C-03: 面接スロット連携（Sprout sprout_interview_slots ↔ calendar_events）

- 対象: Sprout 面接予約と Calendar の双方向同期（event_type='interview' リンク）
- 優先度: 🔴
- 見積: **2.00d**（0.25d 刻み）
- 担当セッション: a-calendar（実装）/ a-sprout（連携元仕様）/ a-rill（通知）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Calendar C-03）
- 前提:
  - **Sprout v0.2 spec §15**（Calendar 設計）+ §11（面接予約）
  - **Calendar C-01**（Migration 完了）
  - **Calendar C-02**（UI 完成、interview 表示色対応）
  - Sprout 側 `sprout_interview_slots` テーブル既出（Sprout S-XX 系で実装中）

---

## 1. 目的とスコープ

### 1.1 目的
- Sprout が管理する面接スロット（`sprout_interview_slots`）と Garden カレンダーを**双方向同期**する
- 採用担当（manager+）が Calendar 側で面接の時刻調整・キャンセルしても Sprout に反映
- Sprout 側で応募者がセルフ予約しても Calendar に即時表示
- event_type='interview' で Calendar に登録、`calendar_event_links` で source='sprout' リンクを保持

### 1.2 含めるもの
- Sprout → Calendar 自動登録（slot 確定時 / 応募者予約時）
- Calendar → Sprout 反映（時刻変更 / キャンセル）
- 同期ジョブ（リアルタイム + バッチ補正）
- 競合時のルール（Sprout 優先）
- 同期失敗時のリトライ + 通知

### 1.3 含めないもの
- 応募者向け面接予約 UI（Sprout 本体で実装）
- 面接結果の登録（Sprout の合否管理）
- 面接官マッチング（Sprout の別 spec）
- 面接スロットの新規作成 UI（Calendar からは NG、Sprout 側 UI のみ）

---

## 2. 設計方針 / 前提

- **同期方向**: 双方向（bidirectional）
- **マスター**: 原則 Sprout 側（応募者管理・選考プロセスを Sprout で完結させるため）
  - 例外: 時刻変更のみ Calendar 側からも可（裏で Sprout の `sprout_interview_slots.scheduled_at` を更新）
- **トリガー**: Postgres トリガー + Edge Function（Supabase）併用
  - Sprout INSERT/UPDATE → Postgres トリガー → calendar_events 反映
  - Calendar UPDATE → API レイヤで sprout 側に逆反映
- **Idempotency**: `calendar_event_links.source_id = sprout_interview_slots.id` を一意キーとして同期
- **削除**: Sprout 側で slot をキャンセル → calendar_events.status = 'cancelled'（物理削除しない）

---

## 3. 同期フロー

### 3.1 Sprout → Calendar（順方向）

```
sprout_interview_slots INSERT (scheduled_at, applicant_id, interviewer_user_ids)
  ↓ (Postgres TRIGGER trg_sprout_slot_to_calendar)
calendar_events INSERT (
  event_type = 'interview',
  title = '面接: {応募者氏名}',
  start_at = scheduled_at,
  end_at = scheduled_at + duration,
  owner_user_id = primary interviewer,
  attendee_user_ids = interviewer_user_ids,
  metadata = { applicant_id, sprout_slot_id, application_id },
  status = 'confirmed'
)
  ↓
calendar_event_links INSERT (
  event_id = ↑の event.id,
  source = 'sprout',
  source_table = 'sprout_interview_slots',
  source_id = sprout_interview_slots.id,
  link_direction = 'bidirectional'
)
```

### 3.2 Sprout → Calendar（変更系）

| Sprout 側変更 | Calendar 側反映 |
|---|---|
| `scheduled_at` UPDATE | `calendar_events.start_at` / `end_at` 更新 |
| `status = 'cancelled'` | `calendar_events.status = 'cancelled'` |
| `interviewer_user_ids` 変更 | `calendar_events.attendee_user_ids` 同期 |
| 応募者氏名変更 | `calendar_events.title` 再生成 |

### 3.3 Calendar → Sprout（逆方向）

```
ユーザーが /calendar で interview event をドラッグして時刻変更
  ↓
PATCH /api/calendar/events/:id { start_at, end_at }
  ↓ サーバ側で source 確認
  if event の links に source='sprout' があれば
    UPDATE sprout_interview_slots
    SET scheduled_at = new start_at,
        updated_by = auth.uid()
    WHERE id = source_id
  ↓
calendar_event_links.last_synced_at = now()
```

### 3.4 Calendar → Sprout（キャンセル）

- Calendar UI で「面接キャンセル」ボタン → Sprout 側の `sprout_interview_slots.status = 'cancelled'` を更新
- 応募者への通知は Sprout 側で発火（C-06 の通知統合とは別経路、応募者は社外）

---

## 4. 競合解決ルール

| ケース | 対応 |
|---|---|
| 同時に Sprout と Calendar で時刻変更 | 後勝ち（updated_at で判定）。失敗側に toast 警告 |
| Sprout で削除 + Calendar で更新 | Sprout 削除を優先、Calendar 側を cancelled に |
| 同期失敗（Sprout 側エラー） | `calendar_event_links.sync_status = 'failed'` + Slack 通知 + リトライキュー |
| 既存 link がない孤児 | `sync_status = 'detached'` で UI に警告バッジ |

---

## 5. 同期ジョブ（バッチ補正）

毎日 03:00 JST 実行（Vercel Cron）:

1. `sprout_interview_slots` で過去 7 日 / 未来 30 日の slot を全件取得
2. `calendar_event_links` で source='sprout' かつ source_id 一致を引き当て
3. 不一致を検出（時刻ずれ・status ずれ）→ Sprout 側を正として補正
4. 孤児 calendar_events.event_type='interview' を検出 → manager+ に通知

---

## 6. UI 仕様（Calendar 側）

- 面接イベントは緑色（C-02 の既定）
- イベント詳細ポップオーバーに「Sprout で開く」リンク（応募者管理画面へ）
- 時刻変更時は「Sprout に反映されます」確認ダイアログ
- キャンセルは 2 段階確認（応募者影響あり警告）

---

## 7. API 仕様（C-03 用）

```
POST /api/calendar/sync/sprout-slot
  Body: { sprout_slot_id }
  → 200 { event_id, link_id }

POST /api/calendar/sync/sprout-slot/:id/refresh
  → 200 { synced: true }

GET /api/calendar/sync/diagnostics
  → 200 { detached_count, failed_count, last_batch_at }
```

---

## 8. 法令対応チェックリスト

- [ ] 個人情報保護法: 応募者氏名を calendar_events.title に直接記載するため、visibility='restricted' を既定に
- [ ] 個人情報保護法: 応募者 metadata は manager+ のみ閲覧可（RLS で制御）
- [ ] 雇用機会均等法: 面接記録の改竄防止（updated_by 必須、物理削除禁止）
- [ ] GDPR 様要件: 不採用後 90 日で匿名化（Sprout 側で対応、Calendar も同期で連動）

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | Sprout `sprout_interview_slots` 仕様確定（a-sprout と摺合せ） | a-calendar + a-sprout | 0.25d |
| 2 | Postgres トリガー `trg_sprout_slot_to_calendar` | a-calendar | 0.50d |
| 3 | Calendar → Sprout 逆同期 API | a-calendar | 0.25d |
| 4 | 競合解決ロジック + テスト | a-calendar | 0.25d |
| 5 | バッチ補正ジョブ（Vercel Cron） | a-calendar | 0.25d |
| 6 | UI 連携（イベントポップオーバーに Sprout リンク） | a-calendar | 0.25d |
| 7 | E2E テスト（Sprout で予約 → Calendar 反映） | a-calendar + a-sprout | 0.25d |

合計: 2.00d

---

## 10. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | 面接スロット作成を Calendar からも可能にするか | 不可（Sprout 側 UI のみ）。応募者管理のフロー一貫性優先 |
| 2 | 面接時間の既定 duration | 60 分。Sprout 側に `interview_duration_minutes` を持たせて Calendar に渡す |
| 3 | 同時 Push 競合の解決方針 | 後勝ち（updated_at）。3 ヶ月運用後に再評価 |
| 4 | Slack 通知（同期失敗）の宛先 | a-sprout 担当者 + 槙。Chatwork に統一するか要確認 |
| 5 | 応募者向け Calendar 表示 | 提供しない（応募者は Garden 利用者ではない） |
| 6 | 面接タイトルの応募者氏名フォーマット | 「面接: 山田太郎（応募職種）」案を初期値、UX で調整 |

---

## 既知のリスクと対策

- **リスク 1**: Sprout のテーブル構造変更時に Calendar 側が壊れる → スキーマ契約を `docs/contracts/sprout-calendar-v1.md` に明記、変更時は事前合意
- **リスク 2**: 双方向同期の無限ループ → updated_by が同期ジョブの service_role の場合は再発火しないガード
- **リスク 3**: 大量応募シーズンの同期遅延 → Edge Function に non-blocking キューイング、ピーク時のスループット計測
- **リスク 4**: 面接官の予定重複 → Calendar 側の attendee_user_ids[] で時間重複検知、UI で警告（v2 で予防的ブロック）
- **リスク 5**: 応募者氏名の個人情報露出 → visibility='restricted' を既定、staff には title をマスク表示する代替案

---

## 関連ドキュメント

- `docs/specs/2026-04-26-calendar-C-01-migrations.md`
- `docs/specs/2026-04-26-calendar-C-02-business-schedule-ui.md`
- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md` §11 / §15
- 想定: `docs/contracts/sprout-calendar-v1.md`（C-03 着手時に作成）

---

## 受入基準（Definition of Done）

- [ ] Sprout で面接スロット INSERT すると Calendar に event_type='interview' が自動生成される
- [ ] `calendar_event_links` に source='sprout' のリンクが作成される
- [ ] Sprout 側で scheduled_at を変更すると Calendar の start_at / end_at が更新される
- [ ] Calendar 側で interview をドラッグして時刻変更すると sprout_interview_slots.scheduled_at が更新される
- [ ] Sprout で slot を cancelled にすると Calendar 側も cancelled になる
- [ ] 同期失敗時に sync_status='failed' が記録され、Slack/Chatwork に通知される
- [ ] バッチ補正ジョブが日次で実行され、孤児イベントが検出される
- [ ] 面接イベントは visibility='restricted' で staff から見えない
- [ ] manager 以上では氏名込みで表示される
- [ ] Calendar 詳細ポップオーバーから「Sprout で開く」リンクで応募者ページに遷移できる
- [ ] レビュー（a-sprout + a-bloom）承認 + α版で東海林さん運用確認
