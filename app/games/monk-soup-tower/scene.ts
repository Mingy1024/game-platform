import * as THREE from "three";
import { drawCamera, walkCamera, type CameraPose } from "@/lib/games/monk-soup-tower/camera";
import { CAMERA, DECAL, ENDING, FX, QUALITY, TEMP, TOWER } from "@/lib/games/monk-soup-tower/config";
import { groundAt, type Layout, type Vec2 } from "@/lib/games/monk-soup-tower/layouts";
import { sampleAt, type Path } from "@/lib/games/monk-soup-tower/path";
import type { MonkSession, SessionEvent } from "@/lib/games/monk-soup-tower/session";
import { monkPose } from "@/lib/games/monk-soup-tower/sim";
import { SKY, buildMonk, buildTower, disposeTree, goalRing, puddleMesh, soupDecal, type MonkModel, type TowerModel } from "./tower-model";

/**
 * 和尚端湯上塔的 3D 場景（three.js）。場景是遊戲的時鐘：每一格呼叫 session.update，
 * 再依 session 的狀態擺和尚、鏡頭、路線、湯漬。判定都在 lib/games/monk-soup-tower（純邏輯），這裡只負責畫出來。
 *
 * 鏡頭（F4、F5、G1、G5）：
 * - 畫線（draw、ready）：塔外右前方高處往下看（翻轉的版型從左前方）
 * - 按住走（walk）：0.4 秒滑到和尚肩後，之後跟著走
 * - 開始一層（intro）：從下一層繞塔螺旋上升 1.6 秒
 * - 送達塔頂（summit）：拉到塔外，鐘晃、塔剎發光
 * 減少動態效果時鏡頭直接切換、沒有湯滴與慢動作（G6），湯面照樣晃（是遊戲資訊）。
 */
export type SceneStats = {
  calls: number;
  triangles: number;
  shadows: boolean;
  pixelRatio: number;
  drops: number;
  maxDrops: number;
  decals: number;
};

export type SceneHandle = {
  destroy(): void;
  refresh(): void;
  /** 畫面上的一點（client 座標）對應到這一層地面的哪裡；在地面外回傳 null */
  pick(clientX: number, clientY: number): Vec2 | null;
  /** 畫線中的預覽（還沒放開）與筆尖位置 */
  setDraft(points: Vec2[] | null, tip: Vec2 | null): void;
  setReducedMotion(reduced: boolean): void;
  /** 這一層地面上的一點在畫面上的位置（client 座標）；自動測試用來畫線 */
  project(point: Vec2): { x: number; y: number };
  readonly stats: SceneStats;
};

export type SceneOptions = {
  parent: HTMLElement;
  session: () => MonkSession;
  reducedMotion: boolean;
  onEvents(events: SessionEvent[]): void;
  onFrame(): void;
  onReady(): void;
  onError(): void;
};

const INK = 0xe8401f;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

type Drop = { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number };
type Decal = { group: THREE.Group; steamMat: THREE.MeshBasicMaterial; born: number };

export function createScene(options: SceneOptions): SceneHandle {
  const { parent } = options;
  let reduced = options.reducedMotion;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (error) {
    console.error(error);
    options.onError();
    return {
      destroy() {},
      refresh() {},
      pick: () => null,
      setDraft() {},
      setReducedMotion() {},
      project: () => ({ x: 0, y: 0 }),
      stats: { calls: 0, triangles: 0, shadows: false, pixelRatio: 1, drops: 0, maxDrops: 0, decals: 0 },
    };
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, QUALITY.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
  renderer.domElement.setAttribute("aria-hidden", "true");
  parent.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.FogExp2(SKY, 0.028);
  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xf3f7ef, 0x6d7d62, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 80 });
  sun.position.set(-5.5, 16, 10);
  sun.target.position.set(1.5, 0, 1);
  scene.add(sun, sun.target);

  const monk: MonkModel = buildMonk(true);
  scene.add(monk.group);

  // ---- 這一層：塔、水窪、湯漬、金色圓圈 ----
  let tower: TowerModel | null = null;
  let floorGroup: THREE.Group | null = null;
  let builtFor: { tower: unknown; index: number } | null = null;
  let decals: Decal[] = [];
  let decalCount = 0;
  let layout: Layout;
  let clock = 0;

  function buildFloor(session: MonkSession) {
    if (tower) {
      scene.remove(tower.group);
      disposeTree(tower.group);
    }
    if (floorGroup) {
      scene.remove(floorGroup);
      disposeTree(floorGroup);
    }
    layout = session.layout;
    tower = buildTower(layout, session.floor, renderer.shadowMap.enabled);
    scene.add(tower.group);
    floorGroup = new THREE.Group();
    for (const p of layout.puddles) floorGroup.add(puddleMesh(layout, p));
    floorGroup.add(goalRing(layout));
    scene.add(floorGroup);
    decals = [];
    decalCount = 0;
    builtFor = { tower: session.tower, index: session.index };
    clearRibbons();
    pathBuilt = null;
    const sign = layout.flipped ? -1 : 1;
    sun.position.set(-5.5 * sign, 16, 10);
    sun.target.position.set(1.5 * sign, 0, 1);
  }

  // ---- 路線：朱紅毛筆筆觸，起筆略粗、收筆漸細；走過的部分變淡（F12） ----
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, fog: false, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
  const inkDone = new THREE.MeshBasicMaterial({ color: INK, fog: false, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8, fog: false, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const ribbons: THREE.Mesh[] = [];
  let pathBuilt: Path | null = null;
  let doneAt = -1;

  function clearRibbons() {
    for (const mesh of ribbons) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    ribbons.length = 0;
  }

  /** 沿著點列做一條帶狀網格。width 是半寬；taper 決定起筆與收筆的粗細 */
  function ribbon(points: { x: number; z: number; y: number; t: number }[], width: number, mat: THREE.Material, order: number) {
    if (points.length < 2) return;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const a = points[Math.max(0, i - 1)]!;
      const b = points[Math.min(points.length - 1, i + 1)]!;
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;
      const taper = Math.min(1, p.t / 0.04) * Math.min(1, Math.max(0.15, (1 - p.t) / 0.12));
      const w = width * (0.55 + 0.45 * taper) * (1 + 0.12 * Math.sin(p.t * 47));
      pos.push(p.x - tz * w, p.y, p.z + tx * w, p.x + tz * w, p.y, p.z - tx * w);
      if (i < points.length - 1) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geometry.setIndex(idx);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.renderOrder = order;
    scene.add(mesh);
    ribbons.push(mesh);
  }

  function pathPoints(path: Path, from: number, to: number) {
    const out: { x: number; z: number; y: number; t: number }[] = [];
    const step = 0.06;
    const n = Math.max(2, Math.ceil((to - from) / step));
    for (let i = 0; i <= n; i++) {
      const s = from + ((to - from) * i) / n;
      const p = sampleAt(path, s);
      out.push({ x: p.x, z: p.z, y: groundAt(layout, p).height + 0.03, t: path.length > 0 ? s / path.length : 0 });
    }
    return out;
  }

  function buildPathRibbons(path: Path, walked: number) {
    clearRibbons();
    ribbon(pathPoints(path, 0, path.length), 0.17, haloMat, 1);
    if (walked > 0.02) ribbon(pathPoints(path, 0, walked), 0.13, inkDone, 3);
    if (walked < path.length - 0.02) ribbon(pathPoints(path, walked, path.length), 0.13, inkMat, 3);
    pathBuilt = path;
    doneAt = walked;
  }

  // 畫線中的預覽與筆尖（E1）
  let draft: Vec2[] | null = null;
  let draftDirty = false;
  const tip = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.16, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x23302d, fog: false, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  tip.renderOrder = 5;
  tip.visible = false;
  scene.add(tip);

  function buildDraft() {
    clearRibbons();
    pathBuilt = null;
    if (!draft || draft.length < 2) return;
    let total = 0;
    const lengths = [0];
    for (let i = 1; i < draft.length; i++) lengths.push((total += Math.hypot(draft[i]!.x - draft[i - 1]!.x, draft[i]!.z - draft[i - 1]!.z)));
    const points = draft.map((p, i) => ({ x: p.x, z: p.z, y: groundAt(layout, p).height + 0.03, t: total > 0 ? Math.min(0.85, lengths[i]! / Math.max(total, 3)) : 0 }));
    ribbon(points, 0.17, haloMat, 1);
    ribbon(points, 0.13, inkMat, 3);
  }

  // ---- 湯滴（G2）：固定上限的物件池 ----
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xe0a43a, roughness: 0.2 });
  const dropGeo = new THREE.SphereGeometry(0.05, 8, 6);
  const drops: Drop[] = [];
  let maxDrops = 0;
  function spawnDrops(dx: number, dz: number) {
    if (reduced) return;
    const origin = new THREE.Vector3();
    monk.bowl.getWorldPosition(origin);
    for (let i = 0; i < 6 && drops.length < FX.maxDrops; i++) {
      const mesh = new THREE.Mesh(dropGeo, dropMat);
      mesh.position.copy(origin).add(new THREE.Vector3(0, 0.22, 0));
      const spread = (i - 2.5) * 0.25;
      drops.push({ mesh, vx: dx * 1.4 - dz * spread, vy: 1.4 + (i % 3) * 0.3, vz: dz * 1.4 + dx * spread, life: FX.dropSeconds });
      scene.add(mesh);
    }
    maxDrops = Math.max(maxDrops, drops.length);
  }
  function updateDrops(dt: number) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]!;
      d.life -= dt;
      d.vy -= 9 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        drops.splice(i, 1);
      }
    }
  }

  // ---- 事件 ----
  function onEvents(session: MonkSession, events: SessionEvent[]) {
    for (const event of events) {
      if (event.type === "decal" && floorGroup) {
        const { decal } = event;
        const made = soupDecal(decal.x, decal.z, decal.r, groundAt(layout, decal).height);
        floorGroup.add(made.group);
        decals.push({ group: made.group, steamMat: made.steamMat, born: clock });
        decalCount += 1;
      } else if (event.type === "spill") spawnDrops(event.dx, event.dz);
      else if (event.type === "floor") fallFrom = null;
      else if (event.type === "fall") fallFrom = { x: event.x, z: event.z, at: clock };
    }
    if (!builtFor || builtFor.tower !== session.tower || builtFor.index !== session.index) buildFloor(session);
  }

  // ---- 鏡頭 ----
  const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 39 };
  const tmpPos = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();
  let walkBlend = 0;
  let summitBlend = 0;
  let summitFrom: { pos: THREE.Vector3; target: THREE.Vector3; fov: number } | null = null;
  let fallFrom: { x: number; z: number; at: number } | null = null;
  let lastPhase = "";

  const toVec = (p: CameraPose) => ({ pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target), fov: p.fov });

  function placeCamera(session: MonkSession, dt: number) {
    const drawPose = toVec(drawCamera(layout.flipped));
    const phase = session.phase === "paused" ? (session.resumePhase ?? "draw") : session.phase;
    let goal = drawPose;
    if (phase === "intro") {
      const total = reduced ? CAMERA.climbReducedSeconds : CAMERA.climbSeconds;
      const t = reduced ? 1 : ease(1 - session.introLeft / total);
      const k = 1 - t;
      const angle = k * (-Math.PI / 2) * (layout.flipped ? -1 : 1);
      const p = drawPose.pos.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      p.y -= k * TOWER.levelHeight;
      const target = drawPose.target.clone();
      target.y -= k * TOWER.levelHeight;
      goal = { pos: p, target, fov: drawPose.fov };
      walkBlend = 0;
      summitBlend = 0;
      summitFrom = null;
    } else if ((phase === "walk" || phase === "falling" || phase === "spilled") && session.sim) {
      walkBlend = reduced ? 1 : Math.min(1, walkBlend + dt / CAMERA.toWalkSeconds);
      const sim = session.sim;
      const here = sampleAt(sim.path, sim.s);
      const ahead = sampleAt(sim.path, Math.min(sim.path.length, sim.s + CAMERA.walk.lookAhead));
      // 快到終點時往前看的點不夠遠：沿最後的方向延伸，鏡頭才不會轉回來
      const extra = sim.s + CAMERA.walk.lookAhead - sim.path.length;
      const look = extra > 0 ? { x: ahead.x + ahead.tx * extra, z: ahead.z + ahead.tz * extra } : ahead;
      // 鏡頭方向用最近 1.2 單位的平均方向：轉角時慢慢轉過去，不會一下子甩進塔身
      const back = sampleAt(sim.path, Math.max(0, sim.s - 1.2));
      const dx = here.x - back.x;
      const dz = here.z - back.z;
      const len = Math.hypot(dx, dz);
      const heading = len > 0.3 ? { ...here, tx: dx / len, tz: dz / len } : here;
      const walk = toVec(walkCamera(heading, look, groundAt(layout, here).height));
      // 鏡頭至少離塔身 0.7：和尚走在迴廊中線時「內側 0.9」會讓鏡頭貼著牆，畫面一半被牆擋住（偏離清單）
      const wall = TOWER.core + 0.7;
      if (Math.abs(walk.pos.x) < wall && Math.abs(walk.pos.z) < wall) {
        if (Math.abs(walk.pos.x) > Math.abs(walk.pos.z)) walk.pos.x = Math.sign(walk.pos.x) * wall;
        else walk.pos.z = Math.sign(walk.pos.z || 1) * wall;
      }
      const t = ease(walkBlend);
      goal = {
        pos: drawPose.pos.clone().lerp(walk.pos, t),
        target: drawPose.target.clone().lerp(walk.target, t),
        fov: drawPose.fov + (walk.fov - drawPose.fov) * t,
      };
    } else if (phase === "summit" || (phase === "over" && session.result?.outcome === "summit")) {
      // 從進入塔頂那一刻的鏡頭插值到塔外（起點固定，暫停時 dt = 0 鏡頭就不動，Codex 審查第 3 輪）
      summitFrom ??= { pos: pose.pos.clone(), target: pose.target.clone(), fov: pose.fov };
      summitBlend = reduced ? 1 : Math.min(1, summitBlend + dt / ENDING.summitSeconds);
      const sign = layout.flipped ? -1 : 1;
      const outside = { pos: new THREE.Vector3(13 * sign, 6.5, 15), target: new THREE.Vector3(0, 3.0, 0), fov: 44 };
      const t = ease(summitBlend);
      const from = summitFrom;
      goal = { pos: from.pos.clone().lerp(outside.pos, t), target: from.target.clone().lerp(outside.target, t), fov: from.fov + (outside.fov - from.fov) * t };
    } else if (phase === "over") {
      goal = { pos: pose.pos.clone(), target: pose.target.clone(), fov: pose.fov };
    } else {
      walkBlend = 0;
      summitBlend = 0;
      summitFrom = null;
    }
    // 跟拍時稍微平滑，不會一格一格抖
    const follow = phase === "walk" && walkBlend >= 1 && !reduced ? 1 - Math.exp(-dt * 12) : 1;
    tmpPos.copy(goal.pos);
    tmpTarget.copy(goal.target);
    pose.pos.lerp(tmpPos, follow);
    pose.target.lerp(tmpTarget, follow);
    pose.fov += (goal.fov - pose.fov) * follow;
    camera.position.copy(pose.pos);
    camera.lookAt(pose.target);
    if (camera.fov !== pose.fov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
  }

  // ---- 和尚與碗 ----
  let stride = 0;
  function placeMonk(session: MonkSession, dt: number) {
    const sim = session.sim;
    const sign = layout.flipped ? -1 : 1;
    const phase = session.phase === "paused" ? session.resumePhase : session.phase;
    const finished = session.result;
    monk.setWorried(phase === "falling" || phase === "spilled" || (finished !== null && finished.outcome !== "summit"));
    if (sim) {
      const p = monkPose(sim);
      monk.group.position.set(p.x, p.y, p.z);
      monk.group.rotation.set(0, Math.atan2(p.tx, p.tz), 0);
      if (session.phase === "walk") stride += sim.v * dt * 9;
      monk.body.position.y = sim.v > 0.05 ? Math.abs(Math.sin(stride)) * 0.04 : 0;
      monk.body.rotation.z = sim.v > 0.05 ? Math.sin(stride) * 0.04 : 0;
      // 湯面跟著 θ 傾斜（F6）：lat 左右、lon 前後
      monk.soup.rotation.set(sim.lon * 0.8, 0, -sim.lat * 0.8);
    } else {
      monk.group.position.set(layout.start.x, groundAt(layout, layout.start).height, layout.start.z);
      monk.group.rotation.set(0, (Math.PI / 2) * sign, 0);
      monk.body.position.y = 0;
      monk.body.rotation.z = 0;
      monk.soup.rotation.set(0, 0, 0);
    }
    // 送達塔頂：和尚站上塔頂（第 5 層屋頂的平台），面向塔外的鏡頭（B15、G4，Codex 審查第 2 輪）
    if (session.floor === 5 && (phase === "summit" || (finished && finished.outcome === "summit"))) {
      monk.group.position.set(0.55 * sign, TOWER.levelHeight + 0.03, 0.75);
      monk.group.rotation.set(0, Math.atan2(13 * sign, 15), 0);
      monk.body.position.y = 0;
      monk.body.rotation.z = 0;
      monk.soup.rotation.set(0, 0, 0);
    }
    // 摔下去：0.6 秒慢動作翻出去（減少動態效果時直接結算，不演）
    if (fallFrom && (phase === "falling" || (finished && finished.outcome === "fall"))) {
      const t = reduced ? 1 : Math.min(1, (clock - fallFrom.at) / ENDING.fallSeconds);
      const out = new THREE.Vector2(fallFrom.x, fallFrom.z).normalize();
      monk.group.position.set(fallFrom.x + out.x * t * 0.8, -t * t * 2.4, fallFrom.z + out.y * t * 0.8);
      monk.group.rotation.set(t * 1.2, monk.group.rotation.y, t * 1.6);
    }
    // 湯量：湯面高度跟著剩下的湯
    const fraction = Math.max(0, session.soup) / 1000;
    monk.soup.visible = fraction > 0.001;
    const y = 0.06 + 0.14 * fraction;
    monk.soup.position.y = y;
    const r = (0.13 + (y / 0.24) * 0.14) / 0.255;
    monk.soup.scale.set(r, 1, r);
    // 熱氣：溫度越低越淡，涼掉就沒有
    const heat = Math.max(0, (session.temperature - TEMP.cold) / (TEMP.start - TEMP.cold));
    monk.steamMat.opacity = 0.42 * heat;
    for (const [i, puff] of monk.steam.entries()) {
      puff.visible = heat > 0 && fraction > 0;
      if (!reduced) puff.position.y = 0.35 + i * 0.22 + ((clock * 0.35 + i * 0.3) % 0.66) * 0.3;
    }
  }

  // ---- 塔頂（G4） ----
  function updateSummit(session: MonkSession) {
    if (!tower) return;
    const phase = session.phase === "paused" ? session.resumePhase : session.phase;
    const show = session.floor === 5 && (phase === "summit" || (phase === "over" && session.result?.outcome === "summit"));
    tower.summit.visible = show;
    if (!show) return;
    const t = Math.min(1, summitBlend);
    tower.spire.emissiveIntensity = reduced ? 0 : 0.9 * Math.sin(t * Math.PI * 0.5);
    for (const bell of tower.bells) bell.rotation.z = reduced ? 0 : Math.sin(clock * 6 + (bell.userData.swing as number)) * 0.35 * (1 - t * 0.5);
  }

  // ---- 畫質（H5）：連續 2 秒低於 40 fps 時關陰影、倍率降到 1 ----
  let slowFor = 0;
  let degraded = false;
  function watchFps(dt: number) {
    if (degraded || dt <= 0) return;
    // 分頁在背景、或卡了一大下（例如切回來）不算
    if (dt > 0.5) return;
    // 「連續」2 秒：中間只要有一格達標就重新計算（H5，Codex 審查第 1 輪）
    if (1 / dt < QUALITY.lowFps) slowFor += dt;
    else slowFor = 0;
    if (slowFor >= QUALITY.lowFpsSeconds) degrade();
  }
  function degrade() {
    degraded = true;
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
    pixelRatio = 1;
    renderer.setPixelRatio(1);
    resize();
    scene.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const item of Array.isArray(material) ? material : material ? [material] : []) item.needsUpdate = true;
    });
  }

  // ---- 迴圈 ----
  let width = 0;
  let height = 0;
  function resize() {
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let raf = 0;
  let last = 0;
  let disposed = false;
  let readySent = false;
  const stats: SceneStats = { calls: 0, triangles: 0, shadows: true, pixelRatio, drops: 0, maxDrops: 0, decals: 0 };

  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const session = options.session();
    try {
      resize();
      const events = session.update(dt * 1000);
      clock += dt * (session.phase === "paused" ? 0 : 1);
      onEvents(session, events);
      if (draftDirty) {
        draftDirty = false;
        buildDraft();
      }
      if (!draft) {
        const path = session.path;
        if (!path) {
          if (pathBuilt || ribbons.length > 0) clearRibbons();
          pathBuilt = null;
        } else {
          const walked = session.sim?.s ?? 0;
          if (pathBuilt !== path || Math.abs(walked - doneAt) > 0.08) buildPathRibbons(path, walked);
        }
      }
      // 暫停時畫面停在原處：鏡頭插值、和尚、湯滴都不前進（Codex 審查第 2 輪）
      const live = session.phase === "paused" ? 0 : dt;
      placeMonk(session, live);
      placeCamera(session, live);
      updateSummit(session);
      updateDrops(live);
      for (const decal of decals) {
        const age = clock - decal.born;
        decal.steamMat.opacity = age >= DECAL.steamSeconds ? 0 : 0.45 * (1 - age / DECAL.steamSeconds);
      }
      if (session.phase !== lastPhase) lastPhase = session.phase;
      if (session.phase !== "paused") watchFps(dt);
      else slowFor = 0;
      renderer.render(scene, camera);
      stats.calls = renderer.info.render.calls;
      stats.triangles = renderer.info.render.triangles;
      stats.shadows = renderer.shadowMap.enabled;
      stats.pixelRatio = pixelRatio;
      stats.drops = drops.length;
      stats.maxDrops = maxDrops;
      stats.decals = decalCount;
      options.onEvents(events);
      options.onFrame();
      if (!readySent) {
        readySent = true;
        options.onReady();
      }
    } catch (error) {
      console.error(error);
      disposed = true;
      cancelAnimationFrame(raf);
      options.onError();
    }
  }

  try {
    buildFloor(options.session());
    resize();
    placeCamera(options.session(), 0);
  } catch (error) {
    console.error(error);
    options.onError();
  }
  raf = requestAnimationFrame(frame);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  return {
    get stats() {
      return stats;
    },
    pick(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      // 先打 y = 0 的地面，再依那一點的地面高度（架高平台）修正一次
      plane.constant = 0;
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      const h = groundAt(layout, { x: hit.x, z: hit.z }).height;
      if (h > 0) {
        plane.constant = -h;
        raycaster.ray.intersectPlane(plane, hit);
      }
      return { x: hit.x, z: hit.z };
    },
    setDraft(points, at) {
      draft = points;
      draftDirty = true;
      if (at) {
        tip.position.set(at.x, groundAt(layout, at).height + 0.045, at.z);
        tip.visible = true;
      } else tip.visible = false;
    },
    setReducedMotion(value) {
      reduced = value;
    },
    project(point) {
      const rect = renderer.domElement.getBoundingClientRect();
      const v = new THREE.Vector3(point.x, groundAt(layout, point).height, point.z).project(camera);
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    },
    refresh() {
      width = 0;
      resize();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      clearRibbons();
      for (const d of drops) scene.remove(d.mesh);
      drops.length = 0;
      disposeTree(scene);
      for (const item of [inkMat, inkDone, haloMat, dropMat]) item.dispose();
      dropGeo.dispose();
      renderer.dispose();
      // 立刻還給瀏覽器 WebGL context，進出遊戲多次也不會累積（H7）
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
