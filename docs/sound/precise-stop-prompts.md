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
