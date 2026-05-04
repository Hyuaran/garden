# main- No. 38 dispatch - a-bloom-002 nav-pages-header href 修正 + ロゴサイズ統一 - 2026-05-04

> 起草: a-main-011
> 用途: 東海林さん指摘 2 件（nav-pages-header「Bloom」404 + ロゴサイズ不一致）修正
> 番号: main- No. 38
> 起草時刻: 2026-05-04(月) 22:25
> 緊急度: 🔴 5/8 デモ向け

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 38
【a-main-011 から a-bloom-002 への dispatch（nav-pages-header href + ロゴサイズ統一）】
発信日時: 2026-05-04(月) 22:25

東海林さん指摘 2 件、a-main-011 DOM 検証で真因特定。修正依頼します。

【# A: nav-pages-header「Bloom」クリック 404 修正（🔴 必須）】

東海林さんスクショ:「bloom の文字をクリックしたら 404」

DOM 確認結果（経営状況プロト /_proto/ceostatus/）:
- `<a class="nav-pages-header" href="../02_BloomTop/index.html">Bloom</a>`
- 展開 URL: `http://localhost:3000/_proto/02_BloomTop/index.html` ← 404
- 真因: Drive プロトの相対 path（`../02_BloomTop/`）が worktree 配置で壊れている

修正:

各 _proto/ 配下の HTML ファイルで nav-pages-header の href を修正。

```bash
# 経営状況プロト
sed -i 's|href="\.\./02_BloomTop/index\.html"|href="/bloom"|g' \
  /c/garden/a-bloom-002/public/_proto/ceostatus/index.html

# 他の _proto/ 配下も確認（同様の壊れた相対 path があれば修正）
grep -l "\.\./02_BloomTop" /c/garden/a-bloom-002/public/_proto/*/index.html
# → 出てきたファイルすべて同様に sed で `/bloom` 置換
```

**Bloom Top 側（src/app/bloom/_components/BloomSidebar.tsx）**:

`nav-pages-header` が active 表示中（Bloom Top 自身）。`href="/bloom"`（or onClick で /bloom へ）になっているか確認。なければ修正。

【# B: Topbar ロゴサイズ統一（🔴 必須）】

東海林さん指摘:「bloom トップと経営状況のシリーズロゴの大きさが違う、揃えて」

DOM 確認結果:
- Bloom Top（/bloom）: displayW **180**, displayH **60**
- 経営状況（/_proto/ceostatus/）: displayW **192**, displayH **64**

→ 1.067 倍違う。

修正:

経営状況プロト（public/_proto/ceostatus/css/style.css）の `.topbar-brand-img` 関連
CSS を Bloom Top と統一:

```css
/* Bloom Top globals.css と同じ値に揃える */
.topbar-brand-img {
  max-height: 60px;       /* 64px → 60px */
  width: auto;
  object-fit: contain;
}
```

または、経営状況の Topbar 高さ自体が違う可能性も：

```bash
# 経営状況の Topbar / brand 関連 CSS を確認
grep -n "topbar-brand\|topbar.*height" /c/garden/a-bloom-002/public/_proto/ceostatus/css/style.css

# Bloom Top globals.css の対応箇所を確認
grep -n "topbar-brand" /c/garden/a-bloom-002/src/app/globals.css
```

両方の値を比較し、Bloom Top に揃える（180×60 で統一）。

なお、他の _proto/ プロト（bloom-top, garden-home, garden-home-spin, login）も
同じ問題が起きている可能性。横断確認推奨。

【削除禁止ルール継続】

- 既存 .legacy-* ファイル保持
- 今回の修正で _proto/ 配下の HTML / CSS を更新する場合、再度 legacy 保持
  例: ceostatus/index.legacy-relative-path-20260504.html
       ceostatus/css/style.legacy-logo-size-20260504.css

【視覚一致検証フロー】

a-main-011 が Chrome MCP で修正後再 DOM 取得:
1. # A: 経営状況の nav-pages-header href = "/bloom"、クリックで Bloom Top 遷移
2. # B: 経営状況の Topbar img display = 180×60（Bloom Top と一致）
3. 他の _proto/ プロトも同様に統一確認

【完了報告フォーマット】

bloom-002- No. 21 で:
- commit hash + push 状態
- # A 修正対象ファイル一覧 + sed 結果
- # B CSS 変更箇所
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-011: 次 main- No. 39
a-bloom-002: bloom-002- No. 21 で完了報告予定

工数見込み: 30 分（sed 置換 + CSS 統一）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 に貼り付け投下 |

→ a-bloom-002 が修正 + push → a-main-011 が Chrome MCP で再検証 → 視覚一致達成 → 5/8 デモ準備完了。

## 改訂履歴

- 2026-05-04 22:25 初版（a-main-011、東海林さん指摘 + DOM 検証で真因特定）
