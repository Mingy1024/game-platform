# 階段 5.5：音效與背景音樂（本機模型生成）

只在需求確認第 9 題選了要音效或背景音樂時才做。使用者的要求（2026-11-28）：這段流程由我照本檔自己跑完，不必每次在對話裡另外交代。

時間點：驗收標準寫完後就可以生成，和實作並行。選片不擋實作：程式先用檔名接好（音檔載入失敗時照常能玩），使用者選完再匯出。

## 環境

- 本機 Stable Audio 3：`C:\Users\user\Documents\Codex\2026-11-16\bj\outputs\StableAudio3`（WSL 路徑 `/mnt/c/Users/user/Documents/Codex/2026-11-16/bj/outputs/StableAudio3`）。
- Python 用它自己的 Windows 虛擬環境：在該資料夾執行 `./.venv/Scripts/python.exe <腳本>.py`（從 WSL 直接呼叫即可）。
- 顯卡 RTX 4060 8 GB。音效模型 `small-sfx`、音樂模型 `small-music`，都已下載在 `data/huggingface`。
- 生成一輪 13 種音效 × 3 版加 5 首音樂大約 10～15 分鐘，用背景執行（`run_in_background`），輸出寫進 `outputs/<slug>.log`。

## 1. 列清單與提示詞

依第 9 題的決定列音效（檔名、用途、長度、是否循環、英文提示詞）和背景音樂方向，寫進 `docs/sound/<slug>-prompts.md`，同時完整貼在回覆裡（使用者要直接看到提示詞）。

提示詞寫法（上一款驗證過）：

- 音效前面加 `TrackType: SFX, `；負面提示詞 `music, singing, speech, voices, chanting, distortion, clipping, low quality, noisy, hum`。
- 音樂前面加 `TrackType: Music, VocalType: Instrumental, Genre: <曲風>, Genre: <曲風>. `，描述場景、樂器、情緒和 BPM；負面提示詞 `vocals, singing, speech, choir, chanting, distortion, harsh noise, low quality, lo-fi crackle, sfx, crowd`。
- 不要用真實作品、廟宇誦經、車站旋律等可辨識的錄音當參考。

## 2. 生成腳本

範本在本 skill 的 `templates/`，複製到 Stable Audio 3 資料夾改名後只改清單：

| 範本 | 複製成 | 要改的地方 |
|---|---|---|
| `templates/gen_sfx.example.py` | `gen_<slug>.py` | `OUT` 資料夾名、`SOUNDS` 清單（名稱、`shot`／`loop`、生成秒數、最終秒數、提示詞）、尾音較長的音效名單（fade_out 那一行） |
| `templates/gen_bgm.example.py` | `gen_<slug>_bgm.py` | `OUT` 資料夾名、`TRACKS` 清單（id、BPM、seed、提示詞） |

規則：

- 每種音效 3 版（seed 11、22、33）；背景音樂 5 首，每首不同曲風、不同 seed。
- 短音效一律先生 3 秒再裁到最終長度（生成短於 1.5 秒時模型常出白噪音）；點擊、跑分這種極短的生 1 秒、裁到 0.08～0.15 秒。
- 循環音（`loop`）生 4.5 秒、取中段 3 秒、頭尾 0.5 秒交叉淡化。
- 背景音樂取 32 小節、首尾 2 秒交叉淡化；BPM 不要低於 80（太慢時 32 小節加預留會超過模型長度）。
- 輸出：音效 `outputs/<slug>/<名稱>-<版本>.wav`（32 kHz 單聲道）＋ `candidates.json`；音樂 `outputs/<slug>-bgm/<id>.mp3`／`.wav` ＋ `bgm.json`。
- 只重生其中幾個：`gen_<slug>.py 名稱1 名稱2`；換 seed 用環境變數 `SEEDS=44,55,66 TAKE0=4`（版本號從 4 開始，不覆蓋舊的）。

## 3. 選片頁

範本 `templates/audio-picker.html`（和尚端湯上塔用的版本）。複製到 `.scratch/<slug>/sound/index.html`，改：

- `<title>`、`h1`、說明文字裡的數量、`已選 0 / N`（N = 音效種數 + 1 首背景音樂）。
- `GROUPS`：依遊戲時刻分組的音效 `[名稱, 中文名, 用途]`。
- `BGMS`：`[id, 中文曲名, 一句風格描述, 'BPM・秒數']`（秒數看 `bgm.json`）。
- 配色換成這款遊戲的色票。

把音檔複製到同一資料夾的 `sfx/`、`bgm/`，用 Artifact 發佈：`root` 設成這個資料夾，`files` 列出每個音檔，`capabilities: {db: {}}`。選擇存在頁面資料庫 `picks/<名稱>`（背景音樂是 `picks/bgm`），值 `{take: 1～3}`；`take: 0` 表示要重新生成。發佈後用 ArtifactData `list` 讀一次 `picks` 確認可讀。

回覆裡給連結、背景音樂 5 首的曲風表、音效分組，並說明選完告訴我。

## 4. 使用者選完之後

1. ArtifactData `list` 讀 `picks`。有 `take: 0` 的，調整提示詞或換 seed 重生那幾個，把新版加進選片頁（版本號接續），再請使用者選。
2. 全部選定後，把結果寫成 `outputs/<slug>/picks.json`（`{"名稱": 版本}`），匯出：
   - 音效：照 Stable Audio 3 資料夾裡的 `export_monk_soup_tower.py` 改一份 `export_<slug>.py`（改 `SRC`、`LOOPS`、`NAMES`），單次音輸出單聲道 MP3、循環音保留 WAV 16-bit，放到 `public/games/<slug>/<version>/sfx/`。循環音不要轉 MP3：編碼會在頭尾補靜音，循環時有空隙。
   - 背景音樂：照 `export_monk_bgm.py` 改來源資料夾與預設曲目，用法 `export_<slug>_bgm.py <輸出路徑> <compression level> <id>`，轉單聲道 MP3 到 `public/games/<slug>/<version>/music/bgm.mp3`。85 秒的曲子 0.7 約 1.1 MB、0.86 約 670 KB（64 kbps）；1.0 會報錯。
   - 程式若有「音檔已就緒」開關（例如和尚端湯上塔的 `AUDIO_READY`），匯出後改成 true，再跑這款的單元測試確認資產大小條目通過。
   - 音效合計 ≤ 600 KB（驗收清單的資產大小條目）。
3. `docs/sound/<slug>-prompts.md` 補「生成紀錄」：腳本位置、選片頁網址、每種選用的版本、背景音樂選了哪首、檔案大小。
4. 更新專案記憶裡這款遊戲的進度檔。

## 踩過的坑

- 從 WSL 呼叫 Windows 程式時環境變數要用 `WSLENV` 傳過去（例如 `WSLENV=SEEDS:TAKE0`）。
- 生成記錄檔裡的進度條是亂碼，看最後幾行的檔名與 `DONE` 就好。
- 背景音樂原始 MP3 約 1～1.3 MB（立體聲），只給選片用；進專案一定要經過匯出步驟壓小。
