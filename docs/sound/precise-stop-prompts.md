# 精準停車音效提示詞

2026-11-16 追加音效（驗收清單 R 組）。音檔由你用本地模型生成，交檔後我負責接進遊戲。

## 交檔規格

- **循環音（1、2）**：WAV、32 kHz、16-bit、單聲道、約 3 秒。頭尾要能無縫接上；接不上沒關係，我會在程式裡做交叉淡化，但音量要從頭到尾平穩。
- **單次音（3–12）**：MP3 128 kbps 單聲道（只能輸出 WAV 也可以）。開頭不要留空白，尾音自然收掉。
- 全部合計不超過 600 KB（R11）。
- 檔名照下表，放進 `public/games/precise-stop/0.1.0/sfx/` 或直接丟給我。
- 每個可以多生幾版，挑你覺得最好的；拿不定主意就全部給我，我先接上讓你在遊戲裡比較。
- 不要用真實車站的發車旋律、廣播或其他遊戲的音效當參考（R12）。

## 音效清單

| # | 檔名 | 用途 | 長度 | 提示詞 |
|---|---|---|---|---|
| 1 | `run-loop.wav` | 行駛聲。程式依車速調音高和音量（35–75 km/h），所以生成時用中等車速 | 3 s 循環 | Seamless loop of a modern electric commuter train cruising at moderate speed, recorded inside the cabin near the floor. Steady low wheel-on-rail rumble, soft rhythmic rail-joint clicks, gentle electric traction motor hum. Constant volume and pitch throughout. No horn, no announcements, no voices, no music. |
| 2 | `brake-loop.wav` | 煞車聲。按住煞車時播，音量隨煞車力變化 | 3 s 循環 | Seamless loop of train disc brakes applied steadily on steel wheels. Continuous friction hiss with a light, thin metallic squeal on top, steady intensity, no impacts, no rolling rumble, no air release. No voices, no music. |
| 3 | `stop.mp3` | 停穩那一下 | 約 1.2 s | A commuter train coming to a complete stop: a short soft metallic settle clunk followed by a brief gentle air-brake release hiss that fades out. Clean, close, no voices, no music. |
| 4 | `final-5m.mp3` | 剩 5 m 提示，配合「最後 5 m」特效 | 約 0.6 s | Short bright two-note rising chime, soft bell-like synth tone, friendly and alert, casual mobile game UI cue. Tight, minimal reverb, ends cleanly. Not a railway station melody. |
| 5 | `judge-perfect.mp3` | 判定：完美 | 約 1.2 s | Sparkling triumphant casual game success jingle: three quick ascending bell and marimba notes landing on a shimmering major chord with a light glitter sparkle tail. Cheerful, clean, no voices. |
| 6 | `judge-great.mp3` | 判定：優秀 | 約 0.8 s | Cheerful short casual game success sound: two quick ascending marimba notes, bright and positive, small soft sparkle at the end. Clean, no voices. |
| 7 | `judge-good.mp3` | 判定：良好 | 約 0.5 s | Single warm marimba note with a soft rounded attack, pleasant neutral confirmation tone for a casual game. Clean, short tail. |
| 8 | `judge-fair.mp3` | 判定：勉強 | 約 0.6 s | Two soft descending wooden marimba notes, a mild "almost there" feeling, gentle and friendly, not negative. Casual game UI sound, clean. |
| 9 | `judge-miss.mp3` | 判定：失誤（停在標線前或過站都算） | 約 0.8 s | Short playful casual game fail sound: a soft low descending "wah-wah" muted horn, light and comedic, not harsh or loud. Clean, no voices. |
| 10 | `score-tick.mp3` | 結算總分跑動時連續播（程式控制間隔） | 約 0.05 s | A single very short soft digital tick, like a score counter increment in a casual game. Crisp, quiet, dry, no tail. |
| 11 | `new-record.mp3` | 破紀錄 | 約 2 s | Joyful short celebratory fanfare for a casual mobile game: bright brass stabs rising to a final chord with bell sparkles and a light cymbal swell. Triumphant but friendly, clean, no voices. |
| 12 | `ui-click.mp3` | 出發、暫停選單、結算按鈕的點擊 | 約 0.1 s | Soft short UI button tap: a rounded plastic click with a tiny pop, clean and dry, casual mobile game. |

## 音量

不用自己調音量平衡，我會在程式裡統一。只要每個檔案本身沒有破音、峰值不要頂到 0 dB 就好。

## 實際生成紀錄（2026-11-19）

用本機的 Stable Audio 3 Small-SFX 生成（steps 8、cfg 1.0），每種 3 版，在選片頁試聽後挑選。提示詞以上表為底，改成模型建議的寫法：開頭加 `TrackType: SFX`，並加負面提示詞 `music, singing, speech, voices, distortion, clipping, low quality, noisy, hum`。

生成後的處理：裁掉開頭空白、尾音淡出、峰值 −1 dB；循環音取中段 3 秒，頭尾 0.5 秒交叉淡化。單次音用 libsndfile 轉成 MP3（約 118 kbps）。生成長度短於 1.5 秒時模型常出白噪音，所以短音效一律生 3 秒再裁。

| 檔名 | 選用 | 備註 |
|---|---|---|
| run-loop.wav | 第 2 版（seed 22） | |
| brake-loop.wav | 第 1 版（seed 11） | |
| stop.mp3 | 第 1 版（seed 11） | |
| final-5m.mp3 | 第 3 版（seed 33） | |
| judge-perfect.mp3 | 第 1 版（seed 11） | |
| judge-great.mp3 | 第 6 版（seed 66） | 第 2 輪：改成和完美同系列但只有兩個音 |
| judge-good.mp3 | 第 3 版（seed 33） | |
| judge-fair.mp3 | 第 1 版（seed 11） | |
| judge-miss.mp3 | 第 7 版（seed 77） | 第 3 輪：三個往下的小調音，最後一個拉長 |
| score-tick.mp3 | 第 1 版（seed 11） | |
| new-record.mp3 | 第 1 版（seed 11） | |
| ui-click.mp3 | 第 3 版（seed 33） | |

最後採用的提示詞：

- judge-great：`TrackType: SFX, casual game success jingle, two quick ascending bell and marimba notes landing on a bright major chord with a small short sparkle, cheerful, smaller and shorter than a perfect score fanfare, clean`
- judge-miss：`TrackType: SFX, short disappointing casual game failure sound, exactly three descending minor notes on a soft muted synth, the first two notes short, the third and last note held longer and slowly fading out, deflating oh-no feeling of a near miss, sad but gentle, not harsh, clean`
- 其他 10 個：上表提示詞前面加 `TrackType: SFX, `，內容大致相同。

12 個檔案合計 529 KB。生成與匯出腳本在本機的 StableAudio3 資料夾（`gen_precise_stop.py`、`export_precise_stop.py`），不在這個 repo 裡。
