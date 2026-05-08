# main- No. 17 dispatch - a-bloom-002 dev server 再起動 + アクセス確認 - 2026-05-02

> 起草: a-main-011
> 用途: 東海林さんが localhost:3000/bloom と localhost:3000/_proto/bloom-top/index.html の両方にアクセス不可（「このサイトにアクセスできません」）。dev server 復旧依頼
> 番号: main- No. 17
> 起草時刻: 2026-05-02(土) 22:10
> 緊急度: 🔴（東海林さん視覚確認ブロック中）

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 17
【a-main-011 から a-bloom-002 への dispatch（dev server 再起動 + アクセス確認 緊急）】
発信日時: 2026-05-02(土) 22:10

bloom-002- No. 11 の視覚確認を東海林さんが実施しようとしたところ、
**localhost:3000/bloom と localhost:3000/_proto/bloom-top/index.html
両方にアクセス不可**（「このサイトにアクセスできません」）と報告あり。

→ dev server (PID 36948) が落ちた可能性。即復旧お願いします。

【対応手順】

1. 現在の dev server 状態確認
   ```powershell
   netstat -ano | findstr :3000
   Get-Process -Id 36948 -ErrorAction SilentlyContinue
   ```

2. PID 36948 が死んでる or ポート 3000 空いている → §3 で再起動

3. dev server 再起動（Turbopack HMR 教訓 + 削除禁止ルール遵守）
   ```powershell
   # .next キャッシュは削除せずリネーム保持（削除禁止ルール）
   if (Test-Path .next) {
     Move-Item .next .next.old.20260502-2210
   }
   npm run dev
   ```

4. 起動ログで以下を確認
   - "Ready in X.Xs"
   - compilation error 有無（globals.css v2 section / 新 component で error 出てないか）
   - port 3000 で listen 開始

5. compilation error がある場合
   - エラー内容をコピー
   - 該当ファイル / 行番号を特定
   - 即修正 → 再起動
   - 修正不可なら東海林さんに **エラーログ全文 + 推測される原因** を報告して停止

6. 起動成功 → 両 URL を curl で疎通確認
   ```powershell
   curl -I http://localhost:3000/bloom
   curl -I http://localhost:3000/_proto/bloom-top/index.html
   ```
   両方 HTTP 200 を確認

7. 完了報告（bloom-002- No. 12）
   - 新 PID
   - compilation error 有無 + 解消内容
   - 両 URL の curl 確認結果
   - 東海林さんへ「再アクセス確認お願いします」の一文

【NG パターン（避ける）】

- `.next` 削除（削除禁止ルール、必ず Move-Item でリネーム保持）
- 修正なしで放置（東海林さんがブロック中）
- 推測のみで完了報告（curl で疎通確認した上で報告）

【関連 memory】

- feedback_turbopack_hmr_globals_css_unreliable.md: globals.css 大量変更時は再起動 + キャッシュクリア必須
- feedback_no_delete_keep_legacy.md: 削除禁止ルール（.next も対象、リネーム保持）
- project_bloom_auth_independence.md: BloomGate dev バイパス維持確認

【dispatch counter】

a-main-011: 次 main- No. 18
a-bloom-002: bloom-002- No. 12 で復旧報告予定

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が dev server 復旧 + 両 URL 疎通確認後に bloom-002- No. 12 で報告。

## 改訂履歴

- 2026-05-02 22:10 初版（a-main-011、東海林さんアクセス不可報告後）
