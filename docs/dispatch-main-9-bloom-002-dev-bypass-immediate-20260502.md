# main-9 dispatch - a-bloom-002 BloomGate dev バイパス即実装 - 2026-05-02

> 起草: a-main-010
> 用途: BloomGate.tsx に dev 環境バイパス追加（議論なし、即実装）
> 番号: main-9
> 起草時刻: 2026-05-02(土) 10:44

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main-9
【a-main-010 から a-bloom-002 への dispatch（BloomGate dev バイパス即実装）】
発信日時: 2026-05-02(土) 10:44

東海林さんが /bloom 視覚確認できない問題、即実装お願いします。

【現象】
localhost:3000/bloom 入力 → /forest/dashboard に強制リダイレクト
原因: BloomStateContext で fetchBloomUser 失敗 → signOutBloom → Forest 戻り

【修正内容】
src/app/bloom/_components/BloomGate.tsx に dev 環境バイパスを 1 行追加：

  export function BloomGate({ children }: { children: ReactNode }) {
    const { loading, isAuthenticated, hasPermission, isUnlocked } = useBloomState();
    const allowed = isAuthenticated && hasPermission && isUnlocked;

+   // dev 環境では認証バイパス（視覚確認用、本番は process.env.NODE_ENV !== 'development' で無効）
+   if (process.env.NODE_ENV === 'development') return <>{children}</>;

    useEffect(() => { ... });
    ...
  }

【着手】
1. BloomGate.tsx 修正（上記 1 行追加）
2. commit + push（feature/bloom-6screens-vercel-2026-05 ブランチ）
3. 東海林さんに「localhost:3000/bloom で視覚確認可能」と通知
4. memory に project_bloom_auth_independence.md として a-bloom-002 側でも記録

【🔴 重要】
- 議論不要、即実装
- 本番デプロイ時は自動的にバイパス無効（process.env.NODE_ENV === 'production'）
- 根本解決（Bloom 認証 Forest 統一）は post-5/5 タスク
- memory project_bloom_auth_independence.md 参照（a-main-010 側で既に記録）

【完了報告期待】
commit hash + push 完了 + 東海林さん視覚確認 OK 待ち、で a-main-010 に報告。

【dispatch counter】
a-main-010: 次 main-10
a-bloom-002 側のカウンター重複（bloom-002-3 が 2 件）も是正してください。

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が即実装 → 1 行追加 → push → 視覚確認可能になる流れ。

## 改訂履歴

- 2026-05-02 初版（main-9、Bloom 視覚確認用 dev バイパス即実装）
