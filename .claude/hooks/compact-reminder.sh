#!/usr/bin/env bash
# SessionStart（matcher: compact）：context 壓縮後重新提醒專案關鍵規則。
# stdout 會被加進對話 context。內容摘自 CLAUDE.md，改了 CLAUDE.md 的關鍵規則時一併更新這裡。

cat <<'EOF'
【專案關鍵規則提醒（來自 CLAUDE.md）】
- 遊戲小站：Nuxt 4 + Vue 3 + Phaser 4，Cloudflare Workers + D1 + Prisma 7。根目錄 AGENTS.md 的 Next.js 提示不適用。
- 回覆、註解、commit、文件一律繁體中文（台灣用語）；commit 直接做在 main，格式 type: 描述。
- 改 schema 要產生新 migration，不改已存在的 migration、不手改 generated/。
- 會改資料的 API 包 guarded()；GET 不能有寫入副作用；共用狀態／API／登入類改動先照 docs/dev/sync-checklist.md。
- 不讀、不改 .env、.dev.vars；不部署、不對正式 D1 執行 migration，除非使用者明確要求。
- 遊戲規則放 lib/（純邏輯）；新增文字七種語言字典都要補。
- 詳細文件見 CLAUDE.md 的「詳細文件」清單。
EOF
exit 0
