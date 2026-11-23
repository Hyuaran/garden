# Codex-554 関電のステータス保存 実装報告

## 変更

- `20261123000554_leaf_kanden_status_stored.sql` で受注に `computed_status` を追加し、既存の判定関数で全件を埋める。初期化後は NOT NULL とし、`(computed_status, ordered_on desc)` に索引を作る。
- 受注の INSERT／UPDATE 時に再計算する。入金明細取り込みの最後の受注更新と TimeTree ラベル変更も同じトリガーで反映する。
- 写メ、フォーム、事務入力の写真セットが変わったら関連受注を再計算する。写メの管理番号・セットの変更は変更前後を対象にする。直接リンクがない受注では最新フォームの切り替わりも反映する。
- 事務入力・案件一覧・営業フォームの一覧と件数集計を保存済みステータスに切り替えた。事務入力の「保留」を「差し戻し」にまとめる表示と、既存のステータス判定を維持した。

## 検証

- `npx.cmd vitest run src/app/leaf src/lib/leaf-kanden src/app/system/forms` は 25 ファイル、118 テストすべて成功。
- `npx tsc --noEmit` は終了コード 0。
- `supabase/tests/leaf_kanden_status_stored.sql` を追加した。既存データと判定関数の一致、受注、写メ、フォーム、事務入力の写真セット、入金、TimeTree の各更新経路を検証する。従業員を 1 名以上投入済みのテスト DB が必要。実行できるローカル PostgreSQL がなかったため SQL テストは未実行。
- 本番 DB への適用と計測は未実施。計測目標は `leaf_kanden_entry_page` が `counts=true` でも 300 ms 以下、`/leaf/kanden/entry` のサーバー応答が 1 秒以下。
- Vercel の呼び出し増分は **0 回／日**。再計算は既存の DB 書き込み内で行う。
