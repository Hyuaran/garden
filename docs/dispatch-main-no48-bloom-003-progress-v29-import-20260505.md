# main- No. 48 dispatch - a-bloom-003 Bloom 開発進捗 v29 取り込み（/bloom/progress） - 2026-05-05

> 起草: a-main-012
> 用途: claude.ai 作業日報セッションが完成させた Bloom 開発進捗 v29 (5/5 付) を Garden プロジェクトの /bloom/progress として取り込み
> 番号: main- No. 48
> 起草時刻: 2026-05-05(火) 18:29
> 緊急度: 🔴 5/8 後道代表向けデモ必須

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🔴 main- No. 48
【a-main-012 から a-bloom-003 への dispatch（Bloom 開発進捗 v29 取り込み /bloom/progress 新規 page）】
発信日時: 2026-05-05(火) 18:29

claude.ai 作業日報セッションが完成させた Bloom 開発進捗 v29（5/5 18:01 付）を Garden プロジェクトに取り込み、/bloom/progress として公開します。5/8 デモ必須。

【素材ソース（Drive 上、東海林さん環境）】

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bloom\06_CEOStatus\
├─ chat-ui-bloom-dev-progress-v3-preview-20260505-v29.html  （277KB、CSS/JS 全インライン）
└─ images\decor\
    ├─ icon_work_office.png
    ├─ icon_work_home.png
    ├─ icon_work_irregular.png
    └─ progress_ring_000.png ... progress_ring_100.png  （11 枚、10% 刻み）
```

⚠️ 注: v3.html (5/4) と v29.html (5/5) は別物。**v29 のみが取り込み対象**（claude.ai 作業日報セッション report- No. 6 で明確化）。

【取り込み構成（推奨案 = iframe 配置で最速）】

# 1: 静的ファイル配置

```
public/_proto/bloom-dev-progress/
├─ index.html                                  ← v29 HTML を rename して配置
└─ images/decor/
    ├─ icon_work_{office,home,irregular}.png   （3 枚 copy）
    └─ progress_ring_{000,010,...,100}.png     （11 枚 copy）
```

注意:
- v29 HTML は CSS/JS 全インライン埋め込み済（外部ファイル不要）
- 画像参照 path は HTML 内で `images/decor/...` 相対 → `public/_proto/bloom-dev-progress/index.html` に対する相対 path として動作する
- フォントは Google Fonts から自動取得（ネット必須、デモ環境ネット OK 確認推奨）

# 2: Next.js page 作成

`src/app/bloom/progress/page.tsx`（新規）:

```tsx
"use client";

export default function BloomProgressPage() {
  return (
    <iframe
      src="/_proto/bloom-dev-progress/index.html"
      style={{ width: "100%", height: "100vh", border: "none" }}
      title="Garden 開発進捗 v29"
    />
  );
}
```

→ Topbar / Sidebar との重複可能性あり。BloomShell（既存 Bloom レイアウト）を介さず、専用 page として全画面 iframe で表示するのが最速。

または: BloomShell 配下で iframe を main 領域のみに表示（Topbar/Sidebar は本物、コンテンツ領域は iframe）も可。判断は a-bloom-003 で実装容易な方を選択。

# 3: サイドバーに「進捗」項目追加

`src/app/bloom/_components/BloomSidebar.tsx`（or 同等のサイドバーコンポーネント）に:

- ラベル: 「進捗」or「開発進捗」or「Garden 進捗」（東海林さんに確認推奨、もしくは仕様書方針に従う）
- href: `/bloom/progress`
- 既存 4 サブナビ（workboard / daily-report / monthly-digest / ceo-status）と同列追加

# 4: 既知の v29 HTML 内の特殊事項

冒頭に `<title>` が 2 つ存在（HTML としては 2 つ目が有効）:
- `<title>Garden Series - 経営状況</title>`（v3 残骸）
- `<title>Garden 開発進捗 — 庭の育ち | Bloom (preview v3.1)</title>`（v29 メイン）

iframe 配置時はブラウザタブには親ページの title が表示されるので影響軽微。修正不要。

【Drive → Garden プロジェクトのファイル copy 手順】

```bash
# Drive から Garden プロジェクトへ copy
SRC="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus"
DST="/c/garden/a-bloom-003/public/_proto/bloom-dev-progress"

mkdir -p "$DST/images/decor"
cp "$SRC/chat-ui-bloom-dev-progress-v3-preview-20260505-v29.html" "$DST/index.html"
cp "$SRC/images/decor/icon_work_"*.png "$DST/images/decor/"
cp "$SRC/images/decor/progress_ring_"*.png "$DST/images/decor/"
```

【検証フロー（a-main-012 が実施）】

修正後 push 受領 → Chrome MCP で:
1. /bloom/progress HTTP 200 + iframe 内 v29 HTML レンダリング
2. iframe 内の画像が全て表示（icon_work × 3、progress_ring 11 枚）
3. /bloom サイドバーから「進捗」リンククリック → 遷移成功
4. 履歴タブ / モジュールタブ / 概要タブ の表示確認（claude.ai 仕様書 v29 の 4 タブ）

【削除禁止ルール】

- public/_proto/bloom-dev-progress/ は新規ディレクトリなので legacy 不要
- src/app/bloom/progress/page.tsx は新規ファイルなので legacy 不要
- BloomSidebar.tsx 編集時のみ legacy 保持: BloomSidebar.legacy-progress-link-add-20260505.tsx

【完了報告フォーマット】

bloom-003- No. 30 で:
- commit hash + push 状態
- 配置確認（HTML + 画像 14 枚、計 15 ファイル）
- /bloom/progress HTTP code + 簡易表示確認
- サイドバー追加 before/after
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 49（必要なら微調整 dispatch）
a-bloom-003: bloom-003- No. 30 で完了報告予定

工数見込み: 30〜45 分（cp + page.tsx + sidebar 追加 + 動作確認）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 18:29 初版（a-main-012、claude.ai report- No. 6 受領後、素材保存場所確定 + a-bloom-003 取り込み依頼）
