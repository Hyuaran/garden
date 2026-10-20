# Codex-393d：タイトル下の説明文をなくす＋お知らせに場所の表示＋表示切り替えを 1 ボタンに＋Root の切り替えの一瞬の画面（2026-10-20）

前の指示書：`C:\garden\a-bloom-008\docs\dispatches\dispatch-codex-393*-20261020.md`（393・393b・393c の変更は未コミットで作業ツリーにある。続きとして直す）

## 東海林さんの決定（2026-10-20）
- **タイトル（h1）の下の説明文は、全画面でなしに統一**（説明はマニュアルにある。Claude が中身がマニュアルにあることを確かめ済み）
- **右上の一覧／カードの切り替え（393c で 2 つ並びにしたもの）を、明暗の切り替えと同じ 1 つのボタンにする**：見た目はベル・明暗と同じ四角。マークは「押すと切り替わる先」（今が一覧ならカードのマーク、今がカードなら一覧のマーク＝明暗ボタンと同じ考え方）。aria-label／ツールチップ＝「カード表示にする」「一覧表示にする」。保存と中身は今のまま
- **タブの下線は途中で切らずに中身の幅の右端まで**（今の業務管理ツールはタブの並びの幅で線が止まっている）。SystemTabs の外側の下線を親の幅いっぱいに。全画面で同じ
- 業務管理ツールの「入力する」タブの表で、「いつ・どこで」の列に「社員以上」が出て「対象」の列が空になっている。列の対応を確かめて、正しい列に出す（見てよい人の範囲は「対象」の列か、別の正しい列へ。いつ・どこでが無い項目は「—」）
- お知らせの画面にも、ほかの System の画面と同じ場所の表示「System / お知らせ」を付ける（SystemBreadcrumb → h1「お知らせ」）

## Root の画面切り替えの一瞬の「葉っぱの絵文字の画面」をなくす（東海林さん 2026-10-20）
- 今：`srcpp
- 今：`src/app/root/_components/RootGate.tsx` が `useRootState().loading` の間、全面に `src/app/_components/AuthLoadingScreen.tsx`（白い地＋モジュールの絵文字＋「利用状況を確認しています...」）を出す。Root の中でメニューを押して画面が変わるたびに一瞬これが出る（暗い表示だと白く光る）
- 直す：
  1. **一度ログインが確かめられたら、その後の確認中は全面の画面に差し替えない**（外枠と今の中身を出したまま。確認の結果ログインが切れていたら、今どおり「もう一度ログインしてください」へ）。なぜ画面が変わるたびに loading に戻るのか（RootStateContext の読み直し）も確かめ、不要な読み直しなら止める
  2. 初回の確認画面（AuthLoadingScreen）は**絵文字をやめ**、社長スタイル（地は明暗に合わせる・線画のマークか小さな回る印・文字はゴシック）に。白く光らないこと。ModuleGate からも使っているので、ほかのモジュールの確認画面も同じ見た目になる（それでよい）
- テスト：2 回目以降の確認中は中身が出たまま／ログインが切れたら案内が出る／確認画面に絵文字が無い

## 消すもの（h1 のすぐ下の、画面の説明の段落）
- `src\app\system\page.tsx`（日々の事務作業をまとめた入口です…）
- `src\app\system\contracts\page.tsx`（契約書の確認、登録…）
- `src\app\system\deliveries\DeliveriesHubClient.tsx`（決まった時刻に Chatwork へ…）
- `src\app\system\docs\page.tsx`・`docs\slides\page.tsx`・`docs\videos\page.tsx`（画面の説明の段落だけ。資料ごとの説明 document.description は一覧の中身なので残す）
- `src\app\system\forms\FormsHubClient.tsx`（連絡や申請の入力…）
- `src\app\system\innovera\InnoveraSyncClient.tsx`（INNOVERA の回線一覧と…）
- `src\app\system\manuals\ManualsHubClient.tsx`（Garden の使い方と仕組みの資料です。）・`ModuleManualsClient.tsx`（module.description）・`ManualDetailClient.tsx`（manual.description）
- `src\app\system\sites\SitesHubClient.tsx`（グループ各社の会社HP…）
- `src\app\bud\bank\BankAccounts.tsx`（マネーフォワードの口座残高と…）
- ほかに `src\app\system\` の中で h1 の直下に同じ役目の説明の段落があれば同じく

## 消さないもの
- 入力フォームの中の案内（操作の案内で、画面の説明ではない）：給与計算連絡の「営業部のみなさま…」と送信者の行、NHK 訪問業務報告の「業務が終わったら…」、出勤表・シフトの「KING OF TIME の日別データ…」
- 閲覧権限のない人への案内・エラー・読み込み中・件数などの表示
- 説明文の入れ物の CSS は、ほかで使っていなければ消してよい

## 見た目
- 説明文が消えた分、h1 の下の余白は「最終更新の行（あれば）→ タブ（あれば）→ 中身」が自然に詰まる間隔に。画面ごとに余白がばらつかないこと（説明文がもともと無かった画面と同じ間隔）

## テスト
- 既存テストで説明文を探しているものは外す
- お知らせの画面に「System」へのリンク付きの場所の表示が出る
- タブの下線が親の幅いっぱい
- 業務管理ツールの入力する表の列の中身
- 表示切り替えの 1 ボタン（押すたびに一覧⇔カード・マークと説明が切り替わる・保存される）

## 守ること
- commit・push しない。DB・外部 API に接続しない
- `npx vitest run src/app/system src/app/bud src/app/_components src/lib` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す。前から落ちている AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
変えたファイル・消した説明文の一覧・残したものと理由・テストの結果だけ短く。
