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

### 6.1 必要な機能

| 機能 | 内容 |
|---|---|
| 友だち追加時 | ウェルカムメッセージ + 面接予約 URL 自動送信 |
| 「面接予約」キーワード | 予約 URL を再送 |
| 「採用後」 | Garden アカウント案内 + 初回ログイン手順 |
| 「退職」 | 退職フロー案内 |
| その他 | 営業へ転送（手動対応） |

### 6.2 技術選定

- LINE Messaging API（既存公式 LINE で運用可能性確認要）
- Bot サーバ：Garden 内 API ルート（Next.js Server Actions）
- メッセージ履歴：sprout_line_messages テーブル

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

### 9.1 東海林さんからの送付待ち

| # | 項目 | 用途 |
|---|---|---|
| 1 | 雇用契約書フォーマット | 入社時同意項目の精緻化 |
| 2 | 秘密保持誓約書フォーマット | 何を秘匿させるか確認 |
| 3 | 緊急連絡先届フォーマット | 項目数 / 関係性記入の必要性 |
| 4 | 退職届フォーマット | 退職理由必須？引継項目？ |
| 5 | Kintone じぶんフォーム（交通費 / 給与口座）構造 | sprout_pre_employment_data 設計の参考 |

### 9.2 業務確認事項

| # | 項目 | 確認したい |
|---|---|---|
| 1 | バイトル API 連携可否 | Sprout 自動取込が可能か |
| 2 | タイムツリー API 連携可否 | 営業の予定空枠抽出が可能か |
| 3 | 公式 LINE のアカウント種別 | LINE Messaging API 利用可能なプランか |
| 4 | iPad 設置数 / 設置場所の現実性 | オリエン会議室前提で OK か |
| 5 | 既存従業員の Garden 移行戦略 | A / B / C のどれか |

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

---

## 11. 関連ドキュメント

- memory `project_garden_change_request_pattern.md` — 申請承認パターン詳細
- memory `project_garden_login_office_only.md` — 社内 PC 限定ログイン
- memory `project_chatwork_bot_ownership.md` — Bot 運用ポリシー
- memory `project_kintone_tokens_storage.md` — Kintone トークン保存場所
- spec `docs/specs/2026-04-25-kintone-kanden-integration-analysis.md` — Kintone マッピング分析（PR #52）
- CLAUDE.md §18 Garden 構築優先順位 — Phase B に Sprout 追加を反映予定

---

## 12. 次のアクション

| # | 担当 | アクション |
|---|---|---|
| 1 | 東海林さん | 4 フォーマット送付（§9.1） |
| 2 | 東海林さん | バイトル / タイムツリー / LINE API 連携可否確認（§9.2） |
| 3 | a-main | フォーマット受領後に v0.2 改訂 |
| 4 | a-auto Batch 18 | Sprout 全 spec 起草（v0.2 ベースで詳細化） |
| 5 | a-main | CLAUDE.md §18 を更新（Phase B に Sprout 追加） |
| 6 | a-bud / a-root / a-bloom | Phase B 実装時の連携ポイント確認 |

---

— Garden Sprout（仮）+ オンボーディング再設計 v0.1 草稿、東海林さん 4 設計点確定済 —
