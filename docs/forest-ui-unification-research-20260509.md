# Forest UI 統一作業 事前調査結果（Explore subagent 3 件並列、2026-05-09 01:38）

> 起草: a-main-015
> 用途: Forest UI を Bud / Bloom と統一する作業の前提知識集約
> 調査手法: Explore subagent 3 件並列実行
> 関連 dispatch: main- No. 159（a-forest-002 へ Forest 連携依頼）/ 後続 main- No. NNN（Forest UI 統一 spec 起票予定）
> 5/14-16 後道さんデモまでに完成目標

---

## 1. Bud / Bloom UI 共通基盤（Explore #1 結果）

### 1-1. Header コンポーネント

| 項目 | 内容 |
|---|---|
| ファイル | `src/components/shared/Header.tsx`（Bud / Bloom 共通）|
| 主要要素 | アプリ名（左）/ achievementSlot（中央拡張）/ rightActions（右）/ ユーザー情報 |
| スタイル | inline style + `linear-gradient(90deg, #87CEEB, #E0F6FF)` |
| ダークモード | Header 自体に切替ロジックなし、ThemeProvider 統一 |

### 1-2. 左サイドバー

| モジュール | 実装ファイル | 構造 |
|---|---|---|
| Bud | `src/app/bud/_components/BudShell.tsx` | シングル（モジュール内メニューのみ）|
| **Bloom** | **`src/app/bloom/_components/BloomSidebar.tsx`** | **デュアル（nav-apps + nav-pages）← Forest 採用 precedent** |

#### Bloom デュアルサイドバー詳細
- **nav-apps（左縁、icons-only column）**: 12 モジュール全体（Bloom / Fruit / Seed / Forest / Bud / Leaf / Tree / Sprout / Soil / Root / Rill / Calendar）+ ステータス（released / dev / concept / todo）+ ホバー展開
- **nav-pages（モジュール内メニュー）**: 折りたたみボタン（nav-pages-toggle）で名前表示/非表示切替
- localStorage キー: `garden_bloom_nav_pages_collapsed`（モジュール別分離）

### 1-3. 右サイドバー

| モジュール | 実装 | 主要要素 |
|---|---|---|
| Bud | なし | （ヘッダー右側に統合）|
| Bloom | BloomShell 内 | `ShojiStatusWidget`（compact）/ `ViewModeToggle` / ユーザー情報 + ログアウト |

### 1-4. タブ実装

- 専用タブコンポーネント不在（shadcn/ui Tabs 未使用）
- Bloom ワークボード = カード/セクション構成（タブなし）
- Bloom 月次ダイジェスト = サブルート（`[month]`）で月別ページ化
- 実装方式: **URL ベース（Next.js ルーティング）**

### 1-5. テーマ・ダークモード

| 項目 | 内容 |
|---|---|
| ファイル | `src/app/_lib/theme/ThemeProvider.tsx` |
| 実装方式 | 自家製 Provider（next-themes 未導入、互換予定）|
| DOM 反映 | `data-theme` 属性 + `.dark` クラス |
| localStorage キー | `garden.theme` |
| デフォルト | `"light"` |
| SSR safe | 初回 default、useEffect で localStorage 復元 |

---

## 2. Forest v9 HTML 構造解析（Explore #2 結果）

### 2-1. 既存セクション一覧（縦スクロール）

| # | セクション | 役割 |
|---|---|---|
| 1 | ヘッダー（gf-header）| ブランドロゴ + サブタイトル + ユーザー情報 |
| 2 | グループサマリー | 各法人の最新確定期合算カード（grid auto-fit）|
| 3 | 納税カレンダー | 12 ヶ月 × 6 法人マトリクス（確定/予定申告月）|
| 4 | 税理士連携データ | 法人別税ファイル一覧（折りたたみ）|
| 5 | 決算書ダウンロード | 複数選択 × 期数選択 → ZIP 生成 |
| 6 | グループ全体合算利益推移 | Chart.js マクロチャート |
| 7 | 6 法人比較ワンビュー | 横スクロール micro-table |

### 2-2. タブ化提案（縦スクロール → タブ式）

| タブ名 | 含むセクション | 推奨理由 |
|---|---|---|
| **概要** | グループサマリー + マクロチャート | ダッシュボード的ハイレベル集計 |
| **比較** | 6 法人 micro-table | 詳細個別比較 |
| **納税** | 納税カレンダー + 税理士連携 | 税務スケジュール + ファイル管理 |
| **ダウンロード** | 決算書 ZIP | 法人別 × 期数選択 |

### 2-3. 主要 UI 要素

- **チャート**: Chart.js（macroChart）= 折れ線・積み上げ棒
- **テーブル**: tax-grid（固定列 + 12 ヶ月スクロール）/ micro-table（法人 sticky + 横スクロール）/ group-summary-table
- **法人切替**: チェックボックス（ダウンロード）/ スティッキー左列（micro-table）
- **データセル**: 135px × 自動高さ、mini-bars + metric-row
- **進行期ハイライト**: shinkouki class = グロー付きボーダー + 減淡表現
- **ki-badge**: 期数バッジ（#7a6652 茶）

### 2-4. CSS / カラースキーム（Forest 固有）

| カテゴリ | 色 |
|---|---|
| Primary | #1b4332（濃緑）/ #2d6a4f（中緑）|
| Accent | #40916c（明緑）/ #52b788（黄緑）/ #74c69d（淡緑）|
| Light/BG | #d8f3dc（ボーダー）/ #e8f0e0（薄背景）|
| Alert | #d63031（赤）/ #e07a7a（淡赤）/ #c9a84c（税金色）/ #a3b18a（納付色）|

### 2-5. 装飾特徴

- 角丸: 14-20px（セクション）/ 8-10px（カード）
- シャドウ: `0 2px 12px` 〜 `0 12px 40px` rgba(0,0,0,0.04-0.3)
- バックドロップ: blur(8px) + rgba 背景
- グラデーション: ヘッダー（135deg, 3 色）/ login gradient
- 進行期アニメ: shinkou-glow（2.5s ease-in-out）← **Forest 固有、Bud / Bloom にも採用検討価値あり**

### 2-6. データ依存

- Mock データ: HTML inline `<script>` 内 hardcode
  - COMPANIES[] = 6 法人 × 最大 9 期決算データ
  - SHINKOUKI{} = 進行期定義（期数 / 年 / 範囲 / 仮決算フラグ / 見込数値）
  - NOUZEI[] = 納税カレンダー
  - HANKANHI{} = 販管費内訳
- 6 法人マスタ: hyuaran / centerrise / linksupport / arata / taiyou / ichi（embed 済）
- 外部 API: GAS 連携（IS_GAS 判定で local/web 切替）

---

## 3. 背景画像 + ダークモード加工レシピ（Explore #3 結果）

### 3-1. 背景画像ファイル一覧

#### Home 画面用（v2.8a 系、Bud / Bloom 共有）

| ファイル | サイズ | モード |
|---|---|---|
| bg_01_morning.png | 1061 KB | ライト |
| bg_02_water.png | 1269 KB | ライト |
| bg_03_glassdisk.png | 1101 KB | ライト |
| bg_04_crystal.png | 857 KB | ライト |
| bg_05_sunlight.png | 1460 KB | ライト |
| bg_06_night.png | 1953 KB | **ダーク専用** |

→ ライト 5 種カルーセル + ダーク 1 種

#### Bloom 専用

| ファイル | サイズ |
|---|---|
| bg_bloom_garden_light.png | 256 KB |
| bg_bloom_garden_dark.png | 269 KB |

### 3-2. ファイル名規則

- `bg_{NN}_{name}.png` 形式（Home）
- `bg_bloom_garden_{light|dark}.png`（Bloom 専用、light / dark 分離）
- 解像度: **1672 x 941 px**
- フォーマット: PNG

### 3-3. ダークモード加工戦略

**完全独立画像（プログラム変換なし）**

- Home: ライト bg_01-05 = 朝・水・ガラス・結晶・陽光（カルーセル循環）/ ダーク bg_06 = 夜の庭 1 種のみ（carousel 停止）
- Bloom: 花咲く庭（ライト） vs 月夜の庭（ダーク）= 独立生成（ライト/ダーク プロト 1:1 対応、carousel なし）
- 加工ツール: 記録なし（claude.ai 起草版 + GIMP 等手作業推定）

### 3-4. CSS / React 統合

```typescript
<BackgroundLayer
  layer1Src={...}
  layer2Src={...}
  activeLayer={...}
/>
```

- 実装ファイル: `src/app/_components/layout/BackgroundLayer.tsx`
- 定数: `src/app/_lib/background/atmospheres.ts`
- CSS: `backgroundImage: url()` インラインスタイル + `opacity` cross-fade
- 切替: `useTheme()` → `targetBgUrl = theme === 'dark' ? NIGHT_PATH : LIGHT_CAROUSEL[index]`
- 遷移: 800ms FADE_TRANSITION

### 3-5. テーマ全体の世界観

| 項目 | 内容 |
|---|---|
| Bud / Bloom モチーフ | ボタニカル水彩 + ガラス工芸 + 庭園（テラリウム）|
| ライト | 明るい朝日、透光性（水・ガラス）、生命感（花・葉）|
| ダーク | 夜景庭園、月光、静寂、落ち着き |
| 色彩 | ベージュ/クリーム × 深緑/紫紺 |

### 3-6. Forest 固有性提案

| 軸 | 内容 |
|---|---|
| モチーフ | **樹冠（Canopy）+ 多層植物** = 俯瞰視点で複数樹木レイヤー（Bud/Bloom 単体庭園 → Forest = 森へ拡張）|
| 多層植物 | 地表 → 幹 → 枝 → 葉 → 樹頂 と垂直 3-5 段の生態 |
| 群落効果 | Bud の抽象性（結晶・水）を減らし、具象的な樹木シルエット |
| スケール感 | 地表からの見上げ視点（小さな人間 vs 大きな森）|

#### ライト版

「朝日が透ける新緑の多層林」
- 明るい黄緑 + 萌黄 + 淡い金光
- 朝霧、透明感
- 樹冠の隙間から朝日が差し込む

#### ダーク版

「月光の深い森」
- 紫紺 + 深緑 + 銀月、星散り
- 月光が森を照らす
- ライト版と同じ構図、時間帯のみ変化

---

## 4. Forest UI 統一 spec 起草の前提（次セッション =  a-main-016 で実施推奨）

本調査結果を spec 起草の前提として活用:

1. ヘッダー: `src/components/shared/Header.tsx` 流用
2. サイドバー: Bloom デュアルサイドバー precedent 採用、nav-pages を Forest 固有メニューに
3. タブ: URL ベース（`/forest/[tab]`）= Bud / Bloom 踏襲
4. 背景画像: ChatGPT 生成（main- No. 156 ChatGPT 第一弾フロー流用）= ライト + ダーク 2 枚
5. ThemeProvider: `src/app/_lib/theme/ThemeProvider.tsx` 流用
6. BackgroundLayer: `src/app/_components/layout/BackgroundLayer.tsx` 流用、Forest 用 atmospheres 定数追加

## 5. 実装担当・期日

| 項目 | 担当 | 期日 |
|---|---|---|
| Forest UI 統一 spec 起草 | a-main-016（次セッション、a-main-015 引っ越し後）| 5/9 朝 |
| 背景画像 ChatGPT 生成 | 東海林さん（プロンプトは main- No. NNN で提示済）| 5/9 中 |
| 背景画像配置 + 視覚評価 | a-main-016 + 東海林さん | 5/9 中 |
| 実装 | a-forest-002（B-min #2 並行 or 完走後）| 5/12 まで着手推奨 |
| 5/13 統合テスト | 全モジュール | 5/13 |
| 5/14-16 後道さんデモ | 全モジュール | デモ |

## 6. 関連 dispatch / spec / memory

### dispatch
- main- No. 153（5/8 18:14）= ChatGPT 第一弾 GO（Bud + Forest 統一世界観）
- main- No. 156（5/8 18:29）= 案 1 + 案 3 採用（claude.ai HTML read 戦略）
- main- No. 157（5/9 01:17）= 6 法人アイコン組込指示
- main- No. 158（5/9 01:31）= hyuaran-group-hd 追加組込
- main- No. 159（5/9 01:31）= a-forest-002 へ Forest 連携 spec 実装依頼
- main- No. 160（5/9 01:42）= a-bloom-005 → a-bloom-006 引っ越し（UU 案）
- 後続: main- No. NNN = Forest UI 統一 spec 起草 + 背景画像プロンプト発行

### spec
- `docs/specs/2026-05-09-forest-corporations-mock-migration.md`（a-bloom-005 起票、200 行）
- `docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md`（KK 案 spec、確定マッピング掲載）
- 後続: `docs/specs/2026-05-09-forest-ui-unification.md`（a-main-016 で起草予定）

### memory
- `feedback_chat_session_switch_main_first.md`（claude.ai 切替時 main 判断仰ぎ）
- `feedback_reply_as_main_dispatch.md`（dispatch 形式厳守）
- `feedback_session_worktree_auto_setup.md`（worktree a-main 自動実行）
- `user_shoji_design_preferences.md`（ボタニカル水彩、温かみ、絵本的、ピーターラビット世界観）
- `project_garden_3layer_visual_model.md`（樹冠 / 地上 / 地下 縦階層、Forest = 樹冠）

## 7. 改訂履歴

- 2026-05-09 01:42 初版（a-main-015、Explore subagent 3 件並列調査結果集約）
