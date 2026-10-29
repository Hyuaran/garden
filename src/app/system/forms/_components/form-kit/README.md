# form-kit

NHK訪問業務・経費報告と同じフォームを作るための部品。CSS を複製せず `./index` から読み込む。

1. パソコン `/system/forms/<名前>` とスマホ `/m/<名前>` の入口を必ずセットで作る。種類が複数ならスマホは `/m/<名前>/<種類>` に分ける。
2. `forms-registry`（`../../_lib/forms-registry.ts`）に名前・入口・権限を登録する。既存の認証・権限の仕組みを使う。
3. 共通のクライアントで `FormPage` に題・送信者名・社員番号を渡す。スマホ入口では `mobile`。パソコンの切り替えは `tabs` に `SystemTabs` を渡し、その `actions` に歯車を置く。既存画面の操作案内は `description`、マニュアルへのリンクは `guide` に渡せる。新規画面の説明はマニュアルへ。
4. `FormRow label="1 日付"` の子に入力部品を置く。見出しを入力に関連付ける場合は `label={<label htmlFor="date">1 日付</label>}` とし、入力に `id="date"` を渡す。集計など横幅が必要な行だけ `expanded`。
5. 値・入力変更・検証・送信処理は呼び出し側で持つ。`SubmitButton busy={sending}` に送信中状態を渡し、送信関数でも多重送信を防ぐ。`ResultMessage success={成功か}` を送信ボタンの直後に置き、その後に `RecentList`。

| 部品 | 使い方 |
| --- | --- |
| `FormPage` | 題・送信者・明暗・スマホ／パソコンの外枠。スマホの長い題は折り返す |
| `FormRow` | 番号付き見出しと入力。スマホの項目列は共通の 100px |
| `RadioGroup` | `name`・`label`・`options`・`value`・`onChange`。2〜3 択を横並び・不足時は折り返し |
| `SelectField` | 普通の select の props と option を渡す。「選んでください」は自動で先頭に入る |
| `Stepper` | `label`・数値 `value`・`onChange`。増減・直接入力に対応し、整数・0 以上に整える |
| `TextField` / `NumberField` | input の props。数字は数字キーボード、`unit="円（税込）"` で単位を添える |
| `TextArea` | textarea の props |
| `FixedValue` | 子に固定の値を渡す |
| `SubmitButton` | `busy`・子にボタン名。form 内では `type="submit"` |
| `ResultMessage` | 子に結果文。成功は `success`、失敗・注意は省略 |
| `RecentList` | `title` と `items={[<p key={id}>報告内容</p>]}`。空なら「まだありません」。パソコンの DataTable は children に渡す |

保存は先に Garden、外部への送信は保存後。外へ送れなければ画面の結果と Garden通知の両方へ出す。実装・テスト時に本番 DB や Kintone へ接続しない。

取得回数は変更なし。画面を開いた際に読み込み、NHK は既存どおり送信成功後にも履歴を取得。経費は保存した報告を手元の一覧へ追加する。定期取得は 0 回／日。将来追加する場合は `usePolling` だけを使い、1 日の回数を指示書へ記載する。