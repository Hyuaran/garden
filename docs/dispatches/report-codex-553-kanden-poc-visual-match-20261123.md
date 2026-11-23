# Codex-553 関電 フォーム・事務入力 見本対応報告

対象は `/m/kanden`、`/system/forms/kanden`、`/leaf/kanden/entry`。

| 画面 | 見本の部位 | 実装した組み立てと CSS |
| --- | --- | --- |
| フォーム | `page-header`、`tab-bar` | `sales-form.module.css` の `pageHeader` で離席を右端に置き、`tabs` の3等分グリッドで選択中の下線を表示。 |
| フォーム | `phone`、`phone-bar`、`phone-body` | `phone` は PC で幅340pxの枠を中央に置き、480px以下では利用できる幅を使う。`phoneBar`、`phoneBody` で上帯と18pxの内側余白を再現。 |
| フォーム | `mode-switch-bar`、`mode-banner`、`postadd-form` | `modeBar` で右寄せの小ボタンを表示。`modeBanner`、`postAddForm`、`foundCase` で案件確認から諸元添付までを同じ枠内に表示し、新規送信の入力を保持。案件一覧からの追加は既存のダイアログで継続できる。 |
| フォーム | `step-label`、`acquisition-picker` | ①〜③の小見出しをカードの外に置き、`acquisitionOptions` の2列に説明つきの選択カードを配置。選択とキーボードフォーカスはラジオ入力の状態からスタイルを切り替える。 |
| フォーム | `attachment-group`、`attach-block` | `attachments`、`attachmentHead`、`attachmentNumber` で番号・書類名・添付状態を1行に配置。`attachmentActions` の撮影ボタンはカード幅に広がる。ファイル選択は諸元カードと撮影ガイドに置いた。 |
| フォーム | `ocr-section`、`manual-sw-checkbox`、`status-box` | `ocr` の中に至急SW・希望月と桁数カウンターをまとめ、`pdResult` では未入力案内と照合状態に応じたカードを表示。 |
| フォーム | `confirm-card`、`profile-card`、案件カード、情報更新、`lock-card` | `confirmNumber` でお客様番号を中央に強調し、送信内容を下に並べる。`profileCard`、`profileRows`、`profileStats` でプロフィール・連絡先・実績・設定を表示。`caseList` では至急SW、検索、状態ラベル付きの案件カードを縦に置く。確認・情報更新・離席は既存のダイアログに `salesDialog`、`lockDialog` を適用。 |
| 事務入力 | 操作帯、レコード移動、左右入替 | `entry.module.css` の `toolbarActions` を折り返さない1行に設定。レコード表示以降を右寄せし、利用幅が足りない場合は帯だけが横スクロールする。 |
| 事務入力 | `image-pane`、`image-toolbar`、`vertical-tabs` | `case-dialog.module.css` の `imageToolbar`、`zoomGroup` で上帯にプレビュー名と拡大縮小を配置。`entry.module.css` の `columns`、`categories` でプレビューと入力の間に線画アイコン付きの62px縦タブを置く。初期表示は電灯・動力・ガスの実写を優先し、申込書の分類がなく未分類があれば「すべて」を開く。 |
| 事務入力 | `section-head`、`section-num`、`section-tools` | `entrySection`、`sectionHead`、`sectionNumber`、`sectionTools` で、番号と見出しを左、セクション転記と折りたたみ操作を右に配置。 |

配色はフォーム共通のテーマ変数と Garden の `--root-*` 変数、フォントは既存のゴシックを利用。絵文字は線画 SVG に置き換えた。後付け送信の案件確認は既存の案件番号入力と照会を使う。

Vercel 呼び出しの増分見積もりは **0 回／日**。定期処理やポーリングの追加はなく、照会・添付・送信は既存の操作で呼び出す。

## 検証

- 指定範囲の Vitest は35ファイル・164件すべて成功。ファイル選択を撮影ガイドから行う経路、後付け送信と入力保持、電灯優先と未分類へのフォールバックを検証した。
- `tsc --noEmit` はエラーなし。PowerShell ではローカルの `npx.cmd --no-install` を使用した。
- 変更した CSS は PostCSS で構文を検証し、変更ファイルの改行が LF であることを確認した。
- 375〜430px、1527px、ライト／ダークの実表示はブラウザ使用禁止のため未計測。見本の HTML・CSS と実装をコード上で照合した。
