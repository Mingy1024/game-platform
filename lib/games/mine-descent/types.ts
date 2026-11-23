/**
 * 最佳紀錄的格式：最深的深度（公尺）和最高分。
 * 獨立成一個檔案：伺服器端的程式也要用這個型別，不能順便引入 records.ts（它用到瀏覽器的 localStorage）。
 */
export type Records = {
  /** 最高分 */
  score: number | null;
  /** 最深的深度（公尺） */
  depth: number | null;
};
