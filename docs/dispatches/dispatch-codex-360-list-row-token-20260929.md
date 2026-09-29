# Codex-360 リストマスタ：一覧の API から伏せていない電話番号をなくす（区分の直しは「鍵つきの札」で行う）

作成日: 2026-09-29
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く。作成時点は 03d94b5）
**git は触らないこと（commit・branch・stash すべて禁止）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。触ってよいのは下の「触るファイル」だけ。画面に出る文言は日本語のまま（英語に書き換えない）。**

必ず先に読むもの：
- ④ リストマスタ：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§4-1 条件と検索・伏せ字）
- 今のコード：`src/app/api/soil/list/_lib/query.ts`（`SearchRow`・`toSearchRow`＝`phoneNumberKey: phone` に伏せていない番号を入れている）・`src/app/api/soil/list/search/route.ts`・`src/app/api/soil/list/phones/category/route.ts`（PATCH `{ phoneNumber, category }`）・`src/app/system/list/_components/ListMasterClient.tsx`（`SearchRow` 型・`handleCategoryChange`・`categoryBusyPhone`・一覧の区分の select＝2746 行付近）

## 0. 何が問題か
- 一覧は画面では伏せ字（072****81）だが、一覧 API（POST search）の返り値に**伏せていない電話番号**（`phoneNumberKey`）が入っている。区分をその場で直す PATCH に番号を渡すためだけに使っている
- ブラウザの開発者ツールや通信の記録から、伏せていない番号が 1 ページ 100 件ずつ見えてしまう（使えるのは責任者以上だが、伏せ字の意味が薄れる）
- 台帳（soil_list_phone）には主キー・ID の列が無い（電話番号の一意索引だけ）。267 万行に列を足すのは重いので、表は変えない

## 1. 直し方
### A. 札を作る・戻す小さな部品（新規 `src/app/api/soil/list/_lib/row-token.ts`）
- `issueRowToken(phone: string, now = Date.now()): string` と `readRowToken(token: string, now = Date.now()): string | null`
- 中身：`{ p: 電話番号, t: 発行時刻(ms) }` の JSON を **AES-256-GCM** で暗号化（Node の `crypto`・IV は 12 バイトのランダム）。札＝`base64url(iv | 暗号文 | tag)`
- 鍵：環境変数 `SUPABASE_SERVICE_ROLE_KEY` から `crypto.hkdfSync("sha256", 値, "soil-list-row-token", "v1", 32)` で作る（新しい環境変数は足さない）。値が無ければ例外（画面には「区分を更新できませんでした」）
- `readRowToken`：形が壊れている・復号できない・発行から **12 時間**（`ROW_TOKEN_MAX_AGE_MS`）を超えた・p が数字だけでない → `null`
- 鍵は 1 回だけ作ってモジュール内に持つ（テストで差し替えられるよう、鍵を渡せる内部関数も用意してよい）

### B. 一覧 API は札だけを返す（`_lib/query.ts`・`search/route.ts`）
- `SearchRow` の `phoneNumberKey` を**やめて** `rowToken: string | null` にする。電話番号が空の行（約 9.8 万行ある）は `null`
- 伏せ字の `phoneNumber`（072****81）はそのまま
- `toSearchRow` の中で `issueRowToken` を呼ぶ（テストしやすいよう、札を作る関数を引数で渡せる形でもよい）
- **一覧 API の返り値のどこにも伏せていない電話番号が入らないこと**（テストで確かめる）

### C. 区分の PATCH は札で受け取る（`phones/category/route.ts`）
- 受け取り：`{ rowToken, category }`。`readRowToken` で電話番号に戻し、今と同じ `update … eq("電話番号", phone)`
- 札が無い・読めない・期限切れ → 400「画面を読み込み直してから、もう一度選んでください」
- 古い形 `{ phoneNumber }` はもう受け付けない（400）。権限（`requireSoilListUser`）・区分の値のチェックは今のまま

### D. 画面（`ListMasterClient.tsx`）
- 型の `phoneNumberKey` → `rowToken`。`handleCategoryChange(rowIndex, rowToken, category)` が `{ rowToken, category }` を送る。`categoryBusyPhone` → `categoryBusyToken`（中身は札）
- `rowToken` が `null` の行は区分の select を `disabled`（今も電話番号が空の行は直せていない＝動きは同じ）
- **画面の見た目・操作は変えない**（下の「画面の絵」）

## 2. 触るファイル
- 新規 `src/app/api/soil/list/_lib/row-token.ts`・`row-token.test.ts`
- `src/app/api/soil/list/_lib/query.ts`・`query.test.ts`
- `src/app/api/soil/list/search/route.ts`・`search/route.test.ts`
- `src/app/api/soil/list/phones/category/route.ts`（＋テストが無ければ新規 `route.test.ts`）
- `src/app/system/list/_components/ListMasterClient.tsx`・`ListMasterClient.test.tsx`

## 3. テスト（vitest・**`src/app/api/soil/list` と `src/app/system/list` の全部**を流して緑にしてから完了報告）
- row-token：発行→読み戻しで同じ番号／1 文字変えた札は null／12 時間を超えると null／別の鍵で作った札は null／数字以外の番号は null
- query／search：返り値の JSON 文字列に、元の電話番号（例 0721234581）が**含まれない**。`rowToken` が入る。電話番号が空の行は `rowToken: null`
- category：札で更新できる（update と eq の値が元の番号）／札なし・壊れた札・期限切れ・`phoneNumber` だけの古い形は 400／区分の値が不正は 400
- 画面：区分を変えると PATCH の body が `{ rowToken, category }`／`rowToken` が null の行は select が無効
- `npx tsc --noEmit`・触ったファイルの eslint

## 4. 画面の絵（**見た目は変わらない**）
```
一覧（12,292 件・個人情報は一部伏せる）
 電話番号    氏名  住所          …  区分          自社アポ禁
 012****78         大阪府大阪市…    [（空欄）  ▼]
 012****10         大阪府豊中市     [個人      ▼]   ← 区分を選ぶと今までどおりその場で保存
```
変わるのは裏で受け渡す値だけ（伏せていない番号 → 暗号化した札）。

## 5. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／変えたファイル／テスト本数と結果（流した範囲も）／tsc・eslint の結果
- 一覧 API の返り値に伏せていない番号が無いことをどう確かめたか
- 気づいた点・やり残し
