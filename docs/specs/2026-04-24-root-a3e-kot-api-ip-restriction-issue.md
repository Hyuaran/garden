# Root Phase A-3-e: KoT API IP 制限問題 Issue 起票

- 作成: 2026-04-24（a-main）
- 対象モジュール: Garden-Root（インフラ課題）
- 見込み時間: **0.2d（約 1.5h）**
- 先行依存: なし（独立課題）
- 後続依存: A-3-c（Vercel Cron の blocker）
- 担当: a-root セッション（issue 起票のみ）／東海林さん（判断）

---

## 1. 目的

KoT API の **IP 制限により Vercel 本番環境から呼び出せない問題**を GitHub Issue として起票し、解決策を明文化する。

### 現状
- KoT API は**契約先の固定 IP のみ許可**する設計
- 東海林 PC の IP のみ許可済
- Vercel Functions は**動的 IP**（リクエストごとに異なる）
- → **本番 Cron / Server Action からの KoT API 呼出は現状 401/403 で全滅**

### 影響
- Phase A-2 で実装した月次同期は**ローカル実行（東海林 PC 経由）のみ動作**
- A-3-c（Vercel Cron 自動同期）が blocker
- A-3-d（日次同期）も Vercel からは動作しない

---

## 2. 起票手順

以下をそのまま GitHub Issue として起票（repo: `Hyuaran/garden`）。

### Issue タイトル
```
[Root] KoT API IP 制限により Vercel からの同期が動作しない（3案から選定要）
```

### Labels
- `blocker`
- `module:root`
- `infra`
- `phase-a-3`

### Assignee
- 東海林さん（判断）

---

## 3. Issue 本文

```markdown
## 背景

Garden-Root の KoT API 連携（Phase A-2 実装済）は、ローカル開発（東海林 PC）からは動作するが、
**Vercel 本番デプロイからは IP 制限で弾かれる**。

- KoT API 契約: 許可 IP = 東海林 PC の固定 IP のみ
- Vercel Functions: 動的 IP（us-east-1 / ap-northeast-1 等のエッジから動的割当）
- 結果: Server Action / Cron から KoT API を叩くと 401/403 で失敗

## 影響範囲

| Phase | 機能 | 現状 | 備考 |
|---|---|---|---|
| A-2（完了） | 月次同期 Server Action | ❌ Vercel から不可 | ローカル実行なら OK |
| A-3-c | Vercel Cron 自動同期 | ❌ blocker | 本 Issue が解決するまで有効化不可 |
| A-3-d | 日次同期 | ❌ Vercel から不可 | 同上 |
| B 以降 | リアルタイム同期 | ❌ 同上 | Phase D 以降の想定 |

## 解決策候補

### 案 A: Vercel IP 範囲を KoT に許可申請
- **実現性**: ❌ 非現実的
- Vercel の IP レンジは非公開かつ動的、AWS / Cloudflare ネットワーク全体を許可するのと同義
- セキュリティ上 KoT 側が承認しない可能性大

### 案 B: 固定 IP プロキシサービス経由
- **実現性**: ✅ 現実的
- **候補サービス**:
  - **QuotaGuard Static** — Heroku Add-on として実績多数、月 $19〜 / 固定 IP 2 個
  - **Fixie** — HTTP プロキシ、月 $9〜 / 500 リクエスト無料枠
  - **Fixie Socks** — SOCKS5、Node 用ライブラリあり
- **構成**:
  ```
  Vercel Function → Fixie Proxy (固定IP) → KoT API
  ```
- **必要作業**:
  - プロキシサービス契約（月 $9〜$19）
  - 環境変数に `FIXIE_URL` 追加
  - `kot-api.ts` の `fetch` オプションに proxy agent 設定
- **リスク**:
  - プロキシサービスの SLA（障害時に同期停止）
  - トラフィック料金（同期データ量次第）
- **コスト見積**: 月 $9〜$30（最大見積）= 年 $360

### 案 C: Supabase Edge Function 経由
- **実現性**: △ 要検証
- Supabase Edge Function は Deno ランタイム、固定 IP ではない
- ただし Supabase が IP 公開している場合は許可申請の余地あり
- **要確認事項**:
  - Supabase の Egress IP が固定か
  - KoT に Supabase IP 範囲を登録できるか
- **メリット**: 追加サービス契約不要
- **デメリット**: Deno 制約で既存 TypeScript コードの直接流用不可、再実装が必要

### 案 D: 外部 Cron サービス経由で東海林 PC を叩く（つなぎ対応）
- **実現性**: △ 暫定のみ
- cron-job.org 等から東海林 PC の常駐アプリ（Next.js dev server）に wake-up を打ち、
  PC 経由で KoT API を叩いて Supabase に書込
- **リスク**:
  - 東海林 PC が電源オフ / オフライン時に同期失敗
  - ローカル環境が正本になり、冗長性なし
- **用途**: 案 B 契約までの 1-2 週間の暫定運用のみ

## 推奨案

**案 B（Fixie Socks + QuotaGuard バックアップ）**

理由:
1. 既に同類サービスの実績がある
2. コストが年 $360 程度で許容範囲
3. 既存 TypeScript コードの改修が最小（fetch に agent 渡すだけ）
4. Vercel / Next.js 16 との互換性が確認されている

## 要判断事項

- [ ] 案 A / B / C / D のどれで進めるか
- [ ] 案 B の場合、Fixie と QuotaGuard どちらを選ぶか
- [ ] 予算承認（月 $9〜$30）
- [ ] 契約タイミング（A-3-c 着手前 or Phase B 着手時）

## 決定後の次アクション

1. サービス契約 → 固定 IP 発行
2. KoT サポートに「この IP を許可リストに追加」依頼
3. `kot-api.ts` に proxy agent 実装
4. Vercel Preview で疎通確認
5. A-3-c（Cron）を有効化

## 参考
- Fixie: https://usefixie.com/
- QuotaGuard Static: https://quotaguardstatic.com/
- Vercel Edge Network IPs: https://vercel.com/guides/how-to-allowlist-deployment-domains

/cc @hyuaran-shoji
```

---

## 4. 実装手順

### Step 1: Issue 起票
- a-root セッション or 東海林さん本人が `gh issue create` で上記本文を起票

```bash
gh issue create \
  --title "[Root] KoT API IP 制限により Vercel からの同期が動作しない（3案から選定要）" \
  --body-file docs/specs/2026-04-24-root-a3e-kot-api-ip-restriction-issue.md \
  --label blocker,module:root,infra,phase-a-3 \
  --assignee hyuaran-shoji
```

### Step 2: Issue 番号を A-3-c の Readme 注記に反映
- A-3-c spec の「7. 注意事項・既知リスク」セクションに Issue URL を追記
- 後から見て blocker の参照が辿れるように

### Step 3: 東海林さん判断待ち
- 東海林さんが Issue コメントで案を選定
- 選定後、別 spec（A-3-e-followup）or 直接実装で proxy 導入

---

## 5. 完了条件 (DoD)

- [ ] GitHub Issue が起票されている
- [ ] 本文に 4 案の比較とコスト見積が含まれている
- [ ] A-3-c spec に Issue URL が追記されている
- [ ] Phase A-3 全体の blocker として見える化されている

---

## 6. 注意事項

- 本 spec は**実装コードを書かない**（Issue 起票のみ）
- 案選定後の実装は別 spec で切る（A-3-e-followup-<案> の形式推奨）
- KoT サポートへの連絡は東海林さん本人経由（SaaS 契約者権限が必要）
- プロキシサービス契約はユーザー承認必須（§CLAUDE.md 禁止事項「ユーザー事前承認なしの外部API課金呼び出し」）
