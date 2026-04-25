# Garden Sprout（仮）+ オンボーディング再設計 v0.1

- 作成: 2026-04-25
- ステータス: **v0.1 草稿**（東海林さん 4 設計点確定済、フォーマット送付待ち）
- 対象: 採用 → 面接 → 内定 → 入社準備 → 入社初日 → 在職中 → 退職 の業務フロー全体
- 関連 memory:
  - `project_garden_change_request_pattern.md`（申請承認パターン）
  - `project_garden_login_office_only.md`（社内 PC 限定ログイン）
  - `feedback_quality_over_speed_priority.md`（品質最優先）
  - `project_chatwork_bot_ownership.md`（Bot 運用）
  - `project_kintone_tokens_storage.md`（Kintone トークン保存場所）

---

## 1. 背景と動機

### 現状の入社フロー（東海林さん整理）

1. オリエンテーション時にメールアドレスへ MFC（マネーフォワードクラウド契約）から **雇用契約書 / 秘密保持誓約書 / 緊急連絡先届** を送信、本人が同意
2. 公式 LINE 友だち追加 → Kintone 自分フォーム経由で **交通費 / 給与受取口座** を申告（フォーム × 2 回）
3. Kintone 従業員一覧に **手動登録**（事務 / 営業の作業）

### 問題点

| 観点 | 現状 |
|---|---|
| 入力ポイント数 | 4 つ（MFC + LINE + 自分フォーム × 2 + Kintone 手動） |
| データ整合性 | 手動転記でミス頻発 |
| セキュリティ | 個人スマホ × 公式 LINE で個人情報入力 |
| 営業負担 | 高（Kintone 手動登録） |
| 新人体験 | 何回も「次これ入力して」 |
| 待ち時間活用 | なし |

### 目指す姿

- **入社初日に Garden 1 画面で完結** = 一元化
- **社内 PC のみ入力** = セキュリティ強化（スマホ持込なし）
- **管理者 1 段ガード** = 申請承認パターン
- **入力中は社員紹介スライド** = 待ち時間活用 + 入社者の理解促進

---

## 2. 全体アーキテクチャ

### モジュール役割分担（確定）

```
🌱 Sprout（新芽 / 仮名）= 採用 → 面接 → 内定 → 入社準備
   ↓ 入社初日にデータ転記 ↓
🌳 Root（根）= 在職中の従業員マスタ + 退職処理
```

### Sprout モジュール新設、Root に退職フロー組込

- Sprout：応募者管理、面接管理、内定者情報、入社前データ収集
- Root：在職中の従業員マスタ、退職時 status 変更、MFC PDF アップロード + OCR

### Phase 配置（CLAUDE.md §18 に追加提案）

```
Phase A（経理総務自動化、現行）:
  Bud / Forest / Root

Phase B（事務業務効率化、🆕 Sprout 追加）:
  Leaf 関電 / Bud 給与処理 / 🆕 Sprout（採用→入社）

Phase C（補完モジュール）:
  Soil / Bloom / Rill / Seed / Leaf 他商材

Phase D（Tree 最終、最慎重）:
  Tree 架電アプリ
```

---

## 3. 確定した設計判断（4 点、2026-04-25 東海林さん）

### 判 1: 写真添付方式 = iPad + ガイド枠（Leaf 関電方式）

| 項目 | 設計 |
|---|---|
| 設置 | オリエン会議室に **iPad（Garden 専用、社内 Wi-Fi）** |
| 撮影 UI | ガイド枠付きカメラ（マイナンバーカード / 通帳 / 身分証の枠を画面に重ねる） |
| 撮影対象 | マイナンバー（本人確認）/ 通帳（給与口座）/ 身分証（本人確認） |
| 共通ライブラリ | a-leaf 完成後の `image-compression.ts` を `src/lib/image-capture/` に切り出し（Leaf / Sprout / Root から共通利用） |
| 認証 | iPad は社内 Wi-Fi 限定（Garden ログインも社内 PC 扱いで OK） |

実装：a-leaf の HEIC + Canvas + Worker ラッパを Garden 横断ライブラリに格上げ（Phase B のスコープ追加）

### 判 2: 全項目「申請承認パターン」採用

| 項目 | 設計 |
|---|---|
| 直接編集 | **全項目禁止**（マイページから直接更新不可） |
| 変更時 | 「変更申請」ボタン → モーダル入力 → 承認待ち → admin 承認後反映 |
| 例外 | UI 設定（並び順 / 通知 ON-OFF）/ パスワード変更（Tree Phase B-β B 経路） |
| 横断テーブル | `root_change_requests`（target_table / target_record_id / field_name / old/new_value / status） |
| 権限 | 本人=申請、manager=部下の一部承認、admin=全承認、super_admin=全件閲覧 |
| 設定可変化 | `root_settings` で項目別 min_role を可変設定（ハードコード禁止） |

→ memory `project_garden_change_request_pattern.md` 詳細

### 判 3: MFC（マネーフォワードクラウド契約）連携 = C 案

| 項目 | 設計 |
|---|---|
| 雇用契約書 / 秘密保持誓約書 / 緊急連絡先届 / 退職届 | **MFC で締結**（法的効力は MFC に依存、認定タイムスタンプ等は MFC 側で確保） |
| Garden 側 | 締結済 PDF をアップロード → OCR で必要情報（締結日 / 契約期間 / 同意項目）を自動抽出 |
| OCR 実装 | Forest 進行期 PDF と同じ手法（pdfjs-dist + 既存ロジック流用） |
| 連携テーブル | `root_employee_contracts`（雇用契約の状態管理、PDF Storage パス、OCR 結果） |
| 段階移行 | 当面 C 案、将来 50-100 名規模で B 案（Garden 内完結）再検討 |

### 判 4: 退職フロー = 入社の対称、Root に組込

| 項目 | 設計 |
|---|---|
| 退職届 | MFC で締結 → Garden アップロード（C 案） |
| 秘密保持誓約書 | MFC で再締結（入社時のものを更新） |
| Garden 側 | status = TERMINATING → termination_date 入力 → 書面アップロード → status = TERMINATED |
| データ削除ルール | 法令保存期間後（マイナンバー 7 年、給与情報 7 年）に自動削除 |
| 配置 | Root Phase B-3（退職者扱い）で詳細化、a-root が起草中（Phase B 全 spec） |

---

## 4. Sprout モジュール設計

### 4.1 テーブル設計（v0.1 案）

```sql
-- 応募者（バイトル / LINE / その他経路）
sprout_applicants (
  id uuid pk,
  source text check (source in ('baitoru', 'line_direct', 'referral', 'other')),
  source_id text,                       -- バイトル ID / LINE user ID
  applied_at timestamptz,
  full_name text, full_name_kana text,
  phone text, email text,
  status text check (status in ('applied', 'interview_scheduled', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn')),
  rejected_reason text,
  notes text,
  created_at, updated_at
);

-- 面接ヒアリングシート（Kintone じぶんフォーム後継）
sprout_interview_sheets (
  id uuid pk,
  applicant_id uuid references sprout_applicants(id),
  filled_at timestamptz,
  -- 項目は東海林さん送付の Kintone フォーマットに合わせて設計
  ...
);

-- 面接空枠（タイムツリー連携 or 営業手動入力）
sprout_interview_slots (
  id uuid pk,
  interviewer_user_id uuid,             -- 面接官（営業）
  start_at timestamptz, end_at timestamptz,
  is_booked boolean default false,
  source text check (source in ('timetree_sync', 'manual')),
  created_at
);

-- 面接予約レコード
sprout_interview_reservations (
  id uuid pk,
  applicant_id uuid,
  slot_id uuid references sprout_interview_slots(id),
  reserved_at timestamptz,
  status text check (status in ('confirmed', 'cancelled', 'no_show')),
  cancelled_reason text,
  created_at
);

-- 面接実施記録（面接中・後の記入）
sprout_interview_records (
  id uuid pk,
  reservation_id uuid,
  interviewer_user_id uuid,
  interview_date timestamptz,
  evaluation_score int,                 -- 5 段階等
  decision text check (decision in ('hire', 'pass', 'second_interview')),
  notes text,
  created_at
);

-- 内定情報
sprout_offers (
  id uuid pk,
  applicant_id uuid,
  offered_at timestamptz,
  scheduled_employment_date date,       -- 入社予定日
  proposed_salary numeric,
  garden_role_planned text,             -- 採用予定ロール
  notes text,
  status text check (status in ('offered', 'accepted', 'declined', 'on_hold'))
);

-- 入社前情報（オリエン前 or 入社初日に入力）
sprout_pre_employment_data (
  id uuid pk,
  offer_id uuid references sprout_offers(id),
  -- 個人情報
  birth_date date, postal_code text, address1 text, address2 text,
  -- 緊急連絡先
  emergency_contact_name text, emergency_contact_relation text, emergency_contact_phone text,
  -- 通勤
  commute_method text, commute_route text, monthly_commute_cost numeric,
  -- 給与受取口座
  bank_name text, branch_name text, account_type text, account_number text, account_holder_kana text,
  -- マイナンバー（pgcrypto 暗号化）
  my_number_encrypted bytea,
  my_number_card_image_path text,       -- Storage パス
  -- 通帳・身分証
  passbook_image_path text,
  id_document_image_path text,
  -- 履歴書（任意）
  resume_image_path text,
  -- 同意・確認
  privacy_consent_at timestamptz,
  data_input_completed_at timestamptz,
  -- 状態
  status text check (status in ('draft', 'submitted', 'reviewed', 'approved'))
);

-- LINE Bot 連携
sprout_line_users (
  id uuid pk,
  applicant_id uuid,
  line_user_id text unique,
  display_name text,
  added_at timestamptz,
  status text check (status in ('active', 'blocked', 'left'))
);

sprout_line_messages (
  id uuid pk,
  line_user_id text,
  direction text check (direction in ('incoming', 'outgoing', 'auto_reply')),
  message_type text,
  content text,
  sent_at timestamptz
);
```

### 4.2 RLS（行レベルセキュリティ）

- 応募者：本人のみ、トークン認証経由（ログインなし URL）
- 面接官（営業）：自分が担当する面接情報のみ
- admin：全件
- super_admin：全件 + 監査ログ

### 4.3 削除パターン

memory `project_delete_pattern_garden_wide.md` 準拠：
- 論理削除：全員（応募者本人 / 面接官）
- 物理削除：admin のみ
- 削除済バッジ：全員可視

---

## 5. 採用 → 入社フロー（推奨設計）

### 5.1 応募 → 面接予約まで（自動化）

```
1. バイトル応募 → Sprout に応募者登録
   - 自動: バイトル → Sprout 連携（API 連携可能性確認要）
   - 手動: 営業が手動転記（連携不可なら）

2. Sprout が応募者へ公式 LINE 友だち追加 URL を送信
   - 経路: メール / SMS（バイトル経由）

3. 応募者が公式 LINE 友だち追加 → LINE Bot が自動応答
   - 「ようこそ！面接予約はこちら → https://garden.tld/sprout/schedule/<applicant_token>」

4. 応募者が予約 URL をクリック（ログイン不要）
   - Sprout で空枠（営業のタイムツリー連携 or 手動入力）から選択
   - 仮予約 → 確認 → 確定

5. 予約確定後の自動通知
   - 応募者: LINE 自動 + SMS / メール（ヒアリングシート URL も同送）
   - 面接官（営業）: Chatwork / Garden 通知
   - Garden カレンダーに自動登録
```

### 5.2 面接 → 内定

```
1. 応募者が面接ヒアリングシート（Sprout の URL）に事前入力
2. 面接実施
   - 面接官は Sprout で応募者情報 + ヒアリング内容を見ながら面接
   - 面接中・後に評価 / 決定（hire / pass / second）を Sprout に記入
3. 内定の場合
   - sprout_offers に登録
   - 入社予定日設定
   - 仮 garden_role 設定（toss / closer / cs / staff のどれか）
```

### 5.3 入社準備（事前 or 当日）

```
1. 仮アカウント発行（Sprout → Root 仮転記）
   - root_employees に登録、status = 'pending', is_active = false
   - 社員番号付与
   - 仮パスワード発行

2. オリエンテーション会議室で社内 PC を渡される
   - 仮パスワードで初回ログイン → 本パスワード設定（Tree Phase B-β B 経路と同等）

3. 「ようこそ」スライド再生 + 入力ページへ誘導

4. Sprout 入力ページで以下を入力
   a. 個人情報（誕生日、住所等）
   b. 緊急連絡先
   c. 通勤情報（経路、交通費）
   d. 給与受取口座（iPad で通帳撮影）
   e. マイナンバー（iPad で MN カード撮影）
   f. 身分証（iPad で運転免許等撮影）
   g. 履歴書（任意、ファイルアップロード or 手入力）
   h. 同意項目チェック

5. 入力中は社員紹介スライド / 動画が並列表示
   - 入力速い子は会社理解、遅い子も焦らず

6. 入力完了 → admin 承認待ち

7. admin（東海林さん）承認
   - status = ACTIVE / is_active = true
   - MFC で雇用契約書 / 秘密保持誓約書 / 緊急連絡先届を送信
   - 本人 MFC で同意 → MFC 締結 → PDF 取得
   - PDF を Garden Sprout/Root に手動アップロード
   - OCR で締結情報を root_employee_contracts に自動反映

8. 入社初日完了 → Sprout から Root へ完全転記
   - sprout_pre_employment_data → root_employees + 各サブテーブル
   - 関連コミット記録（root_audit_log）
```

### 5.4 退職フロー（Root Phase B-3 で詳細化）

```
1. 退職意向表明（Garden 内 or 直接）
2. status = TERMINATING / termination_date 入力
3. MFC で退職届 + 秘密保持誓約書（再）を送信 → 本人同意
4. PDF を Garden アップロード + OCR 反映
5. 退職時データ整理
   - 給与受取口座: 最終給与の振込先確定
   - 緊急連絡先: 退職後保持 / 削除選択
   - マイナンバー: 法令保存期間（7 年）後に自動削除
6. 退職日経過 → status = TERMINATED / is_active = false
7. アカウント無効化、ログイン不可
```

---

## 6. LINE Bot 自動応答設計

### 6.1 LINE 2 アカウント運用（2026-04-26 確定）

東海林さんから提示の現状運用に合わせて、入社前 / 入社後で別アカウントを使い分け：

| 段階 | LINE アカウント名 | 用途 |
|---|---|---|
| 入社前（応募 → 内定） | **株式会社ヒュアラン_info** | 採用情報配信、面接予約、ヒアリングシート、入社案内 |
| 入社後（在職中） | **スタッフ連絡用_official** | スタッフ間業務連絡、給与明細通知（PW 保護 PDF 経路の補足）、退職案内 |

### 6.2 アカウント切替フロー

```
1. 応募者: ヒュアラン_info に友だち追加
2. 面接 → 内定 → 入社初日
3. 入社初日に Garden Sprout から自動で LINE 通知:
   「ようこそ！スタッフ連絡用_official に友だち追加お願いします → URL」
4. 応募者がスタッフ連絡用_official に追加
5. ヒュアラン_info はブロック / 友だち削除を依頼（任意、Sprout から促し）
6. 入社後の連絡は全て スタッフ連絡用_official 経由
```

### 6.3 Bot 機能（アカウント別）

#### ヒュアラン_info（入社前）

| 機能 | 内容 |
|---|---|
| 友だち追加時 | ウェルカム + 面接予約 URL 自動送信（ホットペッパー方式、§5.1） |
| 「面接予約」キーワード | 予約 URL 再送 |
| 「採用後」キーワード | スタッフ連絡用_official 案内 + 入社初日手順 |
| その他 | 採用担当者へ転送 |

#### スタッフ連絡用_official（入社後）

| 機能 | 内容 |
|---|---|
| 友だち追加時 | ウェルカム + Garden マイページ案内 |
| 給与日 | 給与明細配信完了通知（PDF 添付ではなくマイページ誘導 + メール経由 PW 保護 PDF 別送） |
| 「退職」キーワード | 退職フロー案内 |
| シフト確認 | カレンダー連携、staff 以上のみ |
| その他 | 業務担当者（営業 / 経理 / 総務）へ転送 |

### 6.4 技術選定

- **LINE Messaging API**（2 アカウント分のチャネルアクセストークン必要）
- Bot サーバ：Garden 内 API ルート（Next.js Server Actions）
- メッセージ履歴: `sprout_line_messages`（入社前）/ `root_line_messages`（入社後、または横断テーブル）
- 配信失敗時のリトライ：1h / 6h / 24h（A-07 採択ロジック踏襲）

### 6.5 環境変数（2 アカウント分）

```
LINE_CHANNEL_ACCESS_TOKEN_INFO=（ヒュアラン_info 用）
LINE_CHANNEL_SECRET_INFO=
LINE_CHANNEL_ACCESS_TOKEN_OFFICIAL=（スタッフ連絡用_official 用）
LINE_CHANNEL_SECRET_OFFICIAL=
```

→ Phase B 着手時に東海林さんから取得して `.env.local` 全 10 セッションに保存（Kintone トークンと同パターン）。

---

## 7. 既存システムからの移行戦略

### 7.1 Kintone → Garden Sprout 移行

| 元 | 移行先 |
|---|---|
| Kintone 求人 応募者一覧（App 44）| sprout_applicants |
| Kintone 求人 面接ヒアリングシート（App 45）| sprout_interview_sheets |

→ a-auto Batch 18 で詳細マッピング起草、PR #52 と同様の手法

### 7.2 既存従業員（40+ 名）の Garden 移行

選択肢：
- **A**：全員に「初回ログイン時に再入力」させる（手間多いが正確）
- **B**：Kintone / MFC からの一括インポート（API 連携、データ精度はソース依存）
- **C**：ハイブリッド（基本情報 B、本人確認系 A）

→ Phase A-2 完了後、Phase B 実装着手前に判断

---

## 8. 実装優先順位（推奨）

### Phase B-1: Sprout 基盤（採用→面接予約自動化）
- sprout_applicants / sprout_interview_slots / sprout_interview_reservations
- LINE Bot 自動応答（友だち追加 + 予約 URL 送信）
- 面接予約 UI（ログイン不要）

### Phase B-2: Sprout 中盤（面接ヒアリング → 内定）
- sprout_interview_sheets（Kintone 後継）
- sprout_interview_records（面接記録）
- sprout_offers（内定情報）

### Phase B-3: Sprout 終盤（入社前データ収集）
- sprout_pre_employment_data
- iPad ガイド枠カメラ実装（image-capture 共通ライブラリ）
- 仮アカウント発行 → 入社初日 → 本アカウント化

### Phase B-4: Root 退職フロー
- termination_date 連動 status 変更
- 退職届 / 秘密保持誓約書 アップロード + OCR
- 法令保存期間後の自動削除 cron

---

## 9. 判断保留・確認事項

### 9.1 東海林さんからの送付（2026-04-26 更新）

| # | 項目 | 状態 |
|---|---|---|
| 1 | 雇用契約書フォーマット | ✅ 受領済（リンクサポート 2026-04-20 ver.2、§14.1）|
| 2 | 秘密保持誓約書フォーマット | ✅ 受領済（リンクサポート 2026-04-01 ver.3、§14.2）|
| 3 | 緊急連絡先届フォーマット | ✅ 受領済（リンクサポート 2026-04-01 ver.1、§14.3）|
| 4 | 退職届フォーマット | ✅ 受領済（リンクサポート 2026-04-01 ver.1、§14.4）|
| 5 | Kintone じぶんフォーム（交通費 / 給与口座）構造 | ⏳ 待機（U1-U5 で総合判断）|

### 9.2 業務確認事項（2026-04-26 更新）

| # | 項目 | 状態 |
|---|---|---|
| 1 | バイトル API 連携可否 | ⏳ 確認待ち |
| 2 | タイムツリー API 連携可否 | ❌ **API 非対応確定**（2026-04-26）→ Garden 独自カレンダー（B 案）採用、§15 |
| 3 | 公式 LINE のアカウント種別 | ✅ **2 アカウント運用判明**（入社前: ヒュアラン_info / 入社後: スタッフ連絡用_official）、§6 |
| 4 | iPad 設置数 / 設置場所の現実性 | ⏳ 確認待ち（オリエン会議室前提で OK 確認済）|
| 5 | 既存従業員の Garden 移行戦略 | ⏳ Phase B 実装着手前に判断 |

### 9.3 設計判断保留（Phase B 実装着手前）

| # | 項目 | 案 |
|---|---|---|
| 1 | sprout_applicants と root_employees の分離 vs 統合 | 推奨：分離（応募中で消える人多数） |
| 2 | 面接ヒアリング項目構造 | Kintone App 45 の構造を移植 |
| 3 | 内定者の garden_role 仮設定範囲 | toss / closer / cs / staff のみ（admin 系は手動） |
| 4 | LINE Bot のメッセージ保管期間 | 法令準拠（個情法、3 年程度） |
| 5 | 履歴書任意 vs 必須 | 任意（東海林さん方針）、ただし総務として収集できる仕組み |

---

## 10. 改訂履歴

| 版 | 日付 | 主な変更 |
|---|---|---|
| v0.1 | 2026-04-25 | 初版起草（東海林さん 4 設計点確定 + Sprout モジュール新設提案）|
| v0.2 | 2026-04-26 | 4 PDF 受領反映 + LINE 2 アカウント反映 + タイムツリー API 非対応 → Garden カレンダー B 案 + Garden Fruit 実体化（法人マスタ）+ 6 法人 Kintone 取込 |

---

## 11. 関連ドキュメント

- memory `project_garden_change_request_pattern.md` — 申請承認パターン詳細
- memory `project_garden_login_office_only.md` — 社内 PC 限定ログイン
- memory `project_chatwork_bot_ownership.md` — Bot 運用ポリシー
- memory `project_kintone_tokens_storage.md` — Kintone トークン保存場所
- memory `project_garden_fruit_module.md` — Fruit モジュール実体化（法人法的実体）
- spec `docs/specs/2026-04-25-kintone-kanden-integration-analysis.md` — Kintone マッピング分析（PR #52）
- CLAUDE.md §18 Garden 構築優先順位 — Phase B に Sprout + Fruit 追加を反映予定

---

## 12. 次のアクション

| # | 担当 | アクション |
|---|---|---|
| 1 | 東海林さん | 4 フォーマット送付 ✅（受領済、§14） |
| 2 | 東海林さん | バイトル / LINE API 連携可否確認（タイムツリーは非対応確定） |
| 3 | a-main | v0.2 改訂完了 ✅、a-auto Batch 18 投下準備 |
| 4 | a-auto Batch 18 | Sprout + Fruit + Garden カレンダー spec 一括起草 |
| 5 | a-main | CLAUDE.md §18 を更新（Phase B に Sprout + Fruit 追加） |
| 6 | a-bud / a-root / a-bloom | Phase B 実装時の連携ポイント確認 |

---

## 13. Garden Fruit 連携（v0.2 新規）

Garden Fruit（法人法的実体情報モジュール、memory `project_garden_fruit_module.md` 参照）を Sprout から参照する設計。

### 13.1 Sprout が Fruit を参照する局面

| Sprout 局面 | Fruit から取得する情報 |
|---|---|
| 雇用契約書テンプレ生成 | 法人名 / 法人名カナ / 代表者名 / 代表者名カナ / 会社住所 / 法人電話番号 |
| 秘密保持誓約書テンプレ生成 | 法人名 / 代表者名 |
| 退職届テンプレ生成 | 法人名 / 代表者名 |
| 緊急連絡先届テンプレ生成 | 法人名 / 代表者名 |
| 給与明細生成（D-04 連携） | 法人番号 / インボイス登録番号 |
| 銀行振込連携（A-04 連携） | 法人金融機関情報（取引銀行） |
| 採用 → 内定（sprout_offers）| 採用予定法人の company_id 紐付 |

### 13.2 6 法人マスタ取込フロー（Phase B）

```
1. Kintone 法人名簿（App 28、61 フィールド）から admin が 6 法人レコード一括取込
2. Fruit テーブル群へマッピング（fruit_companies_legal / _representatives / _documents 等）
3. Sprout / Bud / Forest / Root から Fruit を参照
4. 以降の更新は Kintone を引き続き master、Garden Fruit が同期 or 切替（Phase C 判断）
```

### 13.3 法人選択 UI（Sprout 内）

```
[内定情報入力]
配属法人: ▼[法人選択]
  → クリックで法人ドロップダウン
  → Fruit から fruit_companies_legal を取得
  → 6 法人をリスト表示
  → 選択した company_id を sprout_offers / sprout_pre_employment_data に保存
  → 雇用契約書テンプレ生成時に Fruit から動的取得
```

---

## 14. PDF フォーマット 4 件のフィールド構造（v0.2 新規、東海林さん受領済）

ベースは「株式会社リンクサポート」名義。**6 法人対応のため、社名 / 代表者名 / 住所 / 法人番号 / インボイス番号 等は Fruit から動的取得**。

### 14.1 雇用契約書（兼 労働条件通知書、ver.2 / 2026-04-20）

#### Fruit から取得（テンプレ動的部分）
- 法人名 / 法人名カナ
- 代表取締役名
- 本社住所 + 郵便番号
- 法人電話番号
- 法人番号

#### 本人入力（Sprout sprout_pre_employment_data）
- 通知日及び締結日（自動設定 = 入社日）
- 住所
- 署名（電子署名 or MFC）

#### 雇用条件（spec 固定 / 業務マスタから）
- 契約期間（開始 / 終了）
- 試用期間（最初の 14 日）
- 就業場所（spec デフォ：本社 or 「甲が指定する場所」）
- 従事すべき業務：□ 営業職 / □ 事務職 / □ 技術職 / □ その他
- シフト：A（14:00-21:00 / 休憩 45 分）/ B（9:00-21:00 / 休憩 60 分 + 13:00-14:00 昼休）/ C（9:00-17:00 / 休憩 45 分）
- 基本賃金：時給 [   ] 円（最低賃金準拠）
- 営業達成手当（クルー人事制度）
- 入社時特別保障：累計 120 時間まで時給 1,500 円
- 通勤交通費：1日500円 or 月額20,000円（少額側適用）
- 賞与・退職金：なし

### 14.2 秘密保持誓約書（ver.3 / 2026-04-01）

#### Fruit から取得
- 法人名 / 代表取締役名

#### 本人入力
- □新規 / □再提出 のチェック（入社時=新規、退職時=再提出）
- 誓約日（自動設定）
- 住所
- 署名

#### 全文同意項目（spec 固定）
- 第 1 条：秘密情報の定義（6 項目）
- 第 2 条：秘密情報の帰属
- 第 3 条：秘密保持義務
- 第 4 条：秘密情報の返還・消去義務
- 第 5 条：退職後の競業避止義務（**退職日から 6 ヶ月**）
- 第 6 条：損害賠償

### 14.3 緊急連絡先届（ver.1 / 2026-04-01）

#### Fruit から取得
- 法人名 / 代表取締役名

#### 本人入力
- □新規 / □変更 のチェック
- 提出日
- 提出者本人：氏名 / 現住所 / 個人の電話番号
- 緊急連絡先：氏名 / 本人との続柄 / 住所（同上 OK）/ 電話番号
- 署名

### 14.4 退職届（ver.1 / 2026-04-01）

#### Fruit から取得
- 法人名 / 代表取締役名

#### 本人入力
- 退職日（*日付*）
- 提出日
- 住所
- 署名

#### 確認事項（spec 固定、3 項目）
1. 秘密保持の再確認（再提出済か）
2. 私物管理の徹底
3. 貸与品の返還

---

## 15. Garden カレンダー（v0.2 新規）

### 15.1 背景

タイムツリー API が非対応のため、面接予約自動化 + シフト管理 + 営業予定管理を Garden 独自で実装。CLAUDE.md §18 Phase B / C で実装、Sprout から面接予約として参照。

### 15.2 設計概要

```
🆕 Garden カレンダー（既存 Sprout / Bloom / Tree から共通利用）
  ├─ 営業予定（タイムツリーから移行 or リリース時から Garden 専用）
  ├─ 面接スロット（Sprout sprout_interview_slots と連動）
  ├─ シフト（Tree 連携、コール現場のシフト）
  └─ 個人予定（任意、staff 以上のみ）
```

### 15.3 配置の選択（v0.2 段階で保留、a-auto Batch 18 で詳細化）

| 案 | 内容 | 推奨度 |
|---|---|---|
| **A** | Garden カレンダーを **新モジュール（独立）** として構築 | 🥇 推奨：横断利用が多いため独立 |
| B | Bloom 内のサブモジュールとして統合（Bloom 進捗 UI と一体化） | 🥈 Bloom と密結合する場合 |
| C | Sprout 内に閉じた面接予約のみ実装（他は対象外） | 🥉 最小スコープ、将来拡張 |

### 15.4 アクセス権限

- **閲覧権限**: **staff 以上**（toss / closer / cs は不可、現場アルバイト系は不要）
- **入力権限**: 同様に staff 以上
- **管理権限**: admin（全予定編集、シフト一括設定）

### 15.5 スマホ対応（社内 PC 限定の例外）

通常ロール（toss / closer / cs / staff）は社内 PC ログイン限定だが、**カレンダー閲覧は出先・自宅でも見たいケースがある**。設計案：

| 案 | 内容 | 推奨度 |
|---|---|---|
| **A** | staff 以上はスマホ閲覧 OK（既存「社内 PC 限定」の例外設定）| 🥇 推奨：閲覧用の専用権限 |
| B | カレンダー専用の限定 URL + 一時トークンで閲覧（ログイン不要）| 中庸 |
| C | 全員社内 PC のみ（変更なし） | 不便すぎる |

→ **A 案推奨**：staff 以上はスマホからカレンダー閲覧 OK、入力は社内 PC のみ（or staff 以上はスマホ入力も OK、admin 判断）。memory `project_garden_login_office_only.md` の補正必要。

### 15.6 テーブル骨格（v0.2 段階）

```sql
calendar_events (
  id uuid pk,
  event_type text check (event_type in ('interview', 'shift', 'sales_meeting', 'personal', 'other')),
  title text,
  start_at timestamptz,
  end_at timestamptz,
  owner_user_id uuid,           -- 主催者
  attendee_user_ids uuid[],     -- 参加者
  location text,
  notes text,
  status text check (status in ('confirmed', 'tentative', 'cancelled')),
  visibility text check (visibility in ('public', 'private', 'restricted')),
  created_at, updated_at
);

calendar_event_links (
  id uuid pk,
  event_id uuid references calendar_events(id),
  source text check (source in ('sprout', 'tree', 'bud', 'manual')),
  source_id text,               -- 連携元レコードの ID
  ...
);
```

→ a-auto Batch 18 で詳細起草。

---

## 16. 関連 PR / ブランチ（v0.2 新規セクション）

| 状態 | PR / ブランチ | 内容 |
|---|---|---|
| OPEN | PR #76 | 本 spec v0.1 → v0.2 改訂 |
| 起草予定 | a-auto Batch 18 | Sprout + Fruit + Garden カレンダー spec 一括起草 |
| 受領済 | 4 PDF (G:\マイドライブ\01_経理部\) | 雇用契約書 / 秘密保持 / 退職届 / 緊急連絡先届 |
| 既存 | Kintone App 44 / 45 / 28 | 応募者一覧 / 面接ヒアリング / 法人名簿 |
| 既存 memory | `project_garden_fruit_module.md` | Fruit 実体化 |

---

— Garden Sprout（仮）+ オンボーディング再設計 v0.2、東海林さん 4 設計点確定 + 4 PDF 受領 + LINE 2 アカウント + タイムツリー API 非対応 + Fruit 実体化 + 6 法人 Kintone 取込 反映済 —
