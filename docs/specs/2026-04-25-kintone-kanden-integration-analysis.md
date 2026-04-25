# Kintone → Garden 移行マッピング分析（関電業務委託まわり）

- 作成: 2026-04-25 (a-main 004)
- 対象: 3 つの Kintone アプリ計 140 フィールド
- 元データ: API 経由で fetch、構造のみ抽出（個人情報・実値はチャット非出力）

---

## 1. 対象アプリ概要

| App ID | Kintone アプリ名 | フィールド数 | Garden 移行先（推奨） |
|---|---|---|---|
| **55** | 関西電力リスト一覧 | 74 | Garden Leaf 関電業務委託 (`leaf_kanden_cases` + 拡張) |
| **104** | 在庫管理 関西電力（sim 端末）| 25 | Garden Seed 候補 or Leaf 拡張 (`leaf_kanden_sim_inventory` 新規) |
| **38** | 事業部登録名簿1（営業用）| 41 | Garden Root + 外注判定 (`root_partners` + `root_employees(employment_type='outsource')`) |

---

## 2. App 55 関西電力リスト一覧（74 fields）

### 2.1 業務的な意味づけ

関電案件の**マスタ + 進捗管理 + 営業活動データ**が一体化したテーブル。
1 レコード = 1 顧客の関電契約案件。

### 2.2 フィールド分類（業務ドメイン別）

#### 識別系（必須）
| Kintone | 型 | 業務的役割 | Garden 推奨 |
|---|---|---|---|
| 管理番号1 | text 🔴 | 主キー的役割 | `kanden_case_id` (PK 候補) |
| 管理番号2, 3 | text | 副管理番号（社内別運用）| `kanden_case_no_2 / _3` |
| ブレーカー_管理番号 | text | ブレーカー商材連携 | 別テーブル `leaf_breaker_cases` 候補 or `breaker_kanden_link_id` |
| D_電気ID | text | 関電内部 ID（電気契約連携）| `kepco_electricity_id` |
| お客様番号 | text | 関電顧客番号 | `customer_no` |
| ブレーカー_お客様番号 | text | ブレーカー顧客番号 | `breaker_customer_no` |

#### 顧客・申込者情報
| Kintone | Garden 推奨 |
|---|---|
| リスト名 | `list_name`（営業リスト由来） |
| 現契約名義_漢字 | `current_holder_name_kanji` |
| 現契約名義_カナ | `current_holder_name_kana` |

#### 住所（請求先 + 使用場所の 2 セット）
| Kintone | Garden |
|---|---|
| 現使用場所住所_郵便番号 / 1 / 2 | `usage_postal_code`, `usage_address_1`, `usage_address_2` |
| 現請求先住所_郵便番号 / 1 / 2 | `billing_postal_code`, `billing_address_1`, `billing_address_2` |

#### 電話番号
- 電話番号1 / 2 / 重複（重複 = 別案件と同じ番号フラグ？運用確認要）

#### 契約・業種
| Kintone | 選択肢 / Garden |
|---|---|
| 業種 (DROP_DOWN) | `industry_type` enum: 工場照明, 理容・洗濯, 街路灯その他, 事務所・医院, 飲食・娯楽, 商店, 寮, 学校・官公庁 |
| 契約種別 (DROP_DOWN) | `contract_type` enum: なっトクでんき, 従量電灯A, なっトクでんきBiz, 従量電灯B |
| 動力契約 (DROP_DOWN) | `dynamic_contract` enum: 無, 有(使用中), 有(離脱中) |
| 関電ガス契約 (DROP_DOWN) | `kanden_gas_contract` enum: 無, 有, - |
| 契約容量_従Ｂ (NUMBER) | `contract_capacity_jb` |
| 契約容量_動力 (NUMBER) | `contract_capacity_dynamic` |
| ブレーカー_動力契約容量 / 提案契約 | `breaker_dynamic_capacity`, `breaker_proposal_kw` |

#### 数値（金額・容量・使用量）
- 月間平均使用量_電灯 / 動力 → `monthly_avg_usage_lighting`, `..._dynamic`
- 年間合計使用量_電灯 → `annual_total_usage_lighting`
- 囲込_電気使用量1〜12 (12ヶ月分) → `enclosure_usage_m1` ... `_m12`
- 囲込_デマンド → `enclosure_demand`
- 囲込_現料金 → `enclosure_current_fee`
- 囲込_なっトクでんき変更後 → `enclosure_after_change`
- 囲込_なっトクでんきメリット額 → `enclosure_merit_amount`
- 囲込_電気単独変更後 / メリット額 → `enclosure_solo_after`, `enclosure_solo_merit`

#### 日付（イベント）
| Kintone | Garden |
|---|---|
| 需要開始年月日 | `service_start_date` |
| 離脱時期 | `churn_date` |
| 囲込_DM発送日 | `enclosure_dm_sent_date` |
| 囲込_需要開始年月日 | `enclosure_service_start` |
| 囲込_電気使用量_日付 / F | `enclosure_usage_date / _f` |
| 囲込_ガス検針日1〜4 | `enclosure_gas_meter_date_1...4` |
| ブレーカー_試算依頼日 | `breaker_estimate_request_date` |

#### ステータス・進行管理
- ステータス（Kintone STATUS）→ Garden では `status` enum + 状態遷移テーブル
- アポ禁 (DROP_DOWN: アポ禁, -) → `is_apo_kin` boolean

#### 削除フラグ的なもの
- グループ "削除する？" → 削除候補マーキング（移行時に `deleted_at` で代用）

### 2.3 Garden 設計提案

**テーブル**: `leaf_kanden_cases`（既存設計を拡張）

```
leaf_kanden_cases
├─ kanden_case_id (PK, 関電管理番号1)
├─ list_name, customer_no, current_holder_name_kanji/kana
├─ 住所セット 2 種
├─ 電話番号 1/2 + 重複フラグ
├─ industry_type, contract_type, dynamic_contract, kanden_gas_contract
├─ 各種契約容量 / 使用量 (NUMBER 多数)
├─ 各種日付 (需要開始, 離脱, DM 等)
├─ status, is_apo_kin
├─ deleted_at, deleted_by (Garden 共通削除パターン)
├─ created_at/by, updated_at/by
└─ FK: assigned_user_id → root_employees (担当営業)
```

**ブレーカー商材**は別テーブル `leaf_breaker_cases` 推奨（業種特化が異なる）。

**画像検索 8 条件との対応**（Batch 13 spec 参照）:
- PD → 業種コード or その他 ID（要確認、関電責任者ヒアリング必要）
- お客様番号 → `customer_no` 直接検索
- 供給地点番号 → 別フィールド存在？要 Kintone 側追加確認
- 電話番号・携帯番号 → `tel_1`, `tel_2` 部分一致
- 住所 → `usage_address_1/2` + `billing_address_1/2` 部分一致
- リスト名前 漢字/カナ → `current_holder_name_kanji/kana`
- 申込者名前 漢字/カナ → 別フィールド（**Kintone に申込者と契約名義の区別が見当たらない**、要確認）
- 代表者名前 漢字/カナ → 同上、不在の可能性

→ **Kintone App 55 には申込者・代表者フィールドが見当たらない**
→ 関電責任者からの追加ヒアリングが必要、または関電 Excel 側に存在する可能性

### 2.4 移行戦略

| Phase | 内容 |
|---|---|
| Phase B-1 初期 | スキーマ確定（leaf_kanden_cases v1）+ Kintone から CSV エクスポート → Garden 一括投入 |
| Phase B-1 後半 | 画像・添付ファイルは別途 Leaf A-1c で運用、TimeTree から手動移行 |
| Phase B-1 リリース後 | Kintone 段階廃止、Garden 一本化 |

---

## 3. App 104 在庫管理 関西電力（sim 端末）（25 fields）

### 3.1 業務的意味づけ
関電業務に必要な **SIM 内蔵端末の貸出・返却管理**。在庫数台規模、SUBTABLE で履歴管理。

### 3.2 主要フィールド

| Kintone | 型 | 業務役割 | Garden 推奨 |
|---|---|---|---|
| 番号1, 2, 3 | text | 端末識別番号（複数規格） | `device_no_1/2/3` |
| sim 番号 (ハイフンあり/なし 2 形式) | text | SIM 番号 | `sim_no_with_hyphen`, `sim_no_plain` |
| 稼働状況 (RADIO 🔴) | enum | 貸出中, 解約済み, 在庫あり | `status` enum |
| 最終状況 (RADIO 🔴) | enum | 解約, 返却, 貸出 | `last_action` enum |
| 投入日 | date | 在庫投入日 | `purchase_date` |
| 最終日時 | datetime | 最終操作 | `last_action_at` |
| 最終使用者 | text | 直近の利用者名 | `last_user_name` |

### 3.3 SUBTABLE 構造

#### 在庫管理 (SUBTABLE)
- 入力日時 (DATETIME)
- 使用者 (text)
- 行番号 (NUMBER)
- 状況 (RADIO_BUTTON)
- 入力者 (USER_SELECT)

#### 交換履歴 (SUBTABLE)
- 入力者 (USER_SELECT)
- (RADIO_BUTTON)
- 端末名 (text)
- 入力日時 (DATETIME)
- 行番号 (NUMBER)

### 3.4 Garden 移行先の判断

3 案：

| 案 | 配置先 | 理由 |
|---|---|---|
| **A 推奨** | Garden Leaf 拡張（`leaf_kanden_sim_devices` + 履歴サブテーブル） | 関電業務に特化、Leaf に統合がシンプル |
| B | Garden Seed（新事業枠の在庫管理として）| 将来他商材でも在庫管理が必要なら汎用的に |
| C | 独立した在庫管理モジュール新設 | オーバースペック、不要 |

→ **A 案推奨**: 関電業務委託に密接、Leaf 内で完結する方が業務ロジックが一体化する。

### 3.5 推奨スキーマ（簡略版）

```
leaf_kanden_sim_devices
├─ device_id (PK uuid)
├─ device_no_1/2/3, sim_no_with_hyphen, sim_no_plain
├─ status enum: 貸出中 / 解約済み / 在庫あり
├─ last_action enum: 解約 / 返却 / 貸出
├─ last_user_name, last_action_at
├─ purchase_date
├─ deleted_at, deleted_by
└─ created_at/by, updated_at/by

leaf_kanden_sim_inventory_log (履歴)
├─ log_id (PK uuid)
├─ device_id (FK)
├─ user_name, action (status), action_at
└─ created_by

leaf_kanden_sim_exchange_log (交換履歴)
├─ log_id (PK uuid)
├─ device_id (FK)
├─ replacement_device_name, action_at
└─ created_by
```

---

## 4. App 38 事業部登録名簿1（営業用）（41 fields）

### 4.1 業務的意味づけ
**取引先（パートナー）+ 訪問営業（外注）の登録簿**。
重要: 部署名 = '訪問営業' のレコードが**外注営業に対応**。

### 4.2 主要フィールド

| Kintone | 型 | 業務役割 | Garden 推奨先 |
|---|---|---|---|
| パートナーコード 🔴 | NUMBER | 取引先一意 ID | `partner_code` (UNIQUE) |
| 会社名 / 会社名カナ | text | 会社情報 | `partner_name` / `partner_name_kana` |
| 役職・代表者様 | text | 代表者情報 | `representative_title_name` |
| 会社電話番号 | text | 会社連絡先 | `partner_tel` |
| 会社 FAX 番号 | text | FAX | `partner_fax` |
| 郵便番号, 住所 | text | 住所 | `partner_postal_code`, `partner_address` |
| 担当者様名 / カナ | text | 担当者 | `contact_name` / `contact_name_kana` |
| 担当者様電話番号 | text | 担当者連絡先 | `contact_tel` |
| **事業名 (DROP_DOWN 🔴)** | enum | 自社, テレマーケティング, アライアンス | `business_type` enum |
| **部署名 (DROP_DOWN 🔴)** | enum | 自社, 不動産, テレマーケティング, **訪問営業**, パートナー, 異業種, 直営1部, 直営2部 ... | `department_type` enum（**訪問営業 = 外注**） |
| **チーム名 (DROP_DOWN 🔴)** | enum | オアシス, 藤木誠希, 鳥羽政臣, Raymond, 宮永チーム, スカイズ, 本田啓輔, 瀧健一, ... | `team_name` |
| 会社 HP | LINK | URL | `partner_hp_url` |
| 契約書格納先 | LINK | URL | `contract_storage_url` |
| 支払明細格納先 | LINK | URL | `payment_detail_storage_url` |
| 条件表格納先 | LINK | URL | `terms_storage_url` |
| 明細送付先アドレス_宛先 + CC1〜CC5 | LINK | メアド多数 | `detail_send_to`, `detail_cc_1...5` |
| 進捗送付先アドレス_宛先 + CC1〜CC5 | LINK | メアド多数 | `progress_send_to`, `progress_cc_1...5` |
| ※注意事項 | MULTI_LINE_TEXT | 自由記述 | `notes` |
| 入力履歴 (SUBTABLE) | sub | 編集履歴（日時/詳細/ユーザー）| 別テーブル `root_partners_history` (Garden 共通履歴 UI へ統合) |

### 4.3 訪問営業（外注）判定ロジック

**部署名 = '訪問営業'** のレコードは外注営業として識別されます。

#### Garden 側の対応

```
方式 A（推奨）: Kintone レコード単位で 2 種類の Garden データに分離
- パートナー会社情報 → root_partners テーブル
- 訪問営業（個人）→ root_employees テーブルに employment_type='outsource' で登録
- root_partners と root_employees の紐付け: outsource_employee.partner_id = partner.id

方式 B: 全部 root_partners に格納、garden_role で判別
- root_partners.is_visiting_sales boolean 列
- 簡略だが employees との関係が薄くなる
```

→ **方式 A 推奨**: 既に root_employees に outsource enum 値が定義済（A-3-g 完了済）、自然な統合が可能。

### 4.4 Garden 移行スキーマ提案

```
root_partners (新規)
├─ partner_id (PK uuid)
├─ partner_code (UNIQUE int, Kintone パートナーコード踏襲)
├─ partner_name, partner_name_kana
├─ representative_title_name
├─ partner_tel, partner_fax
├─ partner_postal_code, partner_address
├─ business_type enum: 自社 / テレマーケティング / アライアンス
├─ department_type enum: 自社 / 不動産 / テレマーケティング / 訪問営業 / パートナー / 異業種 / 直営1部 / 直営2部 ...
├─ team_name
├─ partner_hp_url, contract_storage_url, payment_detail_storage_url, terms_storage_url
├─ detail_send_to, detail_cc_1..5 (text/email)
├─ progress_send_to, progress_cc_1..5 (text/email)
├─ notes (text)
├─ deleted_at, deleted_by
└─ created_at/by, updated_at/by

root_employees 拡張（既に A-3-g/h で対応済）
├─ employment_type に 'outsource' 追加済
├─ partner_id (FK to root_partners) を新規追加: 外注の場合に紐付け
└─ contract_end_on (A-3-g 済) で外注契約終了日を管理
```

### 4.5 訪問営業の Garden 登録フロー

1. パートナー会社が `root_partners` に登録される（部署名 = '訪問営業' を含む可能性）
2. その会社に所属する**個別の営業員**が Garden アカウント取得時:
   - `root_employees` に `employment_type='outsource'`, `garden_role='outsource'`, `partner_id=該当partner_id` で登録
   - `contract_end_on` で個別の契約終了日を管理
3. アクセス制御:
   - `is_user_active()` 関数（A-3-g）で contract_end_on 過去なら自動遮断
   - `garden_role_of(uid)` で 'outsource' を返し、Leaf 側 RLS で適切な権限制御

---

## 5. 横断的な発見・推奨

### 5.1 Garden Leaf 関電業務委託（Phase C 既起草 spec への影響）

PR #29 / PR #44（Batch 13）の Leaf 関電 spec に以下の補足が必要：
- App 55 の囲込_電気使用量1〜12 (12ヶ月分の数値配列) → JSONB or 別テーブル化検討
- 申込者・代表者フィールドの不在 → 関電責任者ヒアリング項目に追加
- ブレーカー商材は **別テーブル `leaf_breaker_cases`** に分離するのが業務的に自然

### 5.2 SIM 在庫管理は Leaf 拡張として新 spec が必要

App 104 は Garden 側の既存 spec に対応するものがない。
- 新 spec: `2026-04-25-leaf-kanden-sim-inventory.md`（要起草）
- Batch 13 補足 or Batch 16 候補
- 見積: 0.5d 起草 / 1.0d 実装

### 5.3 Root Partners テーブル（新規）

App 38 に対応する `root_partners` テーブルが Garden 側に未存在。新規 spec 必要：
- 新 spec: `2026-04-25-root-partners-table.md`（要起草）
- Root Phase B として位置付け
- 見積: 0.4d 起草 / 0.8d 実装

### 5.4 Garden 共通履歴 UI（Batch 14 spec）への寄与

App 38 の入力履歴 SUBTABLE は Batch 14（横断履歴 UI）の **典型的な対応事例**。
モジュール統合 spec での参照例として活用可能。

---

## 6. 判断保留事項（東海林さんへの確認）

### 必要な追加確認
1. **App 55 の供給地点番号フィールド**: 画像検索 8 条件で要求されたが Kintone schema に明示なし。実フィールド名 or 関電 Excel 側に存在するか
2. **App 55 の申込者・代表者フィールド**: 同上、不在の場合は関電 Excel から取込する方式か
3. **電話番号重複フィールド**の運用ルール: 重複検出はどうやってる？Garden では unique 制約 + 警告 UI で代替か
4. **離脱先**フィールド (App 55): 他社電力会社移行先の自由記述か、enum 化候補か
5. **App 104 の SIM 在庫**: 何台規模？10台程度 or 100 台超？データ移行戦略に影響
6. **App 38 の部署名 enum**: 「訪問営業」以外の値も定期的に追加されるか？enum vs text 判断
7. **App 38 の team_name**: 個人名混在の理由？人別チームか、組織再編で増減するか

### 設計判断
1. **ブレーカー商材を Leaf にするか別モジュール化するか**: App 55 にブレーカー専用フィールド多数、Leaf 拡張 vs `leaf_breaker_cases` 別テーブル
2. **Garden で関電案件と他電力会社案件を統合管理するか**: App 55 は関電のみ、他社電力 (`離脱先`) は別 Leaf 商材スケルトン (`leaf_others`) との連携設計
3. **Kintone を完全廃止するか並行運用か**: Garden が α/β 段階の間は並行運用、リリース後 Kintone 廃止が現実的

### Garden Leaf Phase C spec 補足が必要な項目
- 12 ヶ月使用量データ（App 55 数値13-24）の JSONB or 配列カラム or 別テーブル
- ブレーカー専用フィールドの分離戦略
- ガス検針日 4 件のデータモデル（最大 4 つで足りるか、JSONB か）

---

## 7. 次アクション

### 即時（東海林さん帰宅後）
- 上記「判断保留事項」7 件のうち 4-5 件を東海林さん即決
- 関電責任者への追加ヒアリング（供給地点番号 / 申込者 / 代表者の所在）

### 近日（数日内）
- `2026-04-25-leaf-kanden-sim-inventory.md` 起草（auto Batch 16 候補）
- `2026-04-25-root-partners-table.md` 起草（auto Batch 16 候補 or a-root に依頼）
- Leaf Phase C spec（PR #29 / #44）に**追記 PR** で App 55 詳細フィールド対応を反映

### Phase B-1 着手時
- `leaf_kanden_cases` migration（App 55 → Garden 移行）
- `root_partners` migration（App 38 → Garden 移行）
- `root_employees` への外注データ取込（部署名='訪問営業' フィルタ）
- `leaf_kanden_sim_devices` migration（App 104 → Garden 移行）

---

## 付録 A: Kintone API トークン情報（要ローテ）

**重要**: 本分析で使用した 3 トークンは 2026-04-25 にチャットへ平文で共有された。
`feedback_token_leak_policy.md` 東海林さん個人方針（時間優先）により分析を進めたが、**Garden 本番運用前に必ずローテ推奨**。

| アプリ | トークン状態 |
|---|---|
| App 55 | 🟡 ローテ推奨 |
| App 104 | 🟡 ローテ推奨 |
| App 38 | 🟡 ローテ推奨 |

ローテ手順は memory `feedback_token_leak_policy.md` の Step 2 を参照。

---

## 付録 B: 取得済 schema ファイル

ローカル保存場所: `C:/garden/a-main/tmp-kintone-analysis/`
- `app55-kanden-list-fields.json` (74 fields)
- `app104-kanden-sim-fields.json` (25 fields)
- `app38-partners-fields.json` (41 fields)
- `_analysis-summary.md` (フィールド分類)

これらは作業用ファイル、本 spec に集約済。`tmp-kintone-analysis/` は東海林さん帰宅後に削除可能（gitignore 推奨）。
