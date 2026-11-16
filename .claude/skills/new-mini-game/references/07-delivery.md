# 階段 8：交付

## Commit 與 push

只在使用者要求時做，直接在 main。

1. `git add -A` 之後先檢查暫存內容：不能有 `.env`、`.scratch/`、本機的 `.nvmrc`、`test-results/`、`playwright-report/`、`.next/`。
2. 回報新增的圖檔與字型大小（`du -sh public assets`），讓使用者知道 repo 變大多少。
3. 訊息用繁體中文，第一行 `feat: <做了什麼>`，下面條列重點，結尾用系統提供的 attribution。
4. push 前確認使用者有說 push；push 後回報 `舊 commit..新 commit` 和是否與遠端同步。

## 開發紀錄文件

使用者會要求「整理從需求確認到實作再到測試完成的整個流程」。做成 Claude Docs 文件（Artifact `quickstart` intent `document`，從 Docs 類型建立），章節：

1. **流程總覽**：表格「階段｜時間（台灣時間）｜做了什麼｜產出」，附設計稿連結
2. **需求確認**：表格「#｜題目｜結果（照建議／你改了／你追加）｜最後的決定」，開頭一句統計題數（數字要數對）
3. **工作規則**：使用者在過程中定下的做法
4. **實作內容**：表格「部分｜內容｜位置」
5. **測試與驗收**：驗收統計、品質關卡表、找到並修好的問題表（問題｜原因｜修法｜條目）
6. **與設計稿的差異**：從偏離清單來
7. **待你確認**：可勾選的清單

資料來源：設計稿 Main 畫板（18 題那類討論紀錄）、對話紀錄的時間戳（`~/.claude/projects/<專案>/<session>.jsonl`，UTC 要加 8 小時）、驗收清單結果欄、`git log`。只寫查得到的事實；原因查不到就寫查不到。

## 跑伺服器給使用者看

使用者會說「實際 run server 讓我確認」。

1. 確認工作目錄乾淨、用最新程式碼重新 `next build`。
2. 用 `run_in_background` 執行 `next start -p 3000`，等到 Ready。
3. 用 Windows 的 curl 測幾個主要網址回 200。
4. 給使用者兩個網址：電腦 `http://localhost:3000/games/<slug>`，手機用 Next 印出的 Network 位址（同一個 Wi-Fi；第一次可能要允許 Windows 防火牆）。
5. 提醒正式版不會出現預設關閉的預留版位。
6. 使用者說關掉時用 `killport 3000`，並確認連接埠已釋放。

## 收尾

更新專案記憶裡這款遊戲的進度檔：已上線、commit、待使用者確認的事項。
