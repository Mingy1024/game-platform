# 下班逃離辦公室：實作計畫

- 設計稿：https://claude.ai/artifact/STatW7mmmh476qsnU7jxAt（v3）
- 驗收標準：docs/acceptance/office-escape.md
- 開始日期：2026-11-22
- 狀態：實作與驗收完成（2026-11-23），等使用者確認；確認後移到 docs/plans/archive/

## 做法

| 層 | 位置 |
|---|---|
| 純邏輯（不依賴 three.js、DOM） | `lib/games/office-escape/`（config、route、sim、scoring、session、lines、share-code、records、account-records、leaderboard、sync-state、meta、share/card） |
| 場景與角色（three.js） | `app/games/office-escape/`（characters.ts 角色庫、scene.ts 場景、sound.ts） |
| 畫面 | `app/components/office-escape/`（介紹頁、遊戲畫面、各面板） |
| 伺服器 | `server/api/games/office-escape/`、`server/utils/office-escape-records.ts`、migration `0005` |
| 文字 | `lib/i18n/dictionaries/*.ts` 的 `officeEscape`（七種語言） |

## 同步檢查表（docs/dev/sync-checklist.md 第 1、2、7 節）

先決定：**伺服器只存「取高分」的最佳紀錄，沒有累計次數，所以重送一定是冪等的**。這讓精準停車最複雜的部分（outbox、syncId、不明確結果、dropForeignOutbox）全部不需要。唯一需要穩定代碼的是「建立訪客」（找回同一個訪客，T9），代碼放在 pending 狀態裡。

### 第 1 節：共用狀態與寫入者

| 狀態 | 存在哪裡 | 誰會寫 | 怎麼避免同時寫 |
|---|---|---|---|
| 本機最佳紀錄（顯示用快取） | `game-station:office-escape:v1`（localStorage） | 玩完一局（`recordRun`）、同步回應（`replaceRecords`）、登出清空 | 只當顯示快取；真正的資料是「伺服器＋pending＋inbox」。玩完一局的寫入是取高分，同步回應整份換成「帳號紀錄與 pending 取高分」 |
| 待上傳（pending） | `game-station:office-escape:pending:v1` | 只在同步的 Web Lock 裡：收 inbox、送出成功後移除已確認的項目、登出清空 | 第 1 種：鎖裡讀→改→寫。內容：`{ guestSyncId, bests: [{mode, dateKey, score, achievedAt}] }`，同一個 key 只留最高分 |
| inbox | `game-station:office-escape:run:<隨機代碼>` | 玩完一局時新增一個新的 key（不改共用 key） | 第 2 種：只新增、不改；由鎖裡的同步收走並刪除（先寫成功 pending 才刪 inbox） |
| 登出記號 | `game-station:account:signed-out` | 沿用精準停車（登出、刪除帳號、刪除訪客時寫） | 其他分頁收到就當作已登出，並用同一個 epoch 機制作廢送出中的請求 |
| 伺服器 `office_escape_bests` | D1 | `POST /records/sync` | `UPDATE … WHERE score < ?` 條件更新；沒有就 INSERT，撞到唯一鍵（P2002）重試條件更新 |
| 訪客與 cookie `gs_guest` | D1、cookie | 沿用平台（建立訪客、合併、刪除） | 沿用平台機制；`mergeGuest` 加上 office_escape_bests 的合併 |

不支援 Web Locks：退回「不鎖」，因為所有寫入都是冪等的取高分，兩個分頁各送一次不會出錯；pending 的移除只移除「分數不高於這次送出的」，所以多送不會丟資料。

### 第 2 節：每個請求的結果

| 結果 | 處理 |
|---|---|
| 沒有回應（離線、逾時） | pending 原封不動；`online`、下一局結束、打開介紹頁或 /me 時重送 |
| 伺服器已寫入但回應沒收到 | 重送同樣的 bests：取高分冪等，不會重複；建立訪客用同一個 `guestSyncId` 找回同一個訪客並補發 cookie |
| 400 | 整批格式或分數範圍不對（正常前端不會送出）：丟掉這一批的 bests，不再重送壞資料 |
| 401 | Google：當作登出（`expireSession`），本機與 pending 留著，下次登入時併進帳號；訪客 cookie 無效：當作沒有身分（`expireGuest`），pending 留著，下一局再建立新訪客 |
| 403 consent_required | 歐盟地區還沒同意：pending 留著，顯示結算的上榜詢問 |
| 403 其他、413、429、5xx、格式不對 | 當作暫時失敗，pending 留著，下次重送 |
| 409 account_mismatch | 另一個分頁換了身分：epoch +1、重新讀登入狀態；pending 留著，送給新的身分 |
| 晚到的回應，期間已登出或換帳號 | epoch 或登出記號變了就整個丟掉，不寫回本機 |
| 晚到的回應，期間本機有更新 | 回應套用時取「帳號紀錄、pending、本機」三者的高分，不蓋掉新的 |
| 送到一半頁面關掉 | pending 在 localStorage，新頁面接手重送（冪等） |
| 送出後頁面關掉、沒有任何回應 | 同上；不需要「不明確」狀態，因為重送不會重複 |

### 第 7 節：登入狀態的結束方式

| 情況 | 本機資料 | 這一頁登入狀態 | 其他分頁 |
|---|---|---|---|
| 這一頁按登出 | 清本機最佳、pending、inbox（第 16 題）；最後才發布新的身分狀態 | 已登出 | 收到登出記號，epoch +1、清空、重新讀取 |
| 刪除帳號 | 同上；伺服器 CASCADE 刪 office_escape_bests | 已登出 | 同上 |
| 401（過期） | 留著（下次登入併進帳號） | `expireSession` | 各自收到 401 時處理 |
| 另一個分頁登出後可能登入別的帳號 | 已被那個分頁清掉 | 收到記號後重新讀取 | — |
| 過期後另一個分頁直接登入別的帳號 | 留著，送給目前 cookie 的帳號 | 這一頁以為的 playerId 與 cookie 不同，伺服器回 409，重新讀取 | — |
| 刪除訪客紀錄 | 同登出：先清本機、最後才變成沒有身分 | 沒有身分 | 同登出 |

## 偏離清單（和設計稿不同的地方）

| 項目 | 設計稿 | 實作 | 原因 |
|---|---|---|---|
| 排行與帳號 | 「先留版位」 | 帶入精準停車的訪客、排行榜、帳號同步（使用者 2026-11-22 決定） | 使用者要求；設計稿 Main 之後補第 20 題 |
| 資料表欄位 | 驗收 P1 原寫 kind | 欄位叫 `mode`（daily／all） | 排行榜查詢可以和精準停車共用同一套程式 |
| 每段長度 | 只寫目標時間（20／25／20／15 秒） | 長度＝基本速度 × 目標時間 × 0.7（84、115.5、101.5、84 公尺） | 設計稿沒寫長度。0.7 讓「不被耽誤」的一局約 56 秒，剛好能趕上 ×2.0，被耽誤約 4 秒內仍可拿到；試玩後可調（`SEGMENT_LENGTH_RATIO`） |
| 擦身判定範圍 | 「距離小於 0.3 個線寬」 | 玩家半寬 0.2、障礙半寬 0.4 線寬，撞到的邊緣外再 0.3 線寬內算擦身 | 要定義「距離」從哪裡算；換線途中經過障礙旁邊才會擦身 |
| 突發事件位置 | 每段 1 次 | 第 1 段在 55% 處（隔壁同事）、第 3 段在 40% 處（群組訊息）固定出現；第 2 段只在主管視線掃到時出現 | 第 2 段的「被叫住」要和主管視線、隱藏結局連在一起；沒被看到就沒有這一次事件 |
| 事件放慢 | 放慢到 20%、限時 3 秒 | 世界 20% 速度，3 秒用真實時間算；減少動態效果時不放慢但限時照算 | 設計稿「減少動態效果：不放慢」 |
| 右上按鈕順序 | 驗收 M10 原文「音符、喇叭、暫停」 | 由上而下：暫停、音符、喇叭 | 照設計稿 A2 畫板；已改驗收清單 |
| 電梯廳背景 | 設計稿暫用走廊圖，實作前另外生一張 | 見驗收 H4 的結果 | |
| 場景畫法 | 3D 地板＋背景貼圖 | 地板與牆面是程式畫的貼圖（每段一套配色），Codex 的背景圖當遠景 | 背景圖是固定視角的透視圖，不能直接當會捲動的地板 |
| 角色庫 | 設計稿 F1 的 window.OfficeChars | 移植成 ES 模組 `app/games/office-escape/characters.ts`，不做型別檢查與 lint | 邏輯照原樣；只換掉 window.THREE |
| 主視覺與成績圖背景 | 設計稿用 2D 圖已停用，改成場景＋3D 角色 | 取自實際遊戲畫面（hero.webp、cover.webp、share-card/office-hero.jpg） | |
| 停用素材 | 月台背景、結局插圖、runner／npc 圖、箱子椅子道具圖 | 移到 .scratch/office-escape/unused-assets/（不在 public，不進建置） | 道具與障礙改用程式建的 3D 物件 |
| 主控台過濾 | 驗收 Q3 主控台沒有錯誤 | E2E 先忽略 sfx／music 音檔 404 | 音檔使用者還沒交；交檔後拿掉過濾 |

（實作中發現偏離時，當下補在這裡。）
