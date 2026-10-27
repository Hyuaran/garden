# Codex-457：通話の取り込みの係（callcenter-agent）の送り直しを減らす（2026-10-27）

## なぜ
Vercel の送受信データ（Fast Origin Transfer）の大半が `/api/system/call-ingest`：直近 12 時間で 4,600 回・**1.16 GB**（1 日 約 2 GB・約 0.6 ドル／日）。係（`scripts/callcenter-agent/CallCenterAgent.ps1`）は毎ポール（pollSeconds ごと）に、主キーの増分のあと **直近 `refreshWindowDays`（7 日）の通話をまるごと読み返して送り直している**（README 6・29・49 行）。後から FileMaker で結果が直された行を拾うためだが、毎回 7 日分は多すぎる。

## やること
1. 見直しを 2 段に分ける：
   - **毎ポール**：主キーの増分＋直近 **`refreshWindowDays`（既定を 1 日に変更＝今日と昨日）** の読み返し。
   - **1 時間に 1 回**：直近 **`fullRefreshWindowDays`（既定 7 日）** の読み返し。最後に行った時刻を状態ファイル（`stateDirectory` の既存の状態）に持ち、`fullRefreshIntervalMinutes`（既定 60）たっていたら行う。初回（記録なし）は行う。
2. ログ：`sync completed` に `refresh_kind`（`recent`／`full`）・`refresh_window_days` を出す。
3. `config.example.json`・`README.md`（設定の意味・ホストPCでの入れ替え手順＝今の 2 ファイルを `.bak-20261027` で残す→差し替え→タスク再起動→ログ確認・戻し方）を直す。
4. 送る中身・API・Garden 側（`/api/system/call-ingest`）は変えない。
5. テスト（`scripts/callcenter-agent/tests/`・今の書き方に合わせる）：普段は 1 日分だけ読み返す／60 分たったら 7 日分／状態に時刻が残る／初回は 7 日分。

## 触らないもの
`src/`（Codex-456 が同時に作業）・本番 DB・ホストPC・環境変数・vercel.json。**git は触らないでください。コミットは人間側が行います。** 秘密の値をファイルに書かない。日本語の入った .ps1 は **UTF-8（BOM 付き）** のまま保つ（今のファイルの形を壊さない）。

## 確認
今のテストの流し方（README に書いてある Pester か PowerShell のテスト）で全部通ること。日本語が「???」に化けていないこと。

## 完了報告（コードブロックで）
変更したファイル／テスト結果／ホストPCで入れ替える手順（3〜5 行）。
