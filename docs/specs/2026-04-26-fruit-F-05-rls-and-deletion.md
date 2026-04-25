# Fruit F-05: RLS 設計 + 削除パターン（Cross History #04 準拠）

- 対象: Fruit 8 テーブルの Row Level Security 設計、論理削除/物理削除の運用パターン
- 優先度: 🔴
- 見積: **1.00d**
- 担当セッション: a-fruit（実装）/ a-root（連携）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Fruit F-05）
- 前提:
  - **F-01**（Migration）/ **F-02**（マッピング）/ **F-03**（取込）/ **F-04**（セレクター）
  - **Cross History #04** 削除パターン統一規格（論理削除全員 / 物理削除 admin のみ）
  - **Sprout v0.2 spec §13**（Fruit 連携）
  - 既存の Root RLS パターン（feature/root-rls-phase-a 等）

---

## 1. 目的とスコープ

### 1.1 目的
Fruit 8 テーブルに対し、**閲覧は staff 以上 / 書込は admin・super_admin のみ**という権限境界を RLS で確実に施行し、機微情報（代表者生年月日 / 口座番号 / 機微許認可番号）の漏洩を防ぐ。同時に、Cross History #04 に準拠した削除パターン（論理削除全員 / 物理削除 admin のみ）を運用ルールと SQL ポリシーとして定義する。

### 1.2 含めるもの
- 8 テーブルの RLS ポリシー定義（select / insert / update / delete）
- ロール別アクセス境界マトリクス（toss / closer / cs / staff / manager / admin / super_admin）
- 暗号化列（_enc）の閲覧時マスキング設計
- 削除パターン詳細（論理削除フロー / 物理削除フロー / 復元フロー）
- 監査ログ（fruit_audit_log テーブル）
- 削除前のチェック（子レコード存在 / 参照整合性）
- 復元 UI の権限境界

### 1.3 含めないもの
- ロール定義そのもの（→ Root の auth_roles テーブル既存）
- フロントの権限制御（→ F-04、本 spec は DB 側）
- 暗号化キー管理（→ F-03、Supabase Vault）

---

## 2. 設計方針 / 前提

- **デフォルト deny**: 全テーブル ENABLE ROW LEVEL SECURITY、明示許可ポリシーのみで動作
- **JWT クレーム**: `auth.jwt() ->> 'role'` で 7 段階ロール判定、`auth.uid()` で個人識別
- **公平な閲覧**: 法人マスタは Garden 全社員が参照する性質 → staff 以上に等しく閲覧権限
- **書込最小化**: 取込（F-03）以外の手動編集は admin / super_admin のみ
- **論理削除**: deleted_at = now()、Cross History #04 §3.1 に準拠
- **物理削除**: admin / super_admin のみ、子レコードの完全クリア後にのみ可能（FK ON DELETE RESTRICT）
- **復元**: deleted_at = NULL、admin / super_admin のみ
- **監査**: 全 INSERT / UPDATE / DELETE を fruit_audit_log に記録（Cross History #04 §5）

---

## 3. ロール別アクセスマトリクス

| ロール | select | insert | update | logical delete | physical delete | restore |
|---|---|---|---|---|---|---|
| toss | × | × | × | × | × | × |
| closer | ○ (限定列) | × | × | × | × | × |
| cs | ○ (限定列) | × | × | × | × | × |
| staff | ○ | × | × | × | × | × |
| manager | ○ | × | × | × | × | × |
| admin | ○ (機微含む) | ○ | ○ | ○ | ○ | ○ |
| super_admin | ○ (機微含む) | ○ | ○ | ○ | ○ | ○ |

### 3.1 「限定列」（closer / cs）
- 閲覧可: company_code / company_name / company_name_kana / prefecture / city
- 不可: 法人番号 / インボイス番号 / 代表者生年月日 / 銀行口座 / 許認可番号 / 保険番号 / 契約相手先 / 履歴
- 実装: VIEW `fruit_companies_legal_basic` を作成、closer / cs ロールはこの VIEW のみ参照

### 3.2 「機微含む」（admin / super_admin）
- 暗号化列の復号閲覧（API ハンドラで pgp_sym_decrypt）
- 監査ログにアクセス時刻を記録

---

## 4. RLS ポリシー定義

### 4.1 fruit_companies_legal

```sql
ALTER TABLE fruit_companies_legal ENABLE ROW LEVEL SECURITY;

-- SELECT: staff 以上は全件、closer/cs は VIEW 経由のみ（このテーブル直アクセス禁止）
CREATE POLICY fruit_companies_select ON fruit_companies_legal FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('staff', 'manager', 'admin', 'super_admin')
  );

-- INSERT: admin / super_admin のみ
CREATE POLICY fruit_companies_insert ON fruit_companies_legal FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'super_admin')
  );

-- UPDATE: admin / super_admin のみ、deleted_at の変更も含む
CREATE POLICY fruit_companies_update ON fruit_companies_legal FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));

-- DELETE（物理削除）: admin / super_admin のみ、子レコードチェックは BEFORE DELETE トリガ
CREATE POLICY fruit_companies_delete ON fruit_companies_legal FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));
```

### 4.2 fruit_companies_legal_basic（VIEW、closer / cs 用）

```sql
CREATE VIEW fruit_companies_legal_basic AS
  SELECT id, company_code, company_name, company_name_kana,
         corporate_form, prefecture, city,
         deleted_at IS NULL AS active
  FROM fruit_companies_legal;

-- closer / cs は VIEW のみ select、本体テーブルは RLS でブロック
GRANT SELECT ON fruit_companies_legal_basic TO authenticated;
```

closer / cs ロールに対しては、本体テーブルの SELECT を拒否し、VIEW 経由のみ許可する設計。

### 4.3 子テーブル 7 種

各子テーブルに同パターンの RLS を適用：

```sql
-- 例: fruit_representatives
ALTER TABLE fruit_representatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY fruit_reps_select ON fruit_representatives FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('staff', 'manager', 'admin', 'super_admin'));

CREATE POLICY fruit_reps_modify ON fruit_representatives FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));
```

### 4.4 機微列の追加保護

`fruit_banks.account_number_enc` / `fruit_licenses.license_number_enc` は admin / super_admin のみ復号 RPC（`fruit_decrypt_bank_account()`）から参照可能。

```sql
CREATE FUNCTION fruit_decrypt_bank_account(bank_id uuid) RETURNS text AS $$
DECLARE
  decrypted text;
BEGIN
  IF auth.jwt() ->> 'role' NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT pgp_sym_decrypt(account_number_enc, current_setting('app.fruit_key'))
    INTO decrypted
    FROM fruit_banks WHERE id = bank_id AND deleted_at IS NULL;

  -- 監査ログ
  INSERT INTO fruit_audit_log (table_name, record_id, action, actor_id, actor_role)
    VALUES ('fruit_banks', bank_id, 'decrypt', auth.uid(), auth.jwt() ->> 'role');

  RETURN decrypted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. 削除パターン詳細（Cross History #04 準拠）

### 5.1 論理削除フロー（admin / super_admin）

```
1. UI（admin only）から削除ボタン押下
2. 確認モーダル: 「論理削除（復元可）」or「物理削除（不可逆）」を選択
3. 論理削除選択時:
   UPDATE fruit_companies_legal
   SET deleted_at = now(),
       deleted_by = auth.uid()
   WHERE id = $1
4. 子テーブル連鎖論理削除（トリガ or アプリ層トランザクション）
5. fruit_audit_log に action='soft_delete' 記録
6. fruit_history に変更履歴 INSERT（change_type='dissolution' if 解散等）
7. SWR mutate で UI 反映
```

### 5.2 物理削除フロー（admin / super_admin）

```
1. UI（admin only）から「物理削除」を選択
2. 子レコード件数を表示し、再確認モーダル
3. 子テーブル全件論理削除済か確認（未削除あれば停止）
4. 子テーブル DELETE（FK RESTRICT のため事前削除必要）
5. 親テーブル DELETE
6. fruit_audit_log に action='hard_delete' 記録（before_value に全列スナップショット）
7. fruit_history は保持（履歴は永続）
```

### 5.3 復元フロー

```
1. UI（admin only）の「削除済法人」一覧から「復元」
2. UPDATE fruit_companies_legal
   SET deleted_at = NULL, deleted_by = NULL
   WHERE id = $1
3. 子テーブルも連鎖復元（同タイムスタンプで論理削除されたもの）
4. fruit_audit_log に action='restore' 記録
```

### 5.4 削除制約（BEFORE DELETE トリガ）

```sql
CREATE FUNCTION fruit_companies_check_before_delete() RETURNS trigger AS $$
DECLARE
  child_count int;
BEGIN
  SELECT count(*) INTO child_count FROM (
    SELECT id FROM fruit_representatives WHERE company_id = OLD.id
    UNION ALL SELECT id FROM fruit_documents WHERE company_id = OLD.id
    UNION ALL SELECT id FROM fruit_licenses WHERE company_id = OLD.id
    UNION ALL SELECT id FROM fruit_insurances WHERE company_id = OLD.id
    UNION ALL SELECT id FROM fruit_contracts WHERE company_id = OLD.id
    UNION ALL SELECT id FROM fruit_banks WHERE company_id = OLD.id
  ) t;

  IF child_count > 0 THEN
    RAISE EXCEPTION 'cannot physically delete: % child records exist (use soft delete or remove children first)', child_count;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fruit_companies_before_delete
  BEFORE DELETE ON fruit_companies_legal
  FOR EACH ROW EXECUTE FUNCTION fruit_companies_check_before_delete();
```

---

## 6. fruit_audit_log テーブル

| 列名 | 型 | 説明 |
|---|---|---|
| id | uuid | PK |
| occurred_at | timestamptz | default now() |
| table_name | text | 対象テーブル |
| record_id | uuid | 対象レコード |
| action | text | insert / update / soft_delete / hard_delete / restore / decrypt |
| actor_id | uuid | FK root_employees |
| actor_role | text | JWT role スナップショット |
| ip_address | inet | クライアント IP（API ハンドラ層で記録） |
| user_agent | text | UA |
| before_value | jsonb | 変更前（update / delete 時） |
| after_value | jsonb | 変更後（update / insert 時） |
| context | jsonb | 追加情報（reason 等） |

**インデックス**:
- `idx_fruit_audit_log_table_record` ON `(table_name, record_id, occurred_at DESC)`
- `idx_fruit_audit_log_actor` ON `(actor_id, occurred_at DESC)`

**RLS**:
- SELECT: super_admin のみ
- INSERT: SECURITY DEFINER 関数経由のみ（直接 INSERT 不可）
- UPDATE / DELETE: 全ロール禁止（監査ログは追記のみ）

---

## 7. 法令対応チェックリスト

- [ ] **個人情報保護法 第 23 条**: 機微情報（代表者生年月日 / 口座番号）は admin / super_admin のみ閲覧、closer / cs はマスキング
- [ ] **個人情報保護法 第 25 条**: アクセスログ（fruit_audit_log）を保持、本人開示請求に対応可能
- [ ] **会社法**: 法人マスタの履歴（fruit_history）は永続、論理削除も物理削除も対象外
- [ ] **電子帳簿保存法**: fruit_documents / 関連監査ログを 10 年保持（物理削除禁止運用）
- [ ] **派遣法**: 派遣業許可情報の閲覧権限を staff 以上に確保（厚労省立入検査時の即応）
- [ ] **インボイス制度**: invoice_number 変更時の履歴を fruit_history に必ず記録
- [ ] **GDPR 相当の対応**: 復元可能期間を明示（v0.1 では無期限、運用ルールで合意）

---

## 8. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | 8 テーブル RLS ポリシー Migration | a-fruit | 0.20d |
| 2 | fruit_companies_legal_basic VIEW | a-fruit | 0.05d |
| 3 | 復号 RPC（fruit_decrypt_*）| a-fruit | 0.10d |
| 4 | fruit_audit_log テーブル + RLS | a-fruit | 0.10d |
| 5 | 監査トリガ（INSERT / UPDATE / DELETE） | a-fruit | 0.20d |
| 6 | BEFORE DELETE 制約トリガ | a-fruit | 0.05d |
| 7 | 削除 / 復元 API ハンドラ | a-fruit | 0.15d |
| 8 | テスト（ロール別アクセス確認 7 ロール × 4 アクション） | a-fruit | 0.10d |
| 9 | レビュー反映 | a-bloom | 0.05d |

---

## 9. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| F05-1 | manager に書込権限を与えるか | v0.1 は admin only、現場運用で manager 必要なら別 spec |
| F05-2 | 論理削除データの自動物理削除サイクル（90 日後など） | 設けない（手動運用、Cross History #04 準拠） |
| F05-3 | 監査ログの IP / UA 記録は API 層で十分か | 十分、DB 直アクセスは禁止する運用前提 |
| F05-4 | closer / cs に invoice_number 部分公開（先頭 T のみ表示等）は必要か | v0.1 は完全マスキング、必要なら別 spec |
| F05-5 | super_admin と admin の権限差別化 | v0.1 は同等、super_admin のみが audit_log 閲覧可 |

---

## 10. 既知のリスクと対策

- **JWT 改ざん**: Supabase Auth の JWT 署名検証で防御、RLS は信頼できる JWT クレームを参照
- **暗号化キー漏洩**: Supabase Vault + ローテーション、ローカル開発では dev 用キー
- **監査ログ肥大化**: 6 法人 × 日次取込でも年間数千行、長期保存可能
- **論理削除データの誤閲覧**: API ハンドラで `WHERE deleted_at IS NULL` を default、明示的に削除済を見るには専用エンドポイント
- **VIEW 経由の閲覧で性能劣化**: 6 法人なので無視可能、将来的に materialized view 検討

---

## 11. 関連ドキュメント

- F-01 / F-02 / F-03 / F-04
- Cross History #04 削除パターン統一規格
- 既存 Root RLS 実装（feature/root-rls-phase-a-* ブランチ群）
- Sprout v0.2 spec §13

---

## 12. 受入基準（Definition of Done）

- [ ] 8 テーブルすべてに ENABLE RLS + ポリシー定義
- [ ] closer / cs は本体テーブル直アクセス不可、VIEW 経由のみ
- [ ] admin / super_admin のみ書込・削除・復元可能
- [ ] 暗号化列の復号は admin only RPC 経由のみ
- [ ] BEFORE DELETE 制約で子レコード残存時の物理削除をブロック
- [ ] fruit_audit_log に全 INSERT / UPDATE / DELETE / decrypt アクションが記録
- [ ] 7 ロール × 主要アクションの組み合わせテスト合格（49 ケース）
- [ ] 法令対応チェックリスト全項目クリア
- [ ] Cross History #04 削除パターン準拠の運用フローが文書化
- [ ] レビュー（a-bloom）完了
