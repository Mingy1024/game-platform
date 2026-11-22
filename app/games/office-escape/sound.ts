import { COUNT_UP_MS, DUCK_LEVEL, MUSIC_GAIN, MUSIC_URL, SOUND_BASE, SOUND_FILES, SOUND_GAIN, duckSeconds, grazeRate, runLevel, tickTimes, type OneShot, type SoundFile } from "@/lib/games/office-escape/sound-mix";

type Loop = { source: AudioBufferSourceNode; gain: GainNode };

/** 平滑時間常數（秒）：音量和音高改變時不會喀一聲 */
const SMOOTH = 0.06;

/**
 * 下班逃離辦公室的音效播放（Web Audio），結構和精準停車的 GameSound 相同：
 * - 遊戲畫面掛上時才建立並載入音檔，介紹頁不載入（M12）。
 * - 瀏覽器不支援或音檔載入失敗（或根本還沒有音檔）時，所有方法都安靜地什麼都不做（M13）。
 * - 暫停、切分頁時整個 AudioContext 暫停，繼續後恢復（M12）。
 * - 音效、音樂各自一條匯流排，互不影響（M11）。
 */
export class OfficeSound {
  /** 開發用：最近播放過的音效，給自動測試檢查 */
  readonly log: { name: string; at: number }[] = [];
  loaded = 0;
  failed = 0;
  musicLoaded = false;
  musicFailed = false;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private buffers = new Map<SoundFile, AudioBuffer>();
  private run: Loop | null = null;
  private music: Loop | null = null;
  private musicStartedAt = 0;
  private muted: boolean;
  private musicOn: boolean;
  private active = true;
  private disposed = false;
  private scheduled: AudioBufferSourceNode[] = [];

  constructor(muted: boolean, musicOn = true) {
    this.muted = muted;
    this.musicOn = musicOn;
    const Context =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
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
    this.run = this.startRunLoop();
    // 背景音樂比較大，等音效好了再載入；失敗只是沒有音樂
    await this.loadMusic();
  }

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

  private musicPosition(): number {
    const ctx = this.ctx;
    const buffer = this.music?.source.buffer;
    if (!ctx || !buffer) return 0;
    return (ctx.currentTime - this.musicStartedAt) % buffer.duration;
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(on ? MUSIC_GAIN : 0, ctx.currentTime, 0.08);
  }

  /** 事件、結算音出現時背景音樂暫時調小 */
  private duck(seconds: number, delay = 0): void {
    const ctx = this.ctx;
    const gain = this.music?.gain.gain;
    if (!ctx || !gain || seconds <= 0) return;
    const start = ctx.currentTime + delay;
    gain.setTargetAtTime(DUCK_LEVEL, start, 0.04);
    gain.setTargetAtTime(1, start + seconds, 0.3);
  }

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

  /** 玩家每次操作都試著解除自動播放限制 */
  unlock(): void {
    const ctx = this.ctx;
    if (ctx && this.active && ctx.state === "suspended") void ctx.resume().catch(() => {});
  }

  /** 每次遊戲狀態更新時呼叫：奔跑聲跟著速度變化，被耽誤或在突發事件、結算時停住 */
  update(running: boolean, speed: number): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed || !this.run) return;
    const { gain, rate } = runLevel(running ? speed : 0);
    this.run.gain.gain.setTargetAtTime(gain * SOUND_GAIN["run-loop.wav"], ctx.currentTime, running ? SMOOTH : 0.15);
    if (running) this.run.source.playbackRate.setTargetAtTime(rate, ctx.currentTime, SMOOTH);
  }

  play(name: OneShot, delay = 0, rate = 1): void {
    const ctx = this.ctx;
    const buffer = this.buffers.get(name);
    this.log.push({ name, at: Math.round(performance.now()) });
    if (this.log.length > 100) this.log.shift();
    if (!ctx || !buffer || !this.sfxBus || this.disposed) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
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

  graze(streak: number) {
    this.play("graze.mp3", 0, grazeRate(streak));
  }

  /** 結算：總分跑動時連續播跑分音，破紀錄時最後再加一聲 */
  finale(newRecord: boolean, reducedMotion: boolean): void {
    const times = reducedMotion ? [0] : tickTimes();
    for (const time of times) this.play("score-tick.mp3", time);
    if (newRecord) this.play("new-record.mp3", reducedMotion ? 0.1 : COUNT_UP_MS / 1000);
  }

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
    for (const loop of [this.run, this.music]) {
      try {
        loop?.source.stop();
      } catch {
        // 已經停止
      }
    }
    const ctx = this.ctx;
    if (ctx) window.setTimeout(() => void ctx.close().catch(() => {}), 250);
  }

  private startRunLoop(): Loop | null {
    const ctx = this.ctx;
    const buffer = this.buffers.get("run-loop.wav");
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
