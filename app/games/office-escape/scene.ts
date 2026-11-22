import * as THREE from "three";
import { LANE_WIDTH_M, FX } from "@/lib/games/office-escape/config";
import { DOOR_STEP_SECONDS, JUMPABLE, LAYOUT, gazeLane, openDoorLane, type Obstacle } from "@/lib/games/office-escape/route";
import type { GameSession } from "@/lib/games/office-escape/session";
import type { SimEvent } from "@/lib/games/office-escape/sim";
import { ACTIONS as ACTION_TABLE, apply, buildChar, part } from "./characters";

type Pose = Record<string, number>;
/** 角色庫（characters.ts）沒有型別，這裡補上場景用到的欄位 */
type Char = ReturnType<typeof buildChar> & { baseX: number; baseYaw: number };
const make = (type: string) => buildChar(type) as Char;
const ACTIONS = ACTION_TABLE as unknown as Record<string, { still: number; fn: (t: number) => Pose }>;

/**
 * 下班逃離辦公室的 3D 場景（three.js）。地板與牆面是程式畫的貼圖，往前捲動；
 * 障礙、同事、主管、電梯門都是 3D 物件，進入視野才建立、離開就釋放。
 * 世界座標：z 是往前的公尺數，x = -線的位置 × 線寬（鏡頭在後面往前看，右邊是 +線）。
 * 碰撞與計分都在 lib/games/office-escape（純邏輯），這裡只負責畫出來。
 */
export type SceneHandle = {
  destroy(): void;
  refresh(): void;
  /** 模擬事件（撞到東西、撿道具、完成），讓場景做出反應 */
  onSimEvent(event: SimEvent): void;
  /** 目前同時存在的粒子數（測試用：確認不超過上限） */
  readonly particles: number;
};

export type SceneOptions = {
  parent: HTMLElement;
  session: GameSession;
  reducedMotion: boolean;
  onReady(): void;
  onError(): void;
};

const BASE = "/games/office-escape/0.1.0/";
/** 各段的背景圖（Codex 生成，同一套透視；H4） */
const BACKDROPS = ["bg-office.webp", "bg-corridor.webp", "bg-elevator.webp", "bg-lobby.webp"] as const;
const THEMES = [
  { floor: "#5f6b7d", line: "#e6edf7", wall: "#e8e2d6", accent: "#9fb4c9", fog: 0xcfd8e3 },
  { floor: "#7b7f89", line: "#f1ece0", wall: "#d9d2c4", accent: "#b88f66", fog: 0xd8d3c9 },
  { floor: "#b3ada0", line: "#ffffff", wall: "#bcc3cc", accent: "#7f8a96", fog: 0xd0d4d9 },
  { floor: "#cbc6bb", line: "#6f7d8f", wall: "#a9cadb", accent: "#5c8aa5", fog: 0xd8e6ee },
] as const;

const TILE = 16;
const wx = (lane: number) => -lane * LANE_WIDTH_M;

function floorTexture(theme: (typeof THEMES)[number]) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext("2d")!;
  g.fillStyle = theme.floor;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) g.fillRect(i * 64, j * 64, 64, 64);
  // 三條線的分隔線：地板寬 12 公尺，貼圖橫向對應 12 公尺
  g.strokeStyle = theme.line;
  g.lineWidth = 6;
  g.setLineDash([36, 28]);
  for (const boundary of [-0.7, 0.7]) {
    const x = ((boundary * LANE_WIDTH_M + 6) / 12) * 512;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wallTexture(index: number, theme: (typeof THEMES)[number]) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext("2d")!;
  g.fillStyle = theme.wall;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = theme.accent;
  g.fillRect(0, 196, 512, 60);
  g.fillStyle = "rgba(20,24,32,0.12)";
  for (let i = 0; i < 4; i++) {
    const x = i * 128 + 16;
    if (index === 0) {
      // 座位區：隔板與螢幕
      g.fillRect(x, 70, 96, 126);
      g.fillStyle = "#273244";
      g.fillRect(x + 14, 92, 68, 44);
      g.fillStyle = "rgba(20,24,32,0.12)";
    } else if (index === 1) {
      // 走廊：門
      g.fillStyle = "#8c6a4b";
      g.fillRect(x + 8, 40, 80, 156);
      g.fillStyle = "#f2d37a";
      g.fillRect(x + 72, 120, 8, 12);
      g.fillStyle = "rgba(20,24,32,0.12)";
    } else if (index === 2) {
      // 電梯廳：不鏽鋼面板
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(x, 30, 100, 166);
      g.fillStyle = "rgba(20,24,32,0.12)";
    } else {
      // 大廳：玻璃帷幕
      g.fillStyle = "rgba(255,255,255,0.4)";
      g.fillRect(x, 24, 108, 172);
      g.fillStyle = "rgba(20,24,32,0.2)";
      g.fillRect(x + 104, 24, 6, 172);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function dispose(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) for (const item of material) item.dispose();
    else material?.dispose();
  });
}

type Actor = {
  id: string;
  root: THREE.Object3D;
  extra?: THREE.Object3D;
  char?: Char;
  action?: string;
  t: number;
  update?(time: number, now: number): void;
  hitAt?: number;
};

export function createScene(options: SceneOptions): SceneHandle {
  const { parent, session, reducedMotion } = options;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (error) {
    console.error(error);
    options.onError();
    return { destroy() {}, refresh() {}, onSimEvent() {}, particles: 0 };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  parent.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 3 / 4, 0.1, 140);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7f74, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(3, 8, -2);
  scene.add(sun);
  scene.fog = new THREE.Fog(THEMES[0].fog, 28, 75);
  scene.background = new THREE.Color(THEMES[0].fog);

  // ---- 地板、牆面、背景圖 ----
  const floorTex = THEMES.map(floorTexture);
  const wallTex = THEMES.map((theme, index) => wallTexture(index, theme));
  const floorMat = new THREE.MeshLambertMaterial({ map: floorTex[0] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 160), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex[0], side: THREE.DoubleSide });
  const walls = [-1, 1].map((side) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(160, 5), wallMat);
    wall.rotation.y = (side * Math.PI) / 2;
    wall.position.set(side * 6, 2.5, 0);
    scene.add(wall);
    return wall;
  });
  const backdropMat = new THREE.MeshBasicMaterial({ transparent: true, fog: false });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(26, 34.7), backdropMat);
  scene.add(backdrop);
  const loader = new THREE.TextureLoader();
  const backdrops: (THREE.Texture | null)[] = [null, null, null, null];
  let failed = false;
  const loadBackdrop = (index: number) =>
    new Promise<void>((resolve) => {
      loader.load(
        BASE + BACKDROPS[index],
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          backdrops[index] = texture;
          resolve();
        },
        undefined,
        () => {
          failed = true;
          resolve();
        },
      );
    });

  // ---- 角色與物件 ----
  const actors = new Map<string, Actor>();
  const disposed = { value: false };
  const runner = make("runner");
  runner.baseX = 0;
  runner.baseYaw = 0;
  scene.add(runner.root, runner.shadow);
  let runnerAction = "ready";
  let runnerT = 0;
  let lastX = 0;

  function box(w: number, h: number, d: number, color: number) {
    const mesh = part(new THREE.BoxGeometry(w, h, d), color, { box: 1.04 });
    return mesh as THREE.Mesh;
  }

  function makeObstacle(o: Obstacle): Actor {
    const x = wx(o.lane);
    const id = `o${o.id}`;
    const root = new THREE.Group();
    root.position.set(x, 0, o.z);
    scene.add(root);
    const base: Actor = { id, root, t: o.id * 0.37 };
    if (o.kind === "box") {
      const crate = box(1, 0.8, 0.9, 0xc99a5b);
      crate.position.y = 0.4;
      root.add(crate);
      if (o.variant) {
        const top = box(0.7, 0.5, 0.7, 0xb98848);
        top.position.y = 1.05;
        root.add(top);
      }
    } else if (o.kind === "chair") {
      const seat = box(0.8, 0.12, 0.8, 0x2f3b4d);
      seat.position.y = 0.5;
      const back = box(0.8, 0.8, 0.12, 0x2f3b4d);
      back.position.set(0, 0.95, 0.35);
      const pole = box(0.12, 0.5, 0.12, 0x8a93a3);
      pole.position.y = 0.25;
      root.add(seat, back, pole);
      root.rotation.y = o.variant ? 0.6 : -0.4;
    } else if (o.kind === "copier") {
      const body = box(1.15, 1.1, 0.9, 0xdfe3e8);
      body.position.y = 0.55;
      const lid = box(1.15, 0.12, 0.95, 0x6f7d8f);
      lid.position.y = 1.16;
      root.add(body, lid);
    } else {
      const type = o.kind === "chatter" ? (o.variant ? "coworkerB" : "coworkerA") : o.kind === "cart" ? "cleaner" : "commuter";
      const char = make(type);
      char.baseX = x;
      char.baseYaw = Math.PI;
      scene.add(char.root, char.shadow);
      // 角色自己有根節點；這個 actor 的 root 只當資料用
      scene.remove(root);
      base.root = char.root;
      base.extra = char.shadow;
      base.char = char;
      base.action = o.kind === "chatter" ? "chat" : o.kind === "cart" ? "push" : "phone";
      char.root.position.z = o.z;
    }
    return base;
  }

  function makeGaze(zone: (typeof LAYOUT.gazes)[number]): Actor {
    const root = new THREE.Group();
    root.position.set(0, 0, zone.z);
    scene.add(root);
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_WIDTH_M * 0.92, zone.length),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.38, depthWrite: false }),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.03, zone.length / 2);
    root.add(lane);
    const boss = make("boss");
    boss.baseX = -4.2;
    boss.baseYaw = -Math.PI / 2 + 0.3;
    boss.root.position.z = zone.z + zone.length / 2;
    scene.add(boss.root, boss.shadow);
    const actor: Actor = { id: `g${zone.id}`, root, extra: boss.root, char: boss, action: "patrol", t: 0 };
    actor.update = (_time, _now) => {
      const clock = session.sim.clockSeconds;
      const l = gazeLane(zone, clock);
      lane.position.x = wx(l);
      boss.baseYaw = Math.atan2(wx(l) - boss.baseX, 4) + (reducedMotion ? 0 : 0);
    };
    return actor;
  }

  function makeDoors(door: (typeof LAYOUT.doors)[number]): Actor {
    const root = new THREE.Group();
    root.position.set(0, 0, door.z);
    scene.add(root);
    const frame = box(LANE_WIDTH_M * 3 + 0.4, 2.8, 0.3, 0x8a93a3);
    frame.position.y = 1.4;
    root.add(frame);
    const panels = [-1, 0, 1].map((lane) => {
      const panel = box(LANE_WIDTH_M * 0.9, 2.3, 0.2, 0xb8c0cb);
      panel.position.set(wx(lane), 1.2, -0.2);
      root.add(panel);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4d3d }));
      light.position.set(wx(lane), 2.6, -0.2);
      root.add(light);
      return { lane, panel, light };
    });
    const actor: Actor = { id: `d${door.id}`, root, t: 0 };
    actor.update = () => {
      const open = openDoorLane(door, session.sim.clockSeconds);
      for (const item of panels) {
        const isOpen = item.lane === open;
        item.panel.scale.x = isOpen ? 0.12 : 1;
        item.panel.position.x = wx(item.lane) + (isOpen ? LANE_WIDTH_M * 0.38 : 0);
        (item.light.material as THREE.MeshBasicMaterial).color.setHex(isOpen ? 0x3ddc84 : 0xff4d3d);
      }
    };
    return actor;
  }

  function makeItem(item: { id: number; z: number; lane: number; kind: string }): Actor {
    const root = new THREE.Group();
    root.position.set(wx(item.lane), 0.9, item.z);
    scene.add(root);
    if (item.kind === "coffee") {
      const cup = part(new THREE.CylinderGeometry(0.22, 0.17, 0.36, 14), 0xffffff) as THREE.Mesh;
      const lid = part(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 14), 0x7a4a2a) as THREE.Mesh;
      lid.position.y = 0.22;
      root.add(cup, lid);
    } else if (item.kind === "headphones") {
      const band = part(new THREE.TorusGeometry(0.26, 0.05, 8, 20, Math.PI), 0x2f3b4d) as THREE.Mesh;
      const l = part(new THREE.SphereGeometry(0.12, 10, 8), 0xe8762d) as THREE.Mesh;
      const r = part(new THREE.SphereGeometry(0.12, 10, 8), 0xe8762d) as THREE.Mesh;
      l.position.set(-0.26, 0, 0);
      r.position.set(0.26, 0, 0);
      root.add(band, l, r);
    } else {
      const moon = part(new THREE.SphereGeometry(0.27, 14, 12), 0x6a4fd0) as THREE.Mesh;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      root.add(moon, ring);
    }
    // 光圈：讓玩家在遠處也看得到
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.86;
    root.add(glow);
    const actor: Actor = { id: `i${item.id}`, root, t: item.id };
    actor.update = (time) => {
      root.rotation.y = reducedMotion ? 0.4 : time * 2;
      root.position.y = 0.9 + (reducedMotion ? 0 : Math.sin(time * 3) * 0.08);
    };
    return actor;
  }

  function makeFinish(): Actor {
    const root = new THREE.Group();
    const z = LAYOUT.total;
    root.position.set(0, 0, z);
    scene.add(root);
    const frame = box(LANE_WIDTH_M * 3 + 1.2, 3.4, 0.5, 0x4a5568);
    frame.position.set(0, 1.7, 0.3);
    root.add(frame);
    const hole = box(LANE_WIDTH_M * 3 + 0.6, 3, 0.6, 0xaed7ee);
    hole.position.set(0, 1.5, 0);
    (hole.material as THREE.MeshToonMaterial).transparent = true;
    (hole.material as THREE.MeshToonMaterial).opacity = 0.35;
    root.add(hole);
    const rotor = new THREE.Group();
    rotor.position.set(0, 1.4, 0.1);
    for (let i = 0; i < 4; i++) {
      const blade = box(0.08, 2.6, 1.7, 0xd7eef8);
      blade.rotation.y = (i * Math.PI) / 2;
      (blade.material as THREE.MeshToonMaterial).transparent = true;
      (blade.material as THREE.MeshToonMaterial).opacity = 0.7;
      rotor.add(blade);
    }
    root.add(rotor);
    // 大門外面：亮亮的街口
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), new THREE.MeshBasicMaterial({ color: 0xfff1cf, fog: false }));
    outside.position.set(0, 4, 8);
    outside.rotation.y = Math.PI;
    root.add(outside);
    const actor: Actor = { id: "finish", root, t: 0 };
    actor.update = (time) => {
      rotor.rotation.y = reducedMotion ? 0.3 : time * 2.4;
    };
    return actor;
  }

  const spots: Actor[] = [];
  const makeSpot = (z: number, side: number, type: string): Actor => {
    const char = make(type);
    char.baseX = side * 4.4;
    char.baseYaw = side > 0 ? Math.PI / 2 + 0.4 : -Math.PI / 2 - 0.4;
    char.root.position.z = z;
    scene.add(char.root, char.shadow);
    return { id: `s${z}`, root: char.root, extra: char.shadow, char, action: "chat", t: z };
  };

  /** 現在鏡頭附近該有哪些物件：進入範圍才建立 */
  function sync(z: number) {
    const near = (objectZ: number) => objectZ > z - 12 && objectZ < z + 70;
    const want = new Set<string>();
    for (const o of LAYOUT.obstacles) {
      const id = `o${o.id}`;
      if (!near(o.z)) continue;
      want.add(id);
      if (!actors.has(id)) actors.set(id, makeObstacle(o));
    }
    for (const gaze of LAYOUT.gazes) {
      const id = `g${gaze.id}`;
      if (!near(gaze.z + gaze.length / 2)) continue;
      want.add(id);
      if (!actors.has(id)) actors.set(id, makeGaze(gaze));
    }
    for (const door of LAYOUT.doors) {
      const id = `d${door.id}`;
      if (!near(door.z)) continue;
      want.add(id);
      if (!actors.has(id)) actors.set(id, makeDoors(door));
    }
    for (const item of session.run.items) {
      const id = `i${item.id}`;
      if (!near(item.z) || hidden.has(id)) continue;
      want.add(id);
      if (!actors.has(id)) actors.set(id, makeItem(item));
    }
    for (const spot of LAYOUT.events) {
      const id = `s${spot.z}`;
      if (!near(spot.z)) continue;
      want.add(id);
      if (!actors.has(id)) actors.set(id, makeSpot(spot.z + 4, spot.segment === 0 ? 1 : -1, spot.segment === 0 ? "coworkerA" : "commuter"));
    }
    if (near(LAYOUT.total)) {
      want.add("finish");
      if (!actors.has("finish")) actors.set("finish", makeFinish());
    }
    for (const [id, actor] of actors) {
      if (want.has(id)) continue;
      scene.remove(actor.root);
      if (actor.extra) scene.remove(actor.extra);
      dispose(actor.root);
      if (actor.char) scene.remove(actor.char.shadow);
      actors.delete(id);
    }
  }

  const hidden = new Set<string>();
  void spots;

  // ---- 粒子（衝出大門的彩帶），同時最多 FX.maxParticles 個 ----
  let confetti: THREE.Points | null = null;
  let confettiVel: Float32Array | null = null;
  let particleCount = 0;
  function burst(z: number) {
    if (reducedMotion || confetti) return;
    const count = FX.maxParticles;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    confettiVel = new Float32Array(count * 3);
    const palette = [0xe8762d, 0xffc83d, 0x4fd69c, 0x8fb0ff, 0xff8a57].map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      positions.set([0, 1.5, z], i * 3);
      confettiVel.set([(Math.random() - 0.5) * 4, 4 + Math.random() * 3, (Math.random() - 0.3) * 3], i * 3);
      const c = palette[i % palette.length];
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    confetti = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, fog: false }));
    particleCount = count;
    scene.add(confetti);
  }

  // ---- 每一格更新 ----
  let theme = -1;
  let pausedDrawn = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let finishAt = -1;
  let caughtAt = -1;
  let bossCatch: Char | null = null;

  function applyTheme(segment: number) {
    if (theme === segment) return;
    theme = segment;
    floorMat.map = floorTex[segment];
    wallMat.map = wallTex[segment];
    floorMat.needsUpdate = true;
    wallMat.needsUpdate = true;
    (scene.fog as THREE.Fog).color.setHex(THEMES[segment].fog);
    (scene.background as THREE.Color).setHex(THEMES[segment].fog);
    backdropMat.map = backdrops[segment];
    backdropMat.needsUpdate = true;
    backdrop.visible = backdrops[segment] !== null;
  }

  const poseOf = (action: string, t: number) => {
    const a = ACTIONS[action] ?? ACTIONS.run;
    return a.fn(reducedMotion ? a.still * 2 : t);
  };

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!session.getSnapshot().paused) time += dt;
    // 遊戲時間由場景的畫面更新推動（和精準停車一樣）；暫停、段落介紹、結算時 session 自己不前進
    session.update(dt);
    const sim = session.sim;
    const snap = session.getSnapshot();
    // 結算畫面完全蓋住場景、暫停時畫面不動：不用一直繪製（省電，也不拖慢頁面其他工作）
    if (snap.phase === "final") return;
    if (snap.paused) {
      if (pausedDrawn) return;
      pausedDrawn = true;
    } else pausedDrawn = false;
    const segment = Math.min(sim.segment, 3);
    applyTheme(segment);

    const finishing = snap.phase === "finishing";
    const caught = sim.caught;
    // 衝出大門後主角繼續跑出門外、轉身歡呼；被攔下時主管出現在前面
    let z = sim.z;
    let x = wx(sim.x);
    if (finishing) {
      if (finishAt < 0) finishAt = time;
      const k = Math.min(1, (time - finishAt) / 0.9);
      z = LAYOUT.total + 1.5 + 2.2 * k;
      x = 0;
    }
    sync(z);

    // 地板與牆面跟著跑：每 TILE 公尺才移一次，貼圖重複所以看不出接縫
    const snapZ = Math.floor(z / TILE) * TILE;
    floor.position.set(0, 0, snapZ + 60);
    for (const wall of walls) wall.position.z = snapZ + 60;
    floorTex.forEach((tex) => {
      tex.repeat.set(1, 160 / 8);
    });
    wallTex.forEach((tex) => tex.repeat.set(160 / 16, 1));
    backdrop.position.set(0, 12, z + 66);
    backdrop.rotation.y = Math.PI;

    // 主角
    const vx = dt > 0 ? (x - lastX) / dt : 0;
    lastX = x;
    let action = "run";
    if (snap.phase === "briefing") action = "ready";
    else if (finishing) action = "cheer";
    else if (caught) action = "held";
    else if (sim.stun?.kind === "held") action = "held";
    else if (sim.stun?.kind === "trip") action = "trip";
    else if (sim.stun) action = "ready";
    else if (sim.jumpTick > 0) action = "jump";
    if (action !== runnerAction) {
      runnerAction = action;
      runnerT = 0;
    }
    runnerT += snap.paused ? 0 : dt * (snap.coffee ? 1.4 : 1);
    let pose;
    if (action === "jump") {
      // 跳躍進度對應動作表裡「滯空」的那一段（0.5 秒）
      pose = ACTIONS.jump.fn((0.16 + sim.jumpProgress * 0.5) * 1.3);
    } else if (action === "run") {
      pose = poseOf("run", runnerT);
      pose.roll = Math.max(-0.3, Math.min(0.3, -vx * 0.045));
    } else pose = poseOf(action, runnerT);
    runner.baseX = x;
    apply(runner, pose);
    runner.root.position.z = z;
    runner.shadow.position.z += z;

    // 其他物件
    for (const actor of actors.values()) {
      actor.t += snap.paused ? 0 : dt;
      actor.update?.(actor.t, now);
      if (actor.char && actor.action) {
        const p = poseOf(actor.hitAt !== undefined ? "grab" : actor.action, actor.t);
        apply(actor.char, p);
        const refZ = actor.char === undefined ? 0 : actor.root.position.z;
        actor.char.shadow.position.z += refZ;
        if (actor.id.startsWith("g")) {
          const gaze = LAYOUT.gazes.find((g) => `g${g.id}` === actor.id)!;
          actor.char.root.position.z = gaze.z + gaze.length / 2 + Math.sin(actor.t * 0.7) * 2.5;
        }
      }
    }
    if (caught) {
      if (caughtAt < 0) {
        caughtAt = time;
        const catcher = make("boss");
        catcher.baseX = x;
        catcher.baseYaw = Math.PI;
        scene.add(catcher.root, catcher.shadow);
        bossCatch = catcher;
      }
      if (bossCatch) {
        const k = Math.min(1, (time - caughtAt) / 0.4);
        bossCatch.root.position.z = z + 5 - 2.6 * k;
        apply(bossCatch, poseOf("call", time));
        bossCatch.shadow.position.z += bossCatch.root.position.z;
      }
    }

    // 彩帶
    if (finishing && z > LAYOUT.total + 2.5) burst(LAYOUT.total + 3);
    if (confetti && confettiVel) {
      const pos = confetti.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        confettiVel[i * 3 + 1] -= 9 * dt;
        pos.setXYZ(i, pos.getX(i) + confettiVel[i * 3] * dt, Math.max(0, pos.getY(i) + confettiVel[i * 3 + 1] * dt), pos.getZ(i) + confettiVel[i * 3 + 2] * dt);
      }
      pos.needsUpdate = true;
    }

    // 鏡頭：在主角後上方，一點點跟著左右移動；衝出大門時拉近
    const zoom = finishing && !reducedMotion ? Math.min(1, (time - finishAt) / 1.2) : 0;
    const back = 7.4 - 3.4 * zoom;
    const height = 4.3 - 2 * zoom;
    camera.position.set(x * (reducedMotion ? 0 : 0.45), height, z - back);
    camera.lookAt(x * (reducedMotion ? 0 : 0.2), 1 + 0.4 * zoom, z + 9 - 5 * zoom);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = parent.clientWidth || 1;
    const h = parent.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 比較寬的視窗要把鏡頭視角收窄，不然三條線會變得太小
    camera.fov = w / h > 0.9 ? 46 : 55;
    camera.updateProjectionMatrix();
  }
  resize();

  void (async () => {
    await Promise.all([0, 1, 2, 3].map(loadBackdrop));
    if (disposed.value) return;
    if (failed) options.onError();
    else {
      applyTheme(Math.min(session.sim.segment, 3));
      raf = requestAnimationFrame(frame);
      options.onReady();
    }
  })();

  function onSimEvent(event: SimEvent) {
    if (event.type === "hit" || event.type === "pickup") {
      const id = event.type === "hit" ? `o${event.id}` : `i${event.id}`;
      if (event.type === "pickup") {
        hidden.add(id);
        const actor = actors.get(id);
        if (actor) {
          scene.remove(actor.root);
          dispose(actor.root);
          actors.delete(id);
        }
      } else {
        const actor = actors.get(id);
        if (actor) {
          actor.hitAt = time;
          if (!actor.char) actor.root.scale.y = 0.35;
        }
      }
    }
  }

  return {
    destroy() {
      disposed.value = true;
      cancelAnimationFrame(raf);
      for (const actor of actors.values()) {
        scene.remove(actor.root);
        dispose(actor.root);
      }
      actors.clear();
      dispose(scene);
      for (const tex of [...floorTex, ...wallTex]) tex.dispose();
      for (const tex of backdrops) tex?.dispose();
      renderer.dispose();
      // 馬上釋放 WebGL context，重複進出遊戲不會累積（H7）
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
    refresh: resize,
    onSimEvent,
    get particles() {
      return particleCount;
    },
  };
}

export { JUMPABLE, DOOR_STEP_SECONDS };
