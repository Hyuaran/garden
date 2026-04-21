# 進行期データ自動更新機能 設計書

**作成日**: 2026-04-21
**対象モジュール**: Garden-Forest
**関連テーブル**: `shinkouki`, `fiscal_periods`, `companies`

---

## 🎯 目的

Forest ダッシュボードに表示している **進行期の速報値（売上・外注費・利益）** を、税理士から届く月次試算表 PDF から **自動/半自動** で更新できるようにする。

**背景**: 現状は Supabase Table Editor で手動 INSERT するしか方法がなく、毎月のデータ更新の手間とミスのリスクがある。旧GAS版（`003_GardenForest_使用不可/update_shinkouki_v3.py`）では PDF 自動抽出スクリプトが既に存在したが、Next.js + Supabase 版には移植されていない。

---

## 📋 全体構成（3フェーズ）

| フェーズ | 内容 | 対象ユーザー | 実装優先 |
|---|---|---|---|
| **A1** | Python スクリプトを Supabase 対応に改修 | 東海林さん（PowerShell実行） | **最優先** |
| **A2** | Next.js UI で PDF アップロード → 自動反映 | 後道社長（非エンジニア） | A1 完了後 |
| **A3** | 手動編集モーダル（A2の数値修正用） | 管理者全員 | A2 と同時 |

### フェーズ区切りの考え方

- **A1 は最速で動く環境を作る**: 既存 Python ロジック（`pdfplumber` ベース）を流用するため、数時間で動作可能。
- **A2 は運用の民主化**: Python 実行スキルがない後道社長でも、ブラウザから PDF を放り込めば更新できるようにする。
- **A3 は A2 の保険**: PDF 抽出は完璧ではない（金額の読み間違い、外注費カテゴリの分類違い等）。UI 上で手動修正できるモーダルを用意。

---

## 🔵 Phase A1: Python スクリプト（Supabase 対応版）

### 機能

- `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\D_税理士連携データ\*.pdf` を走査
- 各 PDF から以下を抽出:
  - 会社名（`ヒュアラン` / `センターライズ` / `リンクサポート` / `ＡＲＡＴＡ` / `たいよう` / `壱`）
  - 売上高合計
  - 外注費（営業外除く）
  - 当期純損益金額
  - 対象期間（至 令和X年Y月）
- 抽出結果を Supabase `shinkouki` テーブルに UPDATE

### 既存ロジックとの差分

旧版 `update_shinkouki_v3.py` の以下を**そのまま流用**:
- PDF 判定ロジック（残高試算表 / 損益計算書 / 貸借対照表）
- テーブル抽出（`pdfplumber`、前期比較 vs 通常試算表の列構成判定）
- 会社名マッピング
- 数値抽出（売上高合計 / 外注費 / 当期純損益金額）

新規に実装するのは:
- Supabase Python クライアント接続（`supabase-py`）
- HTML 書き換え → `shinkouki` UPDATE への変更
- `reflected` 列の更新フォーマット（例: "2026/6まで反映中"）
- 実行ログの出力（どの会社がいつ更新されたか）

### 格納場所

- 配置: `scripts/update_shinkouki_supabase.py`（既存 `seed-forest.ts` と同階層）
- 環境変数: プロジェクトルートの `.env.local` から `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を参照
- 実行方法: PowerShell から `python scripts/update_shinkouki_supabase.py`
- 依存: `pdfplumber`, `supabase-py`, `python-dotenv`（`scripts/requirements.txt` で管理）

### 認証

- Service Role Key を使用（管理用スクリプトのため、RLS をバイパス）
- 本番DBに直接書き込むため、実行は東海林さんのみに限定

---

## 🟢 Phase A2: Web UI で PDF アップロード

### 機能

1. Forest ダッシュボードの「進行期」バッジをクリック → モーダル起動
2. モーダル内に **「📄 PDFから自動入力」** ボタン
3. ファイル選択ダイアログ → PDF 選択
4. アップロード → サーバー側で解析（Next.js API Route）
5. 抽出結果をフォームにプリフィル
6. ユーザー確認後「保存」→ Supabase UPDATE

### 技術スタック

- **PDF 解析**: サーバー側で `pdf-parse` または `pdfjs-dist`
- **API**: Next.js App Router の Route Handler (`/api/forest/parse-pdf`)
- **認証**: Supabase Auth セッション + `forest_users.role='admin'` チェック
- **RLS**: `shinkouki` UPDATE ポリシーを admin 限定に絞る

### 対象ユーザー

- 後道社長（非エンジニア）
- 東海林さん（管理者）
- 管理画面は admin ロールのみアクセス可

### エラー時の動作

- PDF 解析失敗 → エラーメッセージ表示 + 「手動入力」タブにフォールバック
- 会社名を検出できない → ユーザーに会社選択を促す
- 数値の一部が null → その欄だけ空欄でプリフィル（手動入力を促す）

---

## 🟡 Phase A3: 手動編集モーダル

### UI 構成

モーダル（最大幅 560px、中央配置）:

**ヘッダー**:
- 会社色ドット + 「ヒュアラン 第9期」 + 「進行期」バッジ
- 閉じるボタン（✕）

**タブ**:
- 📊 **数値更新**（デフォルト）
- 🔄 **期の切り替え**

### 📊 数値更新タブ（通常運用）

| 入力項目 | 型 | 備考 |
|---|---|---|
| 売上高 | number | 3桁区切り表示、赤字は「-」 |
| 外注費 | number | 3桁区切り表示 |
| 経常利益 | number | 3桁区切り表示、赤字対応 |
| 反映済み期間 | text | 例: 「4月〜6月」 |
| 状態 | radio | 暫定 / 確定 |

### 🔄 期の切り替えタブ（年1回）

進行期を「確定決算」として `fiscal_periods` テーブルに昇格し、次期の進行期を開始する。

| 入力項目 | 型 | 備考 |
|---|---|---|
| 純資産 | number | `fiscal_periods.junshisan` |
| 現金 | number | `fiscal_periods.genkin` |
| 預金 | number | `fiscal_periods.yokin` |
| 決算書URL | url | Google Drive リンク |

**確認ダイアログ**:
> ⚠️ 第9期を確定決算として保存し、第10期の進行期をスタートします。  
> この操作は取り消せません。

**処理内容（トランザクション）**:
1. `shinkouki` の現在値 + 新規入力値を合体して `fiscal_periods` に INSERT
2. `shinkouki` を UPDATE: `ki=ki+1`, `yr=yr+1`, `range` 更新, 数値を NULL にリセット, `zantei=true`
3. 監査ログに `period_rollover` として記録

---

## 🔐 認可設計

### RLS ポリシー追加

```sql
-- shinkouki UPDATE: admin のみ可
CREATE POLICY "shinkouki_admin_update" ON shinkouki
  FOR UPDATE TO authenticated
  USING (public.is_forest_admin(auth.uid()))
  WITH CHECK (public.is_forest_admin(auth.uid()));

-- fiscal_periods INSERT: admin のみ可（期切り替え時）
CREATE POLICY "fiscal_periods_admin_insert" ON fiscal_periods
  FOR INSERT TO authenticated
  WITH CHECK (public.is_forest_admin(auth.uid()));
```

### 監査ログ追加アクション

- `update_shinkouki` — 進行期数値更新
- `upload_pdf` — PDF アップロード（成功/失敗問わず記録）
- `period_rollover` — 期切り替え実行

---

## 🧪 テスト方針

### Phase A1 スクリプト
- 既存の `D_税理士連携データ` の PDF 4ファイルで実行
- Supabase の `shinkouki` テーブルに期待通り反映されることを確認
- 旧版 HTML を書き換えていないこと（副作用なし）を確認

### Phase A2 Web UI
- 管理者ログイン → モーダル起動 → PDF アップロード → プリフィル
- viewer ログインではモーダル操作不可（RLS で UPDATE 拒否）
- 抽出失敗 PDF（画像のみ等）でエラーメッセージ表示

### Phase A3 手動編集
- 数値更新: 各社 1 社ずつ編集 → ダッシュボード再描画
- 期切り替え: 壱のデータで実行（現在データなしなので安全）→ fiscal_periods に正しく保存

---

## 📂 ファイル構成（予定）

### Phase A1
```
scripts/
  update_shinkouki_supabase.py  ← 新規
  requirements.txt               ← 新規（pdfplumber, supabase, python-dotenv）
.env.local                       ← 既存（SUPABASE_URL / SERVICE_ROLE_KEY 利用）
```

### Phase A2 & A3 (Next.js)
```
src/app/forest/
  _components/
    ShinkoukiEditModal.tsx       ← 新規（タブ付きモーダル）
    PdfUploader.tsx              ← 新規（A2 PDFアップロード）
    PeriodRolloverForm.tsx       ← 新規（A3 期切り替え）
  _lib/
    shinkouki-mutations.ts       ← 新規（UPDATE 関数群）
  dashboard/page.tsx             ← 既存 / 進行期バッジにクリックハンドラ追加

src/app/api/forest/
  parse-pdf/route.ts             ← 新規（PDF解析API）

scripts/
  forest-schema-patch-002.sql    ← 新規（RLSポリシー追加）
```

---

## 🚀 完了条件

### Phase A1 完了
- [ ] `update_shinkouki_supabase.py` が動作する
- [ ] D_税理士連携データの 4社分 PDF から正しく数値抽出
- [ ] Supabase `shinkouki` が更新される
- [ ] ダッシュボードに新しい値が表示される

### Phase A2 完了
- [ ] admin ユーザーがブラウザから PDF をアップロードできる
- [ ] PDF から数値が正しく抽出され、フォームにプリフィルされる
- [ ] 保存ボタンで Supabase が更新される
- [ ] viewer ユーザーはモーダルを開けない

### Phase A3 完了
- [ ] 手動編集モーダルで数値を修正できる
- [ ] 期切り替え機能で進行期→確定決算期への昇格ができる
- [ ] 全操作が監査ログに記録される

---

## 🔗 関連ドキュメント

- 既存スクリプト: `003_GardenForest_使用不可/update_shinkouki_v3.py`
- Forest 全体設計: `docs/superpowers/specs/2026-04-16-forest-migration-design.md`
- 認証ポリシー: `.claude/memory/project_garden_auth_policy.md`
- Phase A レビュー: `docs/superpowers/reviews/2026-04-17-forest-phase-a-review.md`
