# Codex-417：Kintone 従業員名簿 → Garden を「保存した瞬間」に反映する（2026-10-24）

## 目的
今は Kintone 従業員名簿（app 56）→ Garden の従業員台帳（root_employees）の同期が毎朝 6:00 の 1 回だけ。
Kintone で名簿のレコードを追加・変更したら、数秒で Garden に反映（アカウント作成も含む）されるようにする。毎朝 6:00 の全件同期は予備としてそのまま残す。
設計書：C:\Claude\000_Garden\150_System_システム\02_入社手続き\004_設計_入社の流れの自動化_20261024.md の §7・§8-A。

## 流れの絵
```
Kintone 名簿でレコードを保存
   └→ Kintone の Webhook が POST /api/root/roster-sync/webhook?key=＊＊＊ を呼ぶ
        ├ 合言葉（key）と app 番号を確かめる → 違えば 401／400
        ├ すぐ 200 を返す（Kintone を待たせない）
        └ 返したあとで（next/server の after）そのレコード 1 件だけを Kintone API から取り直して同期
             → 既存の syncRootRoster と同じ変換・同じ書き込み・同じアカウント作成
```

## やること
1. `src/app/root/_lib/roster-sync.server.ts`
   - `SyncOptions` に `recordIds?: string[]` を足す。指定があるときは名簿の取得を `$id in (...)` に絞り、そのレコードだけ同期する（ラベル同期 `syncRosterFieldLabels`・銀行一覧などの全件向けの処理は、`recordIds` 指定時は飛ばす）。既存の照合（社員番号・打刻ID・名前で既存の行を探す）は全件の root_employees を読んで今と同じに行う。
   - 指定なしの動き（毎朝 6:00）は一切変えない。
2. 受け口 `src/app/api/root/roster-sync/webhook/route.ts`（POST）
   - 合言葉：環境変数 `ROOT_ROSTER_WEBHOOK_SECRET` と URL の `key` を `timingSafeEqual` で比べる。未設定なら 503（何もしない）。
   - 本文の `app.id` が `KINTONE_EMPLOYEE_ROSTER_APP_ID`（既定 56）と違えば 400。
   - `type` が `ADD_RECORD`／`UPDATE_RECORD`／`UPDATE_STATUS` のとき：`record.$id.value` を取り、`after()` で `syncRootRoster({ dryRun: false, recordIds: [id] })` を実行。本文のレコードの中身は使わず、必ず Kintone API から取り直す（なりすまし対策）。
   - `DELETE_RECORD` などそれ以外：何もしないで 200（削除は今の毎朝の同期でも扱っていない。記録だけ console.info）。
   - 失敗は console.error に残す。Chatwork などへの通知はしない。
   - 同じレコードの連続保存で同時に走っても壊れないこと（今の書き込みは社員番号ごとの update／insert なので、insert が二重にならないかを確認。必要なら同じ社員番号の insert 前にもう一度存在確認）。
3. テスト：受け口（合言葉なし→401・違う→401・未設定→503・app 違い→400・ADD で 1 件同期が呼ばれる・DELETE は同期しない）、`recordIds` 指定で取得クエリが絞られ全件向けの処理を飛ばすこと。

## 触らないもの
- 毎朝 6:00 の cron（`src/app/api/root/roster-sync/cron/route.ts`）と vercel.json
- `src/app/bud/bank/` 配下（別件の作業中）
- **git は触らないでください。コミットは人間側が行います。** 本番 DB・Vercel の環境変数・Kintone の設定にも触らない（人間がやる）。

## 確認
- `npx tsc --noEmit` と、変更した範囲の `npx vitest run <対象>` が通ること。

## 完了報告（コードブロックで）
変更・追加ファイル／`recordIds` の動き／テスト結果（件数）／気になった点。長い説明は不要。
