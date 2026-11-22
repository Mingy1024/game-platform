/**
 * 最佳紀錄的格式：每天的最佳分（依台灣日期）和歷史最佳。
 * 獨立成一個檔案：伺服器端的程式也要用這個型別，不能順便引入 records.ts（它用到瀏覽器的 localStorage）。
 */
export type Records = {
  daily: Record<string, number>;
  /** 歷史最佳 */
  best: number | null;
};
