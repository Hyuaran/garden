# Leaf 他商材 #02: クレジットカード商材 骨格 spec（skeleton）

- 対象: 各種クレジットカード（イオン / 楽天 / エポス / その他）の業務委託
- 優先度: **🟡 中**（実装着手前のリサーチ用）
- 見積: **0.2d**（spec 起草、実装見積は別途）
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 12 Leaf 他商材 #02）
- 前提:
  - `spec-leaf-others-00-template-pattern`
  - Bud Phase C-02 マイナンバー暗号化パターン

---

## 1. 目的とスコープ

### 目的

クレジットカード発行業務（営業 → 申込 → 与信 → 発行）を Leaf に追加するための skeleton spec。実装着手前に東海林さんと詳細ヒアリング。

### 含める

- クレカ商材の業務フロー
- 関電・光との差異（与信プロセス、個人信用情報）
- ステータス遷移の暫定案
- 個情法・割賦販売法の対応
- カード会社別の特性

### 含めない

- 完全 6 spec
- 実装コード
- 既存データ移行（#10）

---

## 2. クレカ商材の業務フロー

### 2.1 一般的なフロー

```
1. 営業（架電 / 訪問）→ カード勧誘
   ↓
2. 顧客同意・本人確認（運転免許証等）
   ↓
3. 申込書作成（紙 or オンライン）
   ↓
4. カード会社へ申込送信
   ↓
5. カード会社で 与信審査（数日〜2 週間）
   ↓
6. 審査結果通知（承認 / 否決 / 条件付）
   ↓
7. （承認時）カード発行 → 顧客郵送
   ↓
8. カード受取 → 利用開始
   ↓
9. 月次手数料発生（業務委託料）
```

### 2.2 関電・光との主な差異

| 観点 | 関電 | 光回線 | クレカ |
|---|---|---|---|
| 業務種別 | エネルギー | 通信 | **金融** |
| 個人信用情報 | 不要 | 不要 | **必須**（CIC 等照会）|
| 与信プロセス | 不要 | 不要 | **数日〜2 週間の審査**待ち |
| 否決率 | 低 | 中 | **高い**（5-30%）|
| 本人確認 | 軽 | 軽 | **厳格**（運転免許 + 公共料金）|
| 法令 | 電気事業法 | 電気通信事業法 | **割賦販売法・個情法強化**|
| 入金 | 顧客 → 関電 → 自社 | 顧客 → 業者 → 自社 | カード会社 → 自社（直接）|

### 2.3 主要カード会社の特徴

| カード会社 | 申込方法 | 審査速度 | 手数料 |
|---|---|---|---|
| イオンカード | オンライン + 紙 | 1-3 日 | 約 3,000-5,000 円 / 件 |
| 楽天カード | オンライン中心 | 即日 - 数日 | 約 2,500-4,000 円 / 件 |
| エポスカード | 紙中心 | 1-2 日 | 約 4,000 円 / 件 |
| 三井住友カード | オンライン | 数日 | 約 5,000 円 / 件 |

---

## 3. テーブル設計の暫定案

### 3.1 メインテーブル `soil_credit_cases`

```sql
CREATE TABLE soil_credit_cases (
  case_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number          text UNIQUE NOT NULL,

  -- カード会社
  issuer_code          text NOT NULL CHECK (issuer_code IN (
    'aeon', 'rakuten', 'epos', 'smbc', 'jcb', 'view', 'other'
  )),
  card_product_code    text,         -- カード商品コード（イオンゴールド等）

  -- ステータス（暫定 9 段階）
  status               text NOT NULL CHECK (status IN (
    'ordered',          -- 申込受付
    'kyc_verified',     -- 本人確認完了
    'submitted',        -- カード会社送信
    'pending_review',   -- 審査中
    'approved',         -- 承認
    'rejected',         -- 否決
    'conditional',      -- 条件付承認（限度額減額等）
    'shipped',          -- カード発送
    'activated'         -- 利用開始
  )),

  -- 案件種別
  case_type            text NOT NULL CHECK (case_type IN (
    'new_application',  -- 新規申込
    'reissue',          -- 再発行
    'upgrade'           -- 上位カード切替
  )),

  -- 営業情報（共通）
  employee_number      text NOT NULL REFERENCES root_employees(employee_number),
  -- ...

  -- 顧客情報（金融商材は厳格）
  customer_name              text NOT NULL,
  customer_name_kana         text NOT NULL,
  customer_birthday          date NOT NULL,
  customer_phone             text NOT NULL,
  customer_email             text,
  customer_address           text NOT NULL,
  customer_address_postcode  text,

  -- 本人確認
  identity_verification_type text CHECK (identity_verification_type IN (
    'drivers_license', 'passport', 'mynumber_card', 'health_insurance', 'other'
  )),
  identity_doc_storage_key   text,         -- 添付（暗号化）
  kyc_verified_at            timestamptz,
  kyc_verified_by            text REFERENCES root_employees(employee_number),

  -- 審査関連
  submitted_at               timestamptz,
  review_started_at          timestamptz,
  review_result_at           timestamptz,
  review_result              text CHECK (review_result IN (
    'approved', 'rejected', 'conditional', 'pending'
  )),
  approved_credit_limit      bigint,        -- 承認限度額
  rejection_reason           text,

  -- カード発送・利用開始
  shipped_at                 timestamptz,
  card_number_masked         text,          -- 下 4 桁のみ（PCI DSS）
  activated_at               timestamptz,

  -- 解約
  cancelled_at               timestamptz,
  cancellation_reason        text,

  -- 法令対応
  cooling_off_eligible       boolean NOT NULL DEFAULT true,
  cooling_off_expires_at     timestamptz,

  -- メタ
  -- ...
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  deleted_at                 timestamptz
);

CREATE INDEX idx_scc_issuer_status ON soil_credit_cases (issuer_code, status);
CREATE INDEX idx_scc_employee ON soil_credit_cases (employee_number);
CREATE INDEX idx_scc_pending_review ON soil_credit_cases (issuer_code) WHERE status = 'pending_review';
```

### 3.2 重要な暗号化対象列

- `customer_birthday` （個情法保護対象）
- `identity_doc_storage_key` （顔写真・住所含む本人確認書類）
- `card_number_masked` のみ保存（フルカード番号は保存禁止、PCI DSS）

### 3.3 ステータス遷移グラフ

```
[ordered] → [kyc_verified] → [submitted] → [pending_review]
                                                   ↓
                            ┌──────┬──────┬─────────┐
                            ↓      ↓      ↓
                       [approved] [conditional] [rejected]
                            ↓      ↓
                        [shipped] [shipped]
                            ↓      ↓
                        [activated]
```

---

## 4. 商材固有 UI 要件

### 4.1 input UI 追加要素

- **カード会社選択**: ドロップダウン（カード商品も連動）
- **本人確認書類アップロード**: 必須、Canvas 圧縮 + 暗号化保存
- **生年月日入力**: DatePicker（西暦/和暦切替）
- **収入情報**（カード会社により）: 年収・職業・勤続年数
- **同居家族数**（カード会社により）

### 4.2 backoffice UI 追加要素

- **審査待ち一覧**: status = `pending_review` の専用画面
- **審査結果通知の取込**: カード会社から PDF/CSV 受領 → 案件に反映
- **本人確認書類の閲覧**: admin+ のみ復号可能
- **限度額表示**: `approved_credit_limit` の集計

### 4.3 PCI DSS 配慮

- カード番号は**保存しない**（下 4 桁のみマスク表示）
- 利用開始後の利用情報も Garden には保存しない（カード会社管轄）

---

## 5. 法令対応

### 5.1 割賦販売法

- 加盟店契約の種別管理
- 適合性原則（顧客に適切なカードを勧誘）
- クーリングオフ：カード新規申込は対象外（割賦販売法）
  - ただし**法人の高額与信案件**は契約による

### 5.2 個情法（強化対象）

- 本人確認書類の長期保存（金融機関要請）
- 5 年保存後に物理削除（PII 最小化）
- アクセスログ全取得（admin+ の閲覧履歴）

### 5.3 犯罪収益移転防止法

- 本人確認義務（運転免許 等）
- 取引時確認の記録 5 年以上保存

---

## 6. 想定外部 API

### 6.1 カード会社別

ほぼ各社が独自仕様、一括 API はなし。

| カード会社 | 申込 API | 審査結果通知 |
|---|---|---|
| 楽天カード | あり（楽天 e-ビジネス）| API + メール |
| イオンカード | 限定的 | 紙・PDF 送付 |
| エポスカード | なし | 紙のみ |
| その他 | なし | 紙のみ |

### 6.2 統合方針

- Phase 1: **手動入力 + 紙 PDF アップロード**
- Phase 2: 楽天等 API 連携検討
- Phase 3: 全社 API 統合（実現性低、業界の構造的制約）

---

## 7. テスト戦略の要点

### 7.1 Leaf 🟡 通常厳格度

- **ただし金融商材なので Bud 🔴 寄りのテスト追加**
- 個人情報暗号化 / 復号テスト（Bud C-02 パターン）
- 本人確認書類 添付の暗号化検証
- 与信ステータス遷移の網羅
- カード会社別の必須項目バリデーション

### 7.2 セキュリティテスト

- カード番号フル保存禁止の検証
- アクセスログ完全取得の検証
- admin+ 以外による本人確認書類アクセス拒否

---

## 8. 詳細仕様確定までの判断保留

### 8.1 ⭐ 東海林さん再ヒアリング必須

| # | 論点 | 確認事項 |
|---|---|---|
| 1 | 取り扱いカード会社 | 何社、月間契約数 |
| 2 | 営業形態 | 個人 / 法人 / 学生 |
| 3 | 本人確認 | 紙 / オンライン KYC（eKYC） |
| 4 | 審査結果取込 | 紙 PDF / メール / API |
| 5 | 手数料体系 | 申込時 / 利用開始時 / 継続利用連動 |
| 6 | 既存システム | FileMaker / Excel / カード会社ポータル併用 |
| 7 | 否決率の許容 | 否決時の顧客対応・支払い |
| 8 | 法令専任者 | 法務・コンプライアンス担当 |

---

## 9. 実装見込み時間（参考）

| Step | 所要 |
|---|---|
| Step 1 リサーチ + ヒアリング | 3 日 |
| Step 2 spec 6 件 草稿（auto）| 0.5 日 |
| Step 3 レビュー（法務含む）| 2 日 |
| Step 4 確定修正（auto）| 0.2 日 |
| Step 5 実装（共通部分）| 4 日 |
| Step 5 実装（カード会社別）| 1.5 日 / 社 |
| **合計（カード会社 3 社対応）** | **約 12-15 日** |

クレカは個情法・与信プロセスが複雑、関電・光より工数大。

---

## 10. 判断保留事項

- **判1: 個人情報暗号化方式**
  - Bud C-02 と同じ pgcrypto / Vault 外部連携
  - **推定スタンス**: pgcrypto（Bud と統一）
- **判2: KYC（本人確認）方式**
  - 紙 + 撮影 / オンライン eKYC（業者 API）
  - **推定スタンス**: Phase 1 は紙、Phase 2 で eKYC 検討
- **判3: カード番号フル保存**
  - 絶対禁止 / 暗号化なら可
  - **推定スタンス**: **絶対禁止**（PCI DSS）、下 4 桁マスクのみ
- **判4: 審査結果の自動取込**
  - PDF OCR / メール解析 / API
  - **推定スタンス**: Phase 1 は手入力、Phase 2 でカード会社別自動化
- **判5: 与信限度額の表示権限**
  - 営業見える / staff+ / admin+ のみ
  - **推定スタンス**: staff+ 集計のみ可、個別見える権限は admin+
- **判6: クーリングオフ対象判定**
  - 全件対象 / 法人案件除外 / 高額与信のみ対象
  - **推定スタンス**: 案件種別で自動判定（法令専門家確認後）
- **判7: 本人確認書類の保存期間**
  - 5 年 / 7 年 / 10 年
  - **推定スタンス**: 7 年（犯収法準拠）

---

— spec-leaf-others-02 end —
