# Garden Series — 残作業リスト（v3.0以降の実装計画）

> v2.8a でホーム画面のUIプロトタイプは完成。
> 本ドキュメントは、Next.js + Supabase での本格実装に向けた**残作業の全体像**を示します。

---

## 0. 優先順位の考え方

| 優先度 | 意味 |
|---|---|
| 🔴 P0 | 本番運用開始の前提（認証・基盤・最低限のデータ表示） |
| 🟡 P1 | 各モジュールの主機能（Bloom, Bud, Tree等） |
| 🟢 P2 | 拡張機能（API連携・通知・派生機能） |
| 🔵 P3 | 改善・追加（UI微調整・新機能） |

---

## 1. 🔴 P0：基盤整備

### 1-1. Next.js プロジェクト初期化

- [ ] `create-next-app` でプロジェクト雛形作成（App Router・TypeScript・Tailwind有効）
- [ ] GitHub リポジトリ作成・初回 push
- [ ] Vercel プロジェクト連携
- [ ] 環境変数設計（`.env.local`, `.env.production`）
- [ ] ESLint / Prettier 設定

### 1-2. デザインシステム移植

- [ ] CSS変数を `app/globals.css` に移植（`DESIGN_SPEC.md` 参照）
- [ ] `tailwind.config.ts` でカラー・フォント・寸法を定義
- [ ] Google Fonts を `next/font` で最適化読込
- [ ] `next-themes` でライト/ダーク切替を実装
- [ ] 画像アセットを `public/images/` 配下に移植

### 1-3. ホーム画面コンポーネント化

- [ ] `app/layout.tsx`：Topbar・Sidebar・BackgroundLayer・ThemeProvider 配置
- [ ] `app/page.tsx`：ホーム画面のサーバーコンポーネント
- [ ] `components/layout/Topbar.tsx`：左ロゴ・中央検索・右情報群
- [ ] `components/layout/Sidebar.tsx`：ナビ7項目 + Help カード
- [ ] `components/layout/BackgroundLayer.tsx`：背景フェード切替
- [ ] `components/home/Greeting.tsx`：時刻に応じた挨拶
- [ ] `components/home/KpiGrid.tsx` + `KpiCard.tsx`（4種類のバリアント）
- [ ] `components/home/OrbGrid.tsx` + `OrbCard.tsx`
- [ ] `components/home/ActivityPanel.tsx`（高さ自動調整含む）
- [ ] `lib/theme/`：テーマ切替ロジック
- [ ] `lib/sound/`：Web Audio APIラッパー

### 1-4. Supabase 接続

- [ ] Supabase プロジェクト作成
- [ ] Auth 設定（メール認証 or OAuth）
- [ ] `@supabase/ssr` による Next.js 連携
- [ ] サーバー/クライアント両用のクライアント生成関数
- [ ] 接続テスト用ダミーテーブル

### 1-5. 認証フロー

- [ ] ログイン画面 (`app/login/page.tsx`)
- [ ] ログアウト処理
- [ ] ミドルウェア（`middleware.ts`）で未ログイン時リダイレクト
- [ ] パスワードリセットフロー
- [ ] 初回ログイン時のプロフィール登録

---

## 2. 🔴 P0：データベース設計（Supabase）

### 2-1. ユーザー・組織関連

#### `corporations` テーブル
```
id (uuid, PK)
name (text) -- 株式会社ヒュアラン 等
representative_name (text) -- 代表者名
hq_address (text) -- 本店所在地
established_at (date)
created_at, updated_at
```

#### `users` テーブル（Supabase Auth拡張）
```
id (uuid, PK = auth.users.id)
display_name (text)
email (text)
employment_type (enum) -- 役員|正社員|契約社員|アルバイト|業務委託|派遣自社→他社|派遣他社→自社|パートナー
permission_level (int) -- 1〜7（Garden権限7段階）
avatar_url (text, null)
created_at, updated_at
```

#### `user_corp_memberships` テーブル（中間）
```
id (uuid, PK)
user_id (uuid, FK → users.id)
corp_id (uuid, FK → corporations.id)
role_in_corp (text) -- 法人内での役割
is_primary (bool) -- 主所属法人かどうか
created_at, updated_at
```

#### `user_sessions` テーブル
```
id (uuid, PK)
user_id (uuid, FK)
active_corp_id (uuid, FK → corporations.id) -- 現在切替中の法人
last_login (timestamptz)
```

### 2-2. RLS（Row Level Security）方針

- すべてのテーブルに `corp_id` 列
- ポリシー：「ログインユーザーが `user_corp_memberships` で `active_corp_id` に所属している場合のみ参照/編集可」
- L7（最終承認＝後道代表）は全 `corp_id` を横断的に参照可能
- L6（東海林さんレベル）は所属法人すべてを横断管理可能

### 2-3. 各モジュールテーブル（v3.0以降の段階実装）

詳細は各モジュール実装時に設計。最低限の雛形を以下に：

#### Bloom（案件・KPI）
- `cases` （案件）
- `daily_reports` （日報）
- `kpi_summary` （KPI集計・ホーム画面用）

#### Bud（経理・収支）
- `transactions`
- `transfers`
- `pl_statements`
- `payrolls`

#### Tree（架電）
- `call_sessions`
- `call_results`

#### Soil（DB基盤）
- `lists`
- `call_history`
- `kanden_lists`

#### Root（組織・マスタ）
- `employees`
- `partners`
- `masters`
- `conditions`

#### Forest（決算）
- `corp_financial_reports`
- `consolidated_reports`

#### Rill（メッセージ）
- `messages`（Chatworkアダプター経由）

#### Calendar
- `schedules`
- `shifts`

---

## 3. 🟡 P1：実データ連携

### 3-1. ホーム画面のリアルデータ化

- [ ] **KPIカード**：`kpi_summary` テーブルから現在月の値を取得
  - 売上（今月）：合計値 + 前月比
  - 入金予定（今月）：合計値 + 前月比 + 月日別棒グラフ
  - 架電状況（今日）：完了数/予定数 + 達成率
  - 未処理タスク：件数 + 期限超過数 + 進捗率
- [ ] **ガラス玉カードのステータス**：各モジュールの現状を集計
  - Bloom：レポート更新数
  - Fruit：登記法人数（固定: 6法人）
  - Seed：構想中の事業数
  - Forest：対象FY
  - Bud：未処理仕訳数
  - Leaf：承認待ち件数
  - Tree：本日架電予定数
  - Sprout：採用選考中の件数
  - Soil：最終同期時刻
  - Root：期限超過の件数（マスタ更新等）
  - Rill：未読メッセージ数
  - Calendar：本日の予定数
- [ ] **Today's Activity**：`activity_log` から最新5件を取得
  - 売上更新、入金、タスク割当、ワークフロー承認、システム通知 等

### 3-2. アクティビティログ設計

#### `activity_log` テーブル
```
id (uuid, PK)
corp_id (uuid, FK)
type (enum) -- report_updated|payment_received|task_assigned|workflow_approved|system_notice
icon_module (text) -- どのガラス玉のアイコンを使うか（tree, rill, bloom等）
title (text)
body (text)
related_user_id (uuid, null)
related_amount (bigint, null) -- 入金額等
occurred_at (timestamptz)
```

---

## 4. 🟡 P1：天気API連携

### 4-1. OpenWeatherMap などのAPI連携

- [ ] APIキー取得・環境変数設定
- [ ] サーバーサイドで天気を取得（東海林さん所在地：愛知県等）
- [ ] APIレスポンスを Garden 用キー（`sunny|partly_cloudy|...`）に変換するマッピング関数
- [ ] 1時間に1回程度のキャッシュ
- [ ] エラー時はフォールバック（時刻ベース自動切替）

### 4-2. 移行イメージ

```typescript
// 現状：時刻ベース自動切替
function autoWeatherByHour() { /* ... */ }

// 移行後：API応答ベース
async function fetchAndSetWeather() {
  try {
    const res = await fetch('/api/weather');
    const { weather } = await res.json();
    setWeather(mapApiToGardenKey(weather));
  } catch {
    autoWeatherByHour();
  }
}
```

---

## 5. 🟡 P1：法人切替機能（マルチテナント）

- [ ] Topbar 左側に「法人切替セレクタ」ドロップダウン配置
- [ ] 切替時に `user_sessions.active_corp_id` を更新
- [ ] 全データ取得クエリで `active_corp_id` を自動フィルタ
- [ ] L6/L7 ユーザーのみ「全法人ビュー（連結）」モードを選択可能

---

## 6. 🟢 P2：各モジュール内画面の設計

各モジュールごとに、ホーム画面のガラス玉をクリック → 個別画面へ遷移。
v3.0 以降、モジュールごとに段階的に実装。

### 6-1. 推奨実装順

| 順 | モジュール | 理由 |
|---|---|---|
| 1 | Bloom | KPI・日報は最も使用頻度が高い |
| 2 | Bud | 経理は東海林さんの本業 |
| 3 | Root | 組織マスタは他モジュールの前提 |
| 4 | Tree | 架電業務は売上に直結 |
| 5 | Leaf | 商材ごとの個別管理 |
| 6 | Soil | DB基盤の管理画面 |
| 7 | Forest | 決算は年次なので優先度はやや低い |
| 8 | Calendar | スケジュール |
| 9 | Sprout | 採用業務 |
| 10 | Rill | Chatwork API連携 |
| 11 | Seed | 新事業（必要時のみ） |
| 12 | Fruit | 表示のみ（テーブル不要） |

---

## 7. 🟢 P2：通知・連携

### 7-1. Chatwork API（Garden-Rill）

- [ ] Chatwork API キー管理
- [ ] メッセージ送受信
- [ ] 既読管理
- [ ] ホーム画面の Activity に Chatwork イベントを統合

### 7-2. メール通知

- [ ] Resend / SendGrid などでメール送信
- [ ] 重要イベント発生時のメール通知（承認依頼、期限超過等）

### 7-3. プッシュ通知（将来）

- [ ] PWA 化
- [ ] Web Push API

---

## 8. 🔵 P3：UI改善・追加機能

- [ ] スマホ向け本格対応（現状はPC優先）
- [ ] アバターアップロード機能
- [ ] ダッシュボードのカスタマイズ（KPIカードの差し替え）
- [ ] アクセシビリティ対応（ARIA、キーボード操作）
- [ ] 多言語対応（英語）
- [ ] 検索機能の本実装（現状ボックスのみ）

---

## 9. ❓ 後道代表との確認事項

実装を進める中で、後道代表に確認すべき事項：

- [ ] 本番ドメイン名（Vercel デプロイ時）
- [ ] Supabase 利用料金プランの承認
- [ ] 各種 API（OpenWeatherMap、Chatwork、メール等）の利用承認
- [ ] 管理者アカウントの初期発行ルール
- [ ] データバックアップ方針
- [ ] 個人情報取扱規程（ユーザー情報、顧客情報）
- [ ] プライバシーポリシー・利用規約

---

## 10. ガラス玉カード状態情報の実データ連携（詳細）

ホーム画面の各ガラス玉カードに表示される「ステータス値」のデータソース対応表：

| ガラス玉 | ラベル | 現在のダミー値 | データソース（候補） |
|---|---|---|---|
| Bloom | レポート更新 | 3 件 | `daily_reports` の本日更新数 |
| Fruit | 登記情報 | 6 法人 | `corporations.count()` |
| Seed | 構想中 | 2 件 | `seed_ideas` 等の新事業案 |
| Forest | 対象期 | FY2026 | 現在の会計年度（環境変数） |
| Bud | 未処理仕訳 | 12 件 | `transactions where reviewed=false` |
| Leaf | 承認待ち | 6 件 | `leaf_approvals where status='pending'` |
| Tree | 架電予定 | 15 件 | `call_sessions where date=today` |
| Sprout | 選考中 | 4 件 | `recruitment_candidates where status='in_progress'` |
| Soil | 同期最終 | 5分前 | システムジョブの `last_sync_at` |
| Root | 期限超過 | 3 件（赤） | `master_updates where deadline < now()` |
| Rill | 未読 | 8 件（金色） | Chatwork API レスポンス |
| Calendar | 本日予定 | 7 件 | `schedules where date=today` |

---

## 11. v3.0 のリリース基準（P0完了の定義）

以下がすべて満たされた時点を **v3.0 ベータリリース**とする：

- [ ] ユーザーがログインしてホーム画面を閲覧できる
- [ ] 法人切替が動く
- [ ] KPIカード4枚に**実データ**が表示される（少なくとも1法人分）
- [ ] ガラス玉カード12個の**ステータス値**が実データで表示される
- [ ] Today's Activity に**実データ**が5件表示される
- [ ] ライト/ダーク切替・音演出・背景切替が動く
- [ ] 天気は時刻ベースまたはAPI連携で動く
- [ ] Vercel に本番デプロイ済み
- [ ] Supabase の RLS が正しく機能している（権限テスト済み）

---

> 🌱 一気に全部やる必要はありません。**P0 → P1 → P2 → P3 の順**で、東海林さんと相談しながら段階的に育てていきましょう。
