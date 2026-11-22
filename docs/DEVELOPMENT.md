# 開發規範

## 環境

- Node.js 24（`package.json` 的 `engines` 為 `>=24 <25`）、npm 12.2.2（`packageManager`）。
- 作者的 Windows 只裝了 Node 26，所以本機有一個**不進 Git** 的 `.nvmrc`（內容 `26.13.1`，已列在 `.git/info/exclude`），讓 nvm-windows 的 shim 不報「v>=24.0.0 <25 is not installed」。不要 commit 它，也不要把 `engines` 改成配合它。
- WSL 與 Windows 的 `node_modules` 不互通：dev server 在 WSL 掛載的 Windows 磁碟上不偵測檔案變更，裝套件要用 Windows 的 Node。
- 第一次開發：`npm install` → `npm run db:migrate:local` → `npm run dev`。
- Playwright 瀏覽器不進 Git，換電腦後 `npx playwright install chromium`。

## 環境變數

範例見 `.env.example`；`npm run dev` 讀 `.env`，`npm run preview`（wrangler dev）讀 `.dev.vars`。兩者都被 Git 忽略，不要提交、不要貼進對話。

| 變數 | 用途 | 必要性 | 預設 | 何時讀取 |
| --- | --- | --- | --- | --- |
| `SITE_URL` | 正式網址（canonical、hreflang、社群預覽） | 正式建置必填 | `http://localhost:3000` | 建置時 |
| `ADS_MODE` | `mock` 顯示版位示意、`off` 關閉 | 選填 | `mock` | 建置時 |
| `FEATURE_LOGIN` | Google 登入；`0` 關閉 | 選填 | 打開 | 建置時 |
| `FEATURE_LEADERBOARD` | 全站排行（含訪客）；`0` 關閉，需要登入也打開才出現 | 選填 | 打開 | 建置時 |
| `FEATURE_PLAY_COUNT` | 累計發車次數版位；`1` 才顯示 | 選填 | 關閉 | 建置時 |
| `GOOGLE_CLIENT_ID`／`GOOGLE_CLIENT_SECRET` | Google OAuth 用戶端 | 登入功能必填 | 無 | 執行時（伺服器端）；正式站用 `wrangler secret put` |
| `GOOGLE_OAUTH_TEST_BASE_URL` | 指到假的 Google（E2E 專用） | 僅測試 | 無 | 執行時；正式站絕對不要設 |
| `DATABASE_URL` | `.env.example` 的殘留佔位，D1 不使用 | 不適用 | — | — |

建置時的值會寫進程式，改了要重新建置。舊名稱 `NEXT_PUBLIC_FEATURE_*` 仍認得。

## 命名與慣例

| 對象 | 規則 |
| --- | --- |
| Vue 元件 | PascalCase 檔名（`GameCard.vue`），用檔名直接使用、不加資料夾前綴；元件名稱可以是單字（已關閉 `vue/multi-word-component-names`） |
| composables | `app/composables/` 內 camelCase，`useXxx` 或功能名 |
| `lib/` 檔案 | kebab-case（`guest-merge.ts`），純 TypeScript，不 import Vue／Nuxt／h3 |
| API 檔名 | `<名稱>.<方法>.ts`（`nick.patch.ts`、`index.get.ts`），目錄對應路徑 |
| 資料庫欄位 | Prisma 用 camelCase，`@map` 成 snake_case（`google_sub`）；表名 `@@map` 成複數 snake_case |
| 時間 | DB 存 DateTime（UTC）；「日」一律用台灣日期 `YYYY-MM-DD`（`taiwanDateKey`） |
| 錯誤碼 | 小寫 snake_case 字串（`account_mismatch`） |
| 文字 | 註解、commit、文件用繁體中文（台灣用語）；對外字串走 `lib/i18n/dictionaries/` |
| 模組系統 | ESM（`"type": "module"`）；用 `@/` 指向專案根目錄，`~/` 指向 `app/` |

## 目錄放哪裡

- 遊戲規則、計分、資料格式驗證（zod）→ `lib/games/<slug>/`，附 `__tests__/`。
- Phaser 場景、音效 → `app/games/<slug>/`（只在瀏覽器端）。
- API handler 只做「驗證身分 → 呼叫 lib 或 server/utils → 回應」，業務判斷盡量留在 `lib/`。

## 新增 API

1. 在 `server/api/` 建 `<路徑>/<名稱>.<方法>.ts`，`export default defineEventHandler((event) => guarded(event, async () => { ... }))`。
2. `guarded` 選項：`checkOrigin: false` 只給 GET 與 OAuth 回呼；跟排行榜／訪客有關的設 `leaderboard: true`。
3. 需要登入用 `requireSessionPlayer`（只認 Google）；要接受訪客用 `resolveIdentity`／`guestPlayer`。
4. 讀請求內容用 `readJsonBody(event, 上限位元組)`，處理回傳的狀態碼 411／413／400。
5. 成功回 `noStore(event, body)`，失敗回 `jsonError(event, 狀態碼, "代碼")`。
6. 會限流的改 `wrangler.jsonc` 的 `ratelimits`，跑 `npm run cf:typegen`，並在 `server/utils/rate-limit.ts` 的 `LimiterName` 加名稱。
7. 檔頭註解寫清楚：請求格式、回應格式、每個錯誤碼的情境（照現有 API 的寫法）。
8. 如果碰到共用狀態或會增加的寫入，先照 `docs/dev/sync-checklist.md`。

## 新增資料表／改 schema

1. 改 `prisma/schema.prisma`（每個欄位寫 `///` 註解說明）。
2. `npm run db:migration -- <名稱>` 產生下一個 `migrations/000N_*.sql`。
3. `npm run db:migrate:local` 套用到本機 D1，`npm run db:generate` 更新 Client。
4. 需要觸發器、`ON CONFLICT` 條件更新這類 Prisma 寫不出的 SQL，直接寫在 migration 裡，並在測試用 `lib/__tests__/d1-sqlite.ts`（會套全部 migrations）驗證。
5. 已套用過的 migration 不改；要改就加新的一支。
6. `db:migrate:remote` 是正式環境，使用者要求才跑。

## 新增遊戲

走 `new-mini-game` skill（選題 → 需求 → 設計稿 → 驗收標準 → 實作 → 驗收）。程式面：在 `lib/catalog/catalog.ts` 加 manifest（模組載入時用 zod 驗證，格式錯誤會讓 build 失敗）、素材放 `public/games/<slug>/<版本>/`、`lib/routes.ts` 會自動把它納入預先產生清單。

## 新增使用者可見文字

七種語言字典（`lib/i18n/dictionaries/*.ts`）一起補，`dictionaries.test.ts` 會檢查各語言鍵值一致。

## 提交

- 格式 `type: 描述`（feat、fix、docs、chore），直接提交到 `main`，不開分支。
- 提交前：`npm run typecheck`、`npm run lint`、`npm test`；動到畫面或登入流程再跑 `npm run test:e2e`。
- 不提交 `.env*`（`.env.example` 除外）、`.wrangler/`、`.output/`、`playwright-report/`、`test-results/`。

## 計畫歸檔流程

1. 計畫檔案命名格式：`YYYY-MM-DD-<feature-name>.md`
2. 計畫文件結構：User Story → Spec → Tasks
3. 功能完成後：移至 `docs/plans/archive/`
4. 更新 `docs/FEATURES.md` 和 `docs/CHANGELOG.md`

遊戲的規格另外放在 `docs/acceptance/<slug>.md`（驗收標準），設計稿則在 Artifact（見記憶中的設計稿網址）。
