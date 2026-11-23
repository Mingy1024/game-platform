import * as Phaser from "phaser";
import { FIELD, FX, PLAYER, type Kind } from "@/lib/games/mine-descent/config";
import type { MineSession } from "@/lib/games/mine-descent/session";
import { ceilingY, type Platform, type SimEvent } from "@/lib/games/mine-descent/sim";
import {
  ART_PPM,
  backgroundSvg,
  ceilingSvg,
  INK,
  MOLE_DISPLAY_H,
  MOLE_ORIGIN,
  PLATFORM_BOTTOM,
  PLATFORM_H,
  PLATFORM_PALETTE,
  PLATFORM_TOP,
  platformSvg,
  poseSvg,
  POSES,
  wallsSvg,
  type Pose,
} from "./art";

/**
 * 礦坑大逃亡的畫面層。只負責「畫」：讀取 MineSession 的狀態，把背景、岩板、地鼠、崩塌線和特效畫出來；
 * 同時是遊戲的時鐘（每一格呼叫 session.update）。物理、判定、計分都在 lib/games/mine-descent。
 *
 * 座標：場地 6×8 公尺，畫布 780×1040，每公尺 130 像素（設計稿的 2 倍）。
 */
export const PPM = 130;
const W = FIELD.width * PPM;
/** 預設（3:4）的畫布高度；實際高度跟著 session.viewHeight */
const H0 = FIELD.height * PPM;

export type SceneOptions = {
  parent: HTMLElement;
  session: MineSession;
  reducedMotion: boolean;
  /** 每一格模擬產生的事件（聲音、提示字、結算都在外層處理） */
  onEvents(events: SimEvent[]): void;
  /** 每一格畫面更新後呼叫（讓外層的介面同步最新狀態） */
  onFrame(): void;
  onReady(): void;
  onError(error: Error): void;
};

export type FxCounters = {
  dust: number;
  sparks: number;
  rocks: number;
  /** 目前存活的粒子數 */
  alive: number;
  maxAlive: number;
  shakes: number;
};

export type SceneHandle = {
  destroy(): void;
  refresh(): void;
  setReducedMotion(value: boolean): void;
  fx: FxCounters;
};

const WIDTH_KEYS = Array.from({ length: 13 }, (_, i) => 12 + i).concat(30);
const KINDS: (Kind | "crystalSpent")[] = ["rock", "spike", "crack", "cart", "wood", "crystal", "crystalSpent"];
const platformKey = (kind: Kind | "crystalSpent", w: number) => `plat-${kind}-${Math.round(w * 10)}`;

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片載入失敗"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** 把所有 SVG 轉成圖片（同時載入）。回傳 key → 圖片 */
async function prepare(): Promise<Map<string, HTMLImageElement>> {
  const jobs: [string, string][] = [];
  for (const pose of POSES) jobs.push([`pose-${pose}`, poseSvg(pose)]);
  jobs.push(["bg-0", backgroundSvg(0)], ["walls-0", wallsSvg(0)], ["ceiling", ceilingSvg()]);
  for (const kind of KINDS) {
    for (const key of WIDTH_KEYS) {
      if (key === 30 && kind !== "rock") continue;
      jobs.push([platformKey(kind, key / 10), platformSvg(kind, key / 10, PLATFORM_PALETTE).svg]);
    }
  }
  const images = await Promise.all(jobs.map(async ([key, svg]) => [key, await loadImage(svg)] as const));
  return new Map(images);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

class MineScene extends Phaser.Scene {
  private options!: SceneOptions;
  private session!: MineSession;
  private images!: Map<string, HTMLImageElement>;
  private reduced = false;
  readonly fx: FxCounters = { dust: 0, sparks: 0, rocks: 0, alive: 0, maxAlive: 0, shakes: 0 };

  private viewH = H0;
  private bg!: Phaser.GameObjects.TileSprite;
  private bgNext?: Phaser.GameObjects.TileSprite;
  private bgZone = 0;
  private walls!: Phaser.GameObjects.TileSprite;
  private ceilingGfx!: Phaser.GameObjects.Graphics;
  private beam!: Phaser.GameObjects.TileSprite;
  private vignette!: Phaser.GameObjects.Image;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private mole!: Phaser.GameObjects.Image;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rocks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private pebbleTimer = 0;
  private lastLand = -1e9;
  private lastHurt = -1e9;
  private lastGraze = -1e9;
  private lastCrystal = -1e9;
  private lastBounce = -1e9;
  private loadedZones = new Set<number>([0]);

  constructor() {
    super("mine");
  }

  init(data: SceneOptions & { images: Map<string, HTMLImageElement> }) {
    this.options = data;
    this.session = data.session;
    this.images = data.images;
    this.reduced = data.reducedMotion;
    this.viewH = data.session.viewHeight * PPM;
  }

  create() {
    for (const [key, image] of this.images) if (!this.textures.exists(key)) this.textures.addImage(key, image);
    this.makeTextures();

    this.bg = this.add.tileSprite(0, 0, W, this.viewH, "bg-0").setOrigin(0, 0);
    this.walls = this.add.tileSprite(0, 0, W, this.viewH, "walls-0").setOrigin(0, 0);
    this.motes = this.add.particles(0, 0, "dot", {
      x: { min: 40, max: W - 40 },
      y: this.viewH + 10,
      lifespan: 6000,
      speedY: { min: -60, max: -25 },
      speedX: { min: -8, max: 8 },
      scale: { min: 0.15, max: 0.4 },
      alpha: { start: 0.6, end: 0 },
      frequency: 260,
      tint: 0xffc470,
      maxAliveParticles: 24,
    });
    if (this.reduced) this.motes.stop();

    this.mole = this.add.image(0, 0, "pose-idle").setOrigin(MOLE_ORIGIN.x, MOLE_ORIGIN.y).setDisplaySize((MOLE_DISPLAY_H * 136) / 180, MOLE_DISPLAY_H);
    this.mole.setDepth(5);

    const burst = (frame: string, tint: number | number[], extra: object, max: number) =>
      this.add.particles(0, 0, frame, { emitting: false, tint, maxAliveParticles: max, ...extra }).setDepth(6);
    this.dust = burst("dot", [0xe8d2b0, 0xb9803f], { lifespan: 420, speed: { min: 40, max: 140 }, angle: { min: 180, max: 360 }, gravityY: 200, scale: { start: 0.6, end: 0 }, alpha: { start: 0.9, end: 0 } }, 60);
    this.sparks = burst("dot", [0xffd23f, 0xffffff, 0x3fd6b0], { lifespan: 520, speed: { min: 80, max: 260 }, gravityY: 300, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 } }, 60);
    this.rocks = burst("chunk", [0x8a5a3c, 0x5e3a28, 0xb07a52], { lifespan: 900, speed: { min: 30, max: 120 }, angle: { min: 60, max: 120 }, gravityY: 900, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.6 }, alpha: { start: 1, end: 0.2 } }, 40);

    this.beam = this.add.tileSprite(0, 0, W, 64, "beam").setOrigin(0, 0).setDepth(8);
    this.ceilingGfx = this.add.graphics().setDepth(7);
    this.vignette = this.add.image(W / 2, this.viewH / 2, "vignette").setDisplaySize(W, this.viewH).setDepth(9).setAlpha(0);

    this.options.onReady();
    // 其他段的背景在背景載入（進入該段之前就會好）
    void this.preloadZones();
  }

  setReducedMotion(value: boolean) {
    this.reduced = value;
    // 圖片還在載入、create() 還沒跑時只記下偏好，create 會依它決定要不要放粒子
    if (!this.motes) return;
    if (value) this.motes.stop();
    else this.motes.start();
  }

  private async preloadZones() {
    for (let zone = 1; zone <= 4; zone++) {
      try {
        const [bg, walls] = await Promise.all([loadImage(backgroundSvg(zone)), loadImage(wallsSvg(zone))]);
        if (!this.sys?.isActive()) return;
        this.textures.addImage(`bg-${zone}`, bg);
        this.textures.addImage(`walls-${zone}`, walls);
        this.loadedZones.add(zone);
      } catch {
        // 沒載到就沿用上一段的背景
      }
    }
  }

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
    make("dot", 16, 16, (c) => {
      const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 16, 16);
    });
    make("chunk", 14, 14, (c) => {
      c.fillStyle = "#ffffff";
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(2, 4);
      c.lineTo(9, 1);
      c.lineTo(13, 7);
      c.lineTo(8, 13);
      c.lineTo(2, 10);
      c.closePath();
      c.fill();
      c.stroke();
    });
    make("vignette", 256, 256, (c) => {
      const g = c.createRadialGradient(128, 110, 70, 128, 128, 190);
      g.addColorStop(0, "rgba(232,69,44,0)");
      g.addColorStop(1, "rgba(232,69,44,0.85)");
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
    });
    // 警示梁：黃底黑斜紋，設計稿 390×40 → 780×64（上方 24 像素貼在畫面外）
    make("beam", 68, 64, (c) => {
      c.fillStyle = PLATFORM_PALETTE.hazard;
      c.fillRect(0, 0, 68, 64);
      c.fillStyle = INK;
      for (let x = -40; x < 80; x += 68) {
        c.beginPath();
        c.moveTo(x + 8, 0);
        c.lineTo(x + 40, 0);
        c.lineTo(x + 12, 64);
        c.lineTo(x - 20, 64);
        c.closePath();
        c.fill();
      }
      c.strokeStyle = INK;
      c.lineWidth = 7;
      c.strokeRect(-4, 3.5, 76, 57);
    });
  }

  // ---- 每一格 ----
  /** 遊戲框的長寬比改變（手機轉向、網址列收合）：畫布高度、背景、暈影跟著變 */
  private syncView() {
    const height = this.session.viewHeight * PPM;
    if (Math.abs(height - this.viewH) < 0.5) return;
    this.viewH = height;
    this.scale.setGameSize(W, height);
    this.bg.setSize(W, height);
    this.walls.setSize(W, height);
    this.bgNext?.setSize(W, height);
    this.vignette.setPosition(W / 2, height / 2).setDisplaySize(W, height);
    this.motes.setPosition(0, height - H0);
  }

  update(time: number, deltaMs: number) {
    this.syncView();
    const session = this.session;
    const events = session.update(deltaMs);
    if (events.length > 0) {
      for (const event of events) this.onEvent(event, time);
      this.options.onEvents(events);
    }
    const sim = session.sim;
    const p = sim.player;

    this.drawBackground(sim.scrolled, sim.zone);
    this.drawPlatforms(sim.platforms, time);
    this.drawMole(time);
    this.drawCeiling(sim.scrolled, time, deltaMs);
    this.options.onFrame();
    this.fx.alive = this.dust.getAliveParticleCount() + this.sparks.getAliveParticleCount() + this.rocks.getAliveParticleCount();
    this.fx.maxAlive = Math.max(this.fx.maxAlive, this.fx.alive);
    void p;
  }

  private drawBackground(scrolled: number, zone: number) {
    const key = `bg-${zone}`;
    if (zone !== this.bgZone && this.loadedZones.has(zone)) {
      this.bgZone = zone;
      this.walls.setTexture(`walls-${zone}`);
      if (this.reduced) this.bg.setTexture(key);
      else {
        this.bgNext?.destroy();
        const next = this.add.tileSprite(0, 0, W, this.viewH, key).setOrigin(0, 0).setAlpha(0).setDepth(0);
        this.bgNext = next;
        this.tweens.add({
          targets: next,
          alpha: 1,
          duration: 700,
          onComplete: () => {
            this.bg.setTexture(key);
            next.destroy();
            if (this.bgNext === next) this.bgNext = undefined;
          },
        });
      }
    }
    const y = scrolled * PPM;
    this.bg.tilePositionY = y * 0.3;
    if (this.bgNext) this.bgNext.tilePositionY = y * 0.3;
    this.walls.tilePositionY = y * 0.9;
  }

  private spriteFor(platform: Platform): Phaser.GameObjects.Image | null {
    let sprite = this.sprites.get(platform.id);
    const w = Math.round(platform.w * 10) / 10;
    const kind: Kind | "crystalSpent" = platform.kind === "crystal" && platform.spent ? "crystalSpent" : platform.kind;
    const key = platformKey(kind, w);
    if (!this.textures.exists(key)) return null;
    if (!sprite) {
      sprite = this.add.image(0, 0, key).setDepth(2);
      const height = platformHeight();
      sprite.setOrigin(0.5, (PLATFORM_TOP * 2) / height);
      this.sprites.set(platform.id, sprite);
    } else if (sprite.texture.key !== key) sprite.setTexture(key);
    return sprite;
  }

  private drawPlatforms(platforms: Platform[], time: number) {
    const seen = new Set<number>();
    for (const platform of platforms) {
      seen.add(platform.id);
      if (platform.y * PPM > this.viewH + 140 || platform.y * PPM < -140) {
        this.sprites.get(platform.id)?.setVisible(false);
        continue;
      }
      const sprite = this.spriteFor(platform);
      if (!sprite) continue;
      let x = platform.x * PPM;
      const y = platform.y * PPM;
      if (platform.state === "cracking") x += Math.sin(time / 18) * 2.5;
      sprite.setVisible(true).setPosition(x, y);
      if (platform.state === "falling") sprite.setAngle(platform.vy * 6).setAlpha(clamp(1 - platform.vy / 14, 0.2, 1));
      else sprite.setAngle(0).setAlpha(1);
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  private pose(time: number): Pose {
    const session = this.session;
    const phase = session.phase;
    const p = session.sim.player;
    if (phase === "ready") return "appear";
    if (phase === "dying" || phase === "over") return session.sim.over === "fall" ? "fall" : "dizzy";
    if (time - this.lastHurt < 500) return "hurt";
    if (time - this.lastGraze < 500) return "near";
    if (p.ground !== null) {
      if (time - this.lastCrystal < 600) return "crystal";
      if (time - this.lastLand < 160) return "land";
      return Math.abs(p.vx) > 0.6 ? "run" : "idle";
    }
    if (p.vy < -1 && time - this.lastBounce < 1200) return "bounce";
    if (p.vy > 1.5) return "fall";
    return p.vy < 0 ? "bounce" : "idle";
  }

  private drawMole(time: number) {
    const p = this.session.sim.player;
    const pose = this.pose(time);
    const key = `pose-${pose}`;
    if (this.mole.texture.key !== key) this.mole.setTexture(key);
    this.mole.setPosition(p.x * PPM, p.y * PPM + 3);
    this.mole.setFlipX(p.face === -1);
    // 無敵時閃爍（減少動態效果時不閃）
    const blink = p.invuln > 0 && !this.reduced && Math.floor(time / 70) % 2 === 0;
    this.mole.setAlpha(blink ? 0.45 : 1);
    this.mole.setVisible(!(this.session.phase === "over"));
    this.pause = pose;
  }
  /** 目前的姿勢（給測試讀取） */
  pause = "idle";

  private drawCeiling(scrolled: number, time: number, deltaMs: number) {
    const ceil = ceilingY(scrolled) * PPM;
    const g = this.ceilingGfx;
    g.clear();
    // 岩層：從警示梁下緣到崩塌線，下緣是鋸齒
    g.fillStyle(0x5e3a28, 1);
    g.lineStyle(7, 0x1a120c, 1);
    g.beginPath();
    g.moveTo(0, 56);
    g.lineTo(W, 56);
    g.lineTo(W, ceil - 14);
    const step = 52;
    for (let x = W; x >= 0; x -= step) {
      const down = (Math.floor(x / step) % 2 === 0 ? 22 : -6) + (Math.sin(x * 0.07) > 0 ? 6 : 0);
      g.lineTo(x, ceil + down);
    }
    g.lineTo(0, ceil - 14);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // 岩層上的裂痕
    g.lineStyle(4, 0x1a120c, 0.8);
    for (const x of [90, 250, 420, 610]) {
      g.beginPath();
      g.moveTo(x, 64);
      g.lineTo(x + 12, 64 + (ceil - 70) * 0.5);
      g.lineTo(x - 6, ceil - 6);
      g.strokePath();
    }

    // 靠近時：四周泛紅、落碎石（減少動態效果時只留文字，不閃不晃）
    const p = this.session.sim.player;
    const headroom = p.y - PLAYER.height - ceilingY(scrolled);
    const danger = this.session.phase === "playing" ? clamp(1 - headroom / 2.5, 0, 1) : 0;
    this.vignette.setAlpha(this.reduced ? 0 : danger * 0.8);
    if (!this.reduced && danger > 0.15) {
      this.pebbleTimer -= deltaMs;
      if (this.pebbleTimer <= 0 && this.fx.alive < FX.maxParticles) {
        this.pebbleTimer = 380 - danger * 260;
        this.rocks.emitParticleAt(40 + Math.random() * (W - 80), ceil + 12, 1);
        this.fx.rocks++;
      }
    }
    void time;
  }

  // ---- 特效 ----
  private burst(emitter: Phaser.GameObjects.Particles.ParticleEmitter, x: number, y: number, count: number, counter: "dust" | "sparks" | "rocks") {
    if (this.reduced) return;
    const room = Math.max(0, FX.maxParticles - this.fx.alive);
    const amount = Math.min(count, room);
    if (amount <= 0) return;
    emitter.explode(amount, x, y);
    this.fx[counter] += amount;
  }

  private onEvent(event: SimEvent, time: number) {
    switch (event.type) {
      case "land":
        this.lastLand = time;
        this.burst(this.dust, event.x * PPM, event.y * PPM, FX.dustPerLand, "dust");
        break;
      case "hurt":
        this.lastHurt = time;
        this.burst(this.sparks, event.x * PPM, (event.y - 0.4) * PPM, 8, "sparks");
        if (!this.reduced) {
          this.cameras.main.shake(260, 0.012);
          this.cameras.main.flash(180, 232, 69, 44);
          this.fx.shakes++;
        }
        break;
      case "bounce":
        this.lastBounce = time;
        this.burst(this.dust, event.x * PPM, event.y * PPM, 8, "dust");
        break;
      case "crystal":
        this.lastCrystal = time;
        this.burst(this.sparks, event.x * PPM, (event.y - 0.5) * PPM, 12, "sparks");
        break;
      case "graze":
        this.lastGraze = time;
        this.burst(this.sparks, event.x * PPM, (event.y - 0.5) * PPM, 10, "sparks");
        break;
      case "crack":
        this.burst(this.rocks, event.x * PPM, event.y * PPM, 6, "rocks");
        break;
      case "zone":
        if (!this.reduced) this.cameras.main.flash(300, 255, 243, 208);
        break;
      case "over":
        if (!this.reduced) {
          this.cameras.main.shake(400, 0.02);
          this.fx.shakes++;
        }
        break;
      default:
        break;
    }
  }
}

function platformHeight() {
  return (PLATFORM_TOP + PLATFORM_H + PLATFORM_BOTTOM) * 2;
}

/** 建立遊戲畫面。回傳的 handle 用來銷毀或調整；圖片轉好之前什麼都不會畫。 */
export function createScene(options: SceneOptions): SceneHandle {
  const scene = new MineScene();
  let game: Phaser.Game | null = null;
  let destroyed = false;
  let reduced = options.reducedMotion;
  void prepare()
    .then((images) => {
      if (destroyed) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: options.parent,
        width: W,
        height: options.session.viewHeight * PPM,
        backgroundColor: "#1c1410",
        banner: false,
        audio: { noAudio: true },
        // 輸入一律由外層的 DOM 事件處理（按住畫面、鍵盤），Phaser 不接收
        input: { keyboard: false, mouse: false, touch: false, gamepad: false },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER, expandParent: false },
        render: { antialias: true },
        scene: [],
      });
      game.scene.add("mine", scene, true, { ...options, reducedMotion: reduced, images });
    })
    .catch((error: unknown) => {
      if (!destroyed) options.onError(error instanceof Error ? error : new Error(String(error)));
    });
  void ART_PPM;
  return {
    destroy: () => {
      destroyed = true;
      game?.destroy(true);
    },
    refresh: () => game?.scale.refresh(),
    setReducedMotion: (value) => {
      reduced = value;
      scene.setReducedMotion(value);
    },
    fx: scene.fx,
  };
}
