# 仕訳帳機能 Garden 化 設計書

**作成日**: 2026-04-26
**対象**: 6法人共通の自動仕訳・弥生連携・確認用 Excel 生成 一連のフロー
**現在の実装**: ローカル PC 上の Python スクリプト群（`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\`）
**移行先（暫定）**: **Garden Forest 配下** で着手し、後に **Garden Bud に移行**

---

## ⚠️ 配置場所に関する重要な原則

### CLAUDE.md のモジュール責務定義

| モジュール | 役割 |
|---|---|
| **Bud（蕾）** | **経理・収支（明細・振込・損益・給与）** ← 仕訳帳の本来の置き場所 |
| **Forest（森）** | 全法人の決算資料等（経営ダッシュボード視点） |

仕訳帳は経理処理（明細取込・自動仕訳・弥生連携）であり、本来 **Garden Bud の責務**。

### 暫定 Forest / 将来 Bud 移行ポリシー

#### なぜ暫定 Forest なのか

- Garden Bud はまだ存在しないモジュール（`src/app/bud/` 未作成）
- Garden Forest はすでに 経営ダッシュボード+進行期データ更新（PDF→Supabase）として稼働中
- 試算表 PDF（`D_税理士連携データ`）は **Forest の進行期更新機能ですでに利用済み**
- 「先に動くものを作って試したい」現場ニーズに合わせる

#### 必ず守ること（後で Bud に切り出すための前提）

1. **配置パス**: `src/app/forest/shiwakechou/` 配下に隔離する（Forest コアと混ぜない）
2. **DBテーブル名**: `bud_*` プレフィックス（後で Bud に移すときテーブル名は変えない）
3. **共有ライブラリ依存禁止**: `src/app/forest/_components` などのコアパッケージを直接 import しない。共通利用するなら `src/lib/` に出す
4. **認証・権限**: Forest の `forest_users.role='admin'` を一時流用するが、最終的には `bud_users.role` ベースに切り替える設計余地を残す
5. **移行期限**: Garden Bud モジュール立ち上げ時（目安：6ヶ月以内）に必ず `src/app/bud/shiwakechou/` へ移動

#### 移行時の作業見積（参考）

- ファイル移動（`forest/shiwakechou/` → `bud/shiwakechou/`）
- import パスの一括書き換え
- `forest_users` チェック → `bud_users` チェックへの変更
- 監査ログのテーブル分離（`forest_audit_log` → `bud_audit_log`）
- メニュー・ナビゲーション差し替え

---

## 🎯 目的

ローカル PC 上の Python スクリプトで運用されている仕訳帳処理を Garden の Web UI で再現し、以下を実現する：

1. **どこからでも操作可能**: PC が違ってもブラウザでログインすれば作業できる
2. **複数人で並行作業**: 経理担当を複数人化したときの分担に対応（東海林さん→将来 専任経理）
3. **マスタ・処理状態の一元管理**: ローカル Excel ではなく Supabase で一元管理し、誰が何をしたかの履歴を残す
4. **PDF・CSV 取込の自動化を継続**: 既存の自動判定（口座移し替え検出・法人間取引検出・マスタ参照）をそのまま移植

---

## 📋 現状の Python スクリプト一覧（移行対象）

| # | スクリプト | 役割 | 入力 | 出力 |
|---|---|---|---|---|
| 1 | `3_口座設定.py` | 法人別・銀行別の口座マスタ（コード/補助科目）と口座間移し替え判定用テーブル | （定数定義のみ） | 他スクリプトから import |
| 2 | `4_仕訳帳_弥生出力_v11.py` | 銀行 CSV/Excel/みずほ API → 確認用 Excel 生成 + マスタ自動追記 | 楽天/PayPay/京都/みずほ の各銀行データ | `確認用_BK_法人名_日付.xlsx`, 共通マスタ追記 |
| 3 | `5_仕訳帳_弥生変換_v7.py` | 確認用 Excel（修正済み） → 弥生インポート CSV | 確認用 Excel（OK 行のみ） | `弥生インポート_法人名_日付.csv`, 元データの「処理済み」アーカイブ |
| 4 | `6_マネーフォワード取込_v5.py` | MF 仕訳帳 CSV から銀行 CSV と重複しない明細を抽出 → 確認用 Excel | `マネーフォワード*.csv` | `確認用_MF_法人名_日付.xlsx` |
| 5 | `7_クレジットカード明細_v5.py` | オリコ / NTTBiz / 三井住友 各カード明細 → 確認用 Excel | カード会社別フォルダ内の CSV/PDF | `確認用_CC_法人名_日付.xlsx` |
| 6 | `8_現金領収書_v3.py` | 現金領収書（手入力 or 画像）→ 確認用 Excel | 現金領収書データ | `確認用_現金_法人名_日付.xlsx` |
| 7 | `bk_yayoi_export_v3.py` | 銀行明細 → 弥生エクスポート（v11 のサブセット） | 銀行 CSV | 弥生 CSV |
| 8 | `genkin_yayoi_export_v1.py` | 現金領収書 → 弥生エクスポート | 現金確認用 Excel | 弥生 CSV |
| 9 | `cc_process.py` | CC 明細処理の補助モジュール | （内部利用） | （内部利用） |

### マスタ Excel

| ファイル | 役割 | レコード件数（目安） |
|---|---|---|
| `1_共通マスタ_v12.xlsx` | 取引内容→借方/貸方/税区分 のマッピング表（全法人共通） | 数百〜数千行 |
| `2_法人間取引マスタ_v5.xlsx` | 6法人間の入出金（売掛/買掛/役員報酬/外注費 等の自動振分け） | 数十行 |

### サブフォルダ（運用データ）

```
001_仕訳帳/
├── 01_株式会社ヒュアラン/
│   ├── 1_銀行/
│   │   ├── 1_銀行データを格納/      ← 入力 CSV
│   │   ├── 2_確認データをチェック/  ← 確認用 Excel
│   │   └── 3_完成データを確認/      ← 弥生 CSV
│   ├── 2_クレジットカード/    ← 同構成
│   └── 3_現金領収書/         ← 同構成
├── ... 06_株式会社壱 まで（全6法人同構成）
├── D_税理士連携データ/   ← 試算表 PDF（Forest 既利用）
├── E_賃金台帳/          ← 給与原資（Bud 給与機能）
└── F_Chatwork送信用まとめ/  ← Chatwork 送信用ファイル
```

---

## 🏗️ Web 化のアーキテクチャ

### 全体フロー

```
[ユーザー（東海林さん）]
        ↓ ブラウザログイン
[Garden Forest /shiwakechou] ─── 認証: Forest admin role
        ↓
[Next.js App Router pages]
   ├── /forest/shiwakechou               一覧（法人選択）
   ├── /forest/shiwakechou/[corp_id]     法人別ダッシュボード
   ├── /forest/shiwakechou/[corp_id]/bk  銀行明細処理
   ├── /forest/shiwakechou/[corp_id]/mf  MF処理
   ├── /forest/shiwakechou/[corp_id]/cc  CC処理
   ├── /forest/shiwakechou/[corp_id]/cash 現金領収書処理
   └── /forest/shiwakechou/master         共通マスタ管理
        ↓
[API Routes: src/app/api/forest/shiwakechou/]
   ├── /upload-bk          銀行ファイル受付＋解析
   ├── /upload-mf          MFファイル受付
   ├── /upload-cc          CCファイル受付
   ├── /resolve            未確定取引の確定処理
   ├── /export-yayoi       弥生CSV書き出し
   └── /master             マスタ CRUD
        ↓
[Supabase]
   ├── bud_corporations         法人マスタ
   ├── bud_bank_accounts         口座マスタ
   ├── bud_master_rules          共通仕訳マスタ（旧 1_共通マスタ_v12.xlsx）
   ├── bud_intercompany_rules    法人間取引マスタ（旧 2_法人間取引マスタ_v5.xlsx）
   ├── bud_transactions          取引明細（仕訳化前/後 統合）
   ├── bud_yayoi_exports         弥生CSV エクスポート履歴
   ├── bud_files                 アップロードされた元ファイル（Supabase Storage）
   └── bud_audit_log             仕訳帳操作ログ
```

### バックエンド責務分離

| レイヤー | 責務 |
|---|---|
| `src/app/forest/shiwakechou/` | UI / 画面遷移 / フォーム |
| `src/app/api/forest/shiwakechou/` | API Route（認証チェック→ライブラリ呼び出し） |
| `src/lib/shiwakechou/` | コア処理ライブラリ（解析・判定・出力）。**Bud 移行時もそのまま流用** |
| Supabase | データ保管・RLS・履歴管理 |

---

## 🗄️ データモデル設計

### `bud_corporations` 法人マスタ

| 列 | 型 | 説明 |
|---|---|---|
| id | text PK | `hyuaran` / `centerrise` / `linksupport` / `arata` / `taiyou` / `ichi`（Forest と共通） |
| code | text | `01_株式会社ヒュアラン` などの旧コード（移行時の対照用） |
| name_full | text | `株式会社ヒュアラン` |
| name_short | text | `ヒュアラン` |
| sort_order | int | 表示順 |

> Forest の `companies` テーブルと **同 ID 体系** を維持。将来 `bud_corporations` を Forest と統合する余地。

### `bud_bank_accounts` 口座マスタ

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| corp_id | text FK | `bud_corporations.id` |
| bank_name | text | `みずほ銀行` 等 |
| bank_code | text(4) | 金融機関コード |
| branch_code | text(3) | 支店コード |
| account_number | text | 口座番号 |
| account_type | text | `普通預金` / `当座預金` |
| sub_account_label | text | 弥生用補助科目（旧 Python の「補助科目」） |
| is_active | boolean | |

### `bud_master_rules` 共通仕訳マスタ（旧 1_共通マスタ.xlsx 相当）

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| pattern | text | 摘要の判定キーワード（部分一致） |
| pattern_kind | text | `prefix` / `contains` / `regex` |
| direction | text | `withdrawal`(出金) / `deposit`(入金) / `both` |
| category | text | 区分（通信費 / 交際費 …） |
| debit_account | text | 借方科目 |
| credit_account | text | 貸方科目 |
| tax_class | text | 税区分（`課税仕入 10%` 等） |
| is_intercompany | boolean | |
| created_by | uuid | 作成者 |
| updated_at | timestamptz | |

### `bud_intercompany_rules` 法人間取引マスタ（旧 2_法人間取引マスタ.xlsx 相当）

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| from_corp_id | text FK | 出金側法人 |
| to_corp_id | text FK | 入金側法人 |
| direction | text | `payable` / `receivable` / `bonus` 等 |
| debit_account | text | |
| credit_account | text | |
| tax_class | text | |
| memo | text | |

### `bud_transactions` 取引明細（中核テーブル）

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| corp_id | text FK | |
| source_kind | text | `bk`(銀行) / `mf`(マネフォ) / `cc`(クレカ) / `cash`(現金) |
| source_file_id | uuid FK | `bud_files.id` |
| transaction_date | date | |
| amount | bigint | |
| flow | text | `withdrawal` / `deposit` |
| description | text | 摘要（原文） |
| bank_account_id | uuid FK NULL | `bud_bank_accounts.id`（BK のみ） |
| card_issuer | text NULL | `オリコ` / `NTTBiz` / `三井住友` |
| status | text | `pending`(要確認) / `ok`(確認済) / `intercompany`(法人間) / `internal_transfer`(自社間) |
| applied_rule_id | uuid FK NULL | `bud_master_rules.id` |
| debit_account | text NULL | |
| credit_account | text NULL | |
| tax_class | text NULL | |
| memo | text NULL | |
| confirmed_by | uuid NULL | 最終確認者 |
| confirmed_at | timestamptz NULL | |
| created_at | timestamptz | |

> ステータスを `pending` → `ok` へユーザーが手動で進める運用。

### `bud_yayoi_exports` 弥生 CSV エクスポート履歴

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| corp_id | text FK | |
| source_kind | text | `bk` / `mf` / `cc` / `cash` |
| period_from | date | |
| period_to | date | |
| transaction_count | int | エクスポート件数 |
| file_path | text | Supabase Storage パス |
| exported_by | uuid | |
| exported_at | timestamptz | |

### `bud_files` 元ファイル保管

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| corp_id | text FK | |
| source_kind | text | |
| original_filename | text | |
| storage_path | text | Supabase Storage パス |
| uploaded_by | uuid | |
| uploaded_at | timestamptz | |
| processed_at | timestamptz NULL | |

### `bud_audit_log` 操作監査

| 列 | 型 | 説明 |
|---|---|---|
| id | bigint PK | |
| user_id | uuid | |
| action | text | `upload_bk` / `upload_cc` / `resolve_tx` / `export_yayoi` / `master_create` 等 |
| target_id | text NULL | 対象レコード ID |
| meta | jsonb | 追加情報 |
| created_at | timestamptz | |

### RLS 方針

- **読取**: `forest_users.role IN ('admin')` ＋ 当面 admin のみ（経理担当が増えたら editor ロール追加）
- **書込**: 同上
- **`bud_master_rules` の更新**: 作成者のみ（履歴を残すため `updated_by` 等で誰が変更したか記録）

---

## 🖥️ UI 設計

### 画面 1: 仕訳帳トップ `/forest/shiwakechou`

- 6法人カード一覧（Forest ダッシュボードと同色系統の法人ドット）
- 各カードに「未処理件数」バッジ：BK / MF / CC / 現金 別
- 「共通マスタ管理」ボタン

### 画面 2: 法人ダッシュボード `/forest/shiwakechou/[corp_id]`

- ファイル種別タブ：📄 銀行 / 💳 クレジット / 💴 現金 / 🔄 マネフォ
- 各タブの中：
  - 「ファイルアップロード」ドロップゾーン
  - 「処理待ちキュー」一覧（未確認 / 確認済 / エクスポート済）
  - 「弥生CSV出力」ボタン

### 画面 3: 確認画面 `/forest/shiwakechou/[corp_id]/[kind]/[upload_id]`

旧「確認用 Excel」の Web 版。表形式で：

| 確認 | 日付 | 摘要 | 金額 | 区分 | 借方 | 貸方 | 税区分 | 備考 |
|---|---|---|---|---|---|---|---|---|

- 行の色分け（マニュアル準拠）：
  - 白：OK
  - 黄：要確認（ユーザー編集対象）
  - 水色：口座移し替え（自動判定）
  - 緑：法人間取引（自動判定）
- インライン編集 + 一括「OK化」ボタン
- 未登録パターンを `bud_master_rules` へ追記する「マスタ登録」ボタン

### 画面 4: 共通マスタ管理 `/forest/shiwakechou/master`

- パターン一覧（検索・フィルタ）
- 追加 / 編集 / 削除（履歴付き）
- 法人間取引マスタも同階層

### 画面 5: 弥生エクスポート履歴 `/forest/shiwakechou/[corp_id]/exports`

- 月別エクスポート履歴
- 再ダウンロード可能
- 弥生取り込み済みフラグ（手動チェック）

---

## 🔌 API 設計

| Route | Method | 用途 |
|---|---|---|
| `/api/forest/shiwakechou/upload-bk` | POST | 銀行ファイル受付（マルチパート）→ `bud_files` 保存 → Worker で解析 |
| `/api/forest/shiwakechou/upload-mf` | POST | MF CSV 受付 |
| `/api/forest/shiwakechou/upload-cc` | POST | CC ファイル受付（CSV/PDF） |
| `/api/forest/shiwakechou/upload-cash` | POST | 現金領収書（画像 / 入力データ） |
| `/api/forest/shiwakechou/transactions` | GET / PATCH | 取引一覧・更新 |
| `/api/forest/shiwakechou/master` | GET / POST / PATCH / DELETE | マスタ CRUD |
| `/api/forest/shiwakechou/intercompany` | GET / POST / PATCH / DELETE | 法人間取引マスタ |
| `/api/forest/shiwakechou/export-yayoi` | POST | 弥生 CSV 書き出し（Storage 保存 + 履歴登録） |
| `/api/forest/shiwakechou/parse-bk` | POST | （非同期 Worker）BK 明細解析 |

### ランタイム選択

- ファイル解析（PDF / Excel）→ **`runtime = "nodejs"`**（Edge は重い処理に不向き）
- マスタ操作 → Edge OK

### 認証

- すべての API で Authorization: Bearer JWT 必須
- `forest_users.role = 'admin'` を確認するヘルパー（既存 `isForestAdmin()` を流用）

---

## 🔄 既存ロジックの移植マップ（Python → TypeScript）

| Python 機能 | 移植先 | ライブラリ・実装方針 |
|---|---|---|
| 楽天/PayPay/京都/みずほ CSV パーサ | `src/lib/shiwakechou/parsers/bank/*.ts` | 銀行ごとに別ファイル、CSV ライブラリ `papaparse` |
| みずほ API（.api 形式）パーサ | `src/lib/shiwakechou/parsers/bank/mizuho-api.ts` | バイナリ独自フォーマット解析（既存 Python ロジックを TS 化） |
| Excel 解析 | `src/lib/shiwakechou/parsers/excel.ts` | `exceljs` |
| MF 仕訳帳 CSV パーサ | `src/lib/shiwakechou/parsers/mf.ts` | papaparse |
| CC 明細パーサ | `src/lib/shiwakechou/parsers/cc/{orico,nttbiz,smbc}.ts` | papaparse + pdfjs-dist（既存 PoC あり） |
| 自動判定（3段階）| `src/lib/shiwakechou/classifier.ts` | 口座移し替え→法人間→共通マスタ の優先順位を再現 |
| 弥生 CSV 生成 | `src/lib/shiwakechou/yayoi-export.ts` | カラム順・税区分マッピング・補助科目連結を再現 |
| マスタ追記 | `src/lib/shiwakechou/master-suggest.ts` | 未登録パターンを `bud_master_rules` に提案レコードとして保存 |
| 飲食店 5,000 円判定（CC） | `src/lib/shiwakechou/classifier-cc.ts` | 5,000 円以下＝会議費／超＝接待交際費（インボイス前提） |

---

## 📦 Phase 分割

### Phase 1（最小機能・現場投入可能）

- 法人マスタ＋口座マスタの DB 化（移行スクリプト）
- 銀行 CSV アップロード→確認画面→弥生 CSV 出力（楽天 / PayPay / 京都 / みずほ）
- 共通マスタ Web 画面
- 監査ログ
- **目的**: 現状 Python の **「BK 処理」のみ** を Web 化して並走運用

### Phase 2（CC・MF）

- CC 明細処理（オリコ / NTTBiz / 三井住友 の各社対応）
- MF 仕訳帳取込（重複除外含む）

### Phase 3（現金・賃金台帳・連携）

- 現金領収書処理（写真→OCR は別フェーズ、まず手入力フォーム）
- 賃金台帳取込（給与処理、Bud 給与機能としても整理）

### Phase 4（**Bud モジュールへ正式移行**）

- ファイル一式を `src/app/bud/shiwakechou/` へ移動
- ブランディング・ナビゲーションを Bud 用に切替
- 監査ログ・権限テーブルを Bud 用に分離
- 移行完了後は Forest からこの機能を削除

---

## ⚠️ 移行中の注意事項

### 旧 Python スクリプトとの並走期間

- Phase 1 リリース直後は **Web 版と Python 版を並走**（同じ月の同じ取引が二重計上されないよう、月単位でどちらが正かを明確化）
- 並走終了後、Python スクリプトは `001_仕訳帳/00_旧バージョン/` 配下に退避（即削除はしない）

### マスタの初期投入

- `1_共通マスタ_v12.xlsx` の現行データを **`bud_master_rules` に一括 INSERT する移行スクリプト** を Phase 1 着手時に作成
- `2_法人間取引マスタ_v5.xlsx` も同様に `bud_intercompany_rules` へ

### Supabase Storage の扱い

- アップロードされた銀行 CSV / CC PDF などは Supabase Storage の `bud-files` バケットに保存
- 監査要件として **最低 7 年間保管**（税法上の帳簿保存期間に合わせる）
- バケット直下に `[corp_id]/[YYYY]/[MM]/` の階層

### 銀行 API（みずほ） の取扱い

- `.api` 形式の独自フォーマット（Python の現実装）の TS 移植は工数大
- 暫定対応: みずほは「Excel ダウンロード→Web アップロード」運用に切替
- 余裕ができたら API 形式をネイティブ対応

### 税理士連携データ（PDF）の扱い

- `D_税理士連携データ/` の試算表 PDF は **Forest の進行期更新機能で既に利用中**（重複させない）
- 仕訳帳 Web 版は **試算表 PDF を扱わない**

---

## 🎯 完了条件（Phase 1 ）

- [ ] `bud_*` テーブル群が Supabase に作成されている
- [ ] 共通マスタ Web 画面で CRUD 可能
- [ ] 楽天 / PayPay / 京都 / みずほ の CSV を Web 上でアップロード→自動判定→確認→弥生 CSV ダウンロードまでできる
- [ ] 既存 Python スクリプトの確認用 Excel 出力結果と Web 版の結果が **同じ値** で一致（テストフィクスチャで検証）
- [ ] 監査ログにすべての操作が記録される
- [ ] admin 以外はアクセス不可（403）

---

## 📚 関連ドキュメント

- 本仕様書: `docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md`
- 旧マニュアル: `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\0_使用マニュアル.html`
- 旧 Python ソース: `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\*.py`
- Garden CLAUDE.md: モジュール責務（Bud / Forest）
- Forest 既存設計書: `docs/superpowers/specs/2026-04-21-shinkouki-auto-update-design.md`（試算表 PDF 取込み）

---

## 🔗 改訂履歴

| 日付 | 改訂者 | 内容 |
|---|---|---|
| 2026-04-26 | a-forest | 初版。暫定 Forest / 将来 Bud 移行ポリシーを明記 |
