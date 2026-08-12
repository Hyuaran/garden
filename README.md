This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## テレマ コール集計 Chatwork配信テスト

管理者用の`POST /api/system/call-report`で、単日集計のpreviewと開発デモルームへのテスト送信ができます。UI・定時実行・本番ルーム送信はありません。必要なサーバー環境変数は`CHATWORK_API_TOKEN`と`CHATWORK_DEV_ROOM_ID`です。API本文にroom指定はなく、送信先は開発用envだけから決まります。

ログイン済みのmanager、admin、super_adminのみ実行できます。ブラウザの認証Cookieを`cookie.txt`へ保存した例です。

```bash
curl -X POST https://garden-os.net/api/system/call-report -H "Content-Type: application/json" -b cookie.txt -d '{"mode":"preview","date":"2026-08-12"}'
curl -X POST https://garden-os.net/api/system/call-report -H "Content-Type: application/json" -b cookie.txt -d '{"mode":"send","date":"2026-08-12"}'
```

`date`省略時はJSTの当日です。まずpreviewで本文と集計値を確認し、その後sendを1回だけ実行してください。総コール0件の日は自動スキップされます。レスポンスとサーバーログの集計・送信時間で5分枠を確認できます。トークンと送信本文はログへ出しません。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
