import { PHYSICS, kmhToMs } from "./config";

/** 一站的行車條件。grade 是坡度比例，正值上坡、負值下坡（0.025＝2.5%）。 */
export type Conditions = {
  speedKmh: number;
  grade: number;
  rain: boolean;
};

export type TrainState = {
  /** 車頭離標線的距離（公尺）。正值還沒到，負值已經超過。 */
  distance: number;
  /** 速度（m/s），不會是負的 */
  speed: number;
  /** 煞車力 0–1 */
  brake: number;
  /** 出發後經過的時間（秒），停穩後不再增加 */
  elapsed: number;
  /** 速度為 0 已經維持多久（秒） */
  stoppedFor: number;
  /** 已經停穩、可以判定 */
  settled: boolean;
  /** 超過標線太遠，觸發自動緊急停車 */
  emergency: boolean;
};

/** 該條件下煞車力全開時的減速度（m/s²） */
export function fullBrakeDecel(conditions: Conditions): number {
  return (
    PHYSICS.fullBrake * (conditions.rain ? PHYSICS.rainFactor : 1) +
    passiveDecel(conditions)
  );
}

/** 不踩煞車時的減速度：阻力加上坡度（下坡時可能是負值，代表會加速） */
export function passiveDecel(conditions: Conditions): number {
  return PHYSICS.drag + PHYSICS.gravity * conditions.grade;
}

/** 全力煞車的停車距離（不含煞車力爬升的時間） */
export function fullBrakeDistance(conditions: Conditions): number {
  const v = kmhToMs(conditions.speedKmh);
  return (v * v) / (2 * fullBrakeDecel(conditions));
}

export function startDistance(conditions: Conditions): number {
  return fullBrakeDistance(conditions) * PHYSICS.startFactor;
}

export function createTrainState(conditions: Conditions): TrainState {
  return {
    distance: startDistance(conditions),
    speed: kmhToMs(conditions.speedKmh),
    brake: 0,
    elapsed: 0,
    stoppedFor: 0,
    settled: false,
    emergency: false,
  };
}

/**
 * 前進一個固定步進（PHYSICS.step）。直接修改 state。
 * braking 是玩家這一步有沒有按住煞車。
 */
export function stepTrain(
  state: TrainState,
  braking: boolean,
  conditions: Conditions,
): void {
  if (state.settled) return;
  const dt = PHYSICS.step;

  if (state.distance < -PHYSICS.overrunLimit) state.emergency = true;
  const held = braking || state.emergency;

  // 煞車力爬升／釋放
  const rate = held ? dt / PHYSICS.rampUp : -dt / PHYSICS.rampDown;
  const brakeBefore = state.brake;
  state.brake = Math.min(1, Math.max(0, state.brake + rate));
  // 這一步用前後煞車力的平均，讓積分結果和步進大小幾乎無關
  const brake = (brakeBefore + state.brake) / 2;

  const brakeDecel = brake * PHYSICS.fullBrake * (conditions.rain ? PHYSICS.rainFactor : 1);
  const decel = brakeDecel + passiveDecel(conditions);

  const v0 = state.speed;
  let v1 = v0 - decel * dt;
  let travelled: number;
  if (v1 <= 0) {
    if (v0 <= 0) {
      // 靜止：只有下坡且煞車不夠時才會再滑動
      v1 = decel < 0 ? -decel * dt : 0;
      travelled = (v1 * dt) / 2;
    } else {
      // 這一步內停下來：只走到速度歸零為止
      travelled = (v0 * v0) / (2 * decel);
      v1 = 0;
    }
  } else {
    travelled = ((v0 + v1) / 2) * dt;
  }

  state.speed = v1;
  state.distance -= travelled;

  if (v1 === 0) {
    state.stoppedFor += dt;
    if (state.stoppedFor >= PHYSICS.settle) state.settled = true;
  } else {
    state.stoppedFor = 0;
  }
  // 停下來之後時間就不再往上加（準點只看到停車那一刻）
  if (v1 > 0 || travelled > 0) state.elapsed += dt;
}

/**
 * 從現在開始一直按住煞車，會在離標線多遠的地方停下來。
 * 回傳停下時的 distance（正值＝停在標線前，負值＝過站）。
 * 用解析式計算，給自動駕駛和難度計算使用。
 */
export function predictHoldStop(
  distance: number,
  speed: number,
  brake: number,
  conditions: Conditions,
): number {
  const A = PHYSICS.fullBrake * (conditions.rain ? PHYSICS.rainFactor : 1);
  const c = passiveDecel(conditions);
  let v = speed;
  let s = 0;
  // 爬升階段：煞車力 b(t) = brake + t / rampUp
  const tRamp = (1 - brake) * PHYSICS.rampUp;
  if (tRamp > 0 && v > 0) {
    const k = A / PHYSICS.rampUp;
    // v(t) = v - (A*brake + c) t - k t²/2
    const a0 = A * brake + c;
    // 找 v(t)=0 的時間
    const disc = a0 * a0 + 2 * k * v;
    const tStop = (-a0 + Math.sqrt(disc)) / k;
    const t = Math.min(tRamp, tStop > 0 ? tStop : tRamp);
    s += v * t - (a0 * t * t) / 2 - (k * t * t * t) / 6;
    v = Math.max(0, v - a0 * t - (k * t * t) / 2);
  }
  if (v > 0) {
    const full = A + c;
    if (full <= 0) return -Infinity;
    s += (v * v) / (2 * full);
  }
  return distance - s;
}
