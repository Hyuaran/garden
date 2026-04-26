# Sprout S-03: 面接予約 UI（応募者向け、ログイン不要）

- 対象: 応募者がログイン不要で面接スロットを予約できる UI（ホットペッパー方式）
- 優先度: 🔴
- 見積: **1.25d**（0.25d 刻み）
- 担当セッション: a-sprout / a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Sprout S-03）
- 前提:
  - **Sprout v0.2 spec**（PR #76 merge 済）
  - 関連 spec: S-01（migrations: sprout_interview_slots / reservations）、S-02（取込時に予約 URL 発行）、S-04（予約後にヒアリングシート）、S-05（LINE 通知）
  - Calendar `calendar_events` 双方向同期（S-01 で実装済）

---

## 1. 目的とスコープ

### 1.1 目的

応募者が手間なく面接日時を予約できる UI を提供し、電話折返しの手間を削減する。ホットペッパービューティーの予約 UX を参考に、空きスロット表示 → 選択 → 仮予約 → 本人確認 → 確定の流れを実現する。

### 1.2 含めるもの

- 公開ページ（`/sprout/reserve/:applicant_token`）
- 月次/週次/日次ビュー切替
- 空きスロット表示（残数表示なし、空き有無のみ）
- 仮予約 → 本人確認（電話番号下 4 桁 or 生年月日）→ 確定
- キャンセル UI
- 予約完了時の LINE/SMS 通知連携呼出
- リマインダー（前日 18:00、当日 1 時間前）

### 1.3 含めないもの

- 応募者の本格的なログイン機構（不要）
- 面接実施記録（S-04）
- ZOOM URL 自動発行（β版以降）
- スタッフ側の枠管理 UI（管理画面側、別 spec）

---

## 2. 設計方針 / 前提

- **ログイン不要**: 応募者は `applicant_token`（UUID 形式、有効期限 14 日）でアクセス
- **再予約抑止**: 1 applicant につき同時に「未消化の予約」は 1 件まで
- **空き表示**: 残数は表示しない（◯/△/× の 3 段階のみ）
- **モバイル最適**: Tailwind + Next.js App Router、PC でも動作
- **アクセシビリティ**: WAI-ARIA 準拠、キーボード操作可
- **タイムゾーン**: Asia/Tokyo 固定

---

## 3. URL / ルーティング

| パス | 用途 |
|---|---|
| `/sprout/reserve/[token]` | 予約トップ（カレンダー表示） |
| `/sprout/reserve/[token]/confirm` | 確認画面 |
| `/sprout/reserve/[token]/done` | 完了画面 |
| `/sprout/reserve/[token]/cancel` | キャンセル画面 |

トークンは `sprout_applicants.applicant_code` を SHA-256 + ソルトでハッシュ化したもの。Edge Function 経由で applicant_id を解決。

---

## 4. 画面仕様

### 4.1 トップ画面

- ヘッダ: 法人ロゴ（fruit_companies_legal から取得）+ 「面接日時を選んでください」
- カレンダー: 月次（デフォルト）/ 週次 / 日次切替
- 各日付セル: 空き有無を ◯/△/× で表示（◯=3 件以上空き、△=1〜2 件、×=満枠）
- 日付タップで時間帯一覧（30 分刻み or スロット定義通り）
- 時間帯タップで詳細モーダル（場所、所要時間、面接官の所属拠点）
- 「予約する」ボタン

### 4.2 本人確認画面

- 「ご本人確認のため、生年月日（YYYYMMDD）を入力してください」
- 入力一致 → 確認画面へ
- 3 回失敗 → トークン無効化、再発行依頼を案内

### 4.3 確認画面

- 予約内容サマリ
- 「予約を確定する」ボタン
- 同意文（個人情報の取扱い、キャンセルポリシー）

### 4.4 完了画面

- 予約番号 + 日時 + 場所
- 「LINE 友だち追加」CTA（ヒュアラン_info）
- 「カレンダーに追加」.ics ダウンロード
- リマインダー送信予告

### 4.5 キャンセル画面

- 既存予約の表示
- キャンセル理由（任意）
- 「キャンセルする」ボタン
- キャンセル期限：面接 24 時間前まで（過ぎたら電話連絡を案内）

---

## 5. API 設計（Edge Function）

### 5.1 GET `/api/sprout/reserve/slots`

- クエリ: `token`, `from_date`, `to_date`
- レスポンス: 日付ごとの空き状態 + スロット ID のみ（時刻は別 API で取得）

### 5.2 GET `/api/sprout/reserve/slot/:slot_id`

- スロット詳細

### 5.3 POST `/api/sprout/reserve/confirm`

- ボディ: `token`, `slot_id`, `verification_value`（生年月日 or 電話下 4 桁）
- 処理: 本人確認 → reserved_count を +1（トランザクション、`SELECT ... FOR UPDATE`）→ sprout_interview_reservations INSERT → LINE/SMS 送信ジョブ enqueue

### 5.4 POST `/api/sprout/reserve/cancel`

- ボディ: `token`, `reservation_id`, `reason`
- 処理: status='cancelled'、reserved_count を -1、LINE/SMS 送信

---

## 6. 状態遷移

```
[token 発行]
   ↓
[applicant が URL アクセス]
   ↓
[空き表示] ─→ [本人確認] ─→ [確定] ─→ [reserved]
                                   ↓ (前日)
                                [リマインダー送信]
                                   ↓ (当日)
                              [attended] / [no_show] (面接担当者が S-04 で更新)
                                   ↓
                              [面接記録に進む]
```

キャンセルは reserved → cancelled。

---

## 7. リマインダー設計

- Cron（5 分間隔）で `sprout_interview_reservations` を走査
- 条件 1: status='reserved' AND `slot.starts_at - now()` 24時間±5分 → 前日リマインダー
- 条件 2: status='reserved' AND `slot.starts_at - now()` 1時間±5分 → 当日リマインダー
- 送信媒体: LINE 友だちなら LINE、なければ SMS
- `reminder_sent_at` を更新（重複防止）

---

## 8. 法令対応チェックリスト

- [ ] **個人情報保護法 第17条/18条**: 同意文に利用目的を明示（応募・採用業務）
- [ ] **特定電子メール法**: メール送信時オプトアウト導線を明示
- [ ] **電気通信事業法**: SMS 送信時の事業者表示
- [ ] **障害者差別解消法**: WAI-ARIA 準拠（合理的配慮）
- [ ] **景品表示法**: 該当なし（求人広告との整合は別レイヤ）

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | ルーティング + ページ scaffold | a-sprout | 0.25d |
| 2 | カレンダーコンポーネント | a-sprout | 0.25d |
| 3 | Edge Function 4 本実装 | a-sprout | 0.25d |
| 4 | 本人確認・トークン検証 | a-sprout | 0.25d |
| 5 | リマインダー Cron + 送信連携 | a-sprout / a-rill | 0.25d |

---

## 10. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | 本人確認手段（生年月日 / 電話下 4 桁 / メールリンク） | 生年月日案を提案 |
| 2 | キャンセル期限（24h / 12h / 6h） | 24h 案を提案、現場運用次第で短縮検討 |
| 3 | 同時予約抑止のロック方式（DB ロック / アプリ層） | DB の SELECT FOR UPDATE 案 |
| 4 | カレンダービューのデフォルト（月 / 週） | 月案、モバイルは日次でも可 |
| 5 | リマインダーの送信タイミング（前日 18 時 / 12 時） | 前日 18 時案 |
| 6 | LINE 友だち未追加時の SMS 強制送信可否 | オプトイン明示で送信可 |
| 7 | アンケート同梱（応募経緯確認）の有無 | β版以降検討 |

---

## 11. 既知のリスクと対策

- **リスク**: スロット二重予約
  - **対策**: DB レベルの reserved_count <= capacity CHECK + SELECT FOR UPDATE
- **リスク**: トークン漏洩
  - **対策**: HTTPS、Referrer-Policy: no-referrer、有効期限 14 日
- **リスク**: 本人確認なりすまし
  - **対策**: 3 回失敗でトークン無効化、再発行は admin 経由

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md`
- `docs/specs/2026-04-26-sprout-S-01-migrations.md`
- `docs/specs/2026-04-26-sprout-S-04-interview-sheets.md`
- `docs/specs/2026-04-26-sprout-S-05-line-bot.md`

---

## 13. 受入基準（Definition of Done）

- [ ] 公開 URL から空きスロットが正しく表示される
- [ ] 本人確認 3 回失敗でトークン無効化される
- [ ] 確定時に reserved_count が原子的に増加する
- [ ] 前日 / 当日のリマインダーが LINE or SMS で届く
- [ ] キャンセル時に reserved_count が戻る
- [ ] WAI-ARIA / キーボード操作テスト合格
- [ ] 法令対応チェックリスト 4 項目レビュー済
- [ ] §後述 Kintone 確定反映 Web 面接対応の DoD 全項目

---

## Kintone 確定反映: 決定 #6 Web 面接 = Google Meet 都度発行（将来枠）

> **改訂背景**: a-main 006 で東海林さんから 32 件の Kintone 解析判断が即決承認（`docs/decisions-kintone-batch-20260426-a-main-006.md`）。本セクションで決定 #6 を反映。

### 設計方針

- 通常面接は**対面（オフィス）**を既定
- 遠隔・遠方候補者向けに **Web 面接 = Google Meet 都度発行**を将来枠として設計
- Phase B 段階では**対面のみ**実装、Web 面接は **Phase C 以降**

### スキーマ追加（S-01 sprout_interview_slots / sprout_interview_reservations 連動）

```sql
ALTER TABLE sprout_interview_slots
  ADD COLUMN interview_mode text NOT NULL DEFAULT 'in_person'
    CHECK (interview_mode IN ('in_person', 'web')),
  ADD COLUMN web_meeting_url text;          -- Google Meet 都度発行 URL（Phase C 〜）

ALTER TABLE sprout_interview_reservations
  ADD COLUMN interview_mode text NOT NULL DEFAULT 'in_person'
    CHECK (interview_mode IN ('in_person', 'web')),
  ADD COLUMN web_meeting_url text;
```

### Google Meet URL 発行（Phase C 実装、本 spec 段階では設計のみ）

```typescript
// 予約確定時に Google Meet URL を生成（Phase C）
async function reserveSlotWithWebMode(input: { ... }) {
  const slot = await fetchSlot(input.slot_id);
  let webUrl: string | null = null;
  if (slot.interview_mode === 'web') {
    // Google Calendar API 経由で Meet URL を都度生成
    webUrl = await createGoogleMeetForInterview({
      start_at: slot.start_at,
      end_at: slot.end_at,
      attendees: [input.applicant_email, input.interviewer_email],
    });
  }
  await insertReservation({ ...input, web_meeting_url: webUrl });
  // メール / LINE で URL 通知
}
```

### UI 表示（応募者画面）

```
[面接予約]

■ 面接形式
  ⦿ 対面（弊社オフィス）
  ○ Web 面接（Google Meet）  *Phase C 〜（将来対応）

[次へ]
```

### Phase 段階

| Phase | 対応 |
|---|---|
| Phase B | `interview_mode = 'in_person'` のみ、UI に Web 面接ラジオは disabled |
| Phase C | Web 面接実装、Google Calendar API 連携、Google Meet URL 都度発行 |
| Phase D | Web 面接の自動字幕 / 録画機能（オプション）|

### 判断保留事項追加

| # | 論点 | a-auto スタンス |
|---|---|---|
| Web-1 | Google Workspace アカウント | 法人代表メールで発行、運用コスト次第で再評価 |
| Web-2 | 録画保存場所 | 録画は当面実施しない、Phase D で検討 |
| Web-3 | 候補者側のアカウント要件 | Google アカウント不要のゲスト参加可で運用 |

### DoD 追加

- [ ] sprout_interview_slots / sprout_interview_reservations に interview_mode / web_meeting_url 列追加
- [ ] Phase B では in_person のみ受付、Web ラジオは disabled で UI 表示
- [ ] Phase C 着手時の Google Calendar API 連携契約手続きを admin が事前確認
