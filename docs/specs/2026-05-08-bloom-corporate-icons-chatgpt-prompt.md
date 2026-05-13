# Bloom 6 法人アイコン ChatGPT 生成プロンプト spec

| 項目 | 値 |
|---|---|
| 起票 | 2026-05-08 a-bloom-005 |
| 経緯 | main- No. 150 KK 案 採用、bloom-004- No. 58 で判断保留化された A-1 を実装可能 spec 化 |
| 配置先（生成画像）| `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\bloom-corporate-icons\` |
| 関連 memory | `user_shoji_design_preferences.md`（精緻なボタニカル水彩、温かみ、絵本的）|
| 関連 module | Forest（経営ダッシュボード、6 法人カラー方針確定予定）|
| 利用先（想定）| Bloom v9 unified ホーム / Forest dashboard / 各法人参照 UI / 日報配信 PDF / 給与明細書ヘッダー |

---

## 1. 背景と目的

### 1-1. 経緯

bloom-004- No. 58（5/8 15:25）の調査で、Bloom 実装内に **6 法人ロゴアイコンが存在しない** ことを確認。
ChatGPT 画像生成（KK 案）が main- No. 150 で採用されたため、本 spec で生成プロンプトを確定し、東海林さんが ChatGPT に投下することで実画像を取得する。

### 1-2. 6 法人（東海林さん 2026-05-09 確定マッピング）

| # | 法人名 | 略称 | 業態 | カラー | HEX |
|---|---|---|---|---|---|
| 1 | 株式会社ヒュアラン | hyuaran | グループ HD・人材 | ピンク（薄桃〜淡桜）| `#F4A6BD` |
| 2 | 株式会社センターライズ | centerrise | コールセンター運営 | 紫（藤色〜菫色）| `#8E7CC3` |
| 3 | 株式会社リンクサポート | linksupport | 業務支援・連携 | 青（群青〜空色）| `#4A6FA5` |
| 4 | 株式会社 ARATA | arata | 新規事業 | 橙（朱橙〜山吹）| `#E8743C` |
| 5 | 株式会社たいよう | taiyou | エネルギー・関電業務委託 | 黄（山吹〜蜂蜜色）| `#F9C846` |
| 6 | 株式会社壱 | ichi | 第一・基幹 | 赤（朱赤〜緋色）| `#C0392B` |

> **採用経緯:** 2026-05-09 01:17 東海林さんが新マッピング確定（main- No. 157）。
> 当初 spec では「ヒュアラン=緑」「ARATA=紫」等の暫定値だったが、
> **6 色完全 distinct + 12 モジュールカラーと衝突しない** 配色を東海林さんが選定。
>
> シンボルも 6 法人共通で **「アネモネ + ガラス玉円輪フレーム + 黒紫花芯 + 細裂葉」** に統一（A 案、12 モジュール未使用花）。
> a-main-015 視覚確認で「6 色完全 distinct / 連作整合性 / 12 モジュール整合 / 1024×1024 透明背景 / 視認性 / ボタニカル水彩 + ピーターラビット世界観」全項目合格 ✅。

### 1-2-b. ヒュアラングループ HD 統合アイコン（2026-05-09 02:00 追加）

main- No. 158 で **6 法人花束統合アイコン** を追加配置:

| 用途 | ファイル | 説明 |
|---|---|---|
| グループ HD 表示 | `hyuaran-group-hd.webp` | 6 法人 6 色のアネモネを花束として束ねた統合表現 |

利用先（`GARDEN_GROUP_HD_META.usage`）:
- `chatwork` — Chatwork Bot プロフィール / メッセージヘッダー
- `bloom-home` — Bloom v9 統合ホーム画面のグループ表示部
- `forest-overview` — Forest dashboard の連結損益サマリ等
- `payslip-header` — 給与明細書ヘッダー（6 法人共通帳票）

> **位置づけ:** GARDEN_CORPORATIONS の 6 法人とは独立した「HD 視覚表現用」として、`GARDEN_GROUP_HD_META` 経由で利用。
> Forest 連携 spec（2026-05-09-forest-corporations-mock-migration.md）の「HD は本体に統合、別行表示時は別途分岐」の **別途分岐** 表示でこの統合アイコンを採用予定。

### 1-3. デザイン要件（東海林さん感性整合）

memory `user_shoji_design_preferences.md` に基づく必須要素:

- **精緻なボタニカル水彩**（ヨーロッパ伝統植物図鑑風）
- **温かみ・絵本的**（ピーターラビット世界観、デジタル冷たさ排除）
- **手描きアナログ感**（毎日開きたくなる癒し）
- Garden Series 世界観統一（12 モジュールアイコン群との連続性）

参考素材:
- 既存 12 モジュールアイコン群: `_chat_workspace/_reference/garden-bloom/module-icons/`
- 12 モジュール例: bloom.webp / bud.webp / forest.webp（**同テイストで 6 法人アイコンを揃える**）

---

## 2. ChatGPT 投下用プロンプト（東海林さんがコピペするテキスト）

> **2026-05-09 改訂版（A 案採用 = アネモネ + ガラス玉円輪 + 6 色 variations）**
> **以下のコードブロック内のテキストを ChatGPT にそのまま投下してください。**

```
Garden Series（自社業務 OS）で使用する 6 法人のロゴアイコンを生成してください。

## 共通スタイル要件（厳守）

- 画風: 精緻なボタニカル水彩（ヨーロッパ伝統植物図鑑風）
- トーン: 温かみ・絵本的（ピーターラビットや庭園図鑑のような世界観）
- 質感: 手描きアナログ感、にじみ・かすれを少し含む水彩
- 余白: 中央配置、外周に呼吸の余白
- サイズ: 1024×1024 px
- 出力形式: PNG（透明背景、アンチエイリアス有効）
- 一貫性: 6 法人すべてが「同じ画家が描いた連作」と感じられる統一感
- 文字: 法人名の文字は入れない（シンボルのみ）

## 6 法人共通シンボル（A 案、厳守）

すべての法人アイコンを **同じ構造** で揃えてください:

1. **中央: アネモネの花 1 輪**（横向きまたは半開き、5-6 枚の花弁、12 モジュールアイコン群で未使用の花）
2. **花芯: 黒紫色**（深い紺紫〜墨紫、視覚的アンカー）
3. **葉: 細裂葉（細く繊細に裂けた葉）**、左右に配置
4. **外周: ガラス玉のような円輪フレーム**（透明感のある円、わずかな反射光）
5. 6 法人で **構造は完全に同一**、変えるのは **花弁の主色** のみ

## 6 法人 カラー variations（花弁の主色）

### 1. ヒュアラン（hyuaran）グループ HD・人材
- 花弁主色: **ピンク（薄桃〜淡桜、#F4A6BD 近傍）**
- イメージ: 暖かさ、人材育成の柔らかさ

### 2. センターライズ（centerrise）コールセンター運営
- 花弁主色: **紫（藤色〜菫色、#8E7CC3 近傍）**
- イメージ: 静謐、知的な対話

### 3. リンクサポート（linksupport）業務支援・連携
- 花弁主色: **青（群青〜空色、#4A6FA5 近傍）**
- イメージ: 信頼、繋がる流れ

### 4. ARATA（arata）新規事業
- 花弁主色: **橙（朱橙〜山吹、#E8743C 近傍）**
- イメージ: 革新、立ち上がる勢い

### 5. たいよう（taiyou）エネルギー・関電業務委託
- 花弁主色: **黄（山吹〜蜂蜜色、#F9C846 近傍）**
- イメージ: 太陽、生命を育てる光

### 6. 壱（ichi）第一・基幹
- 花弁主色: **赤（朱赤〜緋色、#C0392B 近傍）**
- イメージ: 第一の格、揺るがぬ基幹

## 出力指示

- 6 枚それぞれ単体の PNG（透明背景、1024×1024px）
- 1 枚ずつ生成、生成後にプレビュー
- 6 枚並べた一覧画像も最後に 1 枚出力（A4 横、2 行 3 列）
- ファイル名（チャット内 表記）: hyuaran.png / centerrise.png / linksupport.png / arata.png / taiyou.png / ichi.png

## 参考スタイル（重要）

私はすでに 12 モジュールのアイコン群を同じ画風で持っています（添付画像参照）。
6 法人アイコンは、この 12 モジュールアイコンと **完全に同じ画家・同じ筆致・同じ世界観** で描いてください。
ただし、12 モジュールで使用済みの花（薔薇・桜・百合・ラベンダー等）は避け、
**アネモネ** を使用することで「12 モジュール = 木の構造、6 法人 = 花の構造」という視覚的階層を作ってください。
```

---

## 3. 東海林さんへの作業指示（コピペテキスト外）

> **以下は ChatGPT 投下時の補足。コピペテキストではなく東海林さん向けの操作手順。**

### 3-1. ChatGPT 投下時の添付ファイル（必須）

ChatGPT に上記プロンプトを投下する際、**以下のファイルを必ず添付**してください:

| 添付ファイル | パス | 役割 |
|---|---|---|
| Garden 12 モジュールアイコン一覧 | `_chat_workspace/_reference/garden-bloom/module-icons/`（12 webp）| 画風統一の参考、ChatGPT に「同じ筆致で」と伝えるため |

代替: 12 枚個別添付が重い場合、bloom.webp / forest.webp / tree.webp の **3 枚だけでも** OK（最も特徴的な 3 つ）。

### 3-2. 生成後の配置

ChatGPT が生成した 6 枚の PNG を以下に配置:

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\bloom-corporate-icons\
├─ hyuaran.png
├─ centerrise.png
├─ linksupport.png
├─ arata.png
├─ taiyou.png
├─ ichi.png
└─ overview-6corporations.png   （6 枚一覧）
```

配置後、a-bloom-005 セッションに「6 法人アイコン配置完了」と伝えれば、Bloom 内の `public/themes/corporate-icons/` への組込 + Forest dashboard 側組込を a-bloom-005 が実施。

### 3-3. もし生成結果がイメージと違う場合

| 状況 | 推奨対処 |
|---|---|
| 画風が硬い / 写実的すぎる | 「もっと水彩のにじみ・かすれを入れて、絵本的にして」と追加指示 |
| 色が派手すぎる | 「彩度を 30% 落として、淡く繊細な水彩に」と追加指示 |
| 文字が入った | 「文字は不要、シンボルのみ」と再生成依頼 |
| 12 モジュールと馴染まない | 添付した 12 モジュールアイコンを **再度参照させて**、「この画家の連作として」と強調 |
| 全然違う方向性 | プロンプトを **そのまま再投下**（ChatGPT のランダム性で変わる）|

### 3-4. 別案: claude.ai 経由で生成テキスト発行

ChatGPT 直接投下が難しい場合、claude.ai に「上記 spec の §2 のプロンプトを、ChatGPT に投下する形に整えて」と依頼してテキスト発行 → ChatGPT 投下、という二段階も可能（CLAUDE.md §20-2 役割分担準拠）。

---

## 4. 完成後の Bloom 側組込（a-bloom-005 担当、東海林さん配置完了後）

### 4-1. 配置先

```
C:\garden\a-bloom-005\public\themes\corporate-icons\
├─ hyuaran.webp        （PNG → WebP 変換、quality 90）
├─ centerrise.webp
├─ linksupport.webp
├─ arata.webp
├─ taiyou.webp
└─ ichi.webp
```

WebP 変換は cwebp（既存ツールで可）。

### 4-2. TypeScript 定義追加

```typescript
// src/lib/garden-corporations.ts
export const GARDEN_CORPORATIONS = [
  { id: 'hyuaran', name: '株式会社ヒュアラン', icon: '/themes/corporate-icons/hyuaran.webp' },
  { id: 'centerrise', name: '株式会社センターライズ', icon: '/themes/corporate-icons/centerrise.webp' },
  { id: 'linksupport', name: '株式会社リンクサポート', icon: '/themes/corporate-icons/linksupport.webp' },
  { id: 'arata', name: '株式会社 ARATA', icon: '/themes/corporate-icons/arata.webp' },
  { id: 'taiyou', name: '株式会社たいよう', icon: '/themes/corporate-icons/taiyou.webp' },
  { id: 'ichi', name: '株式会社壱', icon: '/themes/corporate-icons/ichi.webp' },
] as const;

export type CorporationId = (typeof GARDEN_CORPORATIONS)[number]['id'];
```

### 4-3. Forest dashboard 連携

Forest 側 `src/lib/forest-fetcher.ts` mock の「株式会社ヒュアラン」「ヒュアラングループ HD」を `GARDEN_CORPORATIONS` 経由参照に切替（Forest 側セッションで実施、Bloom はサポート）。

### 4-4. Bloom v9 ホーム展開（選択肢）

`src/app/page.tsx`（v9 unified）に「法人切替バッジ」を追加するか、Forest 内の専用画面に閉じるか、東海林さんと議論。

---

## 5. 工数見積

| Phase | 担当 | 工数 |
|---|---|---|
| ① ChatGPT 生成（東海林さん）| 東海林さん | 30 分 〜 1h（6 枚 + 修正含む）|
| ② PNG → WebP 変換 + 配置 | a-bloom-005 | 0.1d |
| ③ TypeScript 定義 + 既存 mock 切替 | a-bloom-005 | 0.2d |
| ④ Forest 連携（dispatch 経由）| a-forest セッション | 別 spec で起票 |
| ⑤ Bloom v9 ホーム展開可否 議論 | a-bloom-005 + a-main + 東海林さん | 別途 |
| **a-bloom-005 計（②③）** | | **0.3d** |

---

## 6. 関連 dispatch / spec / memory

### dispatch
- bloom-004- No. 58（5/8 15:25）法人アイコン調査 → 判断保留 KK / LL / MM 案
- main- No. 150（5/8 15:46）KK + NN 案 採用
- bloom-005- N（本 spec 完成報告 予定）

### spec
- `docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md`（本 spec）
- 関連: Forest v2 6 法人カラー方針 spec（未起票、Forest セッションで議論予定）

### memory
- `user_shoji_design_preferences.md`（精緻なボタニカル水彩、温かみ、絵本的）
- `project_garden_3layer_visual_model.md`（樹冠/地上/地下 縦階層、Forest は樹冠）
- `project_garden_dual_axis_navigation.md`（12 モジュール grid）

### 添付（重要）
- `_chat_workspace/_reference/garden-bloom/module-icons/`（12 webp、画風統一参考、5/8 配置済）
- `_chat_workspace/_reference/garden-bloom/module-icons/README.md`（5/8 配置済）

---

## 7. ChatGPT 投下手順（東海林さん向け、最終版）

```
Step 1: 上記 §2 のコードブロックをコピー
Step 2: ChatGPT 新規チャット作成
Step 3: §3-1 の添付ファイル（12 モジュールアイコン or 主要 3 枚）を添付
Step 4: §2 のプロンプトをペースト送信
Step 5: 生成結果を確認、必要に応じて §3-3 の追加指示
Step 6: 6 枚 + 一覧 1 枚 ダウンロード
Step 7: §3-2 の配置先に保存
Step 8: a-bloom-005 セッションに「配置完了」と伝える
```

これで KK 案 完走、Bloom 側で WebP 変換 + 組込 + Forest 連携。

---

## 8. 備考

- Forest v2 の 6 法人カラー方針は本 spec で **確定（2026-05-09）**。今後変更要望が出たら別 dispatch で改訂。
- 6 法人以外の関連法人（取引先・外注先）が将来追加された場合、本 spec の枠組みを踏襲して追加生成。
- ChatGPT 生成失敗（極端に違う画風・著作権抵触リスク等）時は LL 案（既存ロゴ提供）or MM 案（文字ロゴ代替）にフォールバック。

---

## 9. 改訂履歴

| 日時 | 改訂内容 | 担当 |
|---|---|---|
| 2026-05-08 18:21 | 初版起草。6 法人 シンボル + カラー暫定値（緑/青/黄/紫/橙/朱）+ ChatGPT 投下プロンプト + 東海林さん操作指示 | a-bloom-005（main- No. 150 KK 案 採用）|
| **2026-05-09 01:17** | **東海林さん新マッピング採用（main- No. 157）+ A 案アネモネ統一採用** | a-main-015 + 東海林さん |
| 2026-05-09 01:25 | §1-2 6 法人テーブルを HEX 付き確定マッピングに更新 / §2 プロンプトをアネモネ + 6 色 variations に書き換え / 1024×1024 px に拡張 / 主要変更点 8 項目 | a-bloom-005（main- No. 157 採用）|
| **2026-05-09 02:00** | **グループ HD 統合アイコン配置完了**（main- No. 158）= §1-2-b 追加 + GARDEN_GROUP_HD_META TypeScript 定義 + WebP 配置（hyuaran-group-hd.webp 224.4KB） | a-bloom-005（main- No. 158 採用）|

### 主要変更点（2026-05-09）

1. **シンボル変更**: 各法人個別シンボル（樹冠/水/蜜蜂/蕾/太陽/壱）→ 6 法人共通「アネモネ + ガラス玉円輪フレーム + 黒紫花芯 + 細裂葉」（A 案）
2. **カラー変更**: 暫定 → 東海林さん確定マッピング
   - ヒュアラン: 緑 → **ピンク #F4A6BD**
   - センターライズ: 青 → **紫 #8E7CC3**
   - リンクサポート: 黄 → **青 #4A6FA5**
   - ARATA: 紫 → **橙 #E8743C**
   - たいよう: 橙 → **黄 #F9C846**
   - 壱: 朱赤 → **赤 #C0392B**（基本同系統、HEX 確定）
3. **サイズ変更**: 512×512px → 1024×1024px（高解像度 + デモ用大型表示対応）
4. **視覚階層追加**: 「12 モジュール = 木の構造、6 法人 = 花の構造」コンセプト明示
5. **a-main-015 視覚確認 ✅**: 6 色完全 distinct / 連作整合性 / 12 モジュール整合 / 視認性 / ボタニカル水彩 + ピーターラビット世界観 全項目合格
6. **生成完了**: 6 法人 + 一覧 PNG 配置済（`_chat_workspace/_reference/garden-bloom/bloom-corporate-icons/`）
7. **WebP 変換完了**: `public/themes/corporate-icons/*.webp` 6 件配置（quality 90、圧縮率 約 90%）
8. **TypeScript 定義配置完了**: `src/lib/garden-corporations.ts` 起票（`GARDEN_CORPORATIONS` 配列、`getCorporationById` helper、Forest 連携用 `LEGACY_FOREST_MOCK_ID_MAP`）

### Forest 連携 spec（別起票）

- `docs/specs/2026-05-09-forest-corporations-mock-migration.md`（5/13 統合テスト前推奨）
