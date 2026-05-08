# Garden Forest UI HTML mock 起草 claude.ai 依頼 spec

| 項目 | 値 |
|---|---|
| 起票 | 2026-05-09(土) 03:15 a-main-015 |
| 経緯 | ChatGPT mock 5 タブ + 修正版タブ 2 = 「いまいち」評価。claude.ai のデザインセンス活用 + HTML 化フロー切替提案（東海林さん 5/9 03:10） |
| 担当者 | claude.ai chat（東海林さん主導、デザインセンス + HTML 起草が得意領域）|
| 関連 spec | 2026-05-09-forest-ui-main-area-chatgpt-prompt.md / 2026-05-09-forest-ui-tabs-chatgpt-prompts.md / 2026-05-08-bloom-corporate-icons-chatgpt-prompt.md |
| 関連 docs | docs/forest-ui-unification-research-20260509.md |
| 確定 8 タブ構成 | 整理案 + タブ 8（法人間取引・手元現金）追加 |

---

## 1. claude.ai に依頼する内容（HTML mock 起草）

### 1-1. スコープ

Garden Forest モジュール（経営ダッシュボード）のメイン部分（左右サイドバー中央エリア）の HTML mock を起草する。

### 1-2. 8 タブ構成（東海林さん確定後）

| # | タブ | 含む項目 |
|---|---|---|
| 1 | ダッシュボード | グループサマリー + マクロチャート + 月次キャッシュフロー要約 + 東海林さん活動（Bloom 連携）|
| 2 | 財務サマリー | **法人数 / 従業員数 / 総資産集計（上部）** + ワンビュー（中段、最重要）+ レーダーチャート（下段左）+ 売上/利益詳細グラフ（下段右）|
| 3 | キャッシュフロー | 銀行残高一覧 + 売掛買掛サマリ + 月次推移詳細 + 入出金予定 |
| 4 | 事業 KPI | 法人別 KPI ダッシュボード + セグメント別指標 + **事業内容サマリ（追加）** + 取引先別売上ランキング |
| 5 | 予実対比 | 年次予算 vs 実績 + 月次予実対比 + 経費科目別推移 + 達成率ランキング |
| 6 | アラート・リスク | 資金繰り危険 + 納税期限 + 滞留売掛 + 派遣資産要件 + リスク評価マトリクス |
| 7 | レポート分析 | 納税カレンダー + 税理士連携 + 決算書ダウンロード + カスタムレポート |
| **8** ⭐ | **法人間取引・手元現金（新規）**| **法人間貸借マトリクス**（6×6）+ **手元現金管理** + **法人間入出金履歴** + **CSV 取込状況** + **税理士向け PDF 生成** |

### 1-3. 厳守事項（claude.ai が遵守）

| 軸 | 内容 |
|---|---|
| **ウサギは描画しない** | 全タブ共通、装飾要素として `<img>` で別途追加もしない |
| 既存 Forest UI 踏襲 | garden-forest_v9.html セクション内容を維持しつつ世界観統一 |
| Bud / Bloom precedent 整合 | ヘッダー / サイドバーは既存コンポーネント前提（HTML には描画せず、コメントで「ヘッダー / 左サイドバー / 右サイドバー はここ」と placeholder のみ）|
| 6 法人カラー一貫 | ヒュアラン=#F4A6BD ピンク / センターライズ=#8E7CC3 紫 / リンクサポート=#4A6FA5 青 / ARATA=#E8743C 橙 / たいよう=#F9C846 黄 / 壱=#C0392B 赤 |
| Forest 緑系 | #1b4332 / #2d6a4f / #40916c / #52b788 / #74c69d |
| 装飾 | 角丸 14-20px、シャドウ、バックドロップ blur(8px)、進行期 glow アニメ |
| ボタニカル水彩世界観 | bg-forest-light.png（背景）と整合、絵本的トーン |
| 画像参照 | `<img src="/themes/corporate-icons/hyuaran.webp">` 等の **参照パス**で記述（実画像は実装時に解決）|

---

## 2. claude.ai に渡す情報パッケージ

### 2-1. HTML ソース（claude.ai が text read で参照）

| # | ファイル | パス | 役割 |
|---|---|---|---|
| 1 | **Forest v9.html**（既存、踏襲対象） | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\08_Garden-Forest\garden-forest_v9.html` | 既存セクション content・データ表示形式 |
| 2 | **Bud v2 PL HTML**（precedent）| `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bud\01_PL\index.html` | ヘッダー + サイドバー + メインの全体構造（実コード）|
| 3 | **Bloom Top HTML**（precedent）| `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bloom\02_BloomTop\index.html` | Bloom 固有の HTML 構造（カード + KPI + Today's Activity）|

### 2-2. 画像参照パス（claude.ai が CSS / `<img>` で参照、画像 visual data 不要）

| 用途 | パス | 説明 |
|---|---|---|
| Forest 背景（ライト）| `_chat_workspace/_reference/garden-forest/bg-forest-light.png` | 朝の森、樹冠俯瞰 + 多層植物 |
| Forest 背景（ダーク）| `_chat_workspace/_reference/garden-forest/bg-forest-dark.png` | 月夜の森、ライト同構図 |
| 6 法人アイコン | `_chat_workspace/_reference/garden-bloom/bloom-corporate-icons/{hyuaran,centerrise,linksupport,arata,taiyou,ichi}.png` | アネモネ + ガラス玉円輪 |
| グループ HD 統合 | `_chat_workspace/_reference/garden-bloom/bloom-corporate-icons/hyuaran-group-hd.png` | 6 法人花束 |
| 12 モジュールアイコン | `_chat_workspace/_reference/garden-bloom/module-icons/{bloom,bud,calendar,forest,fruit,leaf,rill,root,seed,soil,sprout,tree}.webp` | ガラス玉スタイル |

→ 実装時の正規パス: `/themes/corporate-icons/hyuaran.webp` 等（public 配下、a-bloom-005 既配置）

### 2-3. 確定要件（タブごとの内容、§1-2 詳細版）

#### タブ 2: 財務サマリー（東海林さん要望反映）

| セクション | 配置 | 内容 |
|---|---|---|
| タブヘッダー | 上段 | 「2. 財務サマリー」+ サブタイトル |
| **法人数 / 従業員数 / 総資産集計** | **上段下**（3 カード横並び）| 6 法人合算サマリー、ガラス玉アイコン + 数値 + 前期比 |
| **ワンビュー** | **中段（最重要、最大スペース）**| 横スクロール micro-table、3 期分（確定）× 6 法人、各セルに売上/営業利益/経常利益/当期純利益/従業員数。法人列は固有カラー縞表示 |
| **レーダーチャート** | **下段左** | 6 軸（売上/営業利益/粗利率/従業員数/自己資本比率/成長率）で 6 法人重ね表示、各法人 半透明 polygon |
| **売上/利益詳細** | **下段右** | 月次/四半期/年次切替タブ + 折れ線グラフ（4 系列）|

#### タブ 8: 法人間取引・手元現金（新規、後道さん要望対応）

| セクション | 内容 |
|---|---|
| **法人間貸借マトリクス** | 6×6 マトリクス（縦=貸主、横=借主）、各セルに残高 + 緊急度カラー（赤=高額/橙=中/緑=安全）+ CSV 取込ボタン |
| **手元現金管理** | 各法人の現金残高（口座外） + 月次推移ミニグラフ + 最終更新日時 + CSV 取込ボタン |
| **法人間入出金履歴** | 直近 30 日 / 90 日 / 1 年 切替、入出金一覧テーブル（日付 / 貸主法人 / 借主法人 / 金額 / 用途）|
| **CSV 取込状況** | 最終取込日時 + ファイル名 + ステータス（成功/エラー）+ 履歴 |
| **税理士向け PDF 生成** | 1 クリックで PDF レポート生成ボタン（税理士事務所打ち合わせ用、約 2 ヶ月に 1 回利用想定）|

#### タブ 4: 事業 KPI（追加要素）

| セクション | 内容 |
|---|---|
| **事業内容サマリ（追加）** | 各法人の主要事業 + 主要取引先 TOP 5 + 売上構成（税理士打ち合わせで「どういう事業か / どの法人との取引が多いか」確認用）|
| 法人別 KPI ダッシュボード | 6 法人ミニカード（売上/利益/経費/粗利率/従業員数）|
| セグメント別指標 | 業態別比較棒グラフ |
| 取引先別売上ランキング | TOP 10、依存度 % |

---

## 3. claude.ai 投下用プロンプト（東海林さん用、コピペ可）

```
Garden Series（自社業務 OS）の Forest モジュール（経営ダッシュボード）UI のメイン部分（左右サイドバー中央エリア）の HTML mock を起草してください。

## スコープ

- 8 タブ構成（ダッシュボード / 財務サマリー / キャッシュフロー / 事業 KPI / 予実対比 / アラート・リスク / レポート分析 / 法人間取引・手元現金）
- メイン部分のみ（ヘッダー / 左右サイドバーは <header> / <aside> の placeholder コメントのみ）
- 8 個の独立 HTML ファイルとして起草

## 渡す HTML ソース（read してデザイン参考に）

1. 既存 Forest v9（踏襲対象）:
   `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\08_Garden-Forest\garden-forest_v9.html`

2. Bud v2 PL（precedent、ヘッダー + サイドバー + メイン構造の参考）:
   `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bud\01_PL\index.html`

3. Bloom Top（precedent、Bloom 固有のカード構造の参考）:
   `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bloom\02_BloomTop\index.html`

## 画像参照パス（CSS / <img> で参照、visual data 不要）

- Forest 背景（ライト）: `/themes/garden-forest/bg-forest-light.png`
- Forest 背景（ダーク）: `/themes/garden-forest/bg-forest-dark.png`
- 6 法人アイコン: `/themes/corporate-icons/{hyuaran,centerrise,linksupport,arata,taiyou,ichi}.webp`
- グループ HD 統合: `/themes/corporate-icons/hyuaran-group-hd.webp`
- 12 モジュールアイコン: `/themes/module-icons/{bloom,bud,calendar,forest,fruit,leaf,rill,root,seed,soil,sprout,tree}.webp`

## 8 タブ構成（詳細）

[ここに spec §1-2 の表 + §2-3 のタブ別内容詳細を貼り付け]

## 厳守事項

- ウサギは描画しない（全タブ共通、装飾としても入れない）
- 既存 Forest v9 セクション内容は踏襲（データ表示形式維持）
- Bud / Bloom 既存ヘッダー + サイドバーは <header> / <aside> placeholder コメントのみ
- 6 法人カラー一貫: ヒュアラン=#F4A6BD / センターライズ=#8E7CC3 / リンクサポート=#4A6FA5 / ARATA=#E8743C / たいよう=#F9C846 / 壱=#C0392B
- Forest 緑系: #1b4332 / #2d6a4f / #40916c / #52b788 / #74c69d
- 装飾: 角丸 14-20px、シャドウ、バックドロップ blur(8px)、進行期 glow アニメ
- ボタニカル水彩世界観 + ピーターラビット世界観（ただしウサギは描画しない、世界観のみ踏襲）
- ダミーデータで OK

## 出力指示

- 8 個の独立 HTML ファイル
- 各ファイル単独で開いてプレビュー可能（CSS は <style> インライン or 別 .css）
- ファイル名:
  - tab-1-dashboard.html
  - tab-2-financial-summary.html
  - tab-3-cashflow.html
  - tab-4-business-kpi.html
  - tab-5-budget-vs-actual.html
  - tab-6-alerts-risks.html
  - tab-7-reports-analysis.html
  - tab-8-inter-corp-cash.html

## 配置先（東海林さん配置時）

`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\`

## 開発方針

1 タブずつ起草 → プレビュー → OK / 修正フィードバック → 次タブ
（context 限界考慮、tab-1 起草後 a-main-015 に共有して評価 → tab-2 進行）
```

---

## 4. 投下手順（東海林さん用）

| Step | 操作 |
|---|---|
| 1 | claude.ai chat 新規セッション or 既存セッション継続（Garden UI 019 等）|
| 2 | 上の §3 プロンプト本文をコピー |
| 3 | claude.ai に投下 + Drive コネクタで HTML ソース 3 ファイル text read 許可 |
| 4 | 1 タブずつ起草依頼（tab-1 → 確認 → tab-2 ...）|
| 5 | 各 HTML ファイルを `_chat_workspace\garden-forest\html_drafts\` に配置 |
| 6 | 私（a-main-015）に「tab-N 配置完了」と一言 |
| 7 | 私が `Read` で text 読み込み + 視覚的にレビュー（HTML テキスト読込）+ Bud / Bloom precedent との整合確認 → OK / 修正方向 |
| 8 | 全 8 タブ完了 → a-forest-002 (or a-forest-003) で React 化実装 |

---

## 5. a-main-015 評価軸（HTML mock 受領後）

| 軸 | OK 条件 |
|---|---|
| HTML 構造 | 妥当な semantic HTML（section / article / aside / header 等）|
| Bud / Bloom precedent 整合 | 既存 Header.tsx + BloomSidebar.tsx と統合可能な class 構造 |
| 既存 Forest v9 内容踏襲 | 6 セクション内容（グループサマリー / 納税カレンダー 等）維持 |
| 6 法人カラー一貫 | カラーコード厳密 |
| ウサギ描画なし | 全タブ無し（<img>含む） |
| 画像参照パス整合 | 実装時の public/ 配下と一致 |
| データダミー | mock data として妥当 |

OK 判定 → 次タブ進行 + 後続 a-forest-002 React 化指示
NG 判定 → 修正方向 dispatch（claude.ai に投下する追加プロンプト）

---

## 6. 後続作業（HTML mock 完成後）

1. claude.ai HTML mock 8 ファイル完成 → a-main-015 視覚評価 → OK 判定
2. **a-main-016 起草の Forest UI 統一全体 spec** に HTML mock 反映（実装手順、コンポーネント設計、ファイル配置等）
3. 実装: a-forest-002 / a-forest-003 で React 化（Next.js コンポーネント化、TypeScript 化、API 統合）
4. 5/12 まで実装着手、5/13 統合テスト、5/14-16 後道さんデモ

---

## 7. ChatGPT 役割の縮小（新フロー）

| 旧 | 新 |
|---|---|
| ChatGPT が PNG mock 7 タブ生成（いまいち評価）| **claude.ai が HTML mock 8 タブ起草**（デザインセンス + テキスト構造）|
| ChatGPT で UI mock 修正 | claude.ai で HTML 修正 |
| ChatGPT 残役割 | **背景画像生成のみ**（bg-forest-{light,dark}.png 既完成）+ **6 法人アイコン**（既完成）+ 必要時の追加装飾画像 |

→ ChatGPT は「画像生成専用」に縮小、UI mock は claude.ai 担当へ。

---

## 8. 関連 dispatch / spec / docs

- main- No. 153（5/8 18:14）= ChatGPT 第一弾 GO
- main- No. 156（5/8 18:29）= 案 1 + 案 3 採用（claude.ai HTML read 戦略）
- main- No. 161（5/9 01:51）= Forest 背景画像配置
- 関連 spec: 2026-05-09-forest-ui-main-area-chatgpt-prompt.md（ChatGPT 投下用、初回 prompt）
- 関連 spec: 2026-05-09-forest-ui-tabs-chatgpt-prompts.md（ChatGPT 7 タブ続投プロンプト）
- 関連 docs: forest-ui-unification-research-20260509.md（事前調査）

## 9. 改訂履歴

- 2026-05-09 03:15 初版（a-main-015、東海林さん「claude.ai HTML 化」採用、ChatGPT mock いまいち評価後の役割再分担）
