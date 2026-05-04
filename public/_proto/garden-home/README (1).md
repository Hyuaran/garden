# Garden Series — Next.js + Supabase 本格実装 引き継ぎ書

> **このファイルは Claude Code 向けの最初のセッションで丸ごと渡す前提で書かれています。**
> 関連ドキュメント：
> - `DESIGN_SPEC.md` — デザイン仕様書（カラー・フォント・レイアウト・コンポーネント詳細）
> - `TODO_BACKLOG.md` — 残作業リスト（実装すべきタスク群）
> - `CONCEPT_FOR_GOTO.md` — 後道代表向けデザインコンセプト書（技術抜き）

---

## 📌 この引き継ぎ書のゴール

Claude Code が、Garden Series のホーム画面プロトタイプ（HTML/CSS/JS版・v2.8a完成版）を、**Next.js + TypeScript + Tailwind CSS + Supabase** に正しく移植・拡張できるようにすること。

**「なぜそうなっているか」を残すこと**を最重視しています。判断根拠を共有することで、Claude Code が将来の変更で迷わないようにします。

---

## A. プロジェクト概要

### A-1. 株式会社ヒュアラン グループ全体のDX統合

Garden Series は、株式会社ヒュアランを筆頭とする**全6法人のDXを統合**するための業務プラットフォームです。

- **株主**：後道代表（後道さん／全6法人共通株主）
- **管理統括 兼 DX推進責任者**：東海林 美琴（全法人の総務・経理・管理を横断管理）
- **最終決裁者**：後道代表
- **法人構成**：6法人それぞれが本店所在地・代表者を持つ → **マルチテナント設計が前提**

### A-2. 呼称ルール（重要）

| シーン | 呼称 |
|---|---|
| 日報・社内文書 | **後道さん** |
| 社外発表・公式文書・最終決裁者として言及 | **後道代表** |

### A-3. Garden Series 12モジュール構成

「庭を育てる」メタファーに基づき、自然要素で各モジュールを表現しています。

| # | モジュール | 自然比喩 | 役割 | アイコン画像 |
|---|---|---|---|---|
| 1 | Garden-Soil | 土 | DB本体・大量データ基盤（リスト・コール履歴・関電リスト） | `images/icons/soil.png` |
| 2 | Garden-Root | 根 | 組織・従業員・パートナー・マスタデータ・条件 | `images/icons/root.png` |
| 3 | Garden-Tree | 木 | 架電アプリ | `images/icons/tree.png` |
| 4 | Garden-Leaf | 葉 | 商材×商流ごとの個別アプリ（約30テーブル）・トスアップ | `images/icons/leaf.png` |
| 5 | Garden-Bud | 蕾 | 経理・収支（明細・振込・損益・給与） | `images/icons/bud.png` |
| 6 | Garden-Bloom | 花 | 案件一覧・日報・KPI・ダッシュボード | `images/icons/bloom.png` |
| 7 | Garden-Seed | 種 | 新商材・新事業の拡張枠 | `images/icons/seed.png` |
| 8 | Garden-Forest | 森 | 全法人の決算資料等 | `images/icons/forest.png` |
| 9 | Garden-Rill | 川 | チャットワークAPIを利用したメッセージアプリ | `images/icons/rill.png` |
| 10 | Garden-Fruit | 実 | **アプリは作成しない**。新事業要素・社外アピール用の概念枠（派遣資格、Pマーク、インターネット回線再卸資格等） | `images/icons/fruit.png` |
| 11 | Garden-Sprout | 芽 | 採用・入社（実装画面に存在） | `images/icons/sprout.png` |
| 12 | Garden-Calendar | (時) | 営業予定・シフト | `images/icons/calendar.png` |

> **注意**：当初設計の10モジュール（実稼働9＋概念1）に加え、UI上のグリッド整列（4列×3段）のため Sprout・Calendar を追加して **12モジュール**表示しています。実装上は **Sprout は Root の一部、Calendar は独立カレンダー機能**として扱う想定です。

---

## B. 移行先環境

| 項目 | 採用技術 |
|---|---|
| ホスティング | **Vercel** |
| ソース管理 | **GitHub** |
| データベース | **Supabase**（PostgreSQL + Auth + Storage） |
| フレームワーク | **Next.js（App Router）** |
| 言語 | **TypeScript** |
| スタイリング | **Tailwind CSS** |
| フォント | Google Fonts（CDN）または `next/font` で最適化 |

### B-1. ディレクトリ構成案（提案）

```
garden-series/
├── app/                      # App Router
│   ├── layout.tsx            # 全体レイアウト（topbar, sidebar, themeProvider）
│   ├── page.tsx              # ホーム画面（v2.8a相当）
│   ├── (modules)/            # ルートグループ
│   │   ├── bloom/page.tsx
│   │   ├── bud/page.tsx
│   │   └── ...
│   └── api/                  # APIルート（必要なら）
├── components/
│   ├── home/
│   │   ├── KpiGrid.tsx
│   │   ├── KpiCard.tsx
│   │   ├── OrbGrid.tsx
│   │   ├── OrbCard.tsx
│   │   └── ActivityPanel.tsx
│   ├── layout/
│   │   ├── Topbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── BackgroundLayer.tsx
│   └── ui/                   # 汎用UI
├── lib/
│   ├── supabase/             # Supabaseクライアント
│   ├── theme/                # ダーク/ライト切替
│   └── weather/              # 天気API連携
├── public/
│   └── images/               # 既存の画像アセットをそのまま移植
└── styles/
    └── globals.css           # CSS変数のみ移植（Tailwindと併用）
```

### B-2. CSS変数 → Tailwind config 連携

既存の CSS 変数（`--text-main`, `--accent-green` 等）は `tailwind.config.ts` で `colors` として参照できるようにします。

```typescript
export default {
  theme: {
    extend: {
      colors: {
        'text-main':  'var(--text-main)',
        'text-sub':   'var(--text-sub)',
        'accent-green': 'var(--accent-green)',
      }
    }
  }
}
```

これにより `className="text-text-main bg-bg-card"` のように使え、**ダークモード切替時もCSS変数が自動追従**します。

---

## C. デザイン仕様

詳細は `DESIGN_SPEC.md` を参照してください。ここでは要点のみ。

### C-1. カラーシステム
- **ライトモード基調**：温かみのある和紙色（#f5f0e1）
- **ダークモード基調**：深い苔緑（#1f2419）
- **アクセント5色**：緑（生命）・金（実り）・青（水）・桃（花）・赤（警告）

### C-2. フォントの使い分け（v2.8で確立）

| 用途 | 第1選択 | 第2選択 | 理由 |
|---|---|---|---|
| 日本語見出し | `Shippori Mincho` | `Noto Serif JP` | 和風・上品 |
| 日本語本文 | `Noto Serif JP` | system-ui | 可読性 |
| 英字（モジュール名等） | `Cormorant Garamond` | `EB Garamond` | エレガント |
| **数字** | **`EB Garamond`** | `Cormorant Garamond` | **ガタつき防止（v2.8で確立）** |

> **重要な経緯**：v2.7まで Cormorant Garamond だけを使っていましたが、Cormorant のデフォルト数字は「Old-style figures（オールドスタイル数字）」でベースラインがバラついて見える問題がありました。`font-feature-settings: 'lnum' 1` 等での補正を試みても、Cormorant が `lnum` フィーチャーを公式サポートしないため効果がありませんでした。v2.8 で **EB Garamond** に切り替えて解決しています（`tnum`+`lnum` 公式サポート済み）。

### C-3. レイアウト寸法（1920×1080想定）

| 要素 | サイズ |
|---|---|
| Topbar 高さ | 80px |
| Sidebar 幅 | 210px |
| メインpadding | 上下：topbar+24px、左右：32px |
| KPIカード | 4列横並び、gap 14px |
| ガラス玉カード | 4列×3段、各140px、gap 14px |
| Activity Panel 幅 | 340px（fixed配置、右32px） |
| カード角丸 | 20px |

### C-4. ブレイクポイント

- **min-width: 1400px** → 通常レイアウト（4列横並び・Activity右fixed）
- **max-width: 1399px** → タブレット/狭い画面（2列・Activity下に縦積み）

---

## D. データベース設計の指針

詳細は `TODO_BACKLOG.md` の「Supabase初期設計」を参照。ここでは設計の核となる方針のみ。

### D-1. ユーザー属性は2軸構造（重要）

東海林さんが定義した、Garden Series 独自のユーザー権限モデルです。

#### 軸1：雇用形態（誰として働いているか）
- 役員
- 正社員
- 契約社員
- アルバイト
- 業務委託
- 派遣社員（自社→他社）
- 派遣社員（他社→自社）
- パートナー（外部協業者）

#### 軸2：Garden権限7段階（システム上で何ができるか）
- L1：閲覧のみ（自分の担当のみ）
- L2：閲覧（チーム範囲）
- L3：自分の入力編集
- L4：チームの入力編集
- L5：法人内承認
- L6：グループ横断管理（東海林さんレベル）
- L7：最終承認（後道代表レベル）

> **設計判断の理由**：従来の「管理者/一般」の2分類では、ヒュアラングループの**業務実態（人によって雇用形態と権限が独立して動く）**を表現できない。例えば「業務委託 × L4」「派遣社員 × L2」のような組合せが日常的に発生する。

### D-2. マルチテナント対応（6法人切替）

- すべてのテーブルに `corp_id`（法人ID）を持たせる
- ユーザーは複数法人に所属可能（`user_corp_memberships` 中間テーブル）
- 画面上部に「法人切替セレクタ」を設置予定（v3.0以降）
- Supabase **Row Level Security (RLS)** で `corp_id` を必ずフィルタ

### D-3. 各モジュールの想定テーブル

| モジュール | 主要テーブル候補 |
|---|---|
| Soil | `lists`, `call_history`, `kanden_lists` |
| Root | `corporations`, `employees`, `partners`, `masters`, `conditions` |
| Tree | `call_sessions`, `call_results` |
| Leaf | 商材ごと約30テーブル（`leaf_products_*`） |
| Bud | `transactions`, `transfers`, `pl_statements`, `payrolls` |
| Bloom | `cases`, `daily_reports`, `kpis` |
| Seed | （新事業ごとに動的追加） |
| Forest | `corp_financial_reports`, `consolidated_reports` |
| Rill | `messages`（Chatwork API連携） |
| Fruit | （テーブルなし。設定値・資格情報のみ） |
| Calendar | `schedules`, `shifts` |

---

## E. 機能の引き継ぎ

### E-1. 現在動いている機能（v2.8a時点）

#### ✅ 背景画像の動的切替
- ライトモード時：5種類の背景画像を**画面クリックで順次切替**
  - `bg_01_morning.png` → `bg_02_water.png` → `bg_03_glassdisk.png` → `bg_04_crystal.png` → `bg_05_sunlight.png` → ループ
- ダークモード時：`bg_06_night.png` 固定
- フェード切替（2層構造で滑らかに）

#### ✅ ライト/ダークモード切替
- 右上の太陽/月アイコンで切替
- `data-theme="light"` / `data-theme="dark"` を `<html>` に付与
- `localStorage` に保存して再訪時も維持
- ダーク時は背景が夜の風景に固定切替

#### ✅ 音演出
- 右上のスピーカーアイコンでON/OFF
- ガラス玉ホバー時に「ポン」音、クリック時に強めの「ポン」音
- Web Audio API（外部ファイル不要）
- 初期はOFF（v2.7-v2.8a の全バージョンで強制リセット）
- `localStorage` に保存

#### ✅ ホバー演出（CSS）
- ガラス玉カード：浮き上がり + 拡大 + 影強化
- KPIカード：軽く浮き上がり

#### ✅ 天気アイコン時刻ベース切替（v2.8新規）
- ページ読み込み時に時刻に応じて6種類から自動選択
- 朝5〜9時：晴れ／9〜13時：晴れ時々曇り／13〜16時：曇り／16〜19時：晴れ時々曇り／19〜22時：曇り／その他：雨
- `window.setWeather('sunny'|'partly_cloudy'|...)` で手動切替可能

#### ✅ Activityパネル高さ自動調整（v2.8a新規）
- `top + bottom` 両指定で画面高さに応じて伸縮
- JavaScript で `.orb-grid` の最終行下端を実測し、`bottom` を微調整
- ウィンドウリサイズ時に自動再計算

### E-2. 将来実装する機能

`TODO_BACKLOG.md` を参照。要点：

- 実データ連携（KPIカード・ガラス玉ステータス）
- 天気API連携（OpenWeatherMap等）
- 認証フロー（Supabase Auth）
- 各モジュール内画面の設計（v3.0以降）
- Chatwork API連携（Garden-Rill）
- 法人切替セレクタ
- 通知システム

---

## F. 開発経緯（v1.0 → v2.8a）

### なぜこの設計になったか

#### v1.0（2026-04-27 13:24）
- ホーム画面初版。基本構造のみ。
- **判断**：シンプルな構成から始めて、東海林さんと対話しながら育てる方針。

#### v2.0（2026-04-27 13:52）
- 6種類背景 + ナイトモード + 音演出を追加。
- **判断**：ヒュアラングループの「業務を、育てる」というブランドメッセージに合わせ、画面自体に「呼吸」を持たせる。背景クリックで景色が変わる演出は「業務に向き合う気持ちを切り替える」儀式的な意味合い。

#### v2.3（2026-04-27 15:00）
- ガラス玉カード大判化 + 浮島Activity Panel化。
- **判断**：当初Activityはサイドバーに収まっていたが、最終決裁者である後道代表に「業務の動き」を一目で見せたいというニーズから、独立した浮島カードに昇格させた。

#### v2.4（2026-04-27 15:15）
- メニューアイコン7個をChatGPT水彩アイコンに置換。
- **判断**：絵文字や標準アイコンでは Garden Series の世界観が出ない。**統一された水彩タッチ**で全アイコンを揃えることで、画面全体に「絵本のような優しさ」を持たせた。

#### v2.6（2026-04-27 15:37）
- ガラス玉横並び + 1920×1080 ワンビュー化。
- **判断**：縦スクロールが必要だと「業務全体が見渡せない」感覚になる。1920×1080で**全12モジュールがスクロール無しで一望できる**ように再設計。これは後道代表が一画面で経営状況を把握できるようにするため。

#### v2.7（2026-04-27 15:57）
- ヘッダー機能アイコン5個 + テーマ2個 + 装飾1個 = 8個追加。
- **判断**：ヘッダー部分も水彩アイコンで統一。検索・カレンダー・天気・通知・音・テーマ切替の各機能をビジュアルで識別可能に。

#### v2.8（2026-04-27 16:10）
- 天気アイコン6種類追加 + 数字フォントをEB Garamondに変更 + 天気切替ロジック実装。
- **判断1（フォント）**：Cormorant Garamond の数字字形（オールドスタイル）が業務システムとして読みにくいため、EB Garamond に切り替え。**HTML 変更ゼロで CSS のみで対応**することで、Next.js 移植時のコスト削減を最優先した。
- **判断2（天気）**：実APIに繋ぐ前にUIだけ完成させる方針。`setWeather()` 関数を独立させて、後でAPI応答を渡すだけで動くように設計（将来拡張性確保）。

#### v2.8a（2026-04-27 16:22）★最終版
- Activity高さ調整（top+bottom指定+JS実測補正） + 🌿絵文字削除。
- **判断1（高さ）**：CSS変数による計算式は KPIカードの中身が変わると追従できない。`top: 194px; bottom: 32px;` の両端固定 + JavaScriptでガラス玉グリッド下端を実測する**ハイブリッド方式**を採用。CSSだけでも8〜9割正しく、JSが効くと完全一致。
- **判断2（絵文字）**：🌿絵文字はOSによってレンダリングが異なり、世界観を壊す可能性があった。タイトル文字だけのほうがエレガント。

### 🔑 重要な設計判断のサマリ

1. **「世界観 > 機能性」の優先順位がある場面では、世界観を取る**
   （ただし、可読性を犠牲にしない範囲で）

2. **HTML変更を最小化する**
   →Next.js 移植時、JSXに書き換えるコストを最小化するため。

3. **マジックナンバーを避け、CSS変数化する**
   →保守性とレイアウト変更時の追従性を高めるため。

4. **JSは「最後の手段」だが、必要なら堂々と使う**
   →CSS だけで限界がある時（例：Activity高さ実測）は JS を併用。

5. **ファイル削除厳禁、別名保存**
   →過去のバージョンを「いつでも戻せる状態」で保つ。

---

## G. 重要なルール（東海林さんの好み・運用ルール）

Claude Code が東海林さんと対話する際、**必ず守るべきルール**です。

### G-1. コミュニケーション

#### G-1-1. 専門用語禁止
プログラミング知識がない前提で、**中学生でも理解できる言葉**で説明する。

❌ NG：「Webpackのpolyfillが効いていない可能性があります」
✅ OK：「古いブラウザでも動くようにする変換処理がうまく動いていない可能性があります」

#### G-1-2. 全手順の提示
PowerShellやコマンド操作が必要な時は、「**どのボタンを押し、何を貼り付け、どうEnterを押すか**」まで丁寧に。

#### G-1-3. マルチプルチョイスで仕様確認
仕様確認は必ず **「A案：〇〇、B案：△△」の選択肢を本文中に提示**。
**ただし、UIボタン（AskUserQuestion等）は使わない**。テキストで自由に答えられる形を保つ。

#### G-1-4. 進捗報告（トークン残量）
- **50%以下**になったら冒頭で「**【重要】現在のトークン残り：〇〇％**」と報告
- **70%**：進捗メモ（`docs/wip-YYYYMMDD.md`）を取る
- **80%**：ハンドオフメモ（`docs/handoff-YYYYMMDD.md`）を書いてcommit & push
- **85%**：新規作業停止、別セッションへ切替
- **95%**：セッション終了扱い

### G-2. 成果物のルール

#### G-2-1. 保存先
全成果物は以下に生成する。作業開始前に必ず再確認。

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴
```

#### G-2-2. プロジェクトフォルダ
新プロジェクトはフォルダを作成し、**フォルダ名の先頭に `001_` 等のナンバリング**を入れる。

#### G-2-3. ファイル削除厳禁・別名保存ルール
- **ファイル削除は厳禁**
- 修正時は必ず **`元ファイル名_YYYYMMDDHHMMSS.拡張子`** で別名保存

#### G-2-4. JSコードのコメント制限
JavaScript（および TypeScript）提案時は、**コード内のコメントをすべて削除**。
（「コメントをつけて」と明示的に依頼された場合のみ、解説付きで再送）

### G-3. アクセス権限
- PC内・Googleドライブ・kintone（サブドメイン `9j11u0q829lg`）の**読み取りは全許可**
- **書き込み・削除を伴う場合**は、必ず事前に承認を得る

### G-4. 自己検閲
回答前に必ず内部チェック：
1. **即時実行可能か**
2. **既存仕様（Gardenシリーズ）と矛盾がないか**
3. **エラー対策は万全か**

---

## H. Claude Code とのやり取りサンプル（FAQ形式）

### Q1. 「ライトモードの背景画像はどう動的切替する？」

**A.** 配列で5枚を持っておき、クリックごとに `currentBgIndex` を回す。フェード切替には2層構造（`bgLayer1` / `bgLayer2`）を使用。Next.js では：

```tsx
const lightBackgrounds = [
  '/images/backgrounds/bg_01_morning.png',
  '/images/backgrounds/bg_02_water.png',
  '/images/backgrounds/bg_03_glassdisk.png',
  '/images/backgrounds/bg_04_crystal.png',
  '/images/backgrounds/bg_05_sunlight.png'
];

const [bgIndex, setBgIndex] = useState(0);
const [activeLayer, setActiveLayer] = useState<1 | 2>(1);
```

クリック時に `setBgIndex((i) => (i + 1) % 5)` で次へ。

### Q2. 「ダークモードはどう判定する？」

**A.** `document.documentElement.dataset.theme = 'dark'` を見るのが現状。Next.js では `next-themes` ライブラリの使用を推奨：

```tsx
import { useTheme } from 'next-themes';
const { theme, setTheme } = useTheme();
```

### Q3. 「天気APIを繋ぐとき、どこを変える？」

**A.** `index.html` の JavaScript 内 `autoWeatherByHour()` を、API 応答ベースの関数に置き換える。`setWeather(key)` の `key` は `sunny | partly_cloudy | cloudy | rain | snow | thunder` の6種類。OpenWeatherMap 等の応答コードを変換するマッピング関数を一段挟むのが安全。

### Q4. 「KPIカードの数字を Supabase から取得するには？」

**A.** App Router のサーバーコンポーネントで取得し、クライアントコンポーネント（`KpiCard.tsx`）に渡す。

```tsx
async function getKpiData() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('kpi_summary').select('*');
  return data;
}

export default async function HomePage() {
  const kpi = await getKpiData();
  return <KpiGrid data={kpi} />;
}
```

### Q5. 「数字フォント（EB Garamond）はどこに当てるべき？」

**A.** Tailwind では `font-numeric` のようなカスタムクラスを定義し、**数字を含むクラス全体**に当てる。HTML（JSX）には `<span>` を追加しない方針（v2.8で確立）。

```css
.font-numeric {
  font-family: 'EB Garamond', 'Cormorant Garamond', 'Noto Serif JP', serif;
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
}
```

該当クラス（v2.8aで EB Garamond を当てている箇所一覧）：
- `.kpi-value`, `.kpi-value small`
- `.kpi-trend`
- `.kpi-sub`
- `.kpi-warning`
- `.kpi-progress-text`
- `.activity-time`
- `.activity-body p`（数字混在のため）
- `.info-item .info-text strong`（温度）
- `.orb-status-value`

### Q6. 「ガラス玉カードのアニメーション遅延は？」

**A.** `nth-child(N)` で個別に遅延を設定（0.40s〜0.79s）。Next.js では Framer Motion の `staggerChildren` を使うのが推奨。

### Q7. 「Activityパネルの位置調整 JS は移植必須？」

**A.** はい。CSS だけでは画面高さ依存の微小ズレが残ります。`useEffect` で同等の処理を書いてください。`useResizeObserver` でウィンドウサイズ変更にも追従させると堅牢です。

### Q8. 「6法人の切替UIはどこに置く？」

**A.** v2.8a 時点では未実装。`TODO_BACKLOG.md` 参照。設計案としては Topbar 左側のロゴ右、または Sidebar 上部にドロップダウンを配置。

### Q9. 「東海林さんに仕様確認したい時は？」

**A.** 必ず本文中で「A案：〇〇、B案：△△」の形で選択肢を提示。AskUserQuestion などのUIボタンは使わない。トークンが残り少なければ事前に冒頭で告知。

### Q10. 「コードを書いた後、コメントは入れる？」

**A.** デフォルトで**入れない**。明示依頼があった場合のみ、解説付きで再提示。

---

## I. ファイル構成（v2.8a完成版）

```
000_GardenUI/
├── README.md                    # ★この引き継ぎ書
├── DESIGN_SPEC.md               # デザイン仕様書
├── TODO_BACKLOG.md              # 残作業リスト
├── CONCEPT_FOR_GOTO.md          # 後道代表向けコンセプト書
├── index.html                   # ホーム画面（v2.8a最終版）
├── index_v1_*.html ~ index_v2-8a_*.html  # 全バージョンのバックアップ
├── css/
│   ├── style.css                # メインスタイル（v2.8a）
│   └── style_v*.css             # 全バージョンのバックアップ
└── images/
    ├── icons/         # ガラス玉12種（水彩タッチ）
    ├── menu_icons/    # サイドバーメニュー7種
    ├── header_icons/  # ヘッダー機能アイコン4種 + 天気6種
    ├── theme_icons/   # ライト/ダーク切替アイコン
    ├── backgrounds/   # 背景画像6種（ライト5+ダーク1）
    ├── decor/         # 装飾（挨拶横の芽）
    ├── avatar/        # アバター（東海林さん）
    └── logo/          # Garden Series ロゴ
```

---

## J. Claude Code 最初のセッションで推奨する作業順

1. **まず**：`README.md` （このファイル）と `DESIGN_SPEC.md` を読む
2. **次に**：`index.html` と `css/style.css` の最新版を読む
3. **次に**：`TODO_BACKLOG.md` で何を作るか把握
4. **その後**：Next.js プロジェクト雛形を立ち上げ、CSS変数を `globals.css` に移植 + `tailwind.config.ts` でカラー定義
5. **段階的に**：コンポーネント単位で移植（Topbar → Sidebar → KpiGrid → OrbGrid → ActivityPanel → BackgroundLayer）
6. **最後に**：Supabase 接続（最初はモックデータでOK）

---

## K. 連絡先・確認先

- **作業相手**：東海林 美琴さん（管理統括 兼 DX推進責任者）
- **承認権者**：後道代表（最終決裁者）
- **kintone サブドメイン**：`9j11u0q829lg`
- **Googleドライブ保存先**：`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI\`

---

> 🌱 **「業務を、育てる。」 / Grow Your Business.**
> Garden Series が、ヒュアラングループの日々の業務を、より美しく、より穏やかに、より確かに支えるシステムへと育っていきますように。
