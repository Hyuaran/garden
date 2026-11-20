# Codex-535 関電の写メの保管と TimeTree 取り込み

## 作成・変更したファイル

- `supabase/migrations/20261120000535_leaf_kanden_photos.sql` に非公開 Storage バケット、まとまりと写メのテーブル、索引、RLS を定義した。
- `src/lib/leaf-kanden/kanri-no.ts` と `kanri-no.test.ts` に管理番号の正規化とテストを追加した。
- `scripts/leaf-kanden-photos/import-timetree.ts` に一覧の絞り込み、差分取り込み、PDF 更新、進捗表示、失敗ログを実装した。画像は初回失敗後に最大 3 回再試行する。
- `scripts/leaf-kanden-photos/import-timetree.core.ts` と `import-timetree.core.test.ts` に対象選定、保存パス、PDF 組み立てとテストを追加した。
- `scripts/leaf-kanden-photos/README.md` に一覧の作成手順と CLI の使い方を記載した。
- `vitest.config.ts` にスクリプトのテストを追加し、`.gitignore` に失敗ログの保存先を追加した。

## 検証

- `npx --offline --no -- vitest run src/lib/leaf-kanden scripts/leaf-kanden-photos` は 2 ファイル・13 テスト成功。PDF 用の画像を読む処理はモック化した。
- `npx --offline --no -- tsc --noEmit --incremental false` はエラーなし。
- 取り込み CLI と migration は実行していない。Vercel 経由の呼び出しは 0 回／日。定期実行は追加していない。

## 運用上の確認点

- `--dry-run` はローカルの一覧だけを読み、既に取り込んだ写メも含めて推計する。画像の推定容量は 8 万枚で 27 GB を基準にした。
- 写メの DB 行の登録後に PDF の更新が失敗した場合は、同じ一覧で再実行すると登録枚数と PDF 更新時の枚数の差から再処理できる。取り込みプロセスは 1 本ずつ起動する。
- PDF がバケット上限の 30 MiB を超えた場合は失敗ログに残る。HEIC の PDF 化は実行環境の sharp/libvips のデコーダーに依存する。実データの HEIC は未検証。
- 同じ予定内で異なる object_key の末尾ファイル名が一致すると、指定の保存規則では同じパスになる。一覧を作成した後、取り込み前に重複の有無を確認する余地がある。
