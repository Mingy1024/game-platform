# 和尚端湯上塔音效提示詞

2026-11-28 需求確認第 8 題定案：畫線與走路、湯的聲音、過層與結果、介面操作都要出聲，另有背景音樂。音檔由你用本地模型生成，交檔後我負責接進遊戲。

## 交檔規格

- **循環音（標「循環」）**：WAV、32 kHz、16-bit、單聲道，約 3 秒，音量從頭到尾平穩；頭尾接不上沒關係，程式會做交叉淡化。
- **單次音**：MP3 128 kbps 單聲道（只能輸出 WAV 也可以）。開頭不要留空白，尾音自然收掉。短於 1.5 秒的先生 3 秒再裁。
- 音效合計不超過 600 KB；背景音樂另計，約 750 KB 以內。
- 檔名照下表，放進 `public/games/monk-soup-tower/0.1.0/sfx/`（音樂放 `music/`）或直接丟給我。
- 不要用真實寺廟的誦經錄音、人聲唸經或其他遊戲的音效當參考。

## 音效

提示詞前面都加 `TrackType: SFX, `；負面提示詞 `music, singing, speech, voices, chanting, distortion, clipping, low quality, noisy, hum`。

| # | 檔名 | 用途 | 長度 | 提示詞 |
|---|---|---|---|---|
| 1 | `brush-loop.wav` | 畫線時循環，音量隨畫線速度 | 3 s 循環 | soft calligraphy brush stroking across rough rice paper, continuous gentle dry swishing texture, steady volume, close and intimate, no voices, no music |
| 2 | `step-wood.mp3` | 和尚踩木地板，每一步播一次 | 約 0.25 s | single soft footstep of a cloth sandal on an old wooden temple floorboard, light creak, dry and close, no voices, no music |
| 3 | `step-slip.mp3` | 踩到灑出的湯（滑區） | 約 0.35 s | a wet sandal squeaking and sliding briefly on a slick wooden floor, short slippery squelch, comedic, no voices, no music |
| 4 | `slosh-loop.wav` | 湯在碗裡晃，音量隨晃動程度 | 3 s 循環 | thick hot soup gently sloshing back and forth inside a ceramic bowl, continuous soft liquid lapping, steady volume, close, no splashes, no voices, no music |
| 5 | `spill.mp3` | 湯灑出來 | 約 0.8 s | a small splash of hot soup spilling over the rim of a bowl and splattering onto a wooden floor, short and wet, no voices, no music |
| 6 | `sizzle.mp3` | 灑出的湯燙到塔，緊接在 5 後面 | 約 0.8 s | a quick hot sizzle hiss of boiling liquid hitting warm wood, short steam puff that fades out, no voices, no music |
| 7 | `floor-clear.mp3` | 到達樓梯口、過一層 | 約 0.5 s | a single clear wooden temple block (mokugyo) knock, warm hollow tone, short natural decay, no voices, no music |
| 8 | `summit-bell.mp3` | 送到塔頂 | 約 2.5 s | a bright small temple bell struck once with a warm shimmering ring and a gentle wind chime sparkle, uplifting and peaceful, long natural tail, no voices, no music |
| 9 | `fall.mp3` | 和尚踩空摔下去 | 約 1.5 s | comedic cartoon falling whistle sliding downward in pitch, ending with a soft distant wooden thud and a ceramic bowl clatter, playful not painful, no voices, no music |
| 10 | `soup-cold.mp3` | 溫度掉到 50℃ 以下（涼掉）的提示 | 約 0.8 s | a soft descending two-note woodblock and a faint chilly wind whoosh, a gentle "uh-oh, it's getting cold" cue for a casual game, no voices, no music |
| 11 | `score-tick.mp3` | 結算分數跑動時連續播 | 約 0.05 s | a single very short soft wooden tick, like a tiny bamboo tap, crisp and dry, no tail, no voices, no music |
| 12 | `new-record.mp3` | 破紀錄 | 約 2 s | joyful short celebratory fanfare for a casual mobile game: bright plucked koto-like strings and bells rising to a final chord with a gong shimmer, triumphant but friendly, no voices |
| 13 | `ui-click.mp3` | 出發、重畫、暫停選單、結算按鈕 | 約 0.1 s | soft short UI button tap: a rounded bamboo click with a tiny pop, clean and dry, casual mobile game, no voices, no music |

## 背景音樂

提示詞前面加 `TrackType: Music, VocalType: Instrumental, `；負面提示詞 `vocals, singing, speech, choir, chanting, distortion, harsh noise, low quality, lo-fi crackle, sfx, crowd`。

| 檔名 | 用途 | 長度 | 提示詞 |
|---|---|---|---|
| `bgm.mp3` | 遊戲中循環 | 約 50–60 s | Genre: Asian Folk, Genre: Lighthearted. A calm but playful instrumental for a little monk carefully carrying a bowl of hot soup up a wooden pagoda. Plucked guzheng and pipa melody, soft bamboo flute, light wooden percussion and tiny bells, gentle tiptoeing rhythm with a hint of comic suspense, warm and cozy, 90 BPM, loopable. |

## 生成紀錄（2026-11-28）

用本機的 Stable Audio 3 生成（steps 8、cfg 1.0），腳本在 `C:\Users\user\Documents\Codex\2026-11-16\bj\outputs\StableAudio3`：

- `gen_monk_soup_tower.py`：13 種音效各 3 版（seed 11、22、33），結果放 `outputs\monk-soup-tower\<名稱>-<版本>.wav`（32 kHz 單聲道）。短音效先生 3 秒再裁；兩個循環音取中段 3 秒、頭尾 0.5 秒交叉淡化。
- `gen_monk_bgm.py`：5 首背景音樂（Small-Music，32 小節、首尾 2 秒交叉淡化），結果放 `outputs\monk-soup-tower-bgm\`：寺廟躡腳（90 BPM、85 秒）、山霧清晨（80 BPM、96 秒）、端湯小碎步（104 BPM、74 秒）、登塔（112 BPM、69 秒）、茶屋 lo-fi（84 BPM、91 秒）。
- 選片頁：https://claude.ai/artifact/9geWHqJ2Kkfp3u5PSJiDuc（選擇存在頁面資料庫 `picks/<名稱>`，背景音樂是 `picks/bgm`；`take: 0` 表示要重新生成）。
- 選片結果（`outputs\monk-soup-tower\picks.json`）：畫線第 2 版、腳步第 3 版、踩到滑區第 3 版、湯晃動第 2 版、按鈕第 3 版，其餘（灑湯、燙到塔、湯涼掉、過一層、送到塔頂、摔下去、破紀錄、分數跑動）都是第 1 版；背景音樂選「寺廟躡腳」（temple-tiptoe，90 BPM、85 秒）。
- 匯出腳本：`export_monk_soup_tower.py`（音效）、`export_monk_bgm.py`（背景音樂）。兩個循環音保留 WAV 16-bit 單聲道（MP3 編碼會在頭尾補靜音，循環時會有空隙），其餘轉單聲道 MP3（compression level 0.7）。
- 檔案大小：音效合計 534.6 KB（brush-loop.wav、slosh-loop.wav 各 187.5 KB，11 個 MP3 共 159.6 KB）；背景音樂 `music/bgm.mp3` 667.1 KB（單聲道、約 64 kbps，compression level 0.86）。都在驗收 H8 的上限內。
