import * as Phaser from "phaser";
import { FX, kmhToMs } from "@/lib/games/precise-stop/config";
import type { GameSession, SessionEvent } from "@/lib/games/precise-stop/session";
import { STATION_IDS, stationBackground, type StationId } from "@/lib/games/precise-stop/stations";
import { computeView, VIEW } from "@/lib/games/precise-stop/view";

/**
 * 精準停車的畫面層。只負責「畫」：讀取 GameSession 的狀態，
 * 把背景、列車、目標區、刻度尺和粒子畫出來。物理和判定都在 lib/games/precise-stop。
 *
 * 座標以設計稿的 420×340 為準，實際畫布是 2 倍（840×680）。
 */
const S = 2;
const W = VIEW.width * S;
const H = VIEW.height * S;
const RAIL = VIEW.railY * S;

const ASSETS = "/games/precise-stop/0.1.0";

/** 背景原圖尺寸與關鍵位置（像素） */
const BG = {
  width: 1536,
  height: 1024,
  /** 軌道接觸線在原圖的高度 */
  railY: 897.5,
  /** 月台層與軌道層的分界：月台邊緣下方的陰影線 */
  splitY: 713,
  /** 標線對應到原圖的橫向位置 */
  markU: 1150,
};

/** 列車圖（車身 1200×495）上各車輪的位置：中心 x、中心 y、半徑（都是相對比例） */
const TRAIN = { width: 400, height: 400 / (1200 / 495) };
const WHEELS = [
  [0.1103, 0.8907, 0.1011],
  [0.2549, 0.8923, 0.1011],
  [0.6402, 0.8956, 0.1028],
  [0.8016, 0.8989, 0.1028],
] as const;

const COLORS = {
  good: 0xcc4409,
  great: 0xffc83d,
  perfect: 0x16794f,
  win: 0x4fd69c,
  ink: 0x14171f,
  white: 0xffffff,
};

export type SceneLabels = {
  stopBadge: string;
  perfect: string;
  good: string;
  /** 站牌上的站名：依語言顯示 */
  stationName(id: StationId): { name: string; sub: string };
};

export type SceneOptions = {
  parent: HTMLElement;
  session: GameSession;
  labels: SceneLabels;
  fontFamily: string;
  reducedMotion: boolean;
  onReady(): void;
  onError(error: Error): void;
};

export type SceneHandle = {
  destroy(): void;
  refresh(): void;
  setReducedMotion(value: boolean): void;
  /** 給測試讀取的特效計數 */
  fx: FxCounters;
};

export type FxCounters = {
  sparks: number;
  confetti: number;
  rings: number;
  zoomTweens: number;
  /** 目前存活的粒子數（火花＋彩帶） */
  alive: number;
  maxAlive: number;
};

const bgKey = (id: StationId) => `bg-${id}`;
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

class StopScene extends Phaser.Scene {
  private options!: SceneOptions;
  private session!: GameSession;
  private reduced = false;
  readonly fx: FxCounters = { sparks: 0, confetti: 0, rings: 0, zoomTweens: 0, alive: 0, maxAlive: 0 };

  private platform: Phaser.GameObjects.Image[] = [];
  private track: Phaser.GameObjects.Image[] = [];
  private currentStation: StationId | null = null;
  private posts!: Phaser.GameObjects.Graphics;
  private speedLines!: Phaser.GameObjects.Graphics;
  private sign!: Phaser.GameObjects.Container;
  private signName!: Phaser.GameObjects.Text;
  private signSub!: Phaser.GameObjects.Text;
  private beam!: Phaser.GameObjects.Image;
  private zone!: Phaser.GameObjects.Graphics;
  private zoneLabels: Phaser.GameObjects.Text[] = [];
  private badge!: Phaser.GameObjects.Container;
  private badgeShape!: Phaser.GameObjects.Graphics;
  private badgeText!: Phaser.GameObjects.Text;
  private ruler!: Phaser.GameObjects.Graphics;
  private rulerLabels: Phaser.GameObjects.Text[] = [];
  private train!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Graphics;
  private wheels: Phaser.GameObjects.Image[] = [];
  private rings!: Phaser.GameObjects.Graphics;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;

  private zoom = 0;
  private zoomTween?: Phaser.Tweens.Tween;
  private enter = 1;
  private tilt = 0;
  private bounce = 0;
  private wheelAngle = 0;
  private lastDistance = 0;
  private lineOffset = 0;
  private ringT = -1;
  private won = false;
  private unsubscribe?: () => void;

  constructor() {
    super("stop");
  }

  init(data: SceneOptions) {
    this.options = data;
    this.session = data.session;
    this.reduced = data.reducedMotion;
  }

  preload() {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      this.options.onError(new Error(`圖片載入失敗：${file.key}`));
    });
    this.load.image("body", `${ASSETS}/train-body.webp`);
    this.load.image("wheel", `${ASSETS}/wheel.webp`);
    // 先載入前兩站的背景，其餘在背景預先載入（見 create）
    for (const stop of this.session.route.stops.slice(0, 2)) {
      this.load.image(bgKey(stop.station), `${ASSETS}/${stationBackground(stop.station)}`);
    }
  }

  create() {
    this.makeTextures();
    const font = this.options.fontFamily;

    for (let i = 0; i < 3; i++) this.platform.push(this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0));
    for (let i = 0; i < 3; i++) this.track.push(this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0));

    // 月台上的站名牌
    this.signName = this.add
      .text(0, -6, "", { fontFamily: font, fontSize: "32px", fontStyle: "900", color: "#ffffff" })
      .setOrigin(0.5);
    this.signSub = this.add
      .text(0, 22, "", { fontFamily: font, fontSize: "15px", fontStyle: "700", color: "#c9d6f5" })
      .setOrigin(0.5);
    const signBoard = this.add.graphics();
    this.sign = this.add.container(0, 0, [signBoard, this.signName, this.signSub]);
    this.sign.setData("board", signBoard);

    this.beam = this.add.image(0, 0, "beam").setOrigin(0.5, 1);
    this.zone = this.add.graphics();
    for (let i = 0; i < 3; i++) {
      this.zoneLabels.push(
        this.add
          .text(0, 0, i === 1 ? this.options.labels.perfect : this.options.labels.good, {
            fontFamily: font,
            fontSize: "22px",
            fontStyle: "900",
            color: i === 1 ? "#7ff0bd" : "#ffb38a",
            stroke: "#14171f",
            strokeThickness: 6,
          })
          .setOrigin(0.5, 1),
      );
    }

    this.shadow = this.add.graphics();
    for (const [fx, fy, fr] of WHEELS) {
      const size = (fr * TRAIN.height + 1.5) * 2;
      const wheel = this.add.image(
        -TRAIN.width + fx * TRAIN.width,
        -2 - TRAIN.height + fy * TRAIN.height,
        "wheel",
      );
      wheel.setDisplaySize(size, size);
      this.wheels.push(wheel);
    }
    // 車身以中心為軸，煞車時才能做出前傾的效果；車輪留在原地
    this.body = this.add
      .image(-TRAIN.width / 2, -2 - TRAIN.height / 2, "body")
      .setDisplaySize(TRAIN.width, TRAIN.height);
    // 車輪在車身後面：轉向架外框蓋住車輪上緣，不會露出接縫
    this.train = this.add.container(0, RAIL, [this.shadow, ...this.wheels, this.body]);

    this.sparks = this.add.particles(0, 0, "spark", {
      lifespan: 260,
      speed: { min: 120, max: 320 },
      angle: { min: 150, max: 215 },
      gravityY: 900,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0.2 },
      emitting: false,
      maxAliveParticles: FX.maxSparks,
    });
    this.rings = this.add.graphics();
    this.confetti = this.add.particles(0, 0, "confetti", {
      lifespan: 900,
      speed: { min: 160, max: 420 },
      angle: { min: 225, max: 315 },
      gravityY: 700,
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.6 },
      alpha: { start: 1, end: 0 },
      tint: [0xffc83d, 0xcc4409, 0x4fd69c, 0xffffff],
      emitting: false,
      maxAliveParticles: FX.maxConfetti,
    });

    this.posts = this.add.graphics();
    this.speedLines = this.add.graphics();

    // 標線上方的「停」浮標
    this.badgeShape = this.add.graphics();
    this.badgeText = this.add
      .text(0, 0, this.options.labels.stopBadge, {
        fontFamily: font,
        fontSize: "34px",
        fontStyle: "900",
        color: "#14171f",
      })
      .setOrigin(0.5);
    this.badge = this.add.container(0, 0, [this.badgeShape, this.badgeText]);

    this.ruler = this.add.graphics();
    for (let i = 0; i < 5; i++) {
      this.rulerLabels.push(
        this.add
          .text(0, 0, "", { fontFamily: "system-ui, sans-serif", fontSize: "22px", fontStyle: "700", color: "#ffffff" })
          .setOrigin(0.5, 1),
      );
    }

    this.unsubscribe = this.session.onEvent((event) => this.onSessionEvent(event));
    this.lastDistance = this.session.getSnapshot().train.distance;
    this.applyStation();
    this.loadRemainingBackgrounds();
    this.options.onReady();
  }

  setReducedMotion(value: boolean) {
    this.reduced = value;
  }

  shutdown() {
    this.unsubscribe?.();
  }

  // ---- 貼圖 ----
  private makeTextures() {
    const make = (key: string, width: number, height: number, draw: (c: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (context) draw(context);
      this.textures.addCanvas(key, canvas);
    };
    make("spark", 12, 12, (c) => {
      const gradient = c.createRadialGradient(6, 6, 0, 6, 6, 6);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.5, "rgba(255,200,61,0.9)");
      gradient.addColorStop(1, "rgba(255,200,61,0)");
      c.fillStyle = gradient;
      c.fillRect(0, 0, 12, 12);
    });
    make("confetti", 14, 8, (c) => {
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, 14, 8);
    });
    // 標線的光柱：由下往上淡出
    make("beam", 64, 256, (c) => {
      const vertical = c.createLinearGradient(0, 0, 0, 256);
      vertical.addColorStop(0, "rgba(255,200,61,0)");
      vertical.addColorStop(1, "rgba(255,200,61,0.55)");
      c.fillStyle = vertical;
      c.fillRect(0, 0, 64, 256);
      const core = c.createLinearGradient(0, 0, 0, 256);
      core.addColorStop(0, "rgba(255,244,209,0)");
      core.addColorStop(1, "rgba(255,244,209,0.95)");
      c.fillStyle = core;
      c.fillRect(29, 0, 6, 256);
    });
  }

  /** 把一張月台背景切成月台層、軌道層兩張貼圖 */
  private makeLayers(id: StationId) {
    const plat = `plat-${id}`;
    if (this.textures.exists(plat)) return;
    const source = this.textures.get(bgKey(id)).getSourceImage() as HTMLImageElement;
    const cut = (key: string, top: number, height: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = BG.width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(source, 0, top, BG.width, height, 0, 0, BG.width, height);
      this.textures.addCanvas(key, canvas);
    };
    cut(plat, 0, BG.splitY);
    // 多切 1 px 重疊，兩層之間不會露出縫
    cut(`track-${id}`, BG.splitY - 1, BG.height - BG.splitY + 1);
  }

  private loadRemainingBackgrounds() {
    const pending = STATION_IDS.filter(
      (id) =>
        !this.textures.exists(bgKey(id)) &&
        this.session.route.stops.some((stop) => stop.station === id),
    );
    if (pending.length === 0) return;
    for (const id of pending) this.load.image(bgKey(id), `${ASSETS}/${stationBackground(id)}`);
    this.load.once("complete", () => this.applyStation());
    this.load.start();
  }

  private applyStation() {
    const { stop } = this.session.getSnapshot();
    if (!this.textures.exists(bgKey(stop.station))) return;
    if (this.currentStation === stop.station) return;
    this.makeLayers(stop.station);
    for (const image of this.platform) image.setTexture(`plat-${stop.station}`);
    for (const image of this.track) image.setTexture(`track-${stop.station}`);
    this.currentStation = stop.station;

    const name = this.options.labels.stationName(stop.station);
    this.signName.setText(name.name);
    this.signSub.setText(name.sub);
    const width = Math.max(this.signName.width, this.signSub.width) + 56;
    const board = this.sign.getData("board") as Phaser.GameObjects.Graphics;
    board.clear();
    board.fillStyle(0x4a5263, 1);
    board.fillRect(-width / 2 + 24, -62, 6, 28);
    board.fillRect(width / 2 - 30, -62, 6, 28);
    board.fillStyle(COLORS.white, 1);
    board.fillRoundedRect(-width / 2 - 4, -40, width + 8, 80, 14);
    board.fillStyle(0x1d3a8f, 1);
    board.fillRoundedRect(-width / 2, -36, width, 72, 11);
  }

  // ---- 事件 ----
  private onSessionEvent(event: SessionEvent) {
    switch (event.type) {
      case "depart":
        this.enter = this.reduced ? 1 : 0;
        if (!this.reduced) {
          this.tweens.add({ targets: this, enter: 1, duration: 400, ease: "Cubic.easeOut" });
        }
        break;
      case "zoom":
        this.tweenZoom(1);
        break;
      case "stopped":
        if (!this.reduced) {
          this.bounce = 1;
          this.tweens.add({ targets: this, bounce: 0, duration: 300, ease: "Back.easeOut" });
        }
        break;
      case "judged":
        // 沒進到放大範圍就停下（停得太早）也切到近景，讓玩家看到離標線多遠
        if (this.zoom < 1) this.tweenZoom(1);
        this.won = event.result.judgement === "perfect";
        if (event.result.judgement === "perfect" || event.result.judgement === "great") {
          this.ringT = 0;
          this.fx.rings += 1;
        }
        if (this.won && !this.reduced) {
          const view = computeView(this.session.getSnapshot().train.distance, 1);
          this.confetti.explode(FX.maxConfetti, view.markX * S, RAIL - 30);
          this.fx.confetti += 1;
        }
        break;
      case "restart":
        this.resetStation();
        break;
      default:
        break;
    }
  }

  private tweenZoom(target: number) {
    this.zoomTween?.stop();
    if (this.reduced) {
      this.zoom = target;
      return;
    }
    this.fx.zoomTweens += 1;
    this.zoomTween = this.tweens.add({
      targets: this,
      zoom: target,
      duration: 300,
      ease: "Cubic.easeOut",
    });
  }

  private resetStation() {
    this.zoomTween?.stop();
    this.zoom = 0;
    this.enter = 1;
    this.won = false;
    this.ringT = -1;
    this.tilt = 0;
    this.bounce = 0;
    this.lastDistance = this.session.getSnapshot().train.distance;
    this.applyStation();
  }

  // ---- 每個畫面 ----
  update(_time: number, deltaMs: number) {
    const before = this.session.getSnapshot();
    this.session.update(deltaMs / 1000);
    const snapshot = this.session.getSnapshot();

    if (snapshot.phase === "briefing" && (before.index !== snapshot.index || this.zoom !== 0)) {
      this.resetStation();
    }
    if (snapshot.stop.station !== this.currentStation) this.applyStation();

    const distance = snapshot.train.distance;
    const view = computeView(distance, this.zoom);
    const running = snapshot.phase === "running" && !snapshot.paused;
    const dt = deltaMs / 1000;

    this.drawBackground(view);
    this.drawPosts(distance, view.noseX);
    this.drawMark(view, snapshot.phase === "judged" && this.won);
    this.drawRuler(view, distance, snapshot.phase === "judged" ? snapshot.results.at(-1)?.judgement : undefined);

    // 列車
    const closeness = (view.ppm - VIEW.farPpm) / (VIEW.closePpm - VIEW.farPpm);
    const enterOffset = (1 - this.enter) * (view.noseX + 60);
    this.train.setPosition((view.noseX - enterOffset) * S, RAIL);
    this.train.setScale(S * view.trainScale);
    this.train.setVisible(snapshot.phase !== "briefing");

    const travelled = this.lastDistance - distance;
    this.lastDistance = distance;
    if (travelled > 0 && travelled < 5) {
      // 車輪轉動量＝畫面上移動的距離 ÷ 車輪半徑
      const radius = (WHEELS[0][2] * TRAIN.height + 1.5) * view.trainScale;
      this.wheelAngle += (travelled * view.ppm) / radius;
      for (const wheel of this.wheels) wheel.rotation = this.wheelAngle;
    }

    const targetTilt = this.reduced ? 0 : Phaser.Math.DegToRad(1.5) * snapshot.train.brake * (snapshot.train.speed > 0.3 ? 1 : 0);
    this.tilt = lerp(this.tilt, targetTilt, Math.min(1, dt * 10));
    this.body.rotation = this.tilt - this.bounce * Phaser.Math.DegToRad(0.7);

    this.shadow.clear();
    this.shadow.fillStyle(0x10131a, 0.32);
    this.shadow.fillEllipse(-TRAIN.width / 2, 0, TRAIN.width * 0.96, 10);

    // 煞車火花（雨天是水花）
    if (running && snapshot.train.brake > 0.2 && snapshot.train.speed > 1) {
      this.sparks.setParticleTint(snapshot.stop.rain ? 0xbfe0ff : 0xffc83d);
      const scale = S * view.trainScale;
      for (const [fx] of WHEELS) {
        const x = this.train.x + (-TRAIN.width + fx * TRAIN.width) * scale;
        if (x < -20 || x > W + 20) continue;
        if (Math.random() < 0.45 * snapshot.train.brake) {
          this.sparks.emitParticleAt(x - 6 * scale, RAIL - 2, 1);
          this.fx.sparks += 1;
        }
      }
    }

    this.drawSpeedLines(running ? snapshot.speedKmh : 0, dt, closeness);
    this.drawRings(view, dt);

    const alive = this.sparks.getAliveParticleCount() + this.confetti.getAliveParticleCount();
    this.fx.alive = alive;
    this.fx.maxAlive = Math.max(this.fx.maxAlive, alive);
  }

  private drawBackground(view: ReturnType<typeof computeView>) {
    const k = (H / BG.height) * view.backgroundScale;
    const tileWidth = BG.width * k;
    const place = (images: Phaser.GameObjects.Image[], shift: number, top: number) => {
      // 第 0 張圖的左緣：讓原圖上 markU 的位置對到標線
      const origin = view.markX * S + shift - BG.markU * k;
      const first = Math.floor(-origin / tileWidth);
      images.forEach((image, index) => {
        const tile = first + index;
        // 奇數張左右翻轉，接縫兩側是鏡像，看不到斷線
        image.setFlipX(Math.abs(tile) % 2 === 1);
        image.setScale(k);
        image.setPosition(Math.round(origin + tile * tileWidth) - (index > 0 ? 1 : 0), top);
      });
    };
    place(this.platform, view.platformShift * S, RAIL - BG.railY * k);
    place(this.track, 0, RAIL - (BG.railY - (BG.splitY - 1)) * k);

    // 站名牌掛在月台上，跟著月台層移動
    // 鏡頭推近後站名牌會被車頂擋住一半，所以淡出；站名在左上角的標籤還看得到
    const near = (view.backgroundScale - 1) / (VIEW.backgroundCloseScale - 1);
    this.sign.setScale(lerp(1, 1.5, near));
    this.sign.setAlpha(Math.max(0, 1 - near * 2.5));
    this.sign.setPosition((view.markX - 70) * S + view.platformShift * S, RAIL - 300 * S * 0.5 * view.backgroundScale);
  }

  private drawPosts(distance: number, noseX: number) {
    this.posts.clear();
    const alpha = 0.28 * (1 - this.zoom);
    if (alpha <= 0.01) return;
    this.posts.fillStyle(0x10131a, alpha);
    const span = VIEW.postSpacing;
    const first = Math.floor((distance - 40) / span) * span;
    for (let post = first; post < distance + 40; post += span) {
      if (post < 12) continue; // 接近月台標線的地方不放，避免擋住目標區
      const x = (noseX + (distance - post) * VIEW.farPpm * VIEW.postParallax) * S;
      if (x < -40 || x > W + 40) continue;
      this.posts.fillRect(x - 9, 0, 18, H);
      this.posts.fillRect(x - 9, 60, 150, 10);
    }
  }

  private drawMark(view: ReturnType<typeof computeView>, won: boolean) {
    const x = view.markX * S;
    const ppm = view.ppm * S;
    const top = 262 * S;
    const bottom = 306 * S;
    const skew = 10 * S;
    const closeness = (view.ppm - VIEW.farPpm) / (VIEW.closePpm - VIEW.farPpm);

    this.beam.setPosition(x, RAIL + 8);
    this.beam.setDisplaySize(64, lerp(182, 210, closeness) * S);

    const band = (half: number, color: number, alpha: number, minHalf: number) => {
      const h = Math.max(half * ppm, minHalf * S);
      this.zone.fillStyle(color, alpha);
      this.zone.fillPoints(
        [
          new Phaser.Math.Vector2(x - h + skew, top),
          new Phaser.Math.Vector2(x + h + skew, top),
          new Phaser.Math.Vector2(x + h, bottom),
          new Phaser.Math.Vector2(x - h, bottom),
        ],
        true,
      );
      return h;
    };
    this.zone.clear();
    this.zone.fillStyle(won ? COLORS.win : COLORS.great, 0.3);
    this.zone.fillEllipse(x + skew / 2, (top + bottom) / 2, Math.max(2.8 * ppm, 160), 104);
    const outer = band(1, COLORS.good, 0.78, 9);
    band(0.3, COLORS.great, 0.95, 4);
    band(0.05, won ? COLORS.win : COLORS.perfect, 1, 1.6);
    this.zone.lineStyle(3, COLORS.white, 0.9);
    this.zone.strokePoints(
      [
        new Phaser.Math.Vector2(x - outer + skew, top),
        new Phaser.Math.Vector2(x + outer + skew, top),
        new Phaser.Math.Vector2(x + outer, bottom),
        new Phaser.Math.Vector2(x - outer, bottom),
      ],
      true,
      true,
    );

    // 近站放大後才標出「良好／完美」
    const showLabels = view.ppm > 40;
    const offsets = [-0.65, 0, 0.65];
    this.zoneLabels.forEach((label, index) => {
      label.setVisible(showLabels);
      label.setPosition(x + skew + offsets[index] * ppm, top - 8);
    });

    // 浮標
    const radius = lerp(19, 26, closeness) * S;
    const cy = lerp(94, 54, closeness) * S;
    const face = won ? COLORS.win : COLORS.great;
    const rim = won ? COLORS.perfect : 0xb8860b;
    this.badge.setPosition(x, cy);
    this.badgeShape.clear();
    this.badgeShape.fillStyle(0x10131a, 0.3);
    this.badgeShape.fillCircle(0, radius * 0.3, radius);
    this.badgeShape.fillStyle(rim, 1);
    this.badgeShape.fillTriangle(-radius * 0.45, radius * 0.8, radius * 0.45, radius * 0.8, 0, radius * 1.55);
    this.badgeShape.fillCircle(0, radius * 0.14, radius);
    this.badgeShape.fillStyle(face, 1);
    this.badgeShape.fillCircle(0, 0, radius);
    this.badgeShape.lineStyle(Math.max(4, radius / 9), COLORS.ink, 1);
    this.badgeShape.strokeCircle(0, 0, radius);
    this.badgeShape.fillStyle(COLORS.white, 0.5);
    this.badgeShape.fillEllipse(-radius * 0.3, -radius * 0.45, radius * 0.9, radius * 0.44);
    const text = won ? "✓" : this.options.labels.stopBadge;
    if (this.badgeText.text !== text) this.badgeText.setText(text);
    // 文字多於一個字時縮小，塞進圓牌裡
    const fit = Math.min(1, (radius * 1.5) / Math.max(1, this.badgeText.width / this.badgeText.scaleX));
    this.badgeText.setScale(fit * (radius / (19 * S)) * (text.length > 1 ? 1 : 1.05));
  }

  private drawRuler(view: ReturnType<typeof computeView>, distance: number, judgement?: string) {
    this.ruler.clear();
    const alpha = this.zoom;
    for (const label of this.rulerLabels) label.setVisible(alpha > 0.5);
    if (alpha <= 0.01) return;
    const top = 306 * S;
    this.ruler.fillStyle(0x10131a, 0.82 * alpha);
    this.ruler.fillRect(0, top, W, H - top);

    // 車頭到標線之間塗色
    const markX = view.markX * S;
    const noseX = view.noseX * S;
    const color = judgement === "perfect" ? COLORS.win : COLORS.good;
    this.ruler.fillStyle(color, (judgement === "perfect" ? 0.7 : 0.5) * alpha);
    const left = Math.min(markX, noseX);
    this.ruler.fillRect(left, top, Math.max(Math.abs(markX - noseX), judgement === "perfect" ? 8 : 0), H - top);

    // 刻度：挑一個讓間距至少 38 px 的單位
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10];
    const step = steps.find((value) => value * view.ppm >= 38) ?? 10;
    this.ruler.lineStyle(3, COLORS.white, alpha);
    for (let i = -6; i <= 6; i++) {
      const x = markX + i * step * view.ppm * S;
      if (x < 0 || x > W) continue;
      this.ruler.lineBetween(x, top + 4, x, top + (i === 0 ? 40 : 28));
    }
    this.ruler.lineStyle(2, COLORS.white, 0.7 * alpha);
    for (let i = -6; i < 6; i++) {
      const x = markX + (i + 0.5) * step * view.ppm * S;
      if (x < 0 || x > W) continue;
      this.ruler.lineBetween(x, top + 4, x, top + 18);
    }
    const format = (value: number) => {
      if (value === 0) return "0";
      const sign = value > 0 ? "+" : "−";
      const abs = Math.abs(value);
      return abs < 1 ? `${sign}${Math.round(abs * 100)} cm` : `${sign}${abs} m`;
    };
    [-2, -1, 0, 1, 2].forEach((i, index) => {
      const x = markX + i * step * view.ppm * S;
      const label = this.rulerLabels[index];
      label.setText(format(i * step));
      label.setPosition(x, H - 2);
      label.setVisible(alpha > 0.5 && x > 30 && x < W - 30);
    });
    void distance;
  }

  private drawSpeedLines(speedKmh: number, dt: number, closeness: number) {
    this.speedLines.clear();
    if (this.reduced || speedKmh <= FX.speedLinesAboveKmh || closeness > 0.05) return;
    const strength = Math.min(1, (speedKmh - FX.speedLinesAboveKmh) / 30);
    this.lineOffset = (this.lineOffset + kmhToMs(speedKmh) * VIEW.farPpm * S * dt * 1.4) % 520;
    this.speedLines.lineStyle(6, COLORS.white, 0.35 + 0.4 * strength);
    const rows = [314, 326, 318, 334];
    rows.forEach((row, index) => {
      const length = (40 + index * 14) * S * (0.6 + strength * 0.6);
      const x = ((index * 137 * S - this.lineOffset) % 520 + 520) % 520 - 80;
      this.speedLines.lineBetween(x, row * S, x + length, row * S);
    });
  }

  private drawRings(view: ReturnType<typeof computeView>, dt: number) {
    this.rings.clear();
    if (this.ringT < 0) return;
    this.ringT += dt / 0.8;
    if (this.ringT >= 1 || this.reduced) {
      this.ringT = this.reduced ? -1 : this.ringT >= 1 ? -1 : this.ringT;
      if (this.ringT < 0) return;
    }
    const x = view.markX * S + 10;
    const y = 284 * S;
    for (const offset of [0, 0.35]) {
      const t = this.ringT - offset;
      if (t <= 0) continue;
      this.rings.lineStyle(8 * (1 - t), COLORS.win, 1 - t);
      this.rings.strokeEllipse(x, y, (140 + 260 * t) * S * 0.5 * 2, (44 + 80 * t) * S * 0.5 * 2);
    }
  }
}

/** 建立遊戲畫面。回傳的 handle 用來銷毀或調整。 */
export function createScene(options: SceneOptions): SceneHandle {
  const scene = new StopScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    width: W,
    height: H,
    backgroundColor: "#10131a",
    banner: false,
    audio: { noAudio: true },
    // 輸入一律由外層的 DOM 事件處理（按住畫面、鍵盤），Phaser 不接收
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER, expandParent: false },
    render: { antialias: true },
    scene: [],
  });
  game.scene.add("stop", scene, true, options);
  return {
    destroy: () => game.destroy(true),
    refresh: () => game.scale.refresh(),
    setReducedMotion: (value) => scene.setReducedMotion(value),
    fx: scene.fx,
  };
}
