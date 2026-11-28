import type { Mode } from "./tower";

/**
 * 最佳紀錄的格式：固定關卡與隨機模式各自的最佳分數與時間。
 * 獨立成一個檔案：伺服器端的程式也要用這個型別，不能順便引入 records.ts（它用到瀏覽器的 localStorage）。
 */
export type Best = { score: number; timeMs: number };
/** 帳號紀錄（伺服器存的）：兩種模式各自的最佳 */
export type AccountRecords = Record<Mode, Best | null>;
/** 本機紀錄：帳號紀錄＋最高到達層數（只存本機，第 22 題）。送達塔頂記 6 */
export type Records = AccountRecords & { floors: Record<Mode, number | null> };
