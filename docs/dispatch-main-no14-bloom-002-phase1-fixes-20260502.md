# main- No. 14 dispatch - a-bloom-002 Phase 1 NG 3 件 即修正 - 2026-05-02

> 起草: a-main-010
> 用途: Bloom Top Phase 1 視覚確認結果、NG 3 件の即修正
> 番号: main- No. 14
> 起草時刻: 2026-05-02(土) 15:23

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 14
【a-main-010 から a-bloom-002 への dispatch（Phase 1 NG 3 件 即修正）】
発信日時: 2026-05-02(土) 15:23

東海林さん視覚確認結果：基本骨格 OK、ただし NG 3 件即修正。

【視覚確認結果】

OK:
- 桜花 h1 横の小アイコン化 ✅
- KPI 4 枚 表示 ✅（87% / 8/12 / 4 件 / 集中業務中）
- ナビカード 4 枚 表示 ✅（ワークボード / 日報 / 月次まとめ / 経営状況）
- 背景花庭 ✅
- Activity Panel ✅

NG 3 件:

1. 左右のサイドバーのデザインが違う
   左 = 既存 v2.8a Garden Home Sidebar が残っている
   右 = Activity Panel
   prototype（02_BloomTop/index.html）の D1 推奨「Sidebar 削除」と不一致
   → サイドバー削除 or Bloom 専用 nav に差し替え

2. 経営状況クリック → 404
   ceo-status は Phase 3 実装予定で未実装
   → クリックゾーン一時無効化、Coming Soon Toast 等で対応
   （ワークボード / 日報 / 月次まとめも同様に未実装なら統一対応）

3. ページ下部に bg-click-zone（クリック☝マーク）残存
   Garden Home の「クリックで背景切替」機能の名残
   → Bloum Top では無効化

【修正方針】

NG 1: BloomLayoutClient 内で /bloom 時に Garden Sidebar をバイパス
   または page.tsx で Bloom 専用 nav (= bloom-nav-card 4 枚) のみ表示
   prototype の D1 推奨「Sidebar 削除」反映

NG 2: 全ナビカード 4 枚クリック → 404 防止
   - 案 A: クリック自体を disable
   - 案 B: クリック → "Coming Soon" Toast 表示（D8 推奨）
   - 案 C: ワークボードのみ生かす（既存 /bloom/workboard 動作）、他 3 枚は disable
   推奨: 案 C（ワークボードは既存実装あり、機能維持 + 他は Coming Soon）

NG 3: bg-click-zone を /bloom では無効化
   BloomLayoutClient or page.tsx で bg-click-zone を rendering しない
   または click event を pointerEvents: none で無効化

【Turbopack HMR 注意】

memory feedback_turbopack_hmr_globals_css_unreliable.md 参照。
globals.css 大量変更時は HMR 信用せず、dev server 再起動 + .next キャッシュクリア必須。
今回も globals.css 編集なら同手順で。

【完了報告期待】

修正後 commit hash + push 状態 + 東海林さん再視覚確認待ち、で a-main-010 に報告
（v4 ヘッダー形式、接頭辞 bloom-002）。

【dispatch counter】

a-main-010: 次 main- No. 15
a-bloom-002 の v4 接頭辞ルール（"main- No. NNN" 形式）周知未済。
今回 dispatch から「bloom-002- No. NNN」形式での発信に切り替えてください。
詳細: memory feedback_dispatch_header_format.md v4

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が即原因調査 + 修正。

## 改訂履歴

- 2026-05-02 初版（main- No. 14、Phase 1 NG 3 件即修正、v4 接頭辞周知付き）
