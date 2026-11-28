import type { Kind } from "@/lib/games/mine-descent/config";

/**
 * 礦坑大逃亡的美術：全部是程式產生的 SVG 字串（設計稿 v3 的風格：漫畫粗黑線、銅金礦配色、地鼠礦工）。
 * 場景載入時轉成貼圖。座標單位是「設計稿像素」（每公尺 65 px），實際顯示時放大到 130 px／公尺。
 * 純字串，不碰 DOM，方便在單元測試裡檢查。
 */
export const INK = "#1a120c";
/** 設計稿每公尺的像素數，與場景實際每公尺的像素數（放大 2 倍） */
export const ART_PPM = 65;
export const PLATFORM_H = 24;
/** 岩板貼圖上方、下方留給尖刺、水晶、碎塊的空間（設計稿像素） */
export const PLATFORM_TOP = 44;
export const PLATFORM_BOTTOM = 40;

export type Palette = {
  rock: string; rockD: string; rockL: string; rockC: string; top: string; ore: string; wood: string; woodL: string;
  iron: string; rust: string; cart: string; hazard: string; lamp: string; c1: string; c2: string; rope: string; dust: string;
  bg1: string; bg2: string; wallD: string; strat1: string; strat2: string;
};

/** 銅金礦（入口礦道到岩漿深處共用的岩板與道具配色） */
export const PLATFORM_PALETTE: Palette = {
  bg1: "#2a1710", bg2: "#6b2f1a", wallD: "#3a1f14", strat1: "#8a4a2a", strat2: "#5a2a1a",
  rock: "#8a5a3c", rockD: "#5e3a28", rockL: "#b07a52", rockC: "#9a6a48", top: "#c18c5c", ore: "#ffd23f", wood: "#b9803f", woodL: "#dba35a",
  iron: "#7f8a94", rust: "#a8402a", cart: "#2f8f7a", hazard: "#ffd23f", lamp: "#ffc470", c1: "#3fd6b0", c2: "#9af2d6", rope: "#f0dcae", dust: "#d0a47a",
};

/** 五段深度的背景配色（入口礦道、木架坑道、水晶洞窟、地下河、岩漿深處） */
export const ZONE_PALETTES: Palette[] = [
  { ...PLATFORM_PALETTE, bg1: "#3a2418", bg2: "#7a4a2a", strat1: "#9a6038", strat2: "#6a3c22" },
  { ...PLATFORM_PALETTE, bg1: "#2a1710", bg2: "#5e3a1f", wallD: "#2a1a10" },
  { ...PLATFORM_PALETTE, bg1: "#0f1a2a", bg2: "#1f4a52", strat1: "#2f6a70", strat2: "#1d4048", wallD: "#14232e", lamp: "#bff3fb" },
  { ...PLATFORM_PALETTE, bg1: "#0e1a24", bg2: "#1b3a52", strat1: "#2a5a78", strat2: "#183648", wallD: "#122230", lamp: "#d6f0ff" },
  { ...PLATFORM_PALETTE, bg1: "#2a0e0a", bg2: "#7a1e10", strat1: "#a8381c", strat2: "#6a1c10", wallD: "#2a1210", lamp: "#ffb070" },
];

const n = (value: number) => Math.round(value * 10) / 10;
const pts = (...p: [number, number][]) => p.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
const st = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

function svg(width: number, height: number, viewW: number, viewH: number, body: string, label: string, vx = 0, vy = 0): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="${vx} ${vy} ${n(viewW)} ${n(viewH)}" role="img" aria-label="${label}">${body}</svg>`;
}

// ================= 岩板 =================
function rock(x: number, y: number, w: number, p: Palette, dark = false): string {
  const H = PLATFORM_H;
  const c = dark ? p.rockD : p.rock;
  let o = `<path d="M${x + 5} ${y} L${x + w - 5} ${y} L${x + w} ${y + 7} L${x + w - 3} ${y + H} L${n(x + w * 0.72)} ${y + H + 4} L${n(x + w * 0.5)} ${y + H} L${n(x + w * 0.3)} ${y + H + 7} L${x + 3} ${y + H} L${x} ${y + 7} Z" fill="${c}" ${st(3.5)}/>`;
  o += `<path d="M${x + 6} ${y + 1.5} L${x + w - 6} ${y + 1.5} L${x + w - 4} ${y + 9} L${x + 4} ${y + 9} Z" fill="${p.top}"/>`;
  for (let i = 0; i < Math.floor((w - 14) / 13); i++) {
    const a = x + 9 + i * 13;
    o += `<line x1="${a}" y1="${y + 13}" x2="${a + 6}" y2="${y + H - 1}" stroke="${INK}" stroke-width="1.8" opacity=".6"/>`;
  }
  o += `<polyline points="${pts([x + w * 0.58, y + 9], [x + w * 0.52, y + 15], [x + w * 0.6, y + 19])}" fill="none" stroke="${INK}" stroke-width="2" opacity=".8"/>`;
  for (const f of [0.22, 0.8]) {
    const a = x + w * f;
    o += `<polygon points="${pts([a, y + 11], [a + 4, y + 14], [a, y + 18], [a - 4, y + 14])}" fill="${p.ore}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  return o;
}

function timber(x: number, y: number, w: number, h: number, p: Palette, vertical = false): string {
  let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${p.wood}" ${st(3)}/>`;
  const offsets = vertical ? [w * 0.3, w * 0.65] : [h * 0.3, h * 0.65];
  for (const d of offsets) {
    o += vertical
      ? `<line x1="${n(x + d)}" y1="${y + 3}" x2="${n(x + d)}" y2="${y + h - 3}" stroke="${INK}" stroke-width="1.6" opacity=".6"/>`
      : `<line x1="${x + 3}" y1="${n(y + d)}" x2="${x + w - 3}" y2="${n(y + d)}" stroke="${INK}" stroke-width="1.6" opacity=".6"/>`;
  }
  return o;
}

/** 鎬頭尖刺：廢棄鎬頭尖端朝上插在岩板上 */
function pickSpikes(x: number, y: number, w: number, p: Palette): string {
  let o = rock(x, y, w, p);
  const count = Math.max(2, Math.floor(w / 30));
  const step = w / count;
  for (let i = 0; i < count; i++) {
    const a = x + step * (i + 0.5);
    o += `<rect x="${a - 2.5}" y="${y - 4}" width="5" height="12" fill="${p.wood}" stroke="${INK}" stroke-width="2.5"/>`;
    o += `<path d="M${a - 16} ${y - 1} Q${a - 9} ${y - 20} ${a} ${y - 30} Q${a + 9} ${y - 20} ${a + 16} ${y - 1} L${a + 9} ${y - 3} Q${a} ${y - 14} ${a - 9} ${y - 3} Z" fill="${p.iron}" ${st(3)}/>`;
    o += `<path d="M${a - 9} ${y - 6} Q${a - 6} ${y - 17} ${a - 1} ${y - 25}" fill="none" stroke="#e8eef3" stroke-width="2" opacity=".8"/>`;
  }
  return o;
}

function crack(x: number, y: number, w: number, p: Palette): string {
  const H = PLATFORM_H;
  const hw = w / 2 - 5;
  let o = `<polygon points="${pts([x, y + 2], [x + hw, y], [x + hw - 7, y + 11], [x + hw + 2, y + H], [x, y + H])}" fill="${p.rockC}" ${st(3.5)}/>`;
  o += `<g transform="rotate(6 ${x + w} ${y + H})"><polygon points="${pts([x + hw + 11, y], [x + w, y + 2], [x + w, y + H], [x + hw + 9, y + H], [x + hw + 4, y + 10])}" fill="${p.rockC}" ${st(3.5)}/></g>`;
  o += `<polyline points="${pts([x + 10, y + 9], [x + hw - 12, y + 14], [x + hw - 18, y + H - 3])}" fill="none" stroke="${INK}" stroke-width="2.2"/>`;
  o += `<polygon points="${pts([x + hw, y + H + 9], [x + hw + 9, y + H + 8], [x + hw + 5, y + H + 19])}" fill="${p.rockC}" ${st(2.5)}/>`;
  o += `<circle cx="${x + hw + 2}" cy="${y + H + 26}" r="2.5" fill="${p.dust}"/><circle cx="${x + hw + 10}" cy="${y + H + 32}" r="2" fill="${p.dust}"/>`;
  return o;
}

/** 礦軌推車的軌道（固定在岩板貼圖上）；車身、輪子、箭頭另外做貼圖，場景裡才能動 */
function cartRail(x: number, y: number, w: number, p: Palette): string {
  const H = PLATFORM_H;
  let o = `<rect x="${x - 8}" y="${y + H - 3}" width="${w + 16}" height="6" fill="${p.iron}" ${st(3)}/>`;
  for (let sx = Math.floor(x - 4); sx < x + w + 4; sx += 22) o += `<rect x="${sx}" y="${y + H + 2}" width="9" height="8" fill="${p.wood}" ${st(2)}/>`;
  return o;
}

function cartBody(x: number, y: number, w: number, p: Palette): string {
  const H = PLATFORM_H;
  let o = `<polygon points="${pts([x + 2, y - 8], [x + w - 2, y - 8], [x + w - 14, y + H - 9], [x + 14, y + H - 9])}" fill="${p.cart}" ${st(3.5)}/>`;
  o += `<rect x="${x}" y="${y - 12}" width="${w}" height="6" rx="2" fill="${p.iron}" ${st(3)}/>`;
  for (const [ox, oy, s] of [[x + 16, -20, 9], [x + 34, -26, 11], [x + 54, -20, 9], [x + 72, -23, 10]] as const) {
    if (ox < x + w - 8) o += `<polygon points="${pts([ox - s, y - 12], [ox - s * 0.6, y + oy], [ox + s * 0.5, y + oy - 3], [ox + s, y - 12])}" fill="${p.ore}" ${st(2.5)}/>`;
  }
  return o;
}

/** 推車輪子的中心到車身左右邊緣的距離、輪子半徑（設計稿像素） */
export const CART_WHEEL_INSET = 26;
export const CART_WHEEL_R = 8;
/** 推車車身前板（放箭頭的地方）：中心的 y（相對岩板上緣）、高度、左右內縮 */
export const CART_PANEL = { cy: 4.5, h: 12, inset: 16 } as const;

/** 推車車身貼圖：和岩板貼圖同尺寸、同原點，直接疊上去 */
export function cartBodySvg(widthM: number, p: Palette = PLATFORM_PALETTE): { svg: string; width: number; height: number } {
  const margin = 30;
  const w = widthM * ART_PPM;
  const totalW = w + margin * 2;
  const totalH = PLATFORM_TOP + PLATFORM_H + PLATFORM_BOTTOM;
  return { svg: svg(totalW * 2, totalH * 2, totalW, totalH, cartBody(margin, PLATFORM_TOP, w, p), "cart"), width: totalW * 2, height: totalH * 2 };
}

/** 推車輪子（有輻條，轉起來看得出來） */
export function cartWheelSvg(p: Palette = PLATFORM_PALETTE): string {
  const r = CART_WHEEL_R;
  const c = r + 2;
  let o = `<circle cx="${c}" cy="${c}" r="${r}" fill="${p.iron}" ${st(3)}/>`;
  o += `<line x1="${c - r + 2}" y1="${c}" x2="${c + r - 2}" y2="${c}" stroke="${INK}" stroke-width="1.8"/><line x1="${c}" y1="${c - r + 2}" x2="${c}" y2="${c + r - 2}" stroke="${INK}" stroke-width="1.8"/>`;
  o += `<circle cx="${c}" cy="${c}" r="2.5" fill="${INK}"/><circle cx="${c + r * 0.45}" cy="${c - r * 0.45}" r="1.4" fill="#e8eef3"/>`;
  return svg(c * 4, c * 4, c * 2, c * 2, o, "wheel");
}

/** 推車前板上的箭頭（一格一個 V 形，往右；往左的另外一張）。可以橫向重複捲動 */
export function cartArrowSvg(dir: 1 | -1, p: Palette = PLATFORM_PALETTE): string {
  const size = 14;
  const h = CART_PANEL.h;
  const a = dir === 1 ? [[3, 1], [9, h / 2], [3, h - 1]] : [[11, 1], [5, h / 2], [11, h - 1]];
  const o = `<polyline points="${pts(...(a as [number, number][]))}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<polyline points="${pts(...(a as [number, number][]))}" fill="none" stroke="${p.hazard}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  return svg(size * 2, h * 2, size, h, o, dir === 1 ? "arrow-right" : "arrow-left");
}

function brace(x: number, y: number, w: number, p: Palette): string {
  let o = timber(x + 3, y + 2, 10, 46, p, true) + timber(x + w - 13, y + 2, 10, 46, p, true);
  o += `<line x1="${x + 12}" y1="${y + 8}" x2="${x + w - 12}" y2="${y + 44}" stroke="${INK}" stroke-width="7"/><line x1="${x + 12}" y1="${y + 8}" x2="${x + w - 12}" y2="${y + 44}" stroke="${p.woodL}" stroke-width="4"/>`;
  o += `<line x1="${x + w - 12}" y1="${y + 8}" x2="${x + 12}" y2="${y + 44}" stroke="${INK}" stroke-width="7"/><line x1="${x + w - 12}" y1="${y + 8}" x2="${x + 12}" y2="${y + 44}" stroke="${p.woodL}" stroke-width="4"/>`;
  o += timber(x - 6, y - 6, w + 12, 14, p);
  o += `<path d="M${x + w / 2 - 12} ${y + 1} q4 -5 8 0 q4 5 8 0 q4 -5 8 0" fill="none" stroke="${p.rope}" stroke-width="3"/>`;
  for (const f of [0.3, 0.5, 0.7]) {
    const cx = x + w * f;
    o += `<polyline points="${pts([cx - 7, y - 18], [cx, y - 27], [cx + 7, y - 18])}" fill="none" stroke="${p.hazard}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return o;
}

function crystal(x: number, y: number, w: number, p: Palette, spent: boolean): string {
  let o = spent ? "" : `<circle cx="${x + w / 2}" cy="${y - 10}" r="34" fill="${p.c1}" opacity=".28"/>`;
  o += rock(x, y, w, p);
  if (spent) return o;
  for (const [dx, hh, c] of [[0.18, 22, p.c1], [0.42, 36, p.c2], [0.66, 26, p.c1], [0.84, 16, p.c2]] as const) {
    const a = x + w * dx;
    o += `<polygon points="${pts([a - 5, y + 1], [a - 3, y - hh + 9], [a + 2, y - hh], [a + 8, y - hh + 9], [a + 9, y + 1])}" fill="${c}" ${st(3)}/>`;
    o += `<polygon points="${pts([a - 1, y - 2], [a, y - hh + 11], [a + 3, y - hh + 4], [a + 3, y - 2])}" fill="#ffffff" opacity=".6"/>`;
  }
  return o;
}

/** 岩板貼圖：寬 widthM 公尺，原點（岩板上緣的中央）在貼圖的 (width/2, PLATFORM_TOP) */
export function platformSvg(kind: Kind | "crystalSpent", widthM: number, p: Palette = PLATFORM_PALETTE): { svg: string; width: number; height: number } {
  const margin = 30;
  const w = widthM * ART_PPM;
  const totalW = w + margin * 2;
  const totalH = PLATFORM_TOP + PLATFORM_H + PLATFORM_BOTTOM;
  const x = margin;
  const y = PLATFORM_TOP;
  let body: string;
  switch (kind) {
    case "spike": body = pickSpikes(x, y, w, p); break;
    case "crack": body = crack(x, y, w, p); break;
    case "cart": body = cartRail(x, y, w, p); break;
    case "wood": body = brace(x, y, w, p); break;
    case "crystal": body = crystal(x, y, w, p, false); break;
    case "crystalSpent": body = crystal(x, y, w, p, true); break;
    default: body = rock(x, y, w, p);
  }
  return { svg: svg(totalW * 2, totalH * 2, totalW, totalH, body, kind), width: totalW * 2, height: totalH * 2 };
}

// ================= 背景 =================
function lantern(x: number, y: number, p: Palette): string {
  return (
    `<line x1="${x}" y1="${y - 120}" x2="${x}" y2="${y}" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 3"/>` +
    `<circle cx="${x}" cy="${y + 14}" r="46" fill="url(#lg)"/>` +
    `<rect x="${x - 8}" y="${y}" width="16" height="6" fill="${p.iron}" ${st(2.5)}/><rect x="${x - 6}" y="${y + 6}" width="12" height="18" rx="3" fill="${p.lamp}" ${st(2.5)}/><rect x="${x - 8}" y="${y + 24}" width="16" height="5" fill="${p.iron}" ${st(2.5)}/>`
  );
}

/** 背景（390×520 設計稿像素，貼圖放大 2 倍後在場景裡垂直拼接捲動）：漸層、地層、礦脈、礦燈 */
export function backgroundSvg(zone: number): string {
  const p = ZONE_PALETTES[Math.min(zone, ZONE_PALETTES.length - 1)];
  const H = 520;
  let o = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bg1}"/><stop offset=".5" stop-color="${p.bg2}"/><stop offset="1" stop-color="${p.bg1}"/></linearGradient>` +
    `<radialGradient id="lg"><stop offset="0" stop-color="${p.lamp}" stop-opacity=".65"/><stop offset="1" stop-color="${p.lamp}" stop-opacity="0"/></radialGradient>` +
    `<pattern id="dots" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="5.5" cy="5.5" r="2.2" fill="#000" opacity=".28"/></pattern></defs>`;
  o += `<rect width="390" height="${H}" fill="url(#bg)"/>`;
  for (const [yy, hh, c] of [[70, 56, p.strat1], [220, 44, p.strat2], [370, 64, p.strat1]] as const) {
    o += `<path d="M0 ${yy} Q100 ${yy - 14} 200 ${yy + 6} T390 ${yy - 4} V${yy + hh} Q290 ${yy + hh + 12} 190 ${yy + hh - 4} T0 ${yy + hh + 6} Z" fill="${c}" opacity=".55"/>`;
  }
  o += `<rect width="390" height="${H}" fill="url(#dots)"/>`;
  o += `<path d="M120 20 Q150 50 135 90 Q160 120 150 160" fill="none" stroke="${p.ore}" stroke-width="5" stroke-linecap="round" opacity=".9"/>`;
  o += `<path d="M280 300 Q300 350 286 390 Q306 430 296 470" fill="none" stroke="${p.ore}" stroke-width="4" stroke-linecap="round" opacity=".8"/>`;
  o += lantern(70, 150, p) + lantern(322, 380, p);
  return svg(390 * 2, H * 2, 390, H, o, `zone ${zone}`);
}

/** 兩側岩壁與木支架（390×520，可以上下無縫拼接：支架框每 260 像素一組） */
export function wallsSvg(zone: number): string {
  const p = ZONE_PALETTES[Math.min(zone, ZONE_PALETTES.length - 1)];
  const H = 520;
  let o = "";
  for (const side of ["L", "R"] as const) {
    const x0 = side === "L" ? 0 : 390;
    const d = side === "L" ? 1 : -1;
    o += `<path d="M${x0} 0 L${x0 + d * 30} 0 L${x0 + d * 30} ${H} L${x0} ${H} Z" fill="${p.wallD}" ${st(4)}/>`;
    for (const yy of [30, 290]) {
      o += timber(x0 + (side === "L" ? 0 : -22), yy, 22, 150, p, true);
      o += timber(x0 + (side === "L" ? 0 : -58), yy + 20, 58, 14, p);
      o += `<line x1="${x0 + d * 4}" y1="${yy + 130}" x2="${x0 + d * 48}" y2="${yy + 34}" stroke="${INK}" stroke-width="7"/><line x1="${x0 + d * 4}" y1="${yy + 130}" x2="${x0 + d * 48}" y2="${yy + 34}" stroke="${p.woodL}" stroke-width="4"/>`;
    }
  }
  return svg(390 * 2, H * 2, 390, H, o, "walls");
}

/** 頂端的崩塌線：警示梁、裂開的岩層、掉落的碎石。高 120 設計像素，貼在畫面最上方 */
export function ceilingSvg(p: Palette = PLATFORM_PALETTE): string {
  let o = `<rect x="0" y="0" width="390" height="40" fill="${INK}"/>`;
  o += `<polygon points="${pts([0, 40], [390, 40], [390, 70], [362, 96], [334, 66], [300, 100], [268, 70], [232, 94], [196, 64], [156, 100], [116, 68], [80, 94], [42, 66], [0, 88])}" fill="${p.rockD}" ${st(4)}/>`;
  for (const [sx, sy] of [[50, 70], [120, 76], [230, 72], [330, 70]] as const) o += `<polyline points="${pts([sx, 48], [sx + 6, sy - 8], [sx - 3, sy])}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  o += `<rect x="0" y="6" width="390" height="28" fill="${p.hazard}" stroke="${INK}" stroke-width="3.5"/>`;
  for (let i = -1; i < 14; i++) o += `<polygon points="${pts([i * 34, 6], [i * 34 + 16, 6], [i * 34 + 2, 34], [i * 34 - 14, 34])}" fill="${INK}"/>`;
  o += `<g ${st(4)}><polygon points="${pts([22, 108], [46, 100], [56, 124], [32, 136])}" fill="${p.rock}"/><polygon points="${pts([300, 116], [328, 110], [336, 136], [310, 142])}" fill="${p.rock}"/><polygon points="${pts([170, 112], [190, 106], [198, 126], [176, 132])}" fill="${p.top}"/></g>`;
  return svg(390 * 2, 150 * 2, 390, 150, o, "ceiling");
}

// ================= 地鼠礦工 =================
export type Pose = "appear" | "idle" | "run" | "fall" | "land" | "hurt" | "bounce" | "crystal" | "near" | "dizzy";
export const POSES: Pose[] = ["appear", "idle", "run", "fall", "land", "hurt", "bounce", "crystal", "near", "dizzy"];

const FUR = "#7a5640";
const FURD = "#5a3d2c";
const MUZ = "#ecd2b0";
const PINK = "#ff8fa3";
const CLAW = "#fff6e6";

const star = (x: number, y: number, r: number, c = "#ffe14d") => {
  const p: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    p.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  return `<polygon points="${pts(...p)}" fill="${c}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
};
const spark = (x: number, y: number, r: number, c = "#fff6c8") =>
  `<path d="M${x} ${y - r} L${n(x + r * 0.25)} ${n(y - r * 0.25)} L${x + r} ${y} L${n(x + r * 0.25)} ${n(y + r * 0.25)} L${x} ${y + r} L${n(x - r * 0.25)} ${n(y + r * 0.25)} L${x - r} ${y} L${n(x - r * 0.25)} ${n(y - r * 0.25)} Z" fill="${c}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;

const arm = (sx: number, sy: number, ang: number) =>
  `<g transform="rotate(${ang} ${sx} ${sy})"><rect x="${sx - 6.5}" y="${sy - 2}" width="13" height="22" rx="6.5" fill="${FUR}"/><ellipse cx="${sx}" cy="${sy + 22}" rx="9.5" ry="7.5" fill="${PINK}"/><path d="M${sx - 4.5} ${sy + 26} l-1 6 M${sx} ${sy + 28} l0 7 M${sx + 4.5} ${sy + 26} l1 6" stroke="${CLAW}" stroke-width="3.6" fill="none"/></g>`;
const foot = (x: number, y: number) =>
  `<ellipse cx="${x}" cy="${y}" rx="11" ry="6.5" fill="${PINK}"/><path d="M${x - 4} ${y + 3} l-1 3 M${x} ${y + 3.5} l0 3.5 M${x + 4} ${y + 3} l1 3" stroke="${CLAW}" stroke-width="3" fill="none"/>`;

type EyeStyle = "open" | "wide" | "happy" | "closed" | "swirl" | "sparkle";
function eyes(style: EyeStyle, y = 50): string {
  let o = "";
  for (const cx of [37, 63]) {
    if (style === "open") o += `<ellipse cx="${cx}" cy="${y}" rx="6" ry="7.5" fill="${INK}" stroke="none"/><circle cx="${cx - 1.6}" cy="${y - 2.6}" r="2.6" fill="#fff" stroke="none"/><circle cx="${cx + 2}" cy="${y + 2.6}" r="1.2" fill="#fff" stroke="none"/>`;
    else if (style === "wide") o += `<ellipse cx="${cx}" cy="${y}" rx="8" ry="9.5" fill="#fff"/><circle cx="${cx}" cy="${y + 1}" r="3.6" fill="${INK}" stroke="none"/><circle cx="${cx - 1}" cy="${y - 0.5}" r="1.2" fill="#fff" stroke="none"/>`;
    else if (style === "happy") o += `<path d="M${cx - 7} ${y + 3} Q${cx} ${y - 7} ${cx + 7} ${y + 3}" fill="none" stroke-width="3.6"/>`;
    else if (style === "closed") o += `<path d="${cx < 50 ? `M${cx - 6} ${y - 6} L${cx + 5} ${y} L${cx - 6} ${y + 6}` : `M${cx + 6} ${y - 6} L${cx - 5} ${y} L${cx + 6} ${y + 6}`}" fill="none" stroke-width="3.6"/>`;
    else if (style === "swirl") o += `<circle cx="${cx}" cy="${y}" r="8" fill="#fff"/><path d="M${cx - 1} ${y - 1} a2 2 0 1 1 2 2 a4.5 4.5 0 1 1 -4.5 -4.5 a7 7 0 1 1 7 7" fill="none" stroke-width="2"/>`;
    else o += `<ellipse cx="${cx}" cy="${y}" rx="7" ry="8.5" fill="${INK}" stroke="none"/>${spark(cx - 1.5, y - 2, 3.6, "#fff").replace('stroke-width="1.5"', 'stroke-width="0"')}`;
  }
  return o;
}

type MouthStyle = "smile" | "open" | "o" | "wavy" | "zig" | "tongue";
function mouth(style: MouthStyle): string {
  const teeth = `<rect x="46.5" y="73" width="3.5" height="5.5" rx="1" fill="#fff" stroke-width="2"/><rect x="50.5" y="73" width="3.5" height="5.5" rx="1" fill="#fff" stroke-width="2"/>`;
  switch (style) {
    case "smile": return `<path d="M43 72 Q50 78 57 72" fill="none" stroke-width="3"/>${teeth}`;
    case "open": return `<path d="M42 71 Q50 86 58 71 Z" fill="#8a2a3a" stroke-width="3"/><path d="M46 79 Q50 75 54 79 Q50 83 46 79Z" fill="${PINK}" stroke="none"/>`;
    case "o": return `<ellipse cx="50" cy="76" rx="4.5" ry="6" fill="#8a2a3a" stroke-width="3"/>`;
    case "wavy": return `<path d="M42 77 q3 -5 6 0 t6 0 t6 0" fill="none" stroke-width="3"/>`;
    case "zig": return `<path d="M41 76 L45 71 L49 77 L53 71 L57 77 L59 72" fill="none" stroke-width="3"/>`;
    default: return `<path d="M43 72 Q50 77 57 72" fill="none" stroke-width="3"/><path d="M48 75 Q50 86 55 78 Z" fill="${PINK}" stroke-width="2.5"/>`;
  }
}

function helmet(ox = 0, oy = 0, rot = 0): string {
  return (
    `<g transform="translate(${ox} ${oy}) rotate(${rot} 50 26)">` +
    `<circle cx="50" cy="22" r="17" fill="#fff3a0" opacity=".35" stroke="none"/>` +
    `<path d="M29 36 Q30 10 50 8 Q70 10 71 36 Z" fill="#ffc533"/><rect x="25" y="33" width="50" height="8" rx="4" fill="#ffc533"/>` +
    `<rect x="45" y="9" width="10" height="26" fill="#e89a1a" stroke="none"/><path d="M45 9 V35 M55 9 V35" stroke-width="2.5" fill="none"/>` +
    `<circle cx="50" cy="23" r="8" fill="#9aa5b1"/><circle cx="50" cy="23" r="5.2" fill="#fffbe0" stroke-width="2"/>` +
    `<path d="M33 24 Q36 15 43 13" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/></g>`
  );
}

type Cfg = {
  dx: number; dy: number; rot: number; sx: number; sy: number; aL: number; aR: number; fl: [number, number]; fr: [number, number];
  eye: EyeStyle; mouth: MouthStyle; hox: number; hoy: number; hrot: number; ear: number; cheek: number; pre: string; post: string; hold: string;
};
const BASE: Cfg = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, aL: 10, aR: -10, fl: [38, 133], fr: [62, 133], eye: "open", mouth: "smile", hox: 0, hoy: 0, hrot: 0, ear: 0, cheek: 0.55, pre: "", post: "", hold: "" };

const POSE_CFG: Record<Exclude<Pose, "appear">, Partial<Cfg>> = {
  idle: {},
  run: { rot: 9, dx: 5, aL: 55, aR: -65, fl: [28, 127], fr: [72, 134], mouth: "open", hrot: 3, pre: `<g stroke="#fff6e6" stroke-width="3" stroke-linecap="round" opacity=".85" fill="none"><path d="M-8 84 H12"/><path d="M-12 100 H8"/><path d="M-6 116 H14"/></g>` },
  fall: { dy: -8, aL: 150, aR: -150, fl: [40, 131], fr: [61, 134], eye: "wide", mouth: "o", hoy: -9, hrot: -8, ear: -7, sx: 0.96, sy: 1.06, pre: `<g stroke="#fff6e6" stroke-width="3" stroke-linecap="round" opacity=".85" fill="none"><path d="M6 -4 V22"/><path d="M26 -14 V16"/><path d="M74 -14 V16"/><path d="M94 -4 V22"/><path d="M50 -20 V0"/></g>` },
  land: { sx: 1.2, sy: 0.8, aL: 72, aR: -72, fl: [34, 134], fr: [66, 134], eye: "closed", hoy: 3, post: `<g fill="#e8d2b0" stroke="${INK}" stroke-width="2.5"><circle cx="8" cy="134" r="8"/><circle cx="-2" cy="141" r="5"/><circle cx="92" cy="134" r="8"/><circle cx="102" cy="141" r="5"/></g>` },
  hurt: { rot: -11, dx: -2, aL: 40, aR: -45, fl: [36, 134], fr: [66, 130], eye: "closed", mouth: "wavy", cheek: 0.9, hrot: -12, hox: -3, post: `<g>${star(14, 22, 8)}${star(88, 56, 6, "#ff6b4a")}${star(2, 52, 5)}</g><g stroke="#ff6b4a" stroke-width="3" stroke-linecap="round" fill="none"><path d="M84 18 L94 8 M88 34 L100 32 M78 6 L80 -6"/></g><path d="M30 62 q-3 7 0 10 q3 -3 0 -10Z" fill="#7fd6ff" stroke="${INK}" stroke-width="2"/><path d="M70 62 q3 7 0 10 q-3 -3 0 -10Z" fill="#7fd6ff" stroke="${INK}" stroke-width="2"/>` },
  bounce: { sx: 0.9, sy: 1.14, dy: -16, aL: 140, aR: -140, fl: [40, 133], fr: [60, 133], eye: "happy", mouth: "open", hoy: -4, pre: `<path d="M30 146 l8 -6 l-16 -6 l16 -6 l-16 -6 l8 -6" transform="translate(12 0)" fill="none" stroke="#e8d4a0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`, post: spark(8, 40, 7) + spark(94, 30, 6) + spark(90, 90, 5) },
  crystal: { aL: -38, aR: 38, eye: "sparkle", mouth: "open", cheek: 0.9, hrot: -3, hold: `<polygon points="${pts([42, 118], [44, 98], [50, 88], [56, 98], [58, 118])}" fill="#3fd6b0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><polygon points="${pts([46, 114], [47, 100], [51, 94], [51, 114])}" fill="#fff" opacity=".6" stroke="none"/>`, post: spark(12, 52, 7, "#9af2d6") + spark(92, 60, 6, "#9af2d6") + spark(84, 20, 5, "#ffe14d") },
  near: { rot: -6, dx: -2, aL: -140, aR: 140, fl: [38, 130], fr: [62, 133], eye: "wide", mouth: "zig", hrot: -5, post: `<path d="M80 56 q5 8 0 12 q-5 -4 0 -12Z" fill="#7fd6ff" stroke="${INK}" stroke-width="2"/><g stroke="#ff6b4a" stroke-width="3.5" stroke-linecap="round"><path d="M92 28 V40"/><path d="M92 46 V48"/><path d="M104 20 V34"/><path d="M104 40 V42"/></g>` },
  dizzy: { dy: 3, rot: 6, aL: 45, aR: -50, fl: [30, 132], fr: [70, 133], eye: "swirl", mouth: "tongue", hox: 22, hoy: -4, hrot: 28, ear: 2, post: `<g>${star(18, 18, 7)}${star(52, -4, 6, "#fff6c8")}${star(88, 14, 7)}</g>` },
};

function head(c: Cfg): string {
  const ear = c.ear;
  return (
    `<circle cx="23" cy="${40 + ear}" r="10" fill="${FUR}"/><circle cx="23" cy="${40 + ear}" r="5" fill="${PINK}" stroke="none"/>` +
    `<circle cx="77" cy="${40 + ear}" r="10" fill="${FUR}"/><circle cx="77" cy="${40 + ear}" r="5" fill="${PINK}" stroke="none"/>` +
    `<ellipse cx="50" cy="56" rx="32" ry="27" fill="${FUR}"/><ellipse cx="50" cy="67" rx="17" ry="12" fill="${MUZ}" stroke="none"/>` +
    `<circle cx="27" cy="66" r="6" fill="${PINK}" opacity="${c.cheek}" stroke="none"/><circle cx="73" cy="66" r="6" fill="${PINK}" opacity="${c.cheek}" stroke="none"/>` +
    eyes(c.eye) + `<g stroke="${INK}">${mouth(c.mouth)}</g>` +
    `<path d="M42 61 Q50 54 58 61 Q58 68 50 70 Q42 68 42 61Z" fill="${PINK}" stroke-width="2.8"/><ellipse cx="46.5" cy="60" rx="2.6" ry="1.6" fill="#fff" stroke="none" opacity=".85"/>` +
    `<g stroke="${INK}" stroke-width="1.8" fill="none" opacity=".75"><path d="M36 68 L22 65 M36 71 L21 72"/><path d="M64 68 L78 65 M64 71 L79 72"/></g>` +
    helmet(c.hox, c.hoy, c.hrot)
  );
}

/** 地鼠的一個姿勢。座標 100×140，腳底在 y=140；視窗 -18 -26 136 180 留給特效 */
export function poseSvg(pose: Pose): string {
  const g = (s: string) => `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${s}</g>`;
  let body: string;
  if (pose === "appear") {
    const c = { ...BASE };
    body =
      `<ellipse cx="50" cy="132" rx="52" ry="14" fill="#5a3a24" stroke="${INK}" stroke-width="3.5"/><ellipse cx="50" cy="128" rx="34" ry="8" fill="${INK}"/>` +
      g(`<g transform="translate(0 22)">${head(c)}</g>` + arm(30, 112, 95) + arm(70, 112, -100)) +
      `<g fill="#5a3a24" stroke="${INK}" stroke-width="2.5"><circle cx="2" cy="110" r="5"/><circle cx="-4" cy="94" r="3.5"/><circle cx="98" cy="108" r="5"/><circle cx="104" cy="92" r="3.5"/></g>` +
      spark(14, 36, 6) + spark(88, 30, 7);
  } else {
    const c: Cfg = { ...BASE, ...POSE_CFG[pose] };
    const inner =
      `<ellipse cx="80" cy="120" rx="9" ry="6" fill="${FURD}" transform="rotate(-20 80 120)"/>` + arm(28, 92, c.aL) + foot(...c.fl) + foot(...c.fr) +
      `<ellipse cx="50" cy="104" rx="27" ry="27" fill="${FUR}"/><ellipse cx="50" cy="108" rx="16" ry="18" fill="${MUZ}" stroke="none"/>` + c.hold + arm(72, 92, c.aR) + head(c);
    body = c.pre + `<g transform="translate(${c.dx} ${c.dy}) translate(50 140) scale(${c.sx} ${c.sy}) rotate(${c.rot}) translate(-50 -140)">${g(inner)}</g>` + c.post;
  }
  return svg(136 * 1.5, 180 * 1.5, 136, 180, body, pose, -18, -26);
}

/** 地鼠貼圖的原點（腳底中央）在貼圖裡的比例 */
export const MOLE_ORIGIN = { x: 68 / 136, y: 166 / 180 };
/** 地鼠貼圖在場景裡的顯示高度（像素，場景每公尺 130 像素；身體約 1.2 公尺高，比判定框大一點，看得清楚） */
export const MOLE_DISPLAY_H = 1.2 * 130 * (180 / 140);
