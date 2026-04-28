# a-bloom-002 dispatch v7 補足 - 48h GitHub push block 状況通知 - 2026-04-27

> 起草: a-main-009
> 用途: a-bloom-002 への状況共有 + ローカル commit 継続指示 + V7-B/V7-C 進捗確認 + 画像配置確認
> 前提: dispatch v7 V7-A 完了済（SHA `ababd29` push 済）、V7-B 着手中、V7-C 未着手

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】dispatch v7 補足 - 48h GitHub push block + ローカル継続指示

▼ 状況（GitHub アカウント連鎖 ban + Team プラン課金 48h block）

- 4/27 17:30 頃 B 垢 ShojiMikoto-B が ban（A 垢に続いて）
- C 垢 shoji-hyuaran 新設、Hyuaran org に Owner 権限で参加
- Team プラン課金試行 → GitHub anti-fraud で 48h 調査ブロック
- 「You can't proceed with your payment」エラー、48 時間以内に GitHub から返信待ち

詳細: memory `project_github_account_crisis_20260427.md` 参照

▼ あなた（a-bloom-002）への影響

- ✅ ローカル commit は **完全に継続可能**（git commit は GitHub 不要）
- ❌ git push は 48h 不可（C 垢でも token はあるが、現状の token 状態で push はリスク高）
- ✅ npm run dev で localhost 動作確認は完全に可能
- ✅ subagent dispatch / vitest / tsc / eslint も全て継続可能

▼ 指示

1. **dispatch v7 V7-B / V7-C を継続** → ただし push は a-main-009 の指示まで保留
2. 各 step 完了で **ローカル commit のみ**、push しない
3. 完了次第 a-main-009 に commit SHA 共有（push は GitHub 復旧後）
4. 5/5 後道さんデモは localhost:3002 で実施予定、push なくても問題なし

▼ 確認事項

a. login/page.tsx 変更が既に作業ツリーに残っている = V7-B 着手中ですか？進捗 SHA 共有してください
b. ForestGate.tsx の変更は別タスクのもの？（out-of-scope なら revert or 別 commit 推奨）
c. public/images/ に atmospheres/01-06.png + garden-home-bg-v2.png が untracked です。a-main-009 が配置しました。次の commit に含めて OK です（V7-A の atmospheres 用）

▼ V7-B 残作業（変更点リマインド、改めて指示なし）

memory `feedback_dispatch_md_copy_button.md` で受領済の通り:
- 入力枠 1: 「メールアドレス」→「社員番号またはID」（type=text、name=employeeIdOrPartnerCode）
- placeholder: 「例) E-12345 または P-001」
- 背景: 6 atmospheres カルーセル（V7-A の ATMOSPHERES_V2 流用）
- ChatGPT 参考画像: _shared/.../login-references/login-main-ref.png + login-position-ref.png

▼ V7-C 残作業

- 離席中（src/app/tree/away/* 等）を中央配置レイアウトに改修（休憩中と同じ）
- ChatGPT 参考画像: _shared/.../status-screens/away-ref.png + break-ref.png

▼ 5/5 デモ準備（5/3 完成目標、push 不要）

- localhost:3002 で動作確認（東海林さん側で実施予定）
- docs/localhost-demo-verification-checklist-20260427.md に確認チェックリスト
- V7-B / V7-C はローカル commit のみで OK、push は GitHub 復旧後 a-main-009 が一括対応

▼ 期待アウトプット

- V7-B 完了 → 「V7-B ローカル commit 完了、SHA xxxxxxx」報告
- V7-C 完了 → 「V7-C ローカル commit 完了、SHA xxxxxxx」報告
- 各 commit は branch feature/garden-common-ui-and-shoji-status 上で良い

▼ 注意

- push 試行禁止（C 垢 token は invalid 状態 + Team 未課金 = ban リスク高）
- npm install 等の新規依存追加は事前確認（GitHub 関連 deps は影響あり）
- 5 分間隔ルールは復旧後の運用、ローカル commit 自体は無制限
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-bloom-002 に上記短文投下 | 東海林さん |
| 2 | a-bloom-002 が V7-B 状況確認（既着手分の SHA 共有）+ ForestGate.tsx 判断 + atmospheres 画像 commit | a-bloom-002 |
| 3 | V7-B / V7-C ローカル commit 継続 | a-bloom-002 |
| 4 | 各 step 完了で SHA 共有 | a-bloom-002 → a-main-009 |
| 5 | GitHub 復旧後 a-main-009 が一括 push | a-main-009 |

## a-main-009 側の前提

- ローカル backup 完了（`C:\garden_backup_20260427-1750\` 0.55 GB）
- Support Ticket #4330372 受理 + 追加情報送信済
- 全 worktree git config は B 垢のまま（Team 課金完了後 C 垢に切替予定）
- localhost:3002 で 5/5 デモ実施可能性確認済（[checklist](localhost-demo-verification-checklist-20260427.md)）

## 改訂履歴

- 2026-04-27 初版（a-main-009、48h GitHub push block 中の a-bloom-002 への dispatch v7 補足通知）
