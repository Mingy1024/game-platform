#!/usr/bin/env bash
# PreToolUse（Edit|Write）：阻止編輯敏感檔、自動產生檔與已套用的 migration。
# 從 stdin 讀事件 JSON；解析失敗時一律阻擋（exit 2），不默默放行。
# 需要 python3（只用標準函式庫）。

input="$(cat)"

result="$(
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}" python3 -I -c '
import json, os, re, sys

try:
    event = json.loads(sys.stdin.read())
    path = event["tool_input"]["file_path"]
    if not isinstance(path, str) or not path:
        raise ValueError("no path")
except Exception:
    print("無法解析 hook 輸入，為安全起見阻擋")
    sys.exit(3)

project = os.path.normpath(os.environ["PROJECT_DIR"])
abs_path = os.path.normpath(path if os.path.isabs(path) else os.path.join(project, path))
# 統一分隔符與大小寫（Windows 磁碟不分大小寫）
norm = abs_path.replace("\\", "/").lower()
proj = project.replace("\\", "/").lower().rstrip("/")
rel = norm[len(proj) + 1:] if norm.startswith(proj + "/") else None
base = norm.rsplit("/", 1)[-1]

reason = None
if re.fullmatch(r"\.env(\..+)?", base) and base != ".env.example":
    reason = "環境變數檔含密鑰（變數名稱請看 .env.example）"
elif re.fullmatch(r"\.dev\.vars(\..+)?", base):
    reason = ".dev.vars 含本機密鑰"
elif base.endswith((".sqlite", ".sqlite3", ".db", ".pem", ".key")):
    reason = "資料庫或金鑰檔"
elif base in ("package-lock.json", "npm-shrinkwrap.json") or base.endswith(".lock"):
    reason = "lock 檔由 npm 維護，請用 npm 指令更新"
elif rel is not None:
    if rel.startswith((".wrangler/", ".output/", ".nuxt/", "generated/", "node_modules/")):
        reason = "自動產生或本機狀態的目錄（Prisma Client 用 npm run db:generate 產生）"
    elif rel.startswith("migrations/") and os.path.exists(abs_path):
        reason = "已存在的 migration 不能改，請用 npm run db:migration 產生新的一支"

if reason:
    print(f"{reason}：{rel or path}")
    sys.exit(2)
' <<<"$input"
)"
status=$?

if [ "$status" -ne 0 ]; then
  echo "已阻擋編輯：${result:-protect-files 無法判斷}" >&2
  exit 2
fi
exit 0
