# main- No. 32 dispatch - a-bloom-002 最終修正（A ロゴ + B 経営状況リンク + C 他カード Coming Soon 維持）- 2026-05-04

> 起草: a-main-011
> 用途: ① /bloom（React 本番）を ② /_proto/bloom-top（HTML プロト）と完全視覚一致達成。デモで見せた品質を本番でも保証する責任を果たす
> 番号: main- No. 32
> 起草時刻: 2026-05-04(月) 16:13
> 緊急度: 🔴 5/8 デモ後の本番運用に直結（デモ品質 = 本番品質保証）
> 背景: 東海林さん明示「デモでできていたのに本番で劣ったら評価下がる」。① 側を ② レベルに完成させる必要あり

---

## 重要な前提（東海林さん明示方針 2026-05-04）

> デモでは ② で実行するが、本番（①）で劣ると東海林さんの評価が下がる。
> ② を ① でもしっかり完成させる必要がある。

→ ① /bloom（React 本番）も ② /_proto/bloom-top（HTML プロト）と **同等品質を達成**するまで継続修正。post-5/8 デモでも ① 完成は最優先タスク。

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 32
【a-main-011 から a-bloom-002 への dispatch（最終修正：A ロゴ CSS + B 経営状況リンク + C 他カード Coming Soon 維持）】
発信日時: 2026-05-04(月) 16:13

bloom-002- No. 14 で # 2 時刻桁削れ + # 1 ロゴ確認受領、a-main-011 が
Chrome MCP + DOM 検証で残課題を特定。最終修正依頼します。

【重要な前提】

東海林さん明示方針:
「デモでは ② /_proto/bloom-top で実行するが、本番（①  /bloom）で
劣ると東海林さんの評価が下がる。② を ① でもしっかり完成させる必要がある」

→ ① /bloom も ② レベルに完成させること。本 dispatch の修正完了で
視覚一致達成が目標。post-5/8 デモでも継続修正可、品質最優先。

【A: ロゴ CSS 修正（🔴 必須）】

DOM で確認した真因:

```
.topbar-brand の rect:
  width: 260px,
  height: 248px,    ← 異常（Topbar 80px からはみ出し）
  top: -84.63px     ← 画面上端から 84px 上にはみ出し
img: garden_logo.png（公式横長ロゴ：木 + Garden Series + tagline）
```

公式ブランドロゴ（東海林さん共有）は **横長画像**。CSS で縦サイズ制約が
ないため、幅 260px に対して高さも比例膨張。

修正:

```css
.topbar-brand-img {
  max-height: 60px;       /* Topbar 80px 内に収める */
  width: auto;            /* 縦横比維持 */
  object-fit: contain;    /* はみ出し防止 */
}

.topbar-brand {
  height: auto;           /* 親の高さも調整 */
  overflow: visible;      /* 念のため */
}
```

または、Topbar 高さに合わせた値（max-height: 50-70px の範囲で調整）で
プロト ② と視覚一致するサイズに。

【B: 経営状況ナビカード リンク有効化（🔴 必須）】

経営状況の HTML プロトが既に完成済（東海林さん指摘 2026-05-04）:
`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bloom\06_CEOStatus\`

含まれるアセット:
- index.html（経営状況メイン）
- css/style.css
- js/script.js
- images/（avatar, decor, header_icons, icons, logo）
- README_ceostatus_v1_0_20260428190000.md

実装手順:

1. **アセットコピー**
   ```bash
   # a-bloom-002 worktree から実行
   cp -r "/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/" public/_proto/ceostatus/
   ```
   - index.html / css / js / images すべてコピー
   - 履歴 (index_YYYYMMDDHHMMSS.html 等) は除外、最新版のみで OK
   - 削除禁止ルール準拠（Drive 元は触らない、コピーのみ）

2. **経営状況ナビカードのリンク有効化**
   - `BloomNavGrid.tsx`（or 該当ファイル）の経営状況カード
   - Coming Soon バッジ削除
   - `<a href="/_proto/ceostatus/" target="_blank">` or Next.js Link で遷移
   - クリック動作確認

3. **動作テスト**
   - localhost:3000/bloom → 経営状況カードクリック
   - /_proto/ceostatus/ に遷移、画面表示確認

【C: 他 3 ナビカードは Coming Soon 維持（🟢）】

ワークボード / 日報 / 月次まとめ は **画面 HTML 未作成**（Drive 配下に
該当フォルダなし、アイコンのみ存在）→ Coming Soon バッジ + Toast で 5/8 OK。

確認:
- Coming Soon バッジ表示が継続しているか
- クリック時 Coming Soon Toast が出るか（main- No. 14 で実装済）

【削除禁止ルール継続】

- 既存 .legacy-* ファイルは保持
- 今回の修正で .tsx / .css 更新する場合、再度 legacy 保持
  例: BloomTopbar.legacy-logo-fix-20260504.tsx
- Drive 元の `06_CEOStatus/` は触らない（読み取り → コピーのみ）

【視覚一致検証フロー】

a-main-011 が Chrome MCP で修正後再スクショ → DOM 確認 → 視覚一致判定。

検証項目:
- ① # A ロゴ: topbar-brand の rect が height ≤ 70px、top ≥ 0
- ② # B 経営状況: クリック → /_proto/ceostatus/ 遷移、画面表示
- ③ # C 他カード: Coming Soon バッジ表示維持

【完了報告フォーマット】

bloom-002- No. 15 で:
- commit hash + push 状態
- # A ロゴ修正内容（CSS 変更箇所 + DOM rect 値）
- # B 経営状況リンク（コピーしたファイル一覧 + ナビカード変更箇所）
- # C 他カード確認結果
- legacy 保持ファイル（追加分）
- 完了時刻

【補足: 本番品質 = デモ品質】

本 dispatch の主旨は、5/8 デモで ② /_proto/bloom-top を見せた後、
**東海林さんが本番で ① /bloom を後道代表に見せても恥ずかしくない品質**
にすること。これは Garden プロジェクトの信頼性に直結。

完了後、a-main-011 が Chrome MCP で「① と ② が視覚区別つかない」レベル
を確認 → 東海林さん最終 OK 判定 → 5/8 デモ準備完了。

【dispatch counter】

a-main-011: 次 main- No. 33
a-bloom-002: bloom-002- No. 15 で完了報告予定

工数見込み: 1.5-2.5h（# A 30 分、# B 1-2 時間、# C 確認のみ）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が修正 + 経営状況コピー + push → a-main-011 が Chrome MCP で再検証 → ① と ② 視覚区別つかないレベル確認 → 東海林さん最終 OK。

## 関連 memory（参照）

- `project_godo_ux_adoption_gate.md`: 後道さん UX 採用ゲート（実物必須）
- `project_post_5_5_tasks.md`: post-5/8 タスク（Bloom 系 6 画面 Next.js 化）
- `feedback_no_delete_keep_legacy.md`: 削除禁止ルール
- `feedback_self_visual_check_with_chrome_mcp.md`: 視覚確認は Claude が実施

## 改訂履歴

- 2026-05-04 16:13 初版（a-main-011、bloom-002- No. 14 完了報告 + 東海林さん「デモ品質 = 本番品質」明示後、A+B+C 全対応として起草）
