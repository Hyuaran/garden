# main- No. 40 dispatch - a-bloom-002 dev server 再起動依頼（2 回目） - 2026-05-05

> 起草: a-main-012
> 用途: PID 32044 死亡（PC スリープ等）→ 視覚検証ブロック → 再起動依頼
> 番号: main- No. 40
> 起草時刻: 2026-05-05(火) 13:40
> 緊急度: 🟡 5/8 デモ向け（3 日余裕、視覚検証完了の前提）

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🟡 main- No. 40
【a-main-012 から a-bloom-002 への dispatch（dev server 再起動・2 回目）】
発信日時: 2026-05-05(火) 13:40

bloom-002- No. 22 で起動報告された PID 32044 が死亡。再起動お願いします。

【検出状況】

a-main-012 側からの確認結果（5/5 13:39）:
- port 3000 listen なし
- PID 32044 プロセス無し
- node プロセスは Adobe Creative Cloud のみ
- Chrome MCP 全アクセスで chrome-error://chromewebdata/

推測原因: 5/4 23:52 起動 → PC スリープ or シャットダウンで kill された

【作業内容】

```bash
cd /c/garden/a-bloom-002
npm run dev > /tmp/bloom-002-dev.log 2>&1 &

# 起動確認（webpack 初回 compile 待ち、最大 6 分）
sleep 30
curl -sI --max-time 10 http://localhost:3000/_proto/ceostatus/index.html | head -3
curl -sI --max-time 10 http://localhost:3000/bloom | head -3
```

【期待結果】

- _proto/ceostatus/index.html → HTTP 200
- /bloom → HTTP 200（初回は最大 6 分の compile）

【完了報告フォーマット】

bloom-002- No. 23 で:
- 新 PID
- 起動確認 HTTP コード（_proto/ceostatus/index.html, /bloom）
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 41
a-bloom-002: bloom-002- No. 23 で完了報告予定

工数見込み: 8 分（npm run dev + 初回 compile 待ち + 確認）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 13:40 初版（a-main-012、PC スリープ起因の dev server 死亡検出後）
