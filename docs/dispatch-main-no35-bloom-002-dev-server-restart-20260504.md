# main- No. 35 dispatch - a-bloom-002 dev server 復旧依頼 - 2026-05-04

> 起草: a-main-011
> 用途: bloom-002- No. 17 後、dev server 落ちで Chrome MCP 視覚最終判定不可、復旧依頼
> 番号: main- No. 35
> 起草時刻: 2026-05-04(月) 20:17
> 緊急度: 🔴（5/8 デモ向け視覚最終判定の前段階）

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 35
【a-main-011 から a-bloom-002 への dispatch（dev server 復旧依頼）】
発信日時: 2026-05-04(月) 20:17

bloom-002- No. 17 受領後、a-main-011 が Chrome MCP で視覚最終判定を試みた
ところ、dev server 落ちで `curl localhost:3000/bloom` 無応答。

【ファイルレベルでは修正完了を確認済】

- # A boxShadow: globals.css line 447 `box-shadow: none !important;` 確認 ✅
- # B Series ロゴ統一: 全 5 画面 122,419 bytes ✅
- # C toggle 同期: 0.4s → 0.45s 修正済 ✅

【dev server 復旧依頼】

副次対応で git index.lock スタック除去（Python os.remove）が webpack process に
影響した可能性。main- No. 17 と同パターン。

復旧手順:

1. dev server プロセス確認
   ```bash
   # Windows PowerShell
   Get-Process | Where-Object { $_.ProcessName -like "*node*" }
   ```

2. 古い process が残存していれば停止
   ```bash
   # 削除禁止ルール: Stop-Process は OK（プロセス停止、ファイル削除でない）
   Stop-Process -Id <PID> -Force
   ```

3. .next キャッシュ問題の可能性、Move で退避（rename 方式）
   ```bash
   # 削除禁止ルール準拠: Remove-Item ではなく Move
   if (Test-Path .next) { Move-Item .next .next.old.20260504-2017 }
   ```

4. dev server 起動
   ```bash
   npm run dev
   ```

5. 起動確認
   ```bash
   curl -I http://localhost:3000/bloom
   curl -I http://localhost:3000/_proto/ceostatus/index.html
   ```

【完了報告】

bloom-002- No. 18 で:
- 新 PID
- compile 時間
- HTTP 200 確認（/bloom + 全 _proto/ URL）
- 復旧時刻

復旧確認後、a-main-011 が即 Chrome MCP で:
1. /bloom の Activity Panel boxShadow = "none"
2. logo naturalW 480 / naturalH 160
3. toggle 動作（panel + toggle + arrow 完全同期）
4. 視覚区別つかないレベル達成判定

【dispatch counter】

a-main-011: 次 main- No. 36
a-bloom-002: bloom-002- No. 18 で復旧報告予定

工数見込み: 10-15 分（dev server 再起動のみ）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 に貼り付け投下 |

→ a-bloom-002 が dev server 復旧 → bloom-002- No. 18 で復旧報告 → a-main-011 が Chrome MCP で視覚最終判定 → 5/8 デモ準備完了。

## 改訂履歴

- 2026-05-04 20:17 初版（a-main-011、bloom-002- No. 17 後 dev server 落ちで起草）
