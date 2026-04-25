# Sprout S-05: LINE Bot 自動応答（2 アカウント運用）

- 対象: 入社前（ヒュアラン_info）と入社後（スタッフ連絡用_official）の 2 アカウント切替を含む LINE Bot 設計
- 優先度: 🔴
- 見積: **1.50d**（0.25d 刻み）
- 担当セッション: a-sprout / a-rill（Messaging API 連携）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Sprout S-05）
- 前提:
  - **Sprout v0.2 spec**（PR #76 merge 済）
  - 関連 spec: S-01（sprout_line_users / sprout_line_messages）、S-02（取込時に SMS で LINE 案内）、S-03（予約完了通知）、S-07（入社時切替）
  - LINE Developers アカウント 2 つ取得済（公式 / 個人事業主）

---

## 1. 目的とスコープ

### 1.1 目的

応募 → 入社 → 在籍中の各フェーズで適切な LINE アカウントを使い分け、コミュニケーションを自動化・整流化する。応募者には「ヒュアラン_info」、入社後は「スタッフ連絡用_official」へ移管する。

### 1.2 含めるもの

- 2 アカウントの Webhook 受信処理
- 友だち追加時の応募者紐付け（applicant_code 入力 or 電話番号照合）
- 自動応答シナリオ 10 種
- 一斉送信機能（broadcast）
- 入社時のアカウント切替フロー
- メッセージ履歴記録 / 検索

### 1.3 含めないもの

- LINE 公式アカウント運用ガイドライン整備（別ドキュメント）
- 大規模リッチメニュー設計（β版以降）
- 有料プラン上限管理（運用課題）

---

## 2. 設計方針 / 前提

- **2 アカウント分離**: アカウント別に Channel Secret / Access Token を保持
- **DB 分離**: sprout_line_users.account_type で 'info' / 'official' を識別
- **シナリオ駆動**: 受信メッセージ → 状態 + キーワード判定 → 応答テンプレ
- **Webhook 検証**: x-line-signature を必ず検証
- **PII 取扱**: 名前 / 電話番号は LINE プロフィール非依存、別途応募者照合で取得

---

## 3. アカウント定義

| 項目 | ヒュアラン_info | スタッフ連絡用_official |
|---|---|---|
| 用途 | 応募者向け（応募〜入社前日まで） | 在籍スタッフ向け（入社初日以降） |
| アカウント種別 | 認証済 LINE 公式 | 認証済 LINE 公式 |
| 自動応答 | 多め（FAQ / 予約確認） | 少なめ（連絡受付中心） |
| 一斉送信 | 採用関連通知 | シフト / 給与日告知 |
| 友だち登録経路 | バイトル経由 / SMS 案内 | 入社初日に切替案内 |

---

## 4. Webhook 設計

### 4.1 エンドポイント

- `POST /api/sprout/line/webhook/info`
- `POST /api/sprout/line/webhook/official`

### 4.2 処理フロー

1. x-line-signature 検証（HMAC-SHA256）
2. body の events 配列を順に処理
3. event type 別ルーティング：
   - `follow`: 友だち追加 → sprout_line_users 登録 / 復活
   - `unfollow`: ブロック / 削除 → is_blocked=true
   - `message` (text): キーワード判定 → シナリオ実行
   - `postback`: ボタン押下 → シナリオ実行
   - `message` (image/sticker): メッセージ記録のみ
4. sprout_line_messages に inbound レコード INSERT
5. 応答送信（reply token 使用、有効 60 秒）

---

## 5. 応募者紐付けフロー（info アカウント）

### 5.1 友だち追加時

1. 応募者向けに「応募者コード（SP-2026-XXXX）または応募時に登録した電話番号下 4 桁を送信してください」と案内
2. 応募者が送信
3. sprout_applicants と照合
4. 一意ヒット → sprout_line_users.applicant_id を更新、ウェルカムメッセージ送信
5. 不一致 → 「申し訳ございません、再度お試しください」

### 5.2 紐付け後の使用

- `applicant_id` 経由で予約確認 / キャンセルリンクをパーソナライズ
- リマインダー送信は LINE 経由優先（SMS は LINE ブロック時のみ）

---

## 6. 自動応答シナリオ（10 種）

| ID | キーワード | 応答内容 |
|---|---|---|
| 1 | 「予約確認」 | 直近の予約日時を表示 |
| 2 | 「キャンセル」 | キャンセル URL 送付 |
| 3 | 「持ち物」 | 面接時の持ち物リスト Flex メッセージ |
| 4 | 「場所」 | Google Map URL + 地図画像 |
| 5 | 「時間変更」 | 予約変更 URL + 変更可否案内 |
| 6 | 「履歴書」 | 履歴書テンプレ PDF |
| 7 | 「服装」 | 服装規定の説明 |
| 8 | 「採用結果」 | 「面接後 1 週間以内にご連絡します」 |
| 9 | 「FAQ」 | FAQ Flex Carousel |
| 10 | (上記以外) | 「担当者に転送します。営業時間内に返信します」 |

各シナリオは sprout_line_scenarios テーブル（必要なら追加）でテンプレ管理。

---

## 7. 一斉送信（broadcast）

### 7.1 info 側

- 採用関連告知（勉強会 / 説明会）
- 対象: applicant_id 紐付け済 + status='applied' or 'interview_scheduled'

### 7.2 official 側

- シフト確定 / 給与日 / 緊急連絡
- 対象: employee_id 紐付け済 + 在籍中

### 7.3 配信制御

- 配信時間帯: 8:00〜21:00 のみ
- 重複配信抑止: campaign_id でユーザーごとに 1 回まで
- 配信ログ: sprout_line_messages に outbound レコード

---

## 8. 入社時アカウント切替フロー

### 8.1 トリガー

- S-07 で入社確定時、employee_id 発行
- 切替案内ジョブ enqueue

### 8.2 切替メッセージ（info 側）

> 山田太郎様、入社おめでとうございます！
> 本日以降のご連絡は「スタッフ連絡用_official」アカウントへ移行します。
> 下記友だち追加 URL からご登録お願いします。
> https://line.me/R/ti/p/...

### 8.3 official 側友だち追加時

- 応募者紐付けと同様の照合（employee_code or 電話下 4 桁）
- 紐付け成功 → sprout_line_users.account_type='official' で登録、employee_id を更新

### 8.4 info 側ブロック推奨

- official 紐付け完了後、info 側はブロック推奨案内（任意）

---

## 9. PII / セキュリティ

- LINE userId は LINE 内識別子であり、それ自体では個人を特定不可
- ただし applicant_id / employee_id と紐づくため、RLS で厳格管理
- メッセージ本文のログ保管は 1 年（業務通信記録）
- 退職者は employee_id 紐付けを解除し、ブロック

---

## 10. 法令対応チェックリスト

- [ ] **特定電子メール法**: LINE は対象外（メールではない）だが、迷惑にならない時間帯配信
- [ ] **個人情報保護法 第17条**: 友だち追加時に利用目的を明示（プロフィール画面 + 初回応答）
- [ ] **個人情報保護法 第27条**: LINE 社への第三者提供は明示済（LINE 規約準拠）
- [ ] **電気通信事業法**: 該当なし（自社利用）
- [ ] **労働基準法 第15条**: 労働条件は LINE で告知せず、書面 / PDF で渡す（LINE は補助通知のみ）

---

## 11. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | Webhook エンドポイント 2 本実装 | a-sprout | 0.25d |
| 2 | 友だち追加時の照合ロジック | a-sprout | 0.25d |
| 3 | シナリオ 10 種テンプレ作成 | a-sprout / 東海林さん | 0.25d |
| 4 | 一斉送信機能 | a-sprout | 0.25d |
| 5 | アカウント切替フロー | a-sprout | 0.25d |
| 6 | メッセージ履歴閲覧 UI | a-sprout / a-bloom | 0.25d |

---

## 12. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | リッチメニュー設計の有無 | β版以降に検討、α版は基本テキストのみ |
| 2 | 担当者転送（オペレーターへの引継ぎ）の方式 | Chatwork 通知 + 管理画面で返信案 |
| 3 | 応募者紐付けの照合キー（応募コード / 電話下 4 桁） | 両方受付案 |
| 4 | 配信時間帯（8-21時 / 9-20時） | 8-21時案、現場運用次第 |
| 5 | info → official 切替の半強制度合い | ブロック推奨は任意、強制しない |
| 6 | 既読確認の取得有無 | LINE 仕様上不可、表示しない |
| 7 | 退職者のメッセージ履歴削除 | 1 年保管後に自動削除案 |

---

## 13. 既知のリスクと対策

- **リスク**: Webhook の reply token 期限切れ
  - **対策**: 60 秒以内応答のため Edge Function は軽量処理のみ、重い処理は別ジョブ
- **リスク**: 大量受信での Webhook タイムアウト
  - **対策**: 即時 200 OK 返却 + 非同期処理キュー
- **リスク**: 誤配信
  - **対策**: 配信前にプレビュー + admin 承認必須

---

## 14. 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md`
- `docs/specs/2026-04-26-sprout-S-01-migrations.md`
- `docs/specs/2026-04-26-sprout-S-03-interview-reservation-ui.md`
- `docs/specs/2026-04-26-sprout-S-07-account-issuance-flow.md`

---

## 15. 受入基準（Definition of Done）

- [ ] 2 アカウントの Webhook が x-line-signature 検証を通過する
- [ ] 友だち追加 → 応募者紐付けが照合キーで成立する
- [ ] 10 種のシナリオが期待通り応答する
- [ ] 一斉送信が配信時間帯チェックを通過する
- [ ] 入社時の info → official 切替案内が自動送信される
- [ ] メッセージ履歴が sprout_line_messages に記録される
- [ ] 法令対応チェックリスト 5 項目レビュー済
