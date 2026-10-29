# Codex-470：マイページ `/my` の「日報」タブに AP日報を作る（送信で Chatwork へ自動投稿）（2026-10-29）

## 東海林さんの話
- AP日報は、じぶんフォーム（https://app.jibun-apps.jp/form/69c43fac-8ab4-45db-a47c-e3df40758a02/new）を作っていたが、今は完全に手で Chatwork「スタッフ連絡用_official【AP】」に書いている。これをマイページのタブから入力し、［送信する］で Chatwork へ自動で送る。
- アカウントに紐づけてデータとしてためれば、自己分析にも使える（振り返りは日報タブの中に置く。今回は一覧まで）。
- **Chatwork の文は今手で書いている形にする**。
- **総コール数・留守・見込み・有効率はコール履歴から計算**。**トス・受注（本日獲得）もコール履歴から。ただしここだけは本人が訂正できる**。
- **コイン関係は本人が入力**。
- Kintone やフォームの中身を変えるのは問題なし（今回 Kintone は使わない。データは Garden）。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5〜§2.7（**§2.7 フォームの型＝form-kit の部品だけで組み立てる**）。`src/app/system/forms/_components/form-kit/README.md`。絵文字なし。iPhone で入力欄が拡大しないこと。

今の作り（読んでから作る）：
- マイページ `/my`（`src/app/my/page.tsx`・`MyShell.tsx`・`tabs.ts`）。今「日報」タブ（`?tab=report`）は「準備中」の枠。ここを AP日報にする。
- コール履歴の数え方：`src/app/system/_lib/call-metrics.ts`・`call-metrics-merge.ts`・`call-report-counts.server.ts`・RPC `system_call_metrics(p_from,p_to,p_list_name,p_employee_name)`（`src/app/api/system/call-report/route.ts` の使い方）。社員ごとの `absent_count`（留守）・`prospect_count`（見込み）・`toss_count`・`order_count`・有効率などがある。社員と Garden の従業員の結び付けは `call-metrics-merge.ts` の今の決まりを使う。
- 打刻：`src/app/system/attendance/`（Garden の打刻）。
- Chatwork 送信：`src/lib/chatwork`（ChatworkClient）。

## 1. 画面（`/my?tab=report`・form-kit）
- 区分：トス／クローザー。Garden の役職が toss ならトス・closer ならクローザーに決め、選ぶ欄は出さない（FixedValue）。それ以外の役職の人はラジオで選ぶ。
- 画面の絵（スマホ・クローザー）：
```
日報                                         東海林 美琴 さん
[今日の日報] [振り返り]                         ← 日報タブの中の切り替え（2 つ）
──────────────────────────────────────
1 区分        クローザー
2 日付        [2026/10/29]                    ← 今日が既定・変更可（変えたら下の自動の数字を取り直す）
3 時間        [14:00] ～ [21:00]   7 時間稼働    ← Garden の打刻（出勤・退勤・休憩）から自動・直せる。打刻が無ければ空
4 コール      総コール 195 件（留守 99 件）（見込み 17 件）   ← コール履歴から自動（直せない・「コール履歴から」と小さく）
              有効率 35.9%
5 本日獲得    [ 0 ] 件                         ← コール履歴の受注（クローザー）／トス（トス）から自動・Stepper で直せる
6 現状合計    [ 7.0 ] 件   効率 0.08            ← 今月の本日獲得の合計を自動（直せる・小数 1 けた）。効率＝現状合計÷今月の合計稼働時間（自動）
7 コイン      コイン作成数 [ ]  誘導約束 [ ]  誘導中 [ ]  明細確認依頼 [ ]  トータルコイン [ ]   ← 本人が入れる（Stepper・任意）
8 反省点・改善点  [・質問攻めされた
                    ⇒すぐトークに戻って光割る      ]   ← 必須・複数行
[                 送信する                 ]
```
- トスのときは 5 が「トス [ 1 ] 件」になり、6（現状合計・効率）は出さない（今のトスの文に無いため）。
- 送信の前に、下に「Chatwork に送る文」をそのまま表示する（送る前に目で確かめられる）。
- 結果：送れたら「送信しました（Chatwork に投稿しました）」。Chatwork に送れなかったら「Garden には記録しました。Chatwork への投稿に失敗したので、もう一度［送信する］を押してください」（もう一度押すと同じ日の記録を上書きして送り直す）。
- 同じ日に 2 回送ったら、Garden の記録はその日の 1 件を上書きし、Chatwork には「（訂正）」を頭に付けて新しく投稿する。
- 「振り返り」：自分の日報の一覧（新しい順・直近 31 日）。日付・時間・総コール・留守・見込み・有効率・本日獲得（トス）・現状合計・効率。スマホは 1 件 1 段（RecentList）。グラフは今回は作らない。

## 2. Chatwork に送る文（今の手書きと同じ形）
クローザー：
```
【谷本】
10月28日　14：00～21：00　　7時間稼働
総コール195件(留守99件)（見込み17件）
有効率35.9%（繋がった数÷総コール数）

本日獲得　0件
現状合計　7.0件　効率0.08

【反省点】【それに対しての改善点】
・質問攻めされた
⇒すぐトークに戻って光割る
```
トス：
```
【廣門】
10月28日　14：00～21：00　　7時間稼働
総コール192件(留守131件)（見込み22件）
有効率27.1%（繋がった数÷総コール数）

トス1件

【反省点】【それに対しての改善点】
・リアクションもっと
・質問攻め⇒余計な事言わない
```
- 名前は姓（Root の氏名の姓。全角スペースの前）。時刻のコロンは全角「：」、日付は「10月28日」。有効率は小数 1 けた。コイン関係は文に入れない（Garden に記録するだけ）。
- 送り先：環境変数 `AP_DAILY_REPORT_CHATWORK_ROOM_ID`（本番＝429282304「スタッフ連絡用_official【AP】」。Claude が設定する。無いときは送らず「Chatwork の設定がありません」）。送信は【事務局】システム自動通知（`CHATWORK_API_TOKEN`）。TO は付けない。

## 3. データ（Garden が正本）
- migration `supabase/migrations/20261029000470_system_ap_daily_report.sql`：表 `system_ap_daily_report`
  - id・employee_id・employee_number・employee_name・report_date・kind（'toss'|'closer'）・start_time・end_time・work_minutes・calls・absent・prospect・effective_rate・auto_count（コール履歴の値）・count（本人が直した後の本日獲得／トス）・month_total・efficiency・coin_created・guide_promised・guide_in_progress・statement_check_request・coin_total・reflection・chatwork_message_id・chatwork_error・sent_count・created_at・updated_at
  - unique(employee_id, report_date)。RLS：本人は自分の行だけ読める・書き込みは API（service_role）から。全権管理者は全部読める。
- 本番 DB に当てるのは Claude。Codex は当てない。

## 4. 入口
- `GET /api/my/ap-daily-report?date=YYYY-MM-DD`：その人のその日の自動の値（コール履歴・打刻・今月の合計）と、既にある記録・直近 31 日の一覧。
- `POST /api/my/ap-daily-report`：入力を確かめる → 保存（上書き）→ Chatwork へ投稿 → 結果を返す。本人はログインから決める（送られた社員番号は使わない）。
- ログイン中の在籍者なら誰でも。

## 5. テスト
- Chatwork の文：クローザー／トスの形・全角コロン・有効率の小数・コインが入らない・2 回目は「（訂正）」。
- 自動の値：コール履歴の数え方（留守・見込み・有効率・受注・トス）を今の call-metrics と同じにする。本日獲得を直したら直した値が送られる。
- 入力の確かめ（反省点が必須・時刻の前後）。Chatwork 失敗で 200＋chatwork_error。
- 画面：区分の決まり方・トスで 6 が出ない・送る文の表示・振り返りの一覧。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。Chatwork へ実際に送らない。**

## 実装時の取得回数
- 定期的な取得・cron の追加は無し（1 日 0 回）。日報タブを開いたとき・日付を変えたときに 1 回読む（コール履歴の集計 1 回・打刻 1 回・自分の記録 1 回）。送信 1 回につき Chatwork 1 回。

### Codex-470 実装時の補足
- 定期取得・cron：追加なし、0 回／日。
- 表示・日付変更の各1回につき API を1回。既存集計が期間単位のため、コール集計は日別と月別の2回（本日と月合計を算出）、月の打刻1回、自分の記録1回、社員照合1回。送信時も改ざん防止のため同じ情報を再取得する。
- 月合計はコール履歴の受注（acquired_count）／トスに保存済み日報の本人訂正差分を反映。月稼働時間は打刻の休憩控除後に本人訂正を反映する。
- Chatwork 投稿は1送信につき最大1回。設定がない場合は0回。実装・テストでは本番DB接続・実投稿を行わない。
