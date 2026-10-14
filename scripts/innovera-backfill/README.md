# INNOVERA backfill

過去分の CDR を 1 日単位で INNOVERA から直接読み、Garden の `/api/system/innovera-ingest` に 500 件ずつ送ります。

```bash
node scripts/innovera-backfill/backfill.mjs --from 2026-01-01 --to 2026-10-13 --api https://garden-os.net
```

必要な環境変数:

- `INNOVERA_API_HOST`
- `INNOVERA_API_KEY`
- `INNOVERA_INGEST_SECRET`

`--dry` を付けると INNOVERA の取得だけ行い、Garden への送信とログ書き込みは行いません。進んだ日は `scripts/innovera-backfill/state.json` に保存されます。途中再開時に `--from` を省略すると state の翌日から再開します。
