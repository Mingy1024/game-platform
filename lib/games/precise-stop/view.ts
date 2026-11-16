/**
 * 鏡頭計算。座標用設計稿的尺寸（場景 420×340），畫面層再乘上實際倍率。
 *
 * 遠景：1 m＝20 px。列車固定在畫面上、背景往後捲；標線進到畫面右側後改成
 * 標線固定、列車往前。剩 5 m 進入近站放大：標線移到 x=300，
 * 比例尺隨距離從 20 px/m 放大到 84 px/m，精準到公分。
 */
export const VIEW = {
  width: 420,
  height: 340,
  /** 車輪接觸軌道的高度 */
  railY: 298,
  farPpm: 20,
  closePpm: 84,
  /** 遠景時車頭在畫面上的位置 */
  noseFarX: 250,
  /** 遠景時標線停住的位置 */
  markFarX: 380,
  /** 近站放大時標線的位置 */
  markCloseX: 300,
  /** 近站放大、比例尺還在變化時，車頭維持在這個位置 */
  noseCloseX: 90,
  /** 過站時車頭最多畫到這裡，再遠就改成移動標線 */
  noseMaxX: 390,
  /** 列車圖在遠景的寬度（一節 20 m） */
  trainFarWidth: 400,
  trainCloseScale: 1.75,
  backgroundCloseScale: 1.8,
  /** 月台層捲動速度相對於軌道層的比例（視差） */
  platformParallax: 0.94,
  /** 前景架線柱的捲動倍率與間距（公尺） */
  postParallax: 1.6,
  postSpacing: 55,
} as const;

export type ViewState = {
  /** 軌道方向的比例尺（px/m）：目標區、刻度尺都用這個 */
  ppm: number;
  noseX: number;
  markX: number;
  /** 列車圖的縮放（遠景＝1） */
  trainScale: number;
  backgroundScale: number;
  /** 月台層相對軌道層往右偏移的量（px），標線停住後是 0 */
  platformShift: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** 近站放大時的比例尺：離標線越近放得越大 */
export function closePpm(distance: number): number {
  const d = Math.abs(distance);
  const reach = distance >= 0 ? VIEW.markCloseX - VIEW.noseCloseX : VIEW.noseMaxX - VIEW.markCloseX;
  if (d * VIEW.closePpm <= reach) return VIEW.closePpm;
  return clamp(reach / d, VIEW.farPpm, VIEW.closePpm);
}

/**
 * @param distance 車頭離標線的距離（公尺，負值是過站）
 * @param zoom 近站放大的進度 0–1（由畫面層做 0.3 秒的漸變）
 */
export function computeView(distance: number, zoom: number): ViewState {
  const t = clamp(zoom, 0, 1);

  // 遠景
  const lockDistance = (VIEW.markFarX - VIEW.noseFarX) / VIEW.farPpm;
  const farMarkX =
    distance > lockDistance ? VIEW.noseFarX + distance * VIEW.farPpm : VIEW.markFarX;

  // 近景
  const cPpm = closePpm(distance);
  let closeMarkX: number = VIEW.markCloseX;
  if (distance < 0 && VIEW.markCloseX - distance * cPpm > VIEW.noseMaxX) {
    // 過站太遠：車頭停在畫面右側，標線往左退
    closeMarkX = VIEW.noseMaxX + distance * cPpm;
  }

  const ppm = lerp(VIEW.farPpm, cPpm, t);
  const markX = lerp(farMarkX, closeMarkX, t);
  const noseX = markX - distance * ppm;
  const closeness = (ppm - VIEW.farPpm) / (VIEW.closePpm - VIEW.farPpm);

  return {
    ppm,
    noseX,
    markX,
    trainScale: lerp(1, VIEW.trainCloseScale, closeness),
    backgroundScale: lerp(1, VIEW.backgroundCloseScale, closeness),
    platformShift: (1 - t) * (1 - VIEW.platformParallax) * Math.max(0, farMarkX - VIEW.markFarX),
  };
}
