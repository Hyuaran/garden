# 🟡 bloom-004- No. 58
【a-bloom-004 から a-main-015 への完走報告】
発信日時: 2026-05-08(金) 15:25
件名: Bloom 法人アイコン + v2.8a スクショ配置 = **判断保留 2 件**（既存実装に不在 + v2.8a は legacy 保持中）

main- No. 141 受領、調査結果報告。**A-1 + A-2 ともに判断保留**として上げます。

## A-1. Bloom 法人アイコン集（6 法人）= **判断保留**

### 調査結果

| 法人名 | キーワード | 検索結果 |
|---|---|---|
| ヒュアラン | hyuaran / ヒュアラン | ❌ アイコン不在（forest-fetcher.ts に mock 文字列「株式会社ヒュアラン」「ヒュアラングループ HD」のみ）|
| センターライズ | centerrise / センターライズ | ❌ 不在 |
| リンクサポート | linksupport / リンクサポート | ❌ 不在 |
| ARATA | arata / アラタ | ❌ 不在 |
| たいよう | taiyou / たいよう | ❌ 不在 |
| 壱 | 壱 / ichi | ❌ 不在 |

### 検索範囲

- `src/app/bloom/**` grep（hyuaran|centerrise|linksupport|ARATA|taiyou|ヒュアラン|センターライズ|リンクサポート|アラタ|たいよう|壱）
  - 該当: forest-fetcher.ts（mock 文字列）+ BloomStateContext.tsx（DEV_MOCK_USER の「東海林 美琴」）のみ
- `public/**/*.svg` glob → file.svg / globe.svg / next.svg / vercel.svg / window.svg のみ（Next.js 標準）
- `public/themes/` → atmospheres（6 webp）+ garden-login（3 png）+ module-icons（12 webp）+ garden-logo.webp のみ

### 判断保留事項（東海林さん判断仰ぎ）

**6 法人アイコンは Bloom 実装内に存在しません**。ChatGPT 生成可否を東海林さんで判断願います:

| 案 | 内容 |
|---|---|
| KK 案 | ChatGPT で 6 法人アイコン生成（boutique / watercolor 系で東海林さん感性「user_shoji_design_preferences.md」整合）|
| LL 案 | 既存「壱」 等の漢字ロゴ素材があれば東海林さんから提供 |
| MM 案 | 暫定として「文字ロゴ」（社名テキストの漢字 / カナ）で代替 → ChatGPT 生成不要 |

### 副次発見

`public/themes/module-icons/` に **12 モジュールアイコン（webp、各 116-246K）** あり:
- bloom / bud / calendar / forest / fruit / leaf / rill / root / seed / soil / sprout / tree

これは「**法人**アイコン」ではなく「**モジュール**アイコン」です。Forest v2 法人 6 色置き換えとは用途が異なるため、配置は東海林さん指示後に判断（混乱防止）。

## A-2. Bloom v2.8a ホームページスクショ = **判断保留**

### 調査結果

**現状の `/` は claude.ai 起草版 v9 unified（5/7 commit `fdc6809`）に置換済**:
- `src/app/page.tsx` = claude.ai 起草版 garden-home（中央大樹 + 12 バブル円環）
- `src/app/page.legacy-v28a-step5-20260507.tsx` = v2.8a Step 5（BackgroundLayer + Topbar + Sidebar + 12 Orb + ActivityPanel）が **legacy 保持中**

つまり、現状 dev で `/` にアクセスすると **v2.8a ではなく v9 unified** が表示されます。**v2.8a スクショ取得には legacy ファイル復元 + 一時 swap + dev rebuild + スクショ + 元に戻す** という大きい作業が必要。

### 判断保留事項（東海林さん判断仰ぎ）

| 案 | 内容 |
|---|---|
| NN 案 | v9 unified（現状 `/`）のスクショで代用（claude.ai 起草版なので作業日報セッションの再利用には十分？）|
| OO 案 | v2.8a 復元手順（legacy → page.tsx に一時 swap → dev rebuild → スクショ → revert）を 0.3d で実行 |
| PP 案 | v2.8a スクショは過去のリポジトリ history（5/6 以前の commit）から git checkout で取得 |

memory `feedback_no_delete_keep_legacy.md` 厳守のため、legacy への復元 swap は **慎重実装**（temp branch + revert で安全策）。OO 案を選ぶ場合は別 dispatch で正式承認願います。

## B 案件（他画面スクショ）= **判断保留**

A-2 と同理由（v2.8a 復元前提）で判断保留。NN 案（v9 unified スクショで代用）採用なら現状 dev で簡単取得可能。

## 配置済み内容

| ファイル | 状態 |
|---|---|
| `_reference/garden-bloom/bloom-corporate-icons/*.svg` | ❌ 配置なし（A-1 判断保留）|
| `_reference/garden-bloom/bloom-v2.8a-*-screenshot.png` | ❌ 配置なし（A-2 / B 判断保留）|

## 想定 ChatGPT 生成プロンプト（KK 案 採用時 参考）

東海林さんが KK 案で ChatGPT に依頼する場合の参考:

```
6 法人のロゴアイコンを以下の指示で生成してください:
- スタイル: ボタニカル水彩、温かみ、絵本的（東海林さん感性整合）
- サイズ: 512×512px、SVG または PNG（透明背景）
- 各法人テーマ:
  1. ヒュアラン: 緑系、樹冠を象徴
  2. センターライズ: 青系、水・流れ
  3. リンクサポート: 黄系、繋がり・補助
  4. ARATA: 紫系、新しさ
  5. たいよう: 橙系、太陽・暖かさ
  6. 壱: 朱・金系、漢字「壱」を装飾的に
```

## ご判断（A-1 / A-2 / B 各案）

a-main-015 + 東海林さんへの判断仰ぎ:
1. **A-1**: KK / LL / MM 案いずれか
2. **A-2**: NN / OO / PP 案いずれか
3. **B**: A-2 と同じ判断

判断後、a-bloom-004 で再着手します。

## §22-8 補足（main- No. 139 への報告と連動）

bloom-004- No. 57 で報告済の **コンテキスト使用率 60-70% 帯推定**は引き続き有効。HH 案（引っ越し準備）採用判断は a-main-014 / 015 で並行検討推奨。本 No. 58 は調査完了報告のみで、実作業着手前。

## 調査時間

15:00-15:25（25 分、grep + ls + ファイル不在確認 + 副次発見の整理）。
