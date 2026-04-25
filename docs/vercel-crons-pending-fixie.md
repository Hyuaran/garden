# Vercel Cron 未登録項目（Fixie 契約後に有効化）

## 背景

Root の KoT 同期 Cron（Issue #30 で blocker 中）は **Fixie 固定 IP プロキシ契約完了まで Vercel Scheduler への登録を保留**する。

vercel.json に未知の独自キー（`_note_root_crons_disabled` / `crons_pending_fixie_root` 等）を含めると Vercel schema validation でエラーになり preview deploy が全部失敗する。
そのため、本ファイルに保留中の cron 設定を**仕様レベルで保管**し、契約後の有効化手順を明示する。

---

## 有効化前提

1. Fixie Socks（または QuotaGuard Static）契約完了 → 固定 IP 発行
2. KoT サポートに上記 IP を許可リスト追加申請
3. Vercel 環境変数登録：
   - `CRON_SECRET`（Cron 認証用、ランダム 32 文字）
   - `FIXIE_URL`（プロキシ URL）
4. `kot-api.ts` の proxy agent 配線（要 `undici` 追加、a-main 承認必須）
5. 本ファイルの cron 定義を `vercel.json` の `crons` 配列に移動

---

## 移動対象 Cron（Root KoT 同期）

```json
{
  "path": "/api/root/kot-sync/cron-daily",
  "schedule": "0 18 * * *"
}
```
- 毎日 UTC 18:00 = JST 03:00
- 前日分 /daily-workings を KoT API から取込
- 認証: `CRON_SECRET` 必須

```json
{
  "path": "/api/root/kot-sync/cron-monthly",
  "schedule": "0 18 28-31 * *"
}
```
- 毎月末候補日（28-31）UTC 18:00 = JST 03:00
- Route 側で「翌日=月初」判定し、月末 1 回だけ走らせる
- 認証: `CRON_SECRET` 必須

---

## 移動手順（Fixie 契約後）

1. `vercel.json` の `crons` 配列に上記 2 件を追加：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/bloom/cron/daily", "schedule": "0 9 * * *" },
    { "path": "/api/bloom/cron/weekly", "schedule": "0 9 * * 5" },
    { "path": "/api/bloom/cron/monthly", "schedule": "0 9 14 * *" },
    { "path": "/api/root/kot-sync/cron-daily", "schedule": "0 18 * * *" },
    { "path": "/api/root/kot-sync/cron-monthly", "schedule": "0 18 28-31 * *" }
  ]
}
```

2. 本ファイル（`docs/vercel-crons-pending-fixie.md`）は削除 or 「履歴」セクションに retain
3. PR を作成して develop マージ
4. Vercel ダッシュボードで Cron 一覧に Root 系 2 件が登録されたことを確認
5. 翌朝 `/root/kot-sync-history` で cron log が記録されているか確認

---

## 関連

- Issue #30: KoT API IP 制限により Vercel からの同期が動作しない
- PR #39: A-3-c Vercel Cron 自動同期（本 cron 定義の元実装、当初 vercel.json に独自キーで保管していた）
- spec: `docs/specs/2026-04-24-root-a3c-vercel-cron-auto-sync.md`
