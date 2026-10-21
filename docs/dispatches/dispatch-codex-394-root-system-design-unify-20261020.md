# Codex-394：Root・System の見た目の統一（見直しの結果）（2026-10-20）

前提：Codex-393〜393d（commit e488ab0c）で作った部品と決まりを使う
- 場所の表示 `C:\garden\a-bloom-008\src\app\system\_components\SystemBreadcrumb\`（root プロパティで「Root」「Bud」も出せる）
- タブ `...\system\_components\SystemTabs\`／最終更新 `...\system\_components\UpdatedStamp\`／右上の一覧・カード切り替え `...\system\_components\HeaderViewToggle.tsx`
- 社長スタイルの正本：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`（§3 の 11〜14 が今回の決まり）

**並行で Codex-395 が `src\app\bud\expenses\` を直している。`src\app\bud\expenses\` は読みもしない・触らない。**

## 東海林さんの決定（2026-10-20・見直しの結果を OK）
すべての画面の頭を次の形に揃える（System の業務管理ツール・INNOVERA履歴・録音と同じ）：
```
（右上：名前さん  [一覧/カード（ある画面だけ）] [ベル] [明暗] [ログアウト]）
System / 業務管理ツール        ← 場所の表示（小さい）
業務管理ツール                 ← h1（大きさは全画面同じ＝今の System の 30px）
                  ○○最終更新：… (↻)   ← ある画面だけ・右寄せ
 タブ1  タブ2                   ← ある画面だけ
━━━━━━─────────────────
中身
```

### Root（`C:\garden\a-bloom-008\src\app\root\`・14 画面）
1. 全画面に場所の表示「Root / 法人マスタ」など（Root のトップは「Root」だけ）。「Root」は /root へのリンク
2. タイトル下の説明文（「6法人の基本情報…」「Ctrl+Shift+G 検索…」など）を消す。キー操作の説明は消してよい（マニュアルにある）
3. 右上にベル（お知らせ）を付ける。並びは System と同じ（名前さん・ベル・明暗・ログアウト）。外枠は `src\app\root\_components\` の Root の外枠
4. h1 の大きさを System と同じに
5. 表のはみ出し（東海林さんのノートパソコン＝ブラウザの表示幅 1384px・左メニューを開いた状態）：法人・銀行口座・取引先・給与体系・社会保険・勤怠・KoT 同期履歴は**横スクロールなしで収まる**ように列の余白・幅を詰める（今 1026〜1154px／998px）。従業員マスタ（2014px）と権限一覧（1298px）は収まらないので**表の中だけ横スクロール＋いちばん左の列（ID や名前）を左に固定**。ページ全体ははみ出さない
6. 表の見出しは中央、数字は右寄せ（今どおり。崩れていたら直す）

### System（`C:\garden\a-bloom-008\src\app\system\`）
1. h1 の大きさを全画面同じに（今 40px＝マイページ・勤怠打刻・シフト・前確依頼・契約書管理、48px＝同期状況、38.4px＝テレマ コール集計、26px＝お知らせ。基準＝30px）。お知らせの h1 は `src\app\_components\notices\NoticeList.tsx` 側にあれば同じく
2. h1 を左メニューの名前に揃える：マイページ→「自分の情報」、給与計算に関する連絡→「給与計算連絡」。ほかにメニュー名と h1 が違う画面があれば同じく（メニューの名前の正本＝ShachoShell の設定 `src\app\system\_components\ShachoShell\shacho-shell-config.ts`。場所の表示の文字も同じに）
3. 管理表ポータル（`src\app\system\kanri\`）の表の見出しで左寄せのものを中央に
4. テレマ コール集計・管理表の横長の表は今の「表の中だけ横スクロール」のまま

### Bud の外枠（`C:\garden\a-bloom-008\src\app\bud\_components\BudShachoShell\`）
- 上の帯の「Bud ／ ○○」の文字を**全画面で出さない**（393 で口座残高だけ消した仕組みを全画面に）。場所の表示は各画面の中に置く（口座残高は済み。経費精算 2 画面は Codex-395 が付ける。**Bud のほかの画面（ダッシュボード・入金管理など）は、h1 の上に `SystemBreadcrumb root={{label:"Bud",href:"/bud/dashboard"}}` を付ける**。h1 が無い画面は場所の表示だけでよい）

## テスト
- Root：場所の表示・ベル・説明文なし・表の左列固定
- System：h1 の文字（メニュー名と同じ）
- Bud 外枠：上の帯に「Bud ／」が出ない
- 既存テストを今の作りに合わせて直す（Root の「表示 TSX に絵文字なし」のテストは守る。テストの中にも絵文字を書かない）

## 守ること
- commit・push しない。DB・外部 API に接続しない
- 各画面の動き・中身は変えない（見た目・文言の位置だけ）
- `npx vitest run src/app/system src/app/root src/app/bud/_components src/app/bud/bank src/app/_components src/lib` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す。前から落ちている AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
変えたファイル・画面ごとに直したこと・テストの結果だけ短く。
