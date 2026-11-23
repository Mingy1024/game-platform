# 一路向下音效

2026-11-23 用本機的 Stable Audio 3 Small-SFX 生成（steps 8、cfg 1.0），15 種各 3 版。生成與匯出的腳本在 `C:\Users\user\Documents\Codex\2026-11-16\bj\outputs\StableAudio3`：

- `gen_mine_descent.py`：生成，結果放 `outputs\mine-descent\<名稱>-<版本>.wav`（32 kHz 單聲道）。
- `export_mine_descent.py`：依 `outputs\mine-descent\picks.json`（`{"名稱": 版本}`，沒寫的用第 1 版）轉成 MP3（約 118 kbps 單聲道）放進 `public/games/mine-descent/0.1.0/sfx/`。
- 選片頁：https://claude.ai/artifact/HFibCnrzDpDiiP8xQFwiCT（選擇存在頁面的資料庫 `picks/<名稱>`；`take: 0` 表示要重新生成）。

2026-11-23 使用者在選片頁選好，15 種都不用重生。選用的版本寫在 `outputs\mine-descent\picks.json`，已匯出到專案（要換版本改 `picks.json` 再執行匯出即可，程式不用改）：短音效一律先生 3 秒再裁（生成長度短於 1.5 秒時模型常出白噪音），裁掉開頭空白、尾音淡出、峰值 −1 dB。合計約 222 KB（驗收 H8 上限 600 KB）。


| 檔案 | 選用版本 |
|---|---|
| ui-click、hurt、land、minecart-push、near-miss、new-record | 第 3 版 |
| crystal-pickup、rock-crack | 第 2 版 |
| game-start、fall-whoosh、combo-up、collapse-rumble、game-over、score-tick、wood-bounce | 第 1 版 |

| 檔名 | 用途 | 長度 | 提示詞（前面都加 `TrackType: SFX, `；負面提示詞 `music, singing, speech, voices, distortion, clipping, low quality, noisy, hum`） |
|---|---|---|---|
| ui-click.mp3 | 按鈕點擊 | 0.15 s | soft short UI button tap, rounded wooden click with a tiny pop, clean and dry, casual mobile game |
| game-start.mp3 | 開始：地鼠鑽出洞口 | 1.0 s | cartoon mole popping out of a dirt hole, soft dirt burst and a quick cute digging scratch, playful and light, clean |
| land.mp3 | 落地（音量隨撞擊速度） | 0.4 s | small creature landing on a stone slab, soft rocky thud with a tiny dust puff, short, dry, casual game |
| fall-whoosh.mp3 | 下降風聲（循環，音量隨下落速度） | 0.9 s | quick downward air whoosh of something falling fast, cartoon, soft, clean |
| hurt.mp3 | 受傷 | 0.8 s | cartoon ouch hit, short rubbery bonk with a quick comedic squeak, not harsh, not scary, casual game |
| near-miss.mp3 | 驚險 | 0.7 s | quick tense whoosh of a near miss followed by a small relieved bright sting, comic book style, clean |
| combo-up.mp3 | 連段倍率上升 | 0.7 s | quick ascending sparkle arpeggio, three bright bell notes rising, rewarding multiplier increase in a casual game, clean |
| rock-crack.mp3 | 碎裂岩板崩落 | 1.1 s | a stone slab cracking and crumbling into pieces that fall, sharp crack then small rocks tumbling, close and clean |
| minecart-push.mp3 | 落在礦軌推車上 | 1.3 s | an old iron mine cart rattling a short distance along rails, metal wheel clatter, quick and lively, no voices |
| wood-bounce.mp3 | 木支架彈跳 | 0.8 s | springy wooden beam bounce, short wood creak then a bouncy boing launching upward, cartoon, clean |
| crystal-pickup.mp3 | 踩到發光水晶 | 0.9 s | glowing crystal collected, glassy sparkling chime with a bright shimmer tail, magical and cheerful, clean |
| collapse-rumble.mp3 | 崩塌逼近（循環，音量隨離崩塌線的距離） | 2.0 s | distant cave ceiling collapsing, deep low rumble with small pebbles and dust falling, building tension, no voices, no music |
| game-over.mp3 | 失敗 | 1.8 s | comedic failure sound for a dizzy cartoon creature, three slow wobbly descending notes on a muted horn ending with a small dizzy spinning twirl, gentle and funny, not sad or harsh |
| new-record.mp3 | 破紀錄 | 2.2 s | joyful short celebratory fanfare for a casual mobile game, bright brass stabs rising to a final chord with bell sparkles and a light cymbal swell, triumphant but friendly, clean |
| score-tick.mp3 | 結算分數跑動 | 0.08 s | a single very short soft digital tick, score counter increment in a casual game, crisp, quiet, dry, no tail |
