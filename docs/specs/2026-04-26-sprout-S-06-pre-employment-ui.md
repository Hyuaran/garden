# Sprout S-06: 入社前データ収集 UI（iPad ガイド枠カメラ + 申請承認フロー）

- 対象: 内定者が入社前に提出する個人情報・添付書類の収集 UI と、admin 承認フロー
- 優先度: 🔴
- 見積: **1.50d**（0.25d 刻み）
- 担当セッション: a-sprout / a-root（root_change_requests 横断テーブル連携）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Sprout S-06）
- 前提:
  - **Sprout v0.2 spec**（PR #76 merge 済、§3 確定設計判断準拠）
  - 関連 spec: S-01（sprout_pre_employment_data 暗号化列）、S-04（採用後の起動）、S-07（本アカウント化への転記）
  - **写真添付方式**: iPad ガイド枠カメラ（撮影誘導）
  - **承認方式**: 全項目「申請 → admin 承認」フロー（root_change_requests）

---

## 1. 目的とスコープ

### 1.1 目的

採用が決まった応募者から、入社初日に必要な個人情報・本人確認書類・口座情報・マイナンバー等を「ペーパーレス」かつ「セキュア」に収集する。すべての項目に admin 承認を必須化し、誤入力・なりすましを防ぐ。

### 1.2 含めるもの

- 内定者向け収集 UI（モバイル / iPad / PC）
- iPad ガイド枠カメラ機能（運転免許証 / マイナンバーカード / 通帳）
- 全項目の申請 → admin 承認フロー（root_change_requests 共通テーブル使用）
- 暗号化保存（pgcrypto、S-01 準拠）
- 進捗可視化（チェックリスト）
- 緊急連絡先 / 銀行口座 / 通勤経路の入力

### 1.3 含めないもの

- 雇用契約書 / MFC 締結（S-07）
- Root への転記処理（S-07）
- OCR 処理（S-07）
- 退職時のデータ取り扱い（Phase B-3 で対称設計）

---

## 2. 設計方針 / 前提

- **入口**: S-04 で内定確定 → 内定者向け招待リンクを LINE / メールで送付
- **トークン**: 専用 invite_token（有効期限 30 日）
- **承認フロー**: root_change_requests を流用（横断テーブル）
- **ガイド枠カメラ**: HTML5 Canvas で枠オーバーレイ、撮影時に枠内のみクロップ
- **暗号化**: 入力時 → サーバ側 pgcrypto で即時暗号化
- **進捗保存**: 入力中も自動保存、再開可能

---

## 3. 収集項目（チェックリスト）

| # | 項目 | 暗号化 | 添付 | 承認必須 |
|---|---|---|---|---|
| 1 | 氏名（漢字 / カナ） |   |   | ◯ |
| 2 | 生年月日 |   |   | ◯ |
| 3 | 性別 |   |   | ◯ |
| 4 | 自宅住所 | ◯ |   | ◯ |
| 5 | 携帯電話番号 |   |   | ◯ |
| 6 | メールアドレス |   |   | ◯ |
| 7 | 緊急連絡先（氏名 / 続柄） |   |   | ◯ |
| 8 | 緊急連絡先電話 | ◯ |   | ◯ |
| 9 | 通勤手段 / 経路 |   |   | ◯ |
| 10 | 銀行名 / 支店名 |   |   | ◯ |
| 11 | 口座番号 / 口座種別 | ◯ | 通帳写し | ◯ |
| 12 | 口座名義（カナ） |   |   | ◯ |
| 13 | マイナンバー | ◯ | カード両面 | ◯ |
| 14 | 運転免許証 |   | 両面 | ◯ |
| 15 | 健康保険被扶養者情報 |   |   | ◯ |
| 16 | 配偶者の有無 / 扶養人数 |   |   | ◯ |
| 17 | 振込先優先度（給与 / 経費別） |   |   | ◯ |

合計 17 項目。番号は将来追加可能（schema 駆動）。

---

## 4. UI 仕様

### 4.1 トップ画面

- 進捗バー（17 項目 / 完了済の比率）
- 各項目カード：状態（未着手 / 入力中 / 申請中 / 承認待ち / 承認済 / 差戻し）
- 承認待ち項目には「admin 確認中」表示
- 全項目承認後 → 「入社初日のご案内」表示

### 4.2 各項目入力画面

- ガイド付きフォーム（label + placeholder + ヘルプテキスト）
- 添付がある項目はカメラ起動 / ファイル選択
- 確定時：申請 → root_change_requests に INSERT、status='pending'

### 4.3 ガイド枠カメラ

- iPad / スマホで起動
- 画面に書類サイズの枠（運転免許証なら 85.6×54mm 比率）
- 枠内のみキャプチャ、JPEG 圧縮（80%）
- 影 / ピンボケ検出（OpenCV.js or 輝度ヒストグラム）→ 警告
- 撮影後プレビュー → 「OK」で送信

### 4.4 進捗一時停止

- 「あとで続ける」ボタン
- LINE / メールに再開 URL 送信

---

## 5. 申請承認フロー（root_change_requests 連携）

### 5.1 root_change_requests スキーマ（既存想定）

```sql
-- 既存テーブル想定（参考）
-- root_change_requests(id, requester_id, target_table, target_id, field_name, old_value, new_value, status, approver_id, approved_at, ...)
```

### 5.2 Sprout からの利用

- 各項目入力 → root_change_requests に INSERT
  - `target_table = 'sprout_pre_employment_data'`
  - `target_id = pre_employment_data.id`
  - `field_name = '<列名>'`
  - `new_value = <入力値>` （暗号化対象は暗号化前のハッシュのみ保存、実値は別途）
  - `requester_id = applicant_id` （または専用フラグ）
  - `status = 'pending'`
- admin が Sprout admin UI で確認 → 承認 / 差戻し
- 承認時：sprout_pre_employment_data の該当列を更新
- 差戻し時：申請者へ LINE 通知 + 理由表示

### 5.3 一括承認

- admin UI で項目一括承認可能
- 高リスク項目（マイナンバー / 口座番号）は個別承認推奨

---

## 6. 暗号化処理

- フォーム送信時、Edge Function 内で `pgp_sym_encrypt` 実行
- 鍵は Vault から取得（S-01 準拠）
- 復号は admin 承認画面で必要時のみ、ログ記録

---

## 7. 進捗管理

### 7.1 sprout_pre_employment_data.collection_status

- pending: 未着手
- collecting: 入力途中
- complete: 全 17 項目承認済
- transferred_to_root: S-07 で Root に転記済

### 7.2 内定者から見える表示

- 「あと X 項目で完了です」
- 入社初日 7 日前から admin 側にアラート

---

## 8. 法令対応チェックリスト

- [ ] **個人情報保護法 第17条**: 利用目的（雇用管理）を明示
- [ ] **個人情報保護法 第20条**: 安全管理措置（pgcrypto + RLS）
- [ ] **マイナンバー法 第14条**: 本人確認書類取得（運転免許証 or マイナンバーカード両面）
- [ ] **マイナンバー法 第19条**: 提供制限（target_table 限定）
- [ ] **労働基準法 第109条**: 労働者名簿 3 年保存
- [ ] **健康保険法 第48条**: 被扶養者情報（健保組合提出用）

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | 招待トークン発行 + 入口ページ | a-sprout | 0.25d |
| 2 | 17 項目の入力 UI（schema 駆動） | a-sprout | 0.50d |
| 3 | iPad ガイド枠カメラ実装 | a-sprout | 0.25d |
| 4 | root_change_requests 連携 | a-sprout / a-root | 0.25d |
| 5 | 暗号化処理（Edge Function） | a-sprout | 0.25d |

---

## 10. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | ガイド枠カメラのライブラリ（自前 / OpenCV.js / 既製） | 自前 Canvas 実装案、複雑なら OpenCV.js |
| 2 | 全項目承認の admin 負荷軽減策 | 高リスク項目のみ個別、その他は一括承認案 |
| 3 | 内定者の入力途中放棄時の催促タイミング | 1 / 3 / 7 日後の 3 段階案 |
| 4 | 緊急連絡先の続柄選択肢 | 親 / 配偶者 / 兄弟 / 子 / その他案 |
| 5 | 銀行口座の複数登録（給与 + 経費別） | 当面 1 口座、将来拡張 |
| 6 | 入力データの一時保管期間（差戻し中） | 30 日案 |
| 7 | カード等の写真画質基準 | 200 dpi 相当案 |

---

## 11. 既知のリスクと対策

- **リスク**: 写真撮影品質不良
  - **対策**: 影 / ピンボケ検出 + 再撮影誘導
- **リスク**: 内定者の途中離脱
  - **対策**: LINE / メールでリマインダー、admin に未提出アラート
- **リスク**: admin の承認漏れ
  - **対策**: 入社初日 7 日前から強制アラート

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md`（§3 / §13）
- `docs/specs/2026-04-26-sprout-S-01-migrations.md`
- `docs/specs/2026-04-26-sprout-S-04-interview-sheets.md`
- `docs/specs/2026-04-26-sprout-S-07-account-issuance-flow.md`
- Root: `docs/specs/...root_change_requests.md`（既存想定）

---

## 13. 受入基準（Definition of Done）

- [ ] 17 項目すべてが UI で入力でき、申請 → 承認フローが動作する
- [ ] iPad のカメラで枠内撮影が正しく動作する
- [ ] 暗号化対象 4 列が pgcrypto で暗号化保存される
- [ ] root_change_requests に各申請レコードが正しく INSERT される
- [ ] 進捗バー / チェックリストが正常に動作する
- [ ] 入社 7 日前にアラート発火
- [ ] 法令対応チェックリスト 6 項目レビュー済
- [ ] §14 入社初日 LINE 友だち追加 + Bot 接続確認（後述）が完了

---

## 14. 入社初日: LINE 友だち追加 + Bot 接続確認（2026-04-26 改訂）

> **改訂背景**: 給与明細配信 Y 案 + フォールバック確定（memory `project_payslip_distribution_design.md`）に伴い、入社初日に LINE official アカウントの友だち追加 + Bot 接続を**チェック項目化**。

### 14.1 入社初日チェックリスト（既存 §3 拡張）

入社初日 / 仮アカウント発行と並行して以下を確認:

| # | 項目 | 担当 | 完了条件 |
|---|---|---|---|
| D-01 | スタッフ連絡用 LINE official 友だち追加 | 本人 | QR コード読込 → 友だち登録 |
| D-02 | Bot 接続確認（テストメッセージ送受信）| 本人 + admin | テストメッセージ送信 → 受信スクショ確認 |
| D-03 | line_friend_user_id 自動取得 | システム | Webhook で event.source.userId を `root_employees.line_friend_user_id` に保存 |
| D-04 | line_friend_status = 'friend' 確定 | システム | Webhook follow event → status 更新 |
| D-05 | フォールバック説明 | admin | 「友だち追加できない場合はメール + マイページで PW 確認」を口頭説明 |

### 14.2 友だち追加 QR コード表示

```
┌──────────────────────────┐
│ 入社初日チェックリスト     │
├──────────────────────────┤
│ ステップ 7/10              │
│ LINE 友だち追加            │
│                           │
│ ┌──────────────┐          │
│ │ [QR コード]   │          │
│ │ official      │          │
│ └──────────────┘          │
│                           │
│ スマホで QR を読み取ると   │
│ 友だち登録が完了します。   │
│                           │
│ 完了したら下のボタンを     │
│ 押してください。           │
│                           │
│ [友だち追加完了 →]         │
│ [友だち追加できない →]     │
└──────────────────────────┘
```

QR コードは S-05 official アカウント `add friends URL` を `qrcode` ライブラリで動的生成（既存依存、新規 npm 不要）。

### 14.3 Bot 接続確認フロー

```
1. 本人スマホ: 友だち追加完了
   ↓ (Webhook follow event 自動受信)
2. システム: line_friend_user_id 自動保存
   ↓
3. admin 画面: 「テストメッセージ送信」ボタン
   ↓ (LINE push API 経由)
4. 本人スマホ: テストメッセージ受信
   ↓
5. 本人 → admin に「届いた」報告
   ↓
6. admin: 「Bot 接続確認 ✓」ボタンで確定
```

接続確認テストメッセージ例:
```
[Garden] 接続確認テスト

このメッセージが届いていれば、給与明細通知などの
重要連絡を LINE で受け取れます。

確認できたら、入社担当者に「届きました」と
お伝えください。
```

### 14.4 友だち追加できない場合のフォールバック

下記理由で友だち追加できないケース:
- LINE アカウント自体を持っていない
- LINE が業務利用禁止のため使わない（信仰・個人方針）
- スマホのストレージ満杯で LINE がインストール不可

#### 14.4.1 admin 画面での手動マーク

```
[従業員: 山田太郎]
LINE 友だち状態: [no_account ▼]
  ・friend: 友だち登録済
  ・blocked: ブロック中
  ・unfriended: 友だち解除
  ・no_account: LINE アカウントなし
  ・unknown: 未確認

[フォールバック設定 ✓] (チェック済み)

→ 給与明細は PW 保護 PDF + Tree マイページ PW 確認 で配信されます
```

#### 14.4.2 admin による手動 friend_user_id 紐付（緊急時）

LINE は持っているが、Webhook 取りこぼしで自動紐付に失敗するケース:

```
[従業員: 山田太郎]
LINE userId: [_____________]  (LINE Developer Console で本人確認後手入力)
[紐付実行]
```

ただし通常は **Webhook 自動紐付**を推奨、手動入力は障害時の緊急手段。

### 14.5 status の確定タイミング

| タイミング | line_friend_status | 備考 |
|---|---|---|
| 入社前（仮アカウント発行）| `unknown` | 既定値 |
| 入社初日 D-01 完了 | `unknown` のまま | Webhook 受信待ち |
| 入社初日 D-04 完了 | `friend` | Webhook follow event 受信 |
| 入社初日 D-05 で no_account 確定 | `no_account` | admin 手動マーク |
| 退職時 | `unfriended`（手動）| S-07 退職フローと連動 |

### 14.6 Tree マイページ PW 確認連携

`line_friend_status != 'friend'` の従業員には、Tree マイページに**「給与明細 PW 確認」リンク**を表示（既存 Tree マイページ拡張、`docs/specs/2026-04-26-tree-mypage-payslip-password.md` で詳述）。

入社初日に説明:
> 「LINE で受け取れない方は、社内 PC で Tree にログイン → マイページから今月の給与明細 PW を確認できます。」

### 14.7 法令対応チェックリスト追加

- [ ] **個人情報保護法 第 17 条**: LINE userId 取得時の利用目的明示（給与明細通知 + 業務連絡）
- [ ] **賃金支払 5 原則**: 友だち追加できない従業員にも確実な配信経路（メール + マイページ）

### 14.8 入社 7 日前アラートとの統合

`§7 進捗管理` で入社 7 日前アラートが既存。本改訂で「入社 1 日前: LINE 友だち追加 QR コード送付（メール）」も追加可（§10 判断保留）。

### 14.9 §10 判断保留事項への追加

| # | 論点 | a-auto スタンス |
|---|---|---|
| 7 | 入社前事前 QR 送付の有無 | **送付推奨**（入社 1 日前メール）、admin 設定可 |
| 8 | テストメッセージ確認の必須化 | 必須（口頭確認 → admin 側ボタン押下）|
| 9 | no_account マークの監査ログ | 必須記録（後日トラブル防止）|

### 14.10 §11 既知のリスク追加

- **リスク**: 本人が QR を読み取ったつもりで失敗、Webhook event 不在
  - **対策**: 入社初日チェックでテストメッセージ確認まで含めて確定
- **リスク**: 退職後にも friend のまま status 未更新
  - **対策**: S-07 退職フローと連動（手動 unfriended マーク + ブロック推奨）

---

## 15. Kintone 確定反映: 決定 #26 通勤経路変更フロー（申請承認パターン）

> **改訂背景**: a-main 006 確定ログ #26 を反映。現状は LINE 手動 + 漏れリスクあり → Garden で**申請承認パターン**で改善。

### 15.1 確定フロー

```
[従業員] 公式 LINE フォーム or Sprout マイページから申請
  ↓
[Sprout] commute_route_change_requests にレコード生成
  ↓
[admin] 通勤経路変更申請レビュー画面で承認 / 却下
  ↓
[承認時] root_employees / 関連の通勤費・税控除計算へ反映
[却下時] 申請者へ理由通知（LINE / メール）
```

### 15.2 commute_route_change_requests テーブル

```sql
CREATE TABLE sprout_commute_route_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 申請者
  employee_id uuid NOT NULL REFERENCES root_employees(id),
  applicant_user_id uuid NOT NULL,        -- 申請者の auth.uid()（通常 = 本人 employee）
  source text NOT NULL DEFAULT 'sprout_mypage'
    CHECK (source IN ('sprout_mypage', 'line_form', 'admin_proxy')),

  -- 変更前情報（自動取込、参照用）
  old_residence_address text,
  old_route_description text,             -- 例: 「梅田駅 → 大阪駅」
  old_monthly_commute_fee int,            -- 円
  old_route_distance_km numeric(6,2),

  -- 変更後情報（申請内容）
  new_residence_address text NOT NULL,
  new_residence_postal_code text,
  new_route_description text NOT NULL,
  new_monthly_commute_fee int NOT NULL,
  new_route_distance_km numeric(6,2),
  new_transit_pass_url text,              -- 経路定期券のスクショ等

  -- 申請内容
  effective_date date NOT NULL,           -- 変更適用日（引越日）
  reason text,                            -- 引越 / 転居 / その他

  -- 承認状態
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'admin_review', 'approved', 'rejected', 'cancelled')),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  status_changed_by uuid,
  approval_notes text,                    -- admin の承認 / 却下メモ
  rejection_reason text,

  -- 添付資料
  attachments jsonb,                      -- 引越証明 / 賃貸契約 等

  -- 反映済情報
  applied_to_root_at timestamptz,
  applied_to_root_by uuid,

  -- メタ
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_commute_change_status_pending
  ON sprout_commute_route_change_requests (status, created_at DESC)
  WHERE status IN ('pending', 'admin_review');

CREATE INDEX idx_commute_change_employee
  ON sprout_commute_route_change_requests (employee_id, created_at DESC);
```

### 15.3 LINE フォームの構成

LINE 公式アカウント（official）から **リッチメニュー → 通勤経路変更フォーム** で申請可:

```
[公式 LINE リッチメニュー]
├─ 給与明細
├─ 通勤経路変更 ← New
├─ シフト確認
└─ お問合せ
```

#### LIFF（LINE Front-end Framework）連携

LIFF アプリで Sprout 提供の Web フォーム → 申請レコード INSERT:

```typescript
// /sprout/commute-change-form （LIFF 経由）
async function submitCommuteChange(formData: CommuteChangeForm) {
  const employeeId = await resolveEmployeeFromLineUserId(liffContext.userId);
  await supabaseAdmin.from('sprout_commute_route_change_requests').insert({
    employee_id: employeeId,
    applicant_user_id: employeeId,
    source: 'line_form',
    new_residence_address: formData.address,
    new_route_description: formData.route,
    new_monthly_commute_fee: formData.fee,
    effective_date: formData.effectiveDate,
    reason: formData.reason,
    status: 'pending',
  });
  // admin に Chatwork 通知
  await notifyAdminCommuteChange(employeeId);
}
```

### 15.4 admin レビュー画面 `/sprout/admin/commute-changes`

```
┌──────────────────────────────────────┐
│ 通勤経路変更 承認待ち 3 件            │
├──────────────────────────────────────┤
│ 山田太郎（営業部）  申請: 04-25       │
│ 引越前: 梅田 → 大阪 / ¥8,000          │
│ 引越後: 神戸 → 大阪 / ¥15,000         │
│ 適用日: 2026-05-01                    │
│ 添付: [引越証明 PDF]                   │
│                                       │
│ [承認] [却下] [情報追加要求]           │
└──────────────────────────────────────┘
```

### 15.5 承認フロー Server Action

```typescript
async function approveCommuteChange(requestId: string, notes: string) {
  const req = await fetchCommuteChangeRequest(requestId);
  if (!isAdmin(currentUser())) throw new ForbiddenError();

  // 1. 申請を approved に更新
  await supabaseAdmin.from('sprout_commute_route_change_requests').update({
    status: 'approved',
    status_changed_at: new Date().toISOString(),
    status_changed_by: currentUser().id,
    approval_notes: notes,
  }).eq('id', requestId);

  // 2. root_employees へ反映（a-root 担当領域、a-auto は呼出のみ）
  await callRootCommuteUpdate({
    employee_id: req.employee_id,
    new_residence_address: req.new_residence_address,
    new_route_description: req.new_route_description,
    new_monthly_commute_fee: req.new_monthly_commute_fee,
    effective_date: req.effective_date,
  });

  // 3. 申請者へ通知（LINE official + メール）
  await notifyApplicantCommuteApproved(req.employee_id);

  // 4. applied_to_root_at 記録
  await supabaseAdmin.from('sprout_commute_route_change_requests').update({
    applied_to_root_at: new Date().toISOString(),
    applied_to_root_by: currentUser().id,
  }).eq('id', requestId);
}
```

### 15.6 既存 「申請承認パターン」との整合

S-06 §5（root_change_requests 連携）で既存の「全項目申請承認」フローを定義済。**通勤経路変更は専用テーブル**で扱う理由:

- 通勤費 / 税控除に直結する高頻度業務（月数件〜十数件）
- 引越証明 / 経路画像など添付が多い
- a-root 連携で給与・賦課計算に即影響
- 履歴保持と効力日（effective_date）が必須

汎用 root_change_requests に統合する案もあるが、**専用テーブル + admin 画面**で運用効率を優先。

### 15.7 RLS

- 本人: 自分の申請のみ SELECT / INSERT
- admin / super_admin: 全件 SELECT / UPDATE（status 変更）/ DELETE 不可
- staff- は自分の申請のみ閲覧

### 15.8 法令対応

- [ ] **個人情報保護法 第 17 条**: 住所変更情報の利用目的（通勤費計算 + 税控除）
- [ ] **所得税法**: 通勤費非課税限度額（月 15 万円まで）の自動計算反映
- [ ] **賃金支払 5 原則**: 効力日以降の給与計算に正確に反映

### 15.9 判断保留事項追加

| # | 論点 | a-auto スタンス |
|---|---|---|
| Commute-1 | 通勤費の上限超過時の挙動 | 月 15 万円超は admin に警告、超過分は課税扱いで計算 |
| Commute-2 | 効力日が過去日の場合 | 受付可、過去分は遡及修正（給与システム連動）|
| Commute-3 | 同月内の複数申請 | 最後の申請を採用、過去分は履歴保持 |
| Commute-4 | LIFF vs Web フォーム | LIFF 優先、Sprout マイページからも同フォーム提供 |

### 15.10 DoD 追加

- [ ] sprout_commute_route_change_requests テーブル + RLS 動作
- [ ] LIFF 経由の申請フォーム動作（テスト LINE 経由）
- [ ] admin レビュー画面 `/sprout/admin/commute-changes` 動作
- [ ] 承認時 root_employees への反映（a-root 連携）
- [ ] 申請者通知（LINE / メール）動作
- [ ] applied_to_root_at で反映完了確認可能
