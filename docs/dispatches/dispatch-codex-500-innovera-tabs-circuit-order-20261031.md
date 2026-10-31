# Codex-500 INNOVERA履歴・録音をタブ 2 つにし、発信番号の並び順と表題を決められるようにする（2026-10-31）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。
**ファイルは UTF-8。日本語を書いたら読み直して「?」に化けていないことを確かめる。**
社長スタイル §2.5 の型・§2.6 の点検に従う。
**画面の確認にパソコン操作（computer-use）・ブラウザ操作は使わない（東海林さんの画面を動かしてしまう）。** 画面の確認は Claude がやる。Codex はテストまで。
**この作業は一度途中まで進んでいる（route.ts・CircuitOrderEditor.tsx・circuit-order/・circuit-order.server.ts・移行ファイルなど）。今のファイルを読んで、足りない所を仕上げる。**
**同じ作業ツリーで別の作業（`src/app/my/` の AP日報）が直されている。そこには触らない。** tsc でそこのエラーが出たら直さずに報告に書く。

## 東海林さんの指示（画面の言葉）
「INNOVERA履歴・録音もタブ式に変えよう。並び替えボタンの位置をページごとに変えたくない。タブは 2 つにして発信番号を変えるページと検索のページを分ける」
「発信番号のプルダウンを並び替えられるようにしたい。並び順に表題を付けたい（例：代表番号の下に【代表ヒュアラン】06-4400-5414、発信番号の下に【発信番号】…）。表題ごとでも並び替えられるように。表題は増やしたりもできるように」

## 読むもの
- 仕様書：`C:\Claude\000_Garden\150_System_システム\00_マニュアル\19_INNOVERA履歴・録音\Garden_System_INNOVERA履歴・録音_4_仕様書_Claude読み込み用.md`（§4・§5・§9）
- 画面：`src/app/system/innovera-calls/InnoveraCallsClient.tsx`（441 行あたり「自分の発信番号」）・`InnoveraCallsContent.tsx`・`innovera-calls.module.css`
- 発信番号 API：`src/app/api/system/innovera-calls/line/route.ts`（GET が `circuits` を INNOVERA の順で返している）
- 部品：`src/app/system/_components/SystemTabs/SystemTabs.tsx`（`TabActionButton icon="sort" label="並べ替え"`）・`src/app/system/_components/ReorderGrip/ReorderGrip.tsx`（つまみ）。使い方の見本＝`src/app/bud/bank/BankAccounts.tsx`（140〜150 行）・`src/app/bud/profit/broadband/BroadbandTable.tsx`

## 画面の絵
```
System / INNOVERA履歴・録音
INNOVERA履歴・録音 ⚙
                                      INNOVERA最終更新：…  ↻
[ 通話・録音 ] [ 発信番号 ]──────────────────────── [⇅並べ替え] ← いつも出す。押せるのは super_admin が発信番号タブを開いているときだけ
                                                                  （それ以外は薄い灰色で押せない）
― 通話・録音タブ（最初に開く） ―
 今の「今日の内線」の枠（日ごとの内線の人）・絞り込み・件数・表・ページ送り・内線の紐づけ確認（今のまま）

― 発信番号タブ ―
 自分の発信番号：【ヒュアラン】0120-966-159（PC 内線 2001 ／ モバイル内線 1001）
 [ 変更後の発信番号 ⌄ ] [変更する]
   プルダウンの中：
   代表番号                ← <optgroup label="代表番号">（選べない見出し）
     【代表ヒュアラン】06-4400-5414
   発信番号
     【ヒュアラン】0120-966-159
   その他                  ← どの表題にも入っていない番号（表題が 1 つも無ければ optgroup なしで今までどおり）

― 発信番号タブ・並べ替え中（super_admin） ―
 ≡ 代表番号     [名前を変更する] [削除する]
     ≡ 【代表ヒュアラン】06-4400-5414
     ≡ 【代表センターライズ】06-7777-1307
 ≡ 発信番号     [名前を変更する] [削除する]
     ≡ 【ヒュアラン】0120-966-159
 その他（つまみなし・いつも一番下）
     ≡ 【利用予定】0800-600-1741
 [＋ 表題を追加する]
 （並べ替え中は、上のプルダウンと［変更する］は隠す。もう一度［並べ替え］を押すと終わる）
```

## やること
### 1. タブ
- `SystemTabs` でタブ 2 つ：「通話・録音」「発信番号」。URL は `/system/innovera-calls?tab=calls`（既定）／`?tab=line`。マイページに埋め込んだとき（`embedded`・`/my?tab=calls`）は URL を変えず画面の中の状態だけで切り替える（`/my` の `tab` を壊さない）。
- 今「自分の発信番号」の枠は絞り込みと同じ格子に入っている。発信番号タブに移したあと、通話・録音タブの絞り込みの並び（1,440px 以上で 2 行の格子・それ未満は折り返し）が崩れないこと。検索ボタンの右端の揃えは、発信番号の枠が無くなった前提で整え直す。
- 発信番号タブの中身（今の表示・プルダウン・［変更する］・変更の小窓・くるくる・失敗の出し方）は今のまま動かす。

### 2. 並び順の保存（データベース）
移行ファイル `supabase/migrations/20261031000500_innovera_circuit_order.sql` を書く（**本番に当てるのは Claude がやる。Codex は当てない**）。
- `system_innovera_circuit_groups`：`id uuid pk default gen_random_uuid()`・`name text not null`（1〜30 文字・前後空白なし）・`sort_order int not null`・`created_at`・`updated_at`。名前は一意。
- `system_innovera_circuit_positions`：`circuit_id text pk`（INNOVERA の回線 id）・`circuit_name text`（見返し用）・`group_id uuid null references system_innovera_circuit_groups(id) on delete set null`（null＝その他）・`sort_order int not null`・`updated_at`。
- どちらも RLS 有効・ポリシーなし（service_role だけ）。読み書きは API から `getSupabaseAdmin()`。
- 1 回の保存で全体を置き換える関数 `system_innovera_save_circuit_order(p_groups jsonb, p_other jsonb)`（`security definer`・`execute` は service_role だけ）：`p_groups`＝`[{id?:uuid, name:text, circuitIds:text[]}]`（並び順どおり）、`p_other`＝その他の `circuitIds` の並び。関数の中で全部を 1 つのトランザクションで書き換える（消えた表題は削除・id の無い表題は新規）。名前の空・重複・30 文字超・同じ回線が 2 か所にあるのはエラー。

### 3. API
- GET `/api/system/innovera-calls/line`（今のもの）：返す `circuits` を保存した並び順に並べ、新しく `circuitGroups: [{ id: string|null, name: string, circuits: CircuitSummary[] }]` も返す（表題の順・その他は `id:null, name:"その他"` で最後・空の表題も返す・その他が空なら入れない）。保存に無い回線（INNOVERA で新しく増えた）は「その他」の最後に INNOVERA の順で足す。保存にあって INNOVERA に無い回線は出さない。**本人が選べる回線（`allowedCircuitsForUser`）だけを返すのは今のまま**。
- 新しい GET `/api/system/innovera-calls/circuit-order`（super_admin だけ。それ以外は 403「並び順を変更する権限がありません」）：**INNOVERA の全回線**を上と同じ形で返す（並べ替え中の一覧はこれを使う）。
- 新しい PUT 同じ URL（super_admin だけ）：`{ groups:[{id?, name, circuitIds}], other:[circuitIds] }` を検査して関数を呼ぶ。返り値は保存後の GET と同じ形（新しい表題の id が入る）。
- 権限の判定は `ctx.role === "super_admin"`（`requireCallAccess()` の ctx）。

### 4. 並べ替え中の操作（super_admin・発信番号タブ）
- タブの右の `TabActionButton icon="sort" label="並べ替え"`（`pressed` で状態を出す）。押すと並べ替え中、もう一度で終わる。**他の画面と同じ部品・同じ位置**。自前のボタンを作らない。
- **ボタンはいつも出す**（東海林さん「並べ替えがないページはグレーにし、全てのページで同じ仕様に」）。通話・録音タブでは薄い灰色で押せず、マウスを当てると「このタブは並べ替えがありません」。super_admin でない人には「並べ替えは管理者だけが使えます」。`TabActionButton` に `disabled` を渡して灰色にする（今の部品に灰色の見た目が無ければ SystemTabs.module.css に足す）。
- 表題の左に `ReorderGrip`（表題ごと＝中の番号ごと上下に動く）。番号の左にも `ReorderGrip`（同じ表題の中でも、別の表題・その他へも動かせる。空の表題にも入れられること）。キーボードの上下キーでも動く（ReorderGrip の標準）。
- 表題の［名前を変更する］［削除する］／［＋ 表題を追加する］は共通の小窓（`src/app/system/_components/Modal/Modal.tsx`・`size="sm"`）。名前の欄 1 つ。削除は「『代表番号』を削除します。中の番号は『その他』に移ります」＋［キャンセル］［削除する］。ブラウザの confirm は使わない。
- **動かした・追加した・名前を変えた・消した時点で保存**（先に画面を変え、裏で PUT。失敗したら元に戻して赤字「並び順を保存できませんでした。もう一度お試しください」）。保存中に次の操作をしても順番が入れ替わらないこと（PUT は 1 本ずつ順に送る）。
- 並べ替えを終えたら、上のプルダウンの選択肢（本人の GET）を読み直す。
- 文言は「並べ替え」「表題を追加する」「名前を変更する」「削除する」「キャンセル」。

### 5. 見た目
- 表題の行は太字・番号の行は 1 段字下げ。ライト／ダーク両方で読めること（社長スタイルの変数を使う）。
- 幅 1,384px・1,440px・スマホ 390px でページがはみ出さない。小窓にスクロールバーを出さない（globals.css の決まりどおり・自前の小窓を作らない）。

## テスト
- `src/app/api/system/innovera-calls/line/route.test.ts` に：保存した並びで返る・新しい回線がその他の最後・保存にあって INNOVERA に無い回線は出ない・`circuitGroups` の形
- 新しい `circuit-order/route.test.ts`：super_admin 以外は 403・検査（名前の空・重複・同じ回線 2 か所は 400）・正しい本体で関数が呼ばれる
- `InnoveraCallsClient.test.tsx`：タブが 2 つ・既定は通話・録音・発信番号タブにプルダウン・`<optgroup>` の見出し・［並べ替え］はいつも出て、押せるのは super_admin の発信番号タブだけ（それ以外は disabled）
- `npx tsc --noEmit` と `npx vitest run src/app/system/innovera-calls src/app/api/system/innovera-calls src/lib/innovera` が通ること

## 終わったら
`docs/dispatches/report-codex-500-innovera-tabs-circuit-order-20261031.md`（UTF-8）に、変えたファイル・移行ファイル・テスト結果を書く。

## 実装時の取得回数の見積もり（Codex-500）
- cron・一定間隔の取り直しは追加しない。自動の追加取得は 0 回／日。
- 並べ替え開始ごとに全回線 GET 1 回、終了ごとに本人の発信番号 GET 1 回。1 日 N 回並べ替えれば追加取得は 2N 回／日（例：10 回なら 20 回／日）。
- 各編集で PUT 1 回。PUT 内で全回線一覧と保存後の並びを取得する。回線一覧は既存の INNOVERA クライアントのキャッシュを使用する。
