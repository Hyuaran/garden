# Sprout S-07: 仮アカウント発行 → 入社初日 → 本アカウント化フロー

- 対象: 内定 → 入社初日 までの一連のアカウント発行と Root への転記、雇用契約書 MFC 締結 + PDF アップロード OCR 自動反映
- 優先度: 🔴
- 見積: **1.75d**（0.25d 刻み）
- 担当セッション: a-sprout / a-root（root_employees / auth）/ a-rill（LINE 切替）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Sprout S-07）
- 前提:
  - **Sprout v0.2 spec**（PR #76 merge 済、§3 確定設計判断準拠）
  - 関連 spec: S-01（offers / pre_employment_data）、S-04（採用判定）、S-05（LINE 切替）、S-06（入社前データ）
  - **MFC 方式**: C 案 = 雇用契約書を MFC で締結 → PDF アップロード → OCR で sprout_pre_employment_data の対応列を自動反映
  - PDF テンプレ 4 件（雇用契約書 / 秘密保持誓約書 / 退職届 / 緊急連絡先届、ver.1〜3）

---

## 1. 目的とスコープ

### 1.1 目的

採用 → 入社初日 → 本格稼働までの「アカウント発行と書類締結」を 1 つの統合フローで自動化する。仮アカウントで入社前手続きを進め、入社初日に本アカウント発行 + Root への転記を実施し、書類締結は MFC ツール + PDF アップロードで完結する。

### 1.2 含めるもの

- 仮アカウント発行（applicant_id ベース、Sprout 内のみ有効）
- 雇用契約書 / 秘密保持誓約書 等の MFC 締結（外部ツール）
- PDF アップロード → OCR → sprout_pre_employment_data 自動反映
- 入社初日の本アカウント発行（Supabase Auth + root_employees INSERT）
- sprout_pre_employment_data → root_employees 転記
- LINE info → official 切替トリガ
- 入社初日チェックリスト admin UI

### 1.3 含めないもの

- MFC ツール本体の構築（外部ツール利用）
- 退職フロー（Phase B-3、対称設計予定）
- 給与計算（Bud）
- 社会保険手続き（別 spec）

---

## 2. 設計方針 / 前提

- **二段階アカウント**: 仮 (Sprout 内) → 本 (Root + Supabase Auth)
- **書類**: PDF テンプレ 4 種を法人 / 雇用形態別に保持
- **OCR**: 既存 Forest PDF 解析資産流用想定（pdfjs-dist + Tesseract.js）
- **転記**: 暗号化列はそのまま（鍵は同一 Vault）
- **冪等性**: 入社初日処理は同一日内で再実行可能
- **監査ログ**: 転記 / アカウント発行は audit_logs テーブルに記録

---

## 3. PDF テンプレ仕様

### 3.1 テンプレ一覧

| # | テンプレ名 | 用途 | 法令準拠 | バージョン |
|---|---|---|---|---|
| 1 | 雇用契約書 | 採用時 | 労基法 第15条 | ver.1〜3 |
| 2 | 秘密保持誓約書 | 採用時 | 不正競争防止法 | ver.1〜3 |
| 3 | 退職届 | 退職時（Phase B-3） | 労基法 | ver.1〜3 |
| 4 | 緊急連絡先届 | 採用時 | 安全管理上の必要 | ver.1〜3 |

### 3.2 法人別差替

- 6 法人ごとに会社名 / 代表者名 / 本社住所を差替
- fruit_companies_legal から取得して PDF 生成時に埋め込み

### 3.3 雇用形態別差替

- regular / contract / part_time / dispatch
- 試用期間 / 給与体系 / 残業条項 を切替

---

## 4. MFC（C 案）フロー

### 4.1 全体像

```
[admin が PDF テンプレ選択]
   ↓
[fruit_companies_legal + sprout_offers から差込]
   ↓
[PDF 生成 → ダウンロード]
   ↓
[MFC ツールで電子署名締結]
   ↓
[締結済 PDF を Sprout admin UI からアップロード]
   ↓
[OCR 実行 → 認識結果プレビュー]
   ↓
[admin 確認 → sprout_pre_employment_data へ反映]
```

### 4.2 OCR 反映対象

- 氏名
- 住所
- 生年月日
- 入社日
- 雇用形態
- 給与
- 緊急連絡先

OCR 信頼度 < 0.85 は admin に手動確認を要求。

### 4.3 OCR 実装

- 既存 Forest PDF 解析資産（pdfjs-dist + Tesseract.js）を流用想定
- 既存 npm パッケージ範囲内、新規追加なし
- 雇用契約書テンプレは固定座標で OCR 領域を指定（テンプレ駆動）

---

## 5. 仮アカウント仕様

### 5.1 発行タイミング

- S-04 で内定確定（offers.status='accepted'）

### 5.2 仮アカウント機能

- Sprout 内の S-06 入社前データ収集 UI のみアクセス可
- ログインは applicant_token（30 日有効）
- Garden 他モジュールへのアクセス不可

### 5.3 識別子

- pre_employment_data.id がキー
- root_employees にはまだ存在しない

---

## 6. 本アカウント発行フロー（入社初日）

### 6.1 起動条件

- 入社初日（offers.start_date）の朝 8:00 に Cron 起動
- pre_employment_data.collection_status='complete'
- 全 17 項目承認済（S-06 準拠）
- 雇用契約書 PDF 締結済

### 6.2 発行手順

1. Supabase Auth に user 作成（メール = pre_employment_data.email）
2. 初期パスワード（一時、初回ログインで強制変更）発行
3. root_employees INSERT
   - `auth_user_id` = 新規 user.id
   - `legal_entity_id` = pre_employment_data.legal_entity_id
   - `family_name / given_name / kana / birthday / gender` 等を転記
   - 暗号化列（住所 / 緊急連絡先電話）はそのまま BYTEA を移行
   - `role` = offers.position を employee_role mapping に従い決定（toss/closer/cs/staff）
   - `joined_at` = offers.start_date
4. pre_employment_data.collection_status='transferred_to_root'
5. LINE info → official 切替案内ジョブ enqueue（S-05）
6. 監査ログ記録
7. 初期パスワードを LINE official + 紙で本人に渡す

### 6.3 ロールバック

- 失敗時は Supabase Auth user 削除 + root_employees ロールバック
- 監査ログに失敗記録

---

## 7. 入社初日チェックリスト admin UI

### 7.1 表示項目

| # | 項目 | 確認者 |
|---|---|---|
| 1 | 雇用契約書締結済 | admin |
| 2 | 秘密保持誓約書締結済 | admin |
| 3 | 緊急連絡先届提出済 | admin |
| 4 | 17 項目すべて承認済 | admin |
| 5 | 銀行口座 OCR 反映済 | admin |
| 6 | 本アカウント発行済 | system |
| 7 | LINE 切替案内送付済 | system |
| 8 | 初期パスワード受渡し済 | admin |

### 7.2 完了ボタン

- 全 8 項目完了で「入社処理完了」ボタン active
- 押下で sprout_offers.status='hired' + Bud 連携通知

---

## 8. データ転記マッピング

| Sprout 列 | Root 列 |
|---|---|
| family_name / given_name | family_name / given_name |
| family_name_kana / given_name_kana | family_name_kana / given_name_kana |
| birthday | birthday |
| gender | gender |
| home_address_encrypted | home_address_encrypted |
| phone | mobile_phone |
| email | email |
| emergency_contact_name / relation | emergency_contact_name / relation |
| emergency_contact_phone_encrypted | emergency_contact_phone_encrypted |
| bank_name / branch / account_holder_kana | bank_name / branch / account_holder_kana |
| bank_account_encrypted | bank_account_encrypted |
| my_number_encrypted | my_number_encrypted（Root に列追加要） |
| - | role（offers.position から決定） |
| - | joined_at（offers.start_date） |
| - | legal_entity_id（offers.legal_entity_id） |

---

## 9. 法令対応チェックリスト

- [ ] **労働基準法 第15条**: 労働条件明示（雇用契約書で書面交付）
- [ ] **労働基準法 第24条**: 賃金支払い（口座情報の確実な収集）
- [ ] **労働基準法 第109条**: 労働者名簿 3 年保存
- [ ] **個人情報保護法 第20条**: 安全管理措置（暗号化転記）
- [ ] **マイナンバー法 第19条**: 提供制限（Sprout → Root のみ、目的内）
- [ ] **不正競争防止法**: 秘密保持誓約書の書面化
- [ ] **電子帳簿保存法**: 締結済 PDF の保管 7 年（電帳法対応 Storage）

---

## 10. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | PDF テンプレ 4 種作成 + 法人差替ロジック | a-sprout / 東海林さん | 0.25d |
| 2 | MFC アップロード UI + OCR 実行 | a-sprout | 0.50d |
| 3 | 仮アカウント発行ロジック | a-sprout | 0.25d |
| 4 | 本アカウント発行 + Root 転記 | a-sprout / a-root | 0.50d |
| 5 | 入社初日チェックリスト admin UI | a-sprout | 0.25d |
| 6 | LINE 切替トリガ連携 | a-sprout / a-rill | 0.25d |

合計: 2.00d 想定（重ね合わせで 1.75d 見積）

---

## 11. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | 初期パスワードの渡し方（LINE only / 紙 only / 両方） | 両方案、紙は admin が同席で渡す |
| 2 | OCR 信頼度しきい値 | 0.85 案、運用調整 |
| 3 | MFC ツール選定（DocuSign / クラウドサイン / 自前） | クラウドサイン or 既存契約案、東海林さん確認 |
| 4 | 雇用形態 → role の自動マッピング表 | 暫定マッピング案を提示、責任者確認 |
| 5 | 入社初日朝 8:00 の Cron 時刻 | 8:00 案、現場運用次第 |
| 6 | 本アカウント発行失敗時の通知先 | admin + 東海林さん案 |
| 7 | Root への my_number 列追加要否 | 追加案を Root 側に提案 |
| 8 | PDF 締結済の保管期間 | 電帳法 7 年案 |
| 9 | 試用期間中の解雇時の処理（Phase B-3 退職フローと統合） | 退職フローで対称設計予定、当面は admin 手動 |

---

## 12. 既知のリスクと対策

- **リスク**: OCR 誤認識による誤転記
  - **対策**: 信頼度 0.85 未満は手動確認、admin プレビュー必須
- **リスク**: 本アカウント発行のタイミング誤り
  - **対策**: 起動条件を厳格に複数チェック、ロールバック設計
- **リスク**: PDF テンプレのバージョンずれ
  - **対策**: contract_template_id で履歴管理、最新版自動選択
- **リスク**: マイナンバー転記時の鍵不一致
  - **対策**: Sprout / Root で同一 Vault キー使用、移行時のキー再暗号化は不要

---

## 13. 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md`（§3 / §14 / §15）
- `docs/specs/2026-04-26-sprout-S-01-migrations.md`
- `docs/specs/2026-04-26-sprout-S-04-interview-sheets.md`
- `docs/specs/2026-04-26-sprout-S-05-line-bot.md`
- `docs/specs/2026-04-26-sprout-S-06-pre-employment-ui.md`
- Forest PDF 解析資産: `src/app/forest/...`（既存）
- Root: root_employees スキーマ（既存）

---

## 14. 受入基準（Definition of Done）

- [ ] PDF テンプレ 4 種が法人差替で生成される
- [ ] MFC アップロード後、OCR が動作し信頼度別に表示される
- [ ] 仮アカウント → 本アカウント発行が冪等に動作する
- [ ] sprout_pre_employment_data → root_employees の転記が完了する（暗号化保持）
- [ ] LINE info → official 切替案内が自動送信される
- [ ] 入社初日チェックリストが正常に動作する
- [ ] 監査ログが全段階で記録される
- [ ] 法令対応チェックリスト 7 項目レビュー済
- [ ] §後述 Kintone 確定 #4 Root 移管インターフェース DoD 全項目

---

## Kintone 確定反映: 決定 #4 配属・異動 採用前 Sprout / 採用後 Root

> **改訂背景**: a-main 006 確定ログ #4 を反映。App 45 サブテーブル「配属・異動」運用 = **採用前 = Sprout / 採用後 = Root** の境界線を明確化。本セクションで **Sprout → Root 移管インターフェース** を定義。

### 配属の境界線

| 段階 | 配属管理者 | 関連列 / テーブル |
|---|---|---|
| 採用前（応募 〜 内定）| **Sprout** | sprout_applicants.preferred_* / tentative_assignment_* （S-01 §14.1）|
| 入社初日（転記時）| Sprout → Root | 本セクションで定義 |
| 採用後（在籍中の異動）| **Root** | root_employee_assignments（a-root 担当）|
| 退職時 | Root | a-root 担当 |

### 入社初日の Sprout → Root 移管フロー

```
[Sprout: pre_employment タブ完了]
  ↓ admin が「入社確定」ボタン押下（または当日 0:00 自動 by S-01 §13.3 Cron）
[Server Action] sprout-to-root migration
  ↓ Trx 内で実行
[1] sprout_applicants → root_employees 転記（既存仕様）
[2] sprout_applicants.tentative_assignment_* → root_employee_assignments 転記
[3] sprout_applicants.current_tab = 'archived' に遷移
[4] sprout_applicants.status = 'employed'
[5] root_employees.is_active = true
  ↓
[完了] Sprout 側は archived（履歴のみ）/ Root 側が master
```

### 移管 Server Action 詳細

```typescript
// src/lib/sprout/account-issuance.ts
'use server';

export async function migrateSproutToRoot(applicantId: string, options: {
  scheduled_employment_date: string;
  performed_by: string;  // admin の auth.uid()
}): Promise<MigrationResult> {
  return await supabase.rpc('sprout_to_root_migration', {
    p_applicant_id: applicantId,
    p_employment_date: options.scheduled_employment_date,
    p_performed_by: options.performed_by,
  });
}
```

```sql
-- DB 関数（SECURITY DEFINER、Trx 内で実行）
CREATE OR REPLACE FUNCTION sprout_to_root_migration(
  p_applicant_id uuid,
  p_employment_date date,
  p_performed_by uuid
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_applicant sprout_applicants%ROWTYPE;
  v_new_employee_id uuid;
BEGIN
  -- 権限確認
  IF NOT current_garden_role() IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admin can migrate Sprout to Root'
      USING ERRCODE = '42501';
  END IF;

  -- 対象応募者取得
  SELECT * INTO v_applicant FROM sprout_applicants WHERE id = p_applicant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Applicant not found: %', p_applicant_id USING ERRCODE = '22023';
  END IF;

  -- pre_employment タブ完了チェック
  IF v_applicant.current_tab != 'pre_employment' THEN
    RAISE EXCEPTION 'Applicant not in pre_employment tab: current=%', v_applicant.current_tab
      USING ERRCODE = '22023';
  END IF;

  -- 1. root_employees へ転記
  INSERT INTO root_employees (
    name_kanji, name_kana, birthdate, gender,
    email, phone_primary,
    employment_type, hire_date,
    is_active, source_module, source_record_id
  ) VALUES (
    v_applicant.name_kanji, v_applicant.name_kana, v_applicant.birthdate, v_applicant.gender,
    v_applicant.email, v_applicant.phone_primary,
    'full_time', p_employment_date,
    true, 'sprout', p_applicant_id::text
  ) RETURNING id INTO v_new_employee_id;

  -- 2. root_employee_assignments へ配属転記（a-root テーブル前提）
  IF v_applicant.tentative_assignment_company_id IS NOT NULL THEN
    INSERT INTO root_employee_assignments (
      employee_id, company_id, department, position,
      effective_from, source_type, source_id
    ) VALUES (
      v_new_employee_id,
      v_applicant.tentative_assignment_company_id,
      v_applicant.tentative_assignment_department,
      v_applicant.tentative_assignment_position,
      p_employment_date,
      'sprout',
      p_applicant_id::text
    );
  END IF;

  -- 3. sprout_applicants 状態更新
  UPDATE sprout_applicants SET
    current_tab = 'archived',
    status = 'employed',
    tab_changed_at = now(),
    tab_changed_by = p_performed_by,
    updated_at = now()
  WHERE id = p_applicant_id;

  -- 4. tab_changes ログ
  INSERT INTO sprout_applicant_tab_changes (
    applicant_id, from_tab, to_tab, changed_by, reason
  ) VALUES (
    p_applicant_id, 'pre_employment', 'archived', p_performed_by, 'sprout_to_root_migration'
  );

  -- 5. 監査ログ
  INSERT INTO operation_logs (
    user_id, module, action, target_type, target_id, details
  ) VALUES (
    p_performed_by, 'sprout', 'migrate_to_root', 'sprout_applicants', p_applicant_id::text,
    jsonb_build_object(
      'new_employee_id', v_new_employee_id,
      'employment_date', p_employment_date,
      'company_id', v_applicant.tentative_assignment_company_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'new_employee_id', v_new_employee_id,
    'applicant_id', p_applicant_id
  );
END $$;

REVOKE ALL ON FUNCTION sprout_to_root_migration(uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sprout_to_root_migration(uuid, date, uuid) TO authenticated;
```

### 採用後の異動（Root 領域）

入社後の部署異動 / 役職変更 / 関連法人変更は **Root 担当**:

- a-root 側で `root_employee_assignments` 履歴管理（effective_from / effective_to）
- a-auto / Sprout は介入しない
- ただし Sprout 側の `sprout_applicants.tentative_*` は**履歴として保持**

### 整合性検証

- 入社後に Sprout 側の `tentative_assignment_*` を変更しない（変更不可制約）
- 月次 Cron で双方向整合検証:

```sql
SELECT s.id, s.name_kanji, e.id AS root_employee_id
FROM sprout_applicants s
LEFT JOIN root_employees e
  ON e.source_module = 'sprout' AND e.source_record_id = s.id::text
WHERE s.status = 'employed'
  AND e.id IS NULL;  -- Sprout 側 employed だが Root 未転記の異常
```

### 判断保留事項追加

| # | 論点 | a-auto スタンス |
|---|---|---|
| Mig-1 | 入社確定ボタン vs 自動移管 | **手動 + 自動の両方**（admin 押下 / 入社日 0:00 Cron）|
| Mig-2 | 移管失敗時のロールバック | Trx で all-or-nothing、失敗時は Sprout 状態を pre_employment に戻す |
| Mig-3 | 再雇用時の扱い | 別 root_employees レコード作成、過去履歴は source_record_id で逆引き |
| Mig-4 | Sprout 側 archived データの保管期間 | 7 年（労基法 109 条準拠、Cross Ops #05 連動）|

### DoD 追加

- [ ] sprout_to_root_migration() DB 関数実装、SECURITY DEFINER + search_path 固定
- [ ] admin の「入社確定」ボタン動作（手動移管）
- [ ] 入社日 0:00 Cron で自動移管動作
- [ ] root_employees / root_employee_assignments への正確な転記
- [ ] 監査ログ + tab_changes ログで全段階追跡可能
- [ ] 月次整合性検証 Cron で漏れ検出
- [ ] 再雇用時の正しい挙動を dev で検証
