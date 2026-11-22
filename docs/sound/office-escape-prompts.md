# 下班逃離辦公室音效提示詞

2026-11-22 建立（驗收清單 M 組）。音檔由你用本地模型生成，交檔後我負責接進遊戲。**在你交檔之前，遊戲是沒有聲音的，這是正常的**：程式會試著載入下面的檔案，載入不到就安靜地略過（M13）。

## 交檔規格

- **循環音（1）**：WAV、32 kHz、16-bit、單聲道、約 3 秒。頭尾要能無縫接上；接不上沒關係，我會在程式裡做交叉淡化，但音量要從頭到尾平穩。
- **單次音（2–23）**：MP3 128 kbps 單聲道（只能輸出 WAV 也可以）。開頭不要留空白，尾音自然收掉。
- **背景音樂**：MP3 單聲道，約 96 kbps，不超過 1 MB（M13），可以無縫循環，放進 `music/bgm.mp3`。
- 音效全部合計不超過 600 KB。
- 檔名照下表，放進 `public/games/office-escape/0.1.0/sfx/`（音樂放 `music/`），或直接丟給我。
- 每個可以多生幾版，挑你覺得最好的；拿不定主意就全部給我，我先接上讓你在遊戲裡比較。
- 不要用真實公司的廣播、其他遊戲的音效或旋律當參考（M14）。

## 音效清單

| # | 檔名 | 用途 | 長度 | 提示詞 |
|---|---|---|---|---|
| 1 | `run-loop.wav` | 奔跑聲（皮鞋腳步）。程式依速度調音高和音量；咖啡加速時節奏變快 | 3 s 循環 | Seamless loop of fast leather dress shoes running on office carpet and hard floor, steady rhythmic footsteps at a brisk jogging pace, close and dry, constant volume. No voices, no music, no breathing. |
| 2 | `lane.mp3` | 換線 | 約 0.25 s | A very short soft cloth swish, quick sideways dodge, light and airy, dry. |
| 3 | `jump.mp3` | 跳起來 | 約 0.3 s | Short upward whoosh with a tiny cloth rustle, quick hop, casual mobile game, clean. |
| 4 | `land.mp3` | 落地 | 約 0.25 s | Soft shoe landing thud on office floor, short and dry, a little bit of cloth rustle. |
| 5 | `graze.mp3` | 擦身閃避（連段越高，程式會把音調升高） | 約 0.3 s | A quick crisp whoosh with a tiny bright sparkle at the end, near-miss dodge feeling, casual game, clean and short. |
| 6 | `bump.mp3` | 撞到東西、被拉住、電梯門關上 | 約 0.5 s | Dull cartoon bump: a soft muffled thud followed by a small comic wobble sound, light and funny, not harsh. |
| 7 | `delay-tick.mp3` | 被耽誤時時鐘快轉 | 約 0.8 s | Fast ticking of a wall clock speeding up for under one second, rapid dry ticks accelerating, light mechanical sound. |
| 8 | `pickup-coffee.mp3` | 撿到咖啡 | 約 0.5 s | Bright energetic pickup chime with a quick bubbly rising pop, like a power-up for a fast boost, cheerful casual game. |
| 9 | `pickup-headphones.mp3` | 撿到耳機 | 約 0.5 s | Soft bubbly two-note pickup with a mellow muted tone, calm and cool, casual game power-up. |
| 10 | `pickup-dnd.mp3` | 撿到勿擾模式 | 約 0.5 s | Gentle low shimmering pickup chime with a soft moon-like bell, quiet and soothing, casual game power-up. |
| 11 | `event.mp3` | 突發事件出現（同事、主管、群組訊息） | 約 0.6 s | Short office notification pop: a bright double-ping message alert with a small attention-grabbing swell, casual and slightly nervous. |
| 12 | `answer-right.mp3` | 選到最佳、普通回覆 | 約 0.6 s | Cheerful short success sound: two quick ascending marimba notes with a light sparkle, bright and positive, clean. |
| 13 | `answer-wrong.mp3` | 選錯、超時 | 約 0.8 s | Short playful fail sound: a soft descending muted trombone "wah-wah" with a tiny clock tick, comedic and light, not harsh. |
| 14 | `chime.mp3` | 最後 10 秒的點名廣播（叮咚） | 約 1.2 s | Two-tone office intercom announcement chime, ding-dong, slightly echoing in a large room, calm but ominous. No voice, no words. |
| 15 | `door-spin.mp3` | 衝出旋轉門 | 約 1.2 s | Revolving glass door spinning smoothly with a soft rotating whoosh and gentle seal brushes, ending with a soft airy exhale as someone bursts outside. |
| 16 | `reader.mp3` | 讀卡機嗶卡、擠進電梯 | 約 0.3 s | A single short clean electronic card-reader beep, friendly confirmation, dry. |
| 17 | `ending-fast.mp3` | 結算：秒速下班（×2.0） | 約 2.5 s | Triumphant fast celebratory jingle: bright brass stabs and bells rising to a joyful final chord with a light cymbal swell, energetic, casual mobile game, no voices. |
| 18 | `ending-ontime.mp3` | 結算：準時下班（×1.5） | 約 2.5 s | Pleasant relieved success jingle: warm marimba and bell phrase resolving to a satisfied major chord, calm and happy, no voices. |
| 19 | `ending-overtime.mp3` | 結算：加班結局（×1.0） | 約 2.5 s | Comic sad office defeat jingle: slow descending muted trombone and a weary sigh-like synth, light humor, not depressing, no voices. |
| 20 | `ending-hidden.mp3` | 結算：隱藏結局（夕陽街口） | 約 3 s | Warm dreamy sunset ending: soft glowing synth pad with gentle bell arpeggio and light acoustic guitar, peaceful and hopeful, no voices. |
| 21 | `score-tick.mp3` | 結算總分跑動時連續播（程式控制間隔） | 約 0.05 s | A single very short soft digital tick, like a score counter increment in a casual game. Crisp, quiet, dry, no tail. |
| 22 | `new-record.mp3` | 破紀錄 | 約 2 s | Joyful short celebratory fanfare for a casual mobile game: bright brass stabs rising to a final chord with bell sparkles and a light cymbal swell. Triumphant but friendly, clean, no voices. |
| 23 | `ui-click.mp3` | 出發、暫停選單、結算按鈕的點擊 | 約 0.1 s | Soft short UI button tap: a rounded plastic click with a tiny pop, clean and dry, casual mobile game. |

## 背景音樂

| 檔名 | 用途 | 長度 | 提示詞 |
|---|---|---|---|
| `music/bgm.mp3` | 整局循環播放；突發事件和結算時程式會自動調小 | 約 60 秒，可無縫循環 | Upbeat, slightly frantic escape-chase game music for an office run: bouncy funk bass, tight drums at about 140 BPM, staccato synth stabs and playful pizzicato strings, a hint of comic panic, energetic and fun. Instrumental, seamless loop, no voices, no abrupt ending. |

## 音量

不用自己調音量平衡，我會在程式裡統一。只要每個檔案本身沒有破音、峰值不要頂到 0 dB 就好。
