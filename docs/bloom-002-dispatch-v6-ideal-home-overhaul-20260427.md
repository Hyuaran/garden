# a-bloom-002 dispatch v6 - 理想画面ベース ホーム全面刷新 - 2026-04-27

> 起草: a-main-009
> 用途: 5/5 後道さん採用ゲート向け、理想画面（東海林さん共有）に基づくホーム全面刷新
> 前提: candidate 6/7/8 完成済（fb5d11b push 済 PR #106）+ ChatGPT v2 画像 + 理想画面スクリーンショット

## 投下短文（東海林さんが a-bloom-002 にコピペ）

【a-main-009 から a-bloom-002 へ】dispatch v6 - 理想画面ベース ホーム全面刷新

▼ 経緯
- 東海林さんが ChatGPT 経由で生成した「理想ホーム画面」を共有（ダッシュボード機能 + 大樹背景 + 12 モジュール grid + 左サイドバー + Today's Activity）
- candidate 6/7/8 で実装した現行ホームは「デザイン性に欠ける」判定
- 5/5 後道さん採用ゲート（memory `project_godo_ux_adoption_gate.md`）に向け、理想画面ベースで全面刷新

▼ 詳細 spec ファイル

`docs/bloom-002-dispatch-v6-ideal-home-overhaul-20260427.md` を参照（このファイル）。スクリーンショット 2 枚（理想画面 + ChatGPT v2 候補）は東海林さん経由で別途共有。

▼ 大改修 6 ポイント概要

1. **背景画像差し替え**: ChatGPT v2 画像（右側大樹 + テラリウム）を右 1/3 配置
2. **左サイドバー新規**: ホーム / 取引 / 顧客 / ワークフロー / レポート / 設定（業務ドメイン軸、memory `project_garden_dual_axis_navigation.md` 準拠）
3. **AppHeader 拡張**: 検索 ⌘K + 日付 + 天気 + システム状態 + ユーザー情報
4. **4 KPI カード新規**: 売上 / 入金予定 / 架電状況 / 未処理タスク（権限別表示）
5. **12 モジュール grid 再配置**: 3×4、表題 Soil / サブタイトル「DB本体・大量データ基盤」（CLAUDE.md 役割表通り）
6. **Today's Activity 新規**: 右タイムライン、Bloom Cron 3 連携

▼ 工数見積

3-5d（5/5 デモまで 8 日、品質優先で 5/3 完成目標）

▼ 既実装活用

- AppHeader / HelpCard / login + auth-redirect / modules.ts bilingual labels / ModuleSlot は **基本維持して進化**
- Pattern B カルーセル（6 atmospheres）は **オプション化 or 廃止**（dispatch v6 内で判断）

▼ 5/5 デモ完成優先度

- 静的見栄え > KPI 実値（モック値で OK、5/5 後に実データ連携）
- 後道さん採用ゲート: 世界観 + ビジネス感 + 実物動作 の 3 点重視

▼ 期待アウトプット

- branch: feature/garden-common-ui-and-shoji-status（既存継続）
- commit 群: dispatch v6 各ステップ単位
- push: 各ステップ完了で push、Vercel preview で東海林さん確認
- 5/3 完成目標 → 5/5 後道さんデモ用最終調整 5/4

▼ 完了報告先

各ステップ完了で a-main-009 に進捗共有（commit SHA + Vercel preview URL）。最終ステップ完了で「dispatch v6 完走、5/5 デモ準備完了」報告。

---

## 詳細 spec（a-bloom-002 が読む本文）

### Step 1: 背景画像配置（0.3d）

**現状**: BackgroundCarousel で 6 atmospheres を順次切替（candidate 6 v3）

**変更後**:
- ChatGPT v2 画像（東海林さんから共有予定、`public/images/garden-home-bg-v2.webp` に配置）を**メイン背景**として固定
- 画像の **右側 1/3（大樹 + テラリウム）** が画面右に配置されるように `background-position: right center; background-size: cover;`
- 左 2/3 はクリーン（半透明オーバーレイ `bg-cream/80`）でコンテンツが読みやすく
- BackgroundCarousel は廃止 OR 「背景バリエーション切替（Easter egg）」として `Ctrl+Shift+B` でトグル可能なオプション化（推奨: 廃止して `_archive/BackgroundCarousel/` に退避）

**判断委任**: BackgroundCarousel 廃止 vs オプション化、a-bloom-002 で技術判断。Pattern B カルーセルは spec 上候補 6 で「5/5 デモの目玉」だったが、理想画面の固定背景の方が見栄え良い。**廃止推奨**。

### Step 2: 左サイドバー新規実装（0.5d）

**新規ファイル**: `src/app/_components/Sidebar.tsx`

**メニュー項目**（理想画面より、memory `project_garden_dual_axis_navigation.md` の業務ドメイン軸 sidebar 準拠）:

| アイコン | ラベル | 遷移先 |
|---|---|---|
| 🍃 leaf | ホーム | `/` |
| 📊 chart | ダッシュボード | `/bloom` |
| 💼 briefcase | 取引 | `/bud/transactions` or `/bloom/transactions` |
| 👤 user | 顧客 | `/root/customers` or `/leaf/customers` |
| 🔄 workflow | ワークフロー | `/root/workflow` |
| 📈 report | レポート | `/forest` |
| ⚙️ gear | 設定 | `/root/settings` |

**実装**:
- 固定 left sidebar（width 200px, full height）
- 半透明白背景 `bg-white/95 backdrop-blur-md`
- ホバー演出（scale + ring）
- アクティブ項目は左 border 強調 + 緑系背景
- 8-role 連動（outsource は最小項目のみ表示、known-pitfalls #6 準拠）
- bottom: 「成長のヒント」カード（既存 HelpCard を sidebar 下部に配置）

### Step 3: AppHeader 拡張（0.5d）

**既実装**: AppHeader.tsx（候補 8 で logo + 検索 + ユーザー情報）

**追加要素**（理想画面より）:
- 日付表示（`2026年4月27日（月）` フォーマット）
- 天気アイコン + 気温（OpenWeatherMap API or モック値、5/5 後に実 API）
- システム状態インジケータ（緑●「すべてのシステム正常」、エラー時赤●）
- 通知ベルアイコン（クリックで Today's Activity drawer 開閉）
- ユーザー情報（東海林 美琴 / 株式会社ヒュアラン / 全権管理者）+ ドロップダウン

**実装**:
- 検索バー幅広げ（max-w-2xl、placeholder 「検索（取引先・請求書・タスク・ヘルプなど）」、Ctrl+F or ⌘+K で focus）
- 右側ユーザー情報は名前 + 法人 + 役割（root_employees + Fruit 連携、5/5 までは静的）
- 8-role 別表示: super_admin → 全権管理者 / admin → 管理者 / manager → マネージャー / staff → 正社員 / cs → CS / closer → クローザー / toss → トス / outsource → 外注

### Step 4: 4 KPI カード新規実装（1d）

**新規ファイル**: `src/app/_components/KpiCard.tsx` + `src/app/_lib/kpi-fetchers.ts`

**4 カード**（理想画面より、権限別表示）:

| カード | 値 | データソース | 権限 |
|---|---|---|---|
| 売上（今月）| ¥12,680,000（+12.5%）| Bud bud_statements + Forest | super_admin / admin / manager |
| 入金予定（今月）| ¥8,450,000（+8.3%）| Bud bud_transfers | super_admin / admin / manager |
| 架電状況（今日）| 68%（34 / 50 件）| Tree tree_call_records | manager / staff / closer / cs |
| 未処理タスク | 24 件（期限超過 5 件）| Bloom workboard | 全 role（自分担当のみ）|

**5/5 デモまでの方針**:
- **モック値で OK**（実 API 連携は 5/5 後）
- ハードコード値 + 「（モック）」microcopy 付与（後道さん向け説明可能）
- 権限別表示ロジックは実装（known-pitfalls #6 準拠）

**カードデザイン**:
- 半透明白カード `bg-white/90 backdrop-blur-sm`
- 上部小アイコン（モチーフ: 売上=芽 / 入金=水滴 / 架電=木 / タスク=花）
- 大きな金額/数字（`text-3xl font-bold`）
- 下部小グラフ（前月比 線グラフ or 棒グラフ、Recharts or 軽量 SVG）

### Step 5: 12 モジュール grid 再配置（0.5d）

**現状**: ModuleSlot で circular 配置（candidate 6/7/8）

**変更後**: 3×4 grid 配置（理想画面準拠）

**配置順**（CLAUDE.md 1-12 順、memory `project_garden_3layer_visual_model.md` 縦階層も考慮）:

```
Row 1 (canopy/樹冠):  Bloom    | Fruit    | Seed     | Forest
Row 2 (地上):          Bud      | Leaf     | Tree     | Sprout
Row 3 (地下):          Soil     | Root     | Rill     | Calendar
```

**カード実装**:
- 各カード: `aspect-square` グリッド、`bg-white/85 backdrop-blur-sm rounded-xl`
- 上部: クリスタル/ガラス質オーブアイコン（既存 ModuleSlot のボタニカルモチーフ流用、80px diameter）
- 中央: **表題 = Garden 正式名**（例: `Soil`、`text-lg font-semibold`）
- 下部: **サブタイトル = 役割**（例: `DB 本体・大量データ基盤`、`text-xs text-muted-foreground`、CLAUDE.md 役割表通り）
- 最下部: モジュールごとの動的バッジ（例: Bud → 「未処理仕訳: 12件」、Tree → 「架電予定: 15件」、5/5 まではモック）
- hover: scale-105 + ring-2 ring-emerald-300
- click: 該当モジュールページへ遷移
- 8-role 別可視範囲（known-pitfalls #6 準拠）

### Step 6: Today's Activity 新規実装（1d）

**新規ファイル**: `src/app/_components/TodaysActivity.tsx`

**配置**: 画面右側、固定 width 320px、AppHeader 下〜画面下まで scroll 可能

**コンテンツ**（理想画面より、Bloom Cron 3 連携、5/5 まではモック）:

| 時刻 | アイコン | タイトル | 詳細 |
|---|---|---|---|
| 09:30 | 木 | 売上レポートが更新されました | 今月の売上が前月比 12.5% 増加しました。|
| 09:15 | 水滴 | 入金がありました | 株式会社ナチュラルハート様より ¥2,150,000 の入金 |
| 08:45 | 花 | 新しいタスクが割り当てられました | 請求書の送付確認（5件）が割り当てられました。|
| 08:30 | チェック | ワークフロー申請が承認されました | 経費精算申請（山田 太郎）が承認されました。|
| 08:00 | 木 | システムからのお知らせ | メンテナンスは正常に完了しました。すべてのシステムが利用可能です。|

**実装**:
- タイムラインスタイル（左側に時刻、右側にアイコン + タイトル + 詳細）
- カード: `bg-white/95 backdrop-blur-sm rounded-lg p-4`
- 下部に「すべて表示」ボタン → `/bloom/activity` 遷移
- 通知ベル（AppHeader）クリックで drawer 開閉トグル可能
- データソース: `bloom_notifications` テーブル（既存 Cron 3 連携、5/5 までモック）

### Step 7: 統合テスト + a11y + 5/5 デモ準備（0.5d）

**テスト**:
- 既存 727+ tests + 新規追加（Sidebar / KpiCard / TodaysActivity）
- a11y: aria-label / role / ARIA-hidden 適切性、Lighthouse スコア 90+
- 8-role 別表示確認（super_admin / admin / manager / staff / cs / closer / toss / outsource）
- レスポンシブ確認（後道さんデモは PC、ただし memory `project_garden_login_office_only.md` で staff 以下は社内 PC 限定）

**5/5 デモ準備**:
- ログイン → ホーム遷移 (auth-redirect)
- 12 モジュール hover → 微演出（candidate 7 の hover scale 強化）
- 左サイドバー click → 各モジュール遷移
- 通知ベル click → Today's Activity drawer
- Ctrl+F search focus
- 全体パフォーマンス: < 2 秒 LCP、< 100ms INP

### 実装順序提案

| 順 | Step | 工数 | 理由 |
|---|---|---|---|
| 1 | Step 1 背景画像 + Step 2 サイドバー | 0.8d | 全体構造の枠組み |
| 2 | Step 3 AppHeader 拡張 | 0.5d | 上部固定要素 |
| 3 | Step 5 12 モジュール grid | 0.5d | 既実装活用、すぐ見栄え変わる |
| 4 | Step 4 4 KPI カード | 1d | モック値で見栄え重視 |
| 5 | Step 6 Today's Activity | 1d | 最後に右側 |
| 6 | Step 7 統合 + テスト + 微調整 | 0.5d | 仕上げ |

合計 4.3d、5/5 デモまで 8 日、5/3 完成余裕あり。

### 実装上の注意

- **既実装の維持**: AppHeader / HelpCard / login + auth-redirect / modules.ts / ModuleSlot のロジックは流用、デザインは進化
- **8-role 対応**: known-pitfalls #6 必須、すべてのコンポーネントで role 別表示テスト
- **干渉回避**: a-bloom Phase A-1 既実装（Workboard / Roadmap / 月次ダイジェスト）は不変、`/bloom/*` 内のみ
- **既存テスト維持**: 727+ tests 全 pass 維持
- **TypeScript / ESLint clean**
- **commit メッセージ**: `feat(home): dispatch v6 step N - <内容>` 形式
- **push 単位**: 各 step 完了で push、Vercel preview で東海林さん確認

### 完了基準

- [ ] 6 step 全実装完走
- [ ] 全テスト pass（既存 727+ + 新規）
- [ ] TypeScript / ESLint 0 errors
- [ ] Vercel preview で東海林さんが「OK」判定
- [ ] 5/5 デモ用最終 push

### 5/5 後の追加 dispatch（v6 完走後）

- KPI 実 API 連携（Bud / Tree / Bloom / Forest 統合）
- Today's Activity 実データ（Bloom Cron 3 連携）
- 天気 API 実装（OpenWeatherMap）
- 動的 user 名前 / role（root_employees + Fruit 連携）
- /home route 整備（現在は /、deviation 解消）
- /login/forgot 実装
- partner_code lookup（outsource 動的 redirect）

## 改訂履歴

- 2026-04-27 初版（a-main-009、理想画面ベースのホーム全面刷新 dispatch、5/5 デモ準備の最重要タスク）
