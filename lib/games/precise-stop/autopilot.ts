import { PHYSICS } from "./config";
import {
  createTrainState,
  predictHoldStop,
  stepTrain,
  type Conditions,
  type TrainState,
} from "./physics";

/**
 * 自動駕駛：只用「按住／放開」兩種操作，盡量晚煞車並停在標線上。
 * 用途有三個：計算各站的目標時間、驗證每一站都停得進完美區、測試時快速跑完一局。
 *
 * 每一步都問：如果這一步先放開、之後一路按住，會不會超過標線？
 * 會超過就現在按住，不會就繼續放開。
 */
export function autopilotDecision(state: TrainState, conditions: Conditions): boolean {
  if (state.speed <= 0 && state.distance <= 0.001) return true;
  const dt = PHYSICS.step;
  // 模擬放開一步之後的狀態
  const brakeAfter = Math.max(0, state.brake - dt / PHYSICS.rampDown);
  const brakeAvg = (state.brake + brakeAfter) / 2;
  const decel =
    brakeAvg * PHYSICS.fullBrake * (conditions.rain ? PHYSICS.rainFactor : 1) +
    PHYSICS.drag +
    PHYSICS.gravity * conditions.grade;
  const speedAfter = Math.max(0, state.speed - decel * dt);
  const distanceAfter = state.distance - ((state.speed + speedAfter) / 2) * dt;
  const stopIfReleasedOnce = predictHoldStop(distanceAfter, speedAfter, brakeAfter, conditions);
  // 放開一步之後仍然停得住（停在標線前或剛好）→ 可以繼續放開
  return stopIfReleasedOnce < 0;
}

export type AutopilotRun = {
  /** 停穩時的誤差（公尺）。正值過站。 */
  error: number;
  elapsed: number;
  steps: number;
};

/** 用自動駕駛跑完一站 */
export function runAutopilot(conditions: Conditions): AutopilotRun {
  const state = createTrainState(conditions);
  let steps = 0;
  // 最多模擬 5 分鐘，避免條件異常時卡住
  const limit = 300 / PHYSICS.step;
  while (!state.settled && steps < limit) {
    stepTrain(state, autopilotDecision(state, conditions), conditions);
    steps++;
  }
  return { error: -state.distance, elapsed: state.elapsed, steps };
}
