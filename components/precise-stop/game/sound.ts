import type { Snapshot } from "@/lib/games/precise-stop/session";
import {
  brakeLevel,
  COUNT_UP_MS,
  DUCK_LEVEL,
  duckSeconds,
  MUSIC_GAIN,
  MUSIC_URL,
  runLevel,
  SOUND_BASE,
  SOUND_FILES,
  SOUND_GAIN,
  tickTimes,
  type OneShot,
  type SoundFile,
} from "@/lib/games/precise-stop/sound-mix";

type Loop = { source: AudioBufferSourceNode; gain: GainNode };

/** 平滑時間常數（秒）：音量和音高改變時不會喀一聲 */
const SMOOTH = 0.06;

/**
 * 精準停車的音效播放（Web Audio）。
 *
 * - 遊戲畫面掛上時才建立（按「出發」之後），介紹頁不載入音檔（R9）。
 * - 瀏覽器不支援或音檔載入失敗時，所有方法都安靜地什麼都不做（R10）。
 * - 暫停、切分頁時整個 AudioContext 暫停，聲音立即停止，繼續後恢復（R8）。
 */
export class GameSound {
  /** 開發用：最近播放過的音效，給自動測試檢查 */
  readonly log: { name: string; at: number }[] = [];
  loaded = 0;
  failed = 0;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** 音效匯流排：右上喇叭鈕只關這一條（背景音樂另走 musicBus） */
  private sfxBus: GainNode | null = null;
  private buffers = new Map<SoundFile, AudioBuffer>();
  private run: Loop | null = null;
  private brake: Loop | null = null;
  private muted: boolean;
  private musicOn: boolean;
  private music: Loop | null = null;
  private musicBus: GainNode | null = null;
  musicLoaded = false;
  musicFailed = false;
  private active = true;
  private disposed = false;
  private scheduled: AudioBufferSourceNode[] = [];

  constructor(muted: boolean, musicOn = true) {
    this.muted = muted;
    this.musicOn = musicOn;
    const Context =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Context) return;
    try {
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = muted ? 0 : 1;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = musicOn ? MUSIC_GAIN : 0;
      this.musicBus.connect(this.master);
    } catch {
      this.ctx = null;
    }
  }

  get state() {
    return {
      supported: this.ctx !== null,
      context: this.ctx?.state ?? "none",
      muted: this.muted,
      sfxGain: this.sfxBus?.gain.value ?? 0,
      active: this.active,
      loaded: this.loaded,
      failed: this.failed,
      runGain: this.run?.gain.gain.value ?? 0,
      runRate: this.run?.source.playbackRate.value ?? 0,
      brakeGain: this.brake?.gain.gain.value ?? 0,
      musicOn: this.musicOn,
      musicLoaded: this.musicLoaded,
      musicFailed: this.musicFailed,
      musicGain: this.musicBus?.gain.value ?? 0,
      musicDuck: this.music?.gain.gain.value ?? 0,
      musicTime: this.musicPosition(),
    };
  }

  /** 載入全部音檔；個別失敗只是少了那個聲音 */
  async load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    await Promise.all(
      SOUND_FILES.map(async (file) => {
        try {
          const response = await fetch(SOUND_BASE + file);
          if (!response.ok) throw new Error(String(response.status));
          const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
          if (this.disposed) return;
          this.buffers.set(file, buffer);
          this.loaded += 1;
        } catch {
          this.failed += 1;
        }
      }),
    );
    if (this.disposed) return;
    this.run = this.startLoop("run-loop.wav");
    this.brake = this.startLoop("brake-loop.wav");
    // 背景音樂比較大，等音效好了再載入；失敗只是沒有音樂（R15）
    await this.loadMusic();
  }

  private musicStartedAt = 0;

  private async loadMusic(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    try {
      const response = await fetch(MUSIC_URL);
      if (!response.ok) throw new Error(String(response.status));
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (this.disposed) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      // 淡入，避免一載入好就突然出聲
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
      source.connect(gain).connect(this.musicBus);
      source.start();
      this.musicStartedAt = ctx.currentTime;
      this.music = { source, gain };
      this.musicLoaded = true;
    } catch {
      this.musicFailed = true;
    }
  }

  /** 目前播到背景音樂的第幾秒（測試用：確認暫停後從原處接著播） */
  private musicPosition(): number {
    const ctx = this.ctx;
    const buffer = this.music?.source.buffer;
    if (!ctx || !buffer) return 0;
    return (ctx.currentTime - this.musicStartedAt) % buffer.duration;
  }

  /** 右上音符鈕與暫停選單的「音樂」開關 */
  setMusicOn(on: boolean): void {
    this.musicOn = on;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(on ? MUSIC_GAIN : 0, ctx.currentTime, 0.08);
  }

  /** 判定音、結算音出現時背景音樂暫時調小 */
  private duck(seconds: number, delay = 0): void {
    const ctx = this.ctx;
    const gain = this.music?.gain.gain;
    if (!ctx || !gain || seconds <= 0) return;
    const start = ctx.currentTime + delay;
    gain.setTargetAtTime(DUCK_LEVEL, start, 0.04);
    gain.setTargetAtTime(1, start + seconds, 0.3);
  }

  /** 右上喇叭鈕與暫停選單的「音效」開關：只關音效，不影響背景音樂 */
  setMuted(muted: boolean): void {
    this.muted = muted;
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    this.sfxBus.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
  }

  /** false：暫停、切分頁，所有聲音立即停止；true：恢復 */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    if (active) void ctx.resume().catch(() => {});
    else void ctx.suspend().catch(() => {});
  }

  /** 玩家每次操作都試著解除自動播放限制（某些瀏覽器要在手勢裡 resume） */
  unlock(): void {
    const ctx = this.ctx;
    if (ctx && this.active && ctx.state === "suspended") void ctx.resume().catch(() => {});
  }

  /** 每次遊戲狀態更新時呼叫：行駛聲與煞車聲跟著車速和煞車力變化 */
  update(snapshot: Snapshot): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    const moving = snapshot.phase === "running" && !snapshot.paused;
    const speed = moving ? snapshot.speedKmh : 0;
    const now = ctx.currentTime;
    if (this.run) {
      const { gain, rate } = runLevel(speed);
      this.run.gain.gain.setTargetAtTime(gain * SOUND_GAIN["run-loop.wav"], now, moving ? SMOOTH : 0.15);
      if (speed > 0) this.run.source.playbackRate.setTargetAtTime(rate, now, SMOOTH);
    }
    if (this.brake) {
      const level = brakeLevel(snapshot.train.brake, speed);
      this.brake.gain.gain.setTargetAtTime(level * SOUND_GAIN["brake-loop.wav"], now, SMOOTH);
    }
  }

  play(name: OneShot, delay = 0): void {
    const ctx = this.ctx;
    const buffer = this.buffers.get(name);
    this.log.push({ name, at: Math.round(performance.now()) });
    if (this.log.length > 100) this.log.shift();
    if (!ctx || !buffer || !this.sfxBus || this.disposed) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = SOUND_GAIN[name];
    source.connect(gain).connect(this.sfxBus);
    source.start(ctx.currentTime + delay);
    this.duck(duckSeconds(name), delay);
    if (delay > 0) {
      this.scheduled.push(source);
      source.onended = () => {
        this.scheduled = this.scheduled.filter((item) => item !== source);
      };
    }
  }

  /** 結算：總分跑動時連續播跑分音，破紀錄時最後再加一聲 */
  finale(newRecord: boolean, reducedMotion: boolean): void {
    const times = reducedMotion ? [0] : tickTimes();
    for (const time of times) this.play("score-tick.mp3", time);
    if (newRecord) this.play("new-record.mp3", reducedMotion ? 0.1 : COUNT_UP_MS / 1000);
  }

  /** 重新開始時取消還沒播的結算音 */
  cancelScheduled(): void {
    for (const source of this.scheduled) {
      try {
        source.stop();
      } catch {
        // 已經結束
      }
    }
    this.scheduled = [];
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelScheduled();
    for (const loop of [this.run, this.brake, this.music]) {
      try {
        loop?.source.stop();
      } catch {
        // 已經停止
      }
    }
    const ctx = this.ctx;
    // 留一點時間讓剛按下的點擊音播完，再關掉
    if (ctx) window.setTimeout(() => void ctx.close().catch(() => {}), 250);
  }

  private startLoop(name: "run-loop.wav" | "brake-loop.wav"): Loop | null {
    const ctx = this.ctx;
    const buffer = this.buffers.get(name);
    if (!ctx || !buffer || !this.sfxBus) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.sfxBus);
    source.start();
    return { source, gain };
  }
}
