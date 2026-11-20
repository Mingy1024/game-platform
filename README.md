This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

初始化範圍、已安裝工具、環境需求與驗證結果請見 [INITIALIZATION.md](./INITIALIZATION.md)。目前保留預設頁面，尚未開始網站或遊戲功能開發。

## 部署（Cloudflare Workers）與帳號

網站用 [OpenNext](https://opennext.js.org/cloudflare) 部署到 Cloudflare Workers，資料庫是 Cloudflare D1。
Cache Components 在 Workers 上還不支援，所以 `next.config.ts` 先關掉。

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 本機開發；D1 用 `.wrangler/state` 裡的本機資料庫 |
| `npm run db:migrate:local` | 把 `migrations/` 套用到本機 D1（第一次開發前要跑） |
| `npm run db:migration -- <名稱>` | 改了 `prisma/schema.prisma` 之後產生下一個 migration |
| `npm run db:generate` | 重新產生 Prisma Client |
| `npm run cf:preview` | 建置後用 workerd 在本機跑，最接近正式環境 |
| `npm run cf:deploy` | 建置並部署 |

`.env` 要設的值（範例見 `.env.example`）：

- `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`：Google Cloud Console 的 OAuth 用戶端。正式站用 `wrangler secret put` 設定，不要寫進檔案。
- `NEXT_PUBLIC_FEATURE_LOGIN=1`：打開登入功能。正式站先不設（設計稿第 12 題）。

E2E 測試的登入流程連到假的 Google（`tests/e2e/fake-google.mjs`），由 `playwright.config.ts` 自動啟動。

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
