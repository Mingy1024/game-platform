export type Category = {
  slug: string;
  name: string;
  /** 一句話介紹，用在分類入口 */
  summary: string;
  /** 分類頁的原創介紹段落 */
  intro: string;
};

export const categories: Category[] = [
  {
    slug: "puzzle",
    name: "益智",
    summary: "動腦、記憶、找規律",
    intro:
      "益智類遊戲不拚手速，拚的是觀察與記憶。每一局都不長，適合想讓腦袋暖機的時候玩。",
  },
  {
    slug: "reflex",
    name: "反應",
    summary: "看到就要動手",
    intro:
      "反應類遊戲考驗眼睛到手指的速度。規則通常一句話就講完，分數高低全看當下的專注程度。",
  },
  {
    slug: "casual",
    name: "休閒",
    summary: "一兩分鐘玩一局",
    intro:
      "休閒類遊戲隨開隨玩，不用記複雜規則，等車、排隊的空檔就能完成一局。",
  },
  {
    slug: "racing",
    name: "競速",
    summary: "閃避、切線、撐到終點",
    intro:
      "競速類遊戲的節奏會越來越快，重點是提前判斷路線，在對的時機切換位置。",
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}
