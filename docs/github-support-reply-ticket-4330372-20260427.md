# GitHub Support Ticket #4330372 - Sophia Hayes 質問への返信文 - 2026-04-27

> 起草: a-main-009
> 用途: Sophia Hayes（GitHub Support）からの「How do you plan to use GitHub?」質問への返信
> 前提: Reinstatement request 受理 + 追加情報依頼の段階（手動レビュー進行中、ポジティブな展開）

## 返信手順

1. GitHub Support から届いたメール（Subject: `Your request has been updated`）を **そのまま返信**（reply）
2. 下記コードブロックの英文を本文にコピペ
3. 送信

メール本文に「You can add a comment by replying to this email.」とあるので、reply で OK。

## 返信本文（コピペ用）

```
Hi Sophia,

Thank you for the prompt response and for giving me the opportunity to clarify our usage plan.

== How we plan to use GitHub ==

Hyuaran Co., Ltd. is a Japanese company specializing in business outsourcing services (call centers, sales support). We are developing an internal ERP system called "Garden Series" to replace our aging FileMaker-based infrastructure.

The Garden Series consists of 12 modules, each named after a botanical concept:

- Soil (database backbone for ~2.5M list records and ~3.3M call history records)
- Root (organization, employees, partners, master data)
- Tree (call center operator application, replacing FileMaker)
- Leaf (product-specific apps, ~30 tables)
- Bud (accounting, payroll, bank transfers)
- Bloom (case management, daily reports, KPI dashboard)
- Seed (new business expansion)
- Forest (multi-corporate financial statements)
- Rill (in-house messaging system)
- Fruit (legal entity registry)
- Sprout (HR onboarding)
- Calendar (scheduling)

Tech stack: Next.js, TypeScript, Supabase, Vercel.
Repository: Hyuaran/garden (private).

== Project status and team ==

- Active developers: 2 (myself - Mikoto Shoji, and Shunsuke-Maki - both Hyuaran org owners, working as separate individuals)
- Phase A modules completed: Bud, Bloom, Forest, Root, Tree (5 of 12)
- Target: All 12 modules production-ready by end of 2026
- Critical product demo for company executives is scheduled for May 5, 2026

== AI-assisted development (full transparency) ==

We use Claude Code (an AI coding assistant from Anthropic) under direct human supervision. Every commit and pull request is reviewed by me before push. We do not run unattended bots, scrapers, or automated content farming. The AI assists with implementation, but human judgment authorizes each change.

I include this disclosure to be fully transparent about our development process.

== What caused the high-volume activity on April 27 ==

After my original account "ShojiMikoto" was suspended in May 2025, git push to Hyuaran/garden was effectively blocked for me for nearly a year. When my replacement account "ShojiMikoto-B" was reinstated on the morning of April 27, 2026, I executed a one-time catch-up that pushed approximately 50 pull requests in a single day along with many merge and conflict-resolution commits.

I now recognize this concentrated activity is exactly the pattern that triggers GitHub's automated abuse-detection systems, and I sincerely apologize for not pacing it better. This was not malicious or automated; it was a backlog of legitimate work being pushed all at once. I should have spread it across several days.

== Future operating practices we commit to ==

To prevent recurrence, we will follow these self-imposed rules:

1. Push interval: minimum 5 minutes between pushes (no burst pushing).
2. Daily limits: at most 5-10 pull requests and 10-20 pushes per day.
3. Single account: I will use only "shoji-hyuaran" (the new account, shoji-dev@hyuaran.com) as my development identity. I am not creating accounts to circumvent restrictions; the new account exists because the older two are suspended.
4. Paid organization: Hyuaran has applied to upgrade to GitHub Team plan (currently pending billing review per your team's 48-hour notice). Operating as a paid organization is our long-term commitment to legitimate business use.
5. Two-factor authentication: enabled on all active accounts.
6. Profile transparency: real name, company affiliation, and clear bio indicating business use are set on the active account.
7. AI-assisted commits: human-authored commit messages, no AI-generated message strings, every change manually verified before push.

== What we are asking ==

Given the above context, we respectfully ask GitHub Support to consider:

1. Reinstatement of "ShojiMikoto-B" (shoji@centerrise.co.jp), or guidance on whether the suspension is final and we should rely solely on the new account "shoji-hyuaran".
2. Resolution of the Team plan upgrade billing block (separate but related issue, currently pending billing review).
3. Any additional operational guidance you can share, beyond the self-imposed rules above.

We are committed to using GitHub responsibly as a paying business customer. Please let me know if any further information would help your review.

Thank you again for taking the time to look into this.

Best regards,
Mikoto Shoji
Hyuaran Co., Ltd.
shoji-dev@hyuaran.com (current active account: shoji-hyuaran)
shoji@centerrise.co.jp (suspended account: ShojiMikoto-B)
shoji@hyuaran.com (suspended account: ShojiMikoto)
```

## ポイント

| 観点 | 内容 |
|---|---|
| 業務正当性 | Hyuaran 株式会社の正規業務、Garden Series ERP（12 モジュール）開発 |
| チーム構成 | 東海林 + 槙さんの 2 名（複アカ運用ではなく、2 別人として明示）|
| 高頻度活動の理由 | A 垢 ban 後 1 年間 push できず、復旧後の catch-up（誠実な謝罪）|
| AI 利用の透明性 | Claude Code 使用、ただし人間 supervision、bot ではない |
| 今後の運用 | 5 分間隔、1 日上限、Team プラン、2FA、人間 commit message |
| 依頼 3 件 | B 垢復旧 / billing 解除 / 運用助言 |

## 期待される展開

| 状態 | 確率 |
|---|---|
| ✅ B 垢復旧 | 30-50%（追加情報で説得力増せば）|
| ✅ Team プラン billing 解除 | 60-80%（透明性 + 業務正当性で）|
| ✅ 運用助言 | 80%（建設的な対話可能）|
| ❌ 全拒否 | 10%（最悪パターン、複アカ運用を理由に）|

48h 内に追加返信が来る可能性大。

## 改訂履歴

- 2026-04-27 初版（a-main-009、Sophia Hayes 質問への返信文起草）
