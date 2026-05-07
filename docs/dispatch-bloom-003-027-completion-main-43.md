~~~
🟢 bloom-003- No. 27
発信元: a-bloom-003
発信日時: 2026-05-05(火) 17:00
件名: main- No. 43 完了報告（/bloom サブナビ 404 + garden-home アイコン broken 修正）

## commit / push
- commit: `53dad32` fix(bloom): /bloom サブナビ 404 解消 + garden-home Bloom アイコン broken 解消 [dispatch main- No.43]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（f1ef078..53dad32）

## # 1 解決方針: 新規 page.tsx 作成

| URL | 解決方法 | 新規ファイル |
|---|---|---|
| /bloom/ceo-status | 既存 `workboard/ceo-status/page.tsx` の内容を top-level に再現（import path 調整、ShojiStatusWidget + CeoStatusEditor） | `src/app/bloom/ceo-status/page.tsx` |
| /bloom/daily-report | placeholder（「準備中」表示 + ワークボード/月次まとめ/経営状況への関連リンク 3 件） | `src/app/bloom/daily-report/page.tsx` |

両 page.tsx とも `useBloomState()` で BloomGate 配下動作確認、依存 component は既存資産（`ShojiStatusWidget` / `CeoStatusEditor`）を再利用。

## # 2 解決方針: アイコン 4 枚 copy

修正対象画像 path: `public/_proto/garden-home/images/icons_bloom/`（新規ディレクトリ）

`public/_proto/bloom-top/images/icons_bloom/` から下記 4 枚を copy:
- bloom_workboard.png
- bloom_ceostatus.png
- bloom_dailyreport.png
- bloom_monthlydigest.png

→ `public/_proto/garden-home/index.html` の line 428/444/452/460 にある `<img src="images/icons_bloom/bloom_*.png">` 参照が解決。HTML 編集不要。

## 検証 HTTP code（本セッション curl）

| URL | HTTP code |
|---|---|
| /bloom/daily-report | **200** ✅ |
| /bloom/ceo-status | **200** ✅ |
| /_proto/garden-home/images/icons_bloom/bloom_workboard.png | **200** ✅ |
| /_proto/garden-home/images/icons_bloom/bloom_ceostatus.png | **200** ✅ |
| /_proto/garden-home/images/icons_bloom/bloom_dailyreport.png | **200** ✅ |
| /_proto/garden-home/images/icons_bloom/bloom_monthlydigest.png | **200** ✅ |

broken 画像数: **0**

## legacy 保持ファイル一覧
全て新規ファイル追加のため legacy 不要（既存 garden-home/index.html および BloomTopbar.tsx 等は未編集）。

## 完了時刻
2026-05-05(火) 17:00（着手 16:53 → 完了 17:00、所要 7 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. /bloom/daily-report HTTP 200 + ページレンダリング
2. /bloom/ceo-status HTTP 200 + ShojiStatusWidget 表示
3. /_proto/garden-home/ の Bloom 配下アイコン 4 枚 broken 0 確認（naturalWidth > 0）

## 補足: workboard/ceo-status との関係
既存 `src/app/bloom/workboard/ceo-status/page.tsx`（/bloom/workboard/ceo-status）は維持。今回 top-level の `/bloom/ceo-status` を追加したのみ（重複ではなく canonical URL の補完）。両方とも内容は同等で、サイドバー link は top-level を canonical 採用。

a-bloom-003 待機中（次 bloom-003- No. 28）
~~~
