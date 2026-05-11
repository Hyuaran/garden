# main- No. 39 dispatch - a-bloom-002 dev server 再起動依頼 - 2026-05-04

> 起草: a-main-012
> 用途: PID 36572 (next start-server) hung、視覚検証ブロック → 再起動依頼
> 番号: main- No. 39
> 起草時刻: 2026-05-04(月) 23:35
> 緊急度: 🟡 5/8 デモ向け（4 日余裕、ただし視覚検証完了の前提）

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🟡 main- No. 39
【a-main-012 から a-bloom-002 への dispatch（dev server 再起動 + 起動確認）】
発信日時: 2026-05-04(月) 23:35

bloom-002- No. 21（main- No. 38 完了報告）受領 → a-main-012 で Chrome MCP 視覚検証着手 → dev server 無応答を検出。再起動お願いします。

【検出状況】

a-main-012 側からの確認結果:
- PID 36572 (next start-server) が listen `::3000` 状態で起動中
- HTTP 30 秒タイムアウトで無応答（curl -I も -L も exit 28）
- CPU 累計 2381 秒（22:44:39 起動 → 約 1 時間で 40 分相当 = webpack 詰まり典型）
- 起動直後の HTTP 200 報告は事実、その後 hung に遷移した模様

a-main-012 側で直接 kill すると worktree 干渉のため、a-bloom-002 で対応願います。

【作業内容】

```bash
# 1. PID 36572 を強制終了
taskkill /F /PID 36572
# または PowerShell: Stop-Process -Id 36572 -Force

# 2. .next キャッシュクリア（Turbopack HMR 対策、memory 既知）
rm -rf /c/garden/a-bloom-002/.next

# 3. dev server 再起動
cd /c/garden/a-bloom-002
npm run dev > /tmp/bloom-002-dev.log 2>&1 &

# 4. 起動確認（30 秒待機 → HTTP 確認）
sleep 30
curl -sI --max-time 10 http://localhost:3000/_proto/ceostatus/ | head -5
curl -sI --max-time 10 http://localhost:3000/bloom | head -5
```

【期待結果】

- _proto/ceostatus/ → HTTP 200 or 308 + index.html
- /bloom → HTTP 200（BloomGate dev バイパス済）
- 30 秒以内に応答

【削除禁止ルール】

dev server 再起動のみ、ファイル削除なし。`.next/` キャッシュは生成物なので削除可（恒久ファイルではない）。

【完了報告フォーマット】

bloom-002- No. 22 で:
- 旧 PID kill 結果
- 新 PID（再起動後）
- 起動確認 HTTP コード（_proto/ceostatus, /bloom 両方）
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 40
a-bloom-002: bloom-002- No. 22 で完了報告予定

工数見込み: 5 分（kill + npm run dev + 確認）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 に貼り付け投下 |

→ a-bloom-002 が再起動 + push → a-main-012 が Chrome MCP で main- No. 38 視覚検証 4 項目完走

## 改訂履歴

- 2026-05-04 23:35 初版（a-main-012、a-bloom-002 dev server hung 検出後）
