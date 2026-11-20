# Codex-541 関電の送信フォーム（営業が写メを添付して送る・社長スタイル）（2026-11-20）

## 背景（東海林さん 2026-11-20 決定）
- 関電の申込書の写メは、今は営業が TimeTree に貼っている。**このフォームができたら TimeTree への貼り付けはやめる**。
- 事務は移行のあいだ **FileMaker への入力を続ける**。フォームは「写メと受付の窓口」。管理番号で FileMaker の受注（`leaf_kanden_orders`）とつながる。
- 写メはサーバーで **PDF にして保管**、画面では**画像で表示**、ダウンロードも**画像**。**スマホから画像を保存するときは専用のパスワードが要る**（春の設計 A-1c v3 の決定を引き継ぐ）。
- 春の見本（PoC v10「新規送信」）の流れを引き継ぐ：撮影、囲込／奪還、至急 SW、「諸元が添付されていません → 諸元待ちで送信」、送信前の最終確認。春の設計書 `docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md`（HEIC→JPEG、長辺 1500px・JPEG 85%、サムネ 300px）も読む。
- 写メの置き場は Codex-535 の `leaf_kanden_photo_sets`／`leaf_kanden_photos`／バケット `leaf-kanden-photos`（`source='form'` を使う）。設計の正本：Obsidian `100_Projects/110_Garden/060_Leaf_個別アプリ/020_Kanden_関電/050_写メの保管とTimeTree移行.md`

**画面は社長スタイル §2.5〜§2.7 に従う。フォームは部品箱 `src/app/system/forms/_components/form-kit/` だけで組む（画面ごとに css を書かない・足りない部品は form-kit に足す）。手本＝NHK訪問業務 報告（`/m/nhk`・`src/app/system/forms/nhk-visit/`）。スマホと並べて見比べてから完成。**

## 画面の絵（スマホ `/m/kanden`・パソコン `/system/forms/kanden`）
```
関電 申込の送信                         東海林 美琴 さん
1 区分        ○奪還  ○囲込
2 管理番号    [            ]  ← 分からなければ空で送れる（PD は付けても付けなくてもよい）
3 お客様名    [            ]
4 獲得内容    □電灯 □動力 □ガス
5 至急SW      ○なし ○あり   （ありのとき）希望月 [ 5 ]月
6 写メ        電灯   [＋撮る・選ぶ]  □□□  （獲得内容で選んだものは 1 枚以上必須）
              動力   [＋撮る・選ぶ]
              ガス   [＋撮る・選ぶ]
              諸元   [＋撮る・選ぶ]  （任意・あとから追加できる）
              受領書 [＋撮る・選ぶ]  （任意）
7 メモ        [                      ]
              [ 送信する ]
─ 自分の最近の送信（RecentList） ─
 11/20 1527681 山田 太郎  電灯・動力  写メ 6 枚  諸元待ち  [諸元を追加]
```
- 諸元が 0 枚で送るとき：小窓「諸元が添付されていません」［添付する］［諸元待ちで送信］
- 送信前の最終確認の小窓：入力内容と写メの枚数を出して［戻る］［送信する］
- 送信後：ResultMessage「送信しました。事務に知らせました。」
- 自分の最近の送信の［諸元を追加］：同じ送信に諸元だけ追加で送る（諸元待ち → 諸元あり）

## やること
1. migration `supabase/migrations/20261120000541_leaf_kanden_submissions.sql`
   - `leaf_kanden_submissions`：id uuid pk／set_id uuid references leaf_kanden_photo_sets(id)／employee_id uuid／employee_number text／employee_name text／acquisition text check in ('奪還','囲込')／kanri_no text（normalizeKanriNo 済み）／kanri_no_raw text／customer_name text／has_denki・has_douryoku・has_gas boolean／urgent_sw boolean／sw_month integer（1〜12・null 可）／note text／specs_status text check in ('あり','諸元待ち')／submitted_at timestamptz default now()／updated_at
   - `leaf_kanden_settings`（1 行だけ）：image_download_password_hash text・updated_at・updated_by。RLS 有効・サービスロールのみ
   - RLS 有効・ポリシーなし（サーバーのサービスロールで読み書き）
2. 写メのアップロード（ブラウザ側）
   - 選んだ／撮った写真を、HEIC は JPEG に変換（`heic2any` が無ければ package に足す）→ 長辺 1500px・JPEG 85% に縮めて送る。サムネは作らない（表示は縮めた画像を `loading="lazy"`）
   - 送り先は署名付きアップロード URL（server action で発行・`leaf-kanden-photos/form/YYYY/MM/<送信ID>/<種類>_<連番>.jpg`）。Vercel の関数に画像本体を通さない（料金）
   - 1 枚 10MB まで。失敗した写メは再送ボタン
3. 送信（server action）
   - 本人はログインから（送信者を選ばせない）。役職の制限：社員なら誰でも送れる
   - `leaf_kanden_photo_sets`（source='form'・set_key=`form:<送信ID>`・kanri_no・event_date=今日）と `leaf_kanden_photos`（source='form'・source_key=保存先パス・category＝電灯/動力/ガス/諸元/受領）と `leaf_kanden_submissions` を作る
   - その送信の写メを全部 1 本の PDF（pdf-lib・1 枚 1 ページ）にして `pdf/form/YYYY/MM/<送信ID>.pdf` に保存。諸元を追加したら作り直す。PDF 作りは Storage から画像を読むので、関数の時間に気をつける（1 送信 30 枚まで）
   - Garden通知（`sendGardenNotice`）に 1 通：「関電の申込が届きました｜区分・管理番号・お客様名・獲得内容・至急SW・写メ n 枚（諸元待ち）・送った人」。失敗しても送信は成功扱い（Garden に保存してから知らせる）
4. 関電 案件一覧（`/leaf/kanden`・Codex-537）に「フォーム受付」のタブを足す
   - フォームの送信を新しい順に（受注年度ではなく送信日の年度で絞る）。列：送信日時（秒まで）・区分・管理番号・お客様名・獲得内容・至急SW・諸元・写メ枚数・送った人
   - 行を押すと小窓（lg）：入力内容と写メ（今の CaseDialog の写メ表示を共通化して使う）。管理番号が FileMaker の受注にあれば、その受注の詳細へ移るリンク
   - 既存の受注の小窓の写メは、kanri_no で TimeTree とフォームの両方を出す（今のままで両方出るはず。出なければ直す）
5. スマホでの画像の保存に専用パスワード
   - 小窓の［画像を保存］を押したとき、スマホ（幅 768px 未満 か タッチ端末）なら小さな小窓でパスワードを聞く。正しければその画面を閉じるまで聞かない
   - 照合はサーバーで（bcryptjs・`leaf_kanden_settings.image_download_password_hash`）。5 回間違えたら 10 分待つ
   - 全権管理者は `/leaf/kanden` のタブの行の歯車の横（または設定の小窓）でパスワードを設定・変更できる。未設定のあいだは「パスワードが設定されていません。全権管理者に設定を頼んでください。」と出して保存させない
6. 入口
   - パソコン `/system/forms/kanden`（業務管理ツールの一覧にも出す）と スマホ `/m/kanden`（スマホの入口の一覧にも出す）
   - 閲覧権限：フォームは社員なら誰でも。歯車のキーは `system-forms-kanden`

## 守ること
- **git 操作禁止**・**ブラウザ・computer-use 禁止**・**本番 DB・Storage・Chatwork への書き込み禁止**（migration は書くだけ。適用・動作確認は Claude）
- 画面ごとに css を書かない／絵文字・明朝・金色なし／画面の文字はきちんとした日本語・開発者用語なし／エラーの知らせは画面の上
- cron を足さない。報告に Vercel 呼び出しの見積もり（1 日あたり）を書く
- 改行は LF。関係ないファイルは触らない

## 確かめ
- `npx vitest run src/app/system/forms src/app/m src/app/leaf src/lib/leaf-kanden` が緑、`npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-541-kanden-submit-form-20261120.md`
