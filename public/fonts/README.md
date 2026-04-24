# Garden Bloom — PDF 用フォント配置

月次ダイジェスト PDF (`/api/bloom/monthly-digest/[month]/export`) の日本語レンダリング用。
**未配置の場合は日本語が `□` で表示される**ため、本番運用前に必ず配置してください。

## 必要ファイル

| ファイル名 | 用途 | 配置場所 |
|---|---|---|
| `NotoSansJP-Regular.ttf` | 本文 | `public/fonts/NotoSansJP-Regular.ttf` |
| `NotoSansJP-Bold.ttf` | 見出し | `public/fonts/NotoSansJP-Bold.ttf` |

## ダウンロード手順

1. https://fonts.google.com/noto/specimen/Noto+Sans+JP を開く
2. 右上「Get font」 → ダウンロード zip を取得
3. zip の `static/` フォルダ内から以下 2 ファイルを取り出す：
   - `NotoSansJP-Regular.ttf`
   - `NotoSansJP-Bold.ttf`
4. 本ディレクトリ (`public/fonts/`) に配置
5. Git にコミット（`chore(bloom): add Noto Sans JP for PDF generation`）

## ライセンス

Noto Sans JP は **SIL Open Font License 1.1** です。配布元の LICENSE ファイルも同梱してください。

## なぜリポジトリに入れるのか

- CDN fetch は cold start で追加遅延 + 外部依存発生
- Vercel Function は読み取り専用 FS のため実行時ダウンロード後にキャッシュできない
- 計約 6MB は Vercel Function サイズ上限（50MB）に比して十分許容範囲

## ファイル配置後の確認

1. Bloom admin で月次ダイジェストを 1 件作成
2. `http://localhost:3000/bloom/monthly-digest/YYYY-MM/export` をブラウザで開く
3. PDF がダウンロードされ日本語が正しく表示されれば OK
4. サーバログに `[bloom/pdf] NotoSansJP fonts not found` が出ていないことを確認
