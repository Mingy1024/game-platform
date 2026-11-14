/**
 * 各遊戲的說明內容。
 * 規劃上這些文字會改放 content/games/*.md；Markdown 管線建立前先用型別化資料，
 * 讓遊戲頁的版面有真實內容可排。
 */
export type GameGuide = {
  howTo: string[];
  controls: { touch: string; desktop: string };
  scoring: string;
  faq: { question: string; answer: string }[];
  changelog: { date: string; note: string }[];
};

const recordFaq = {
  question: "我的最佳紀錄存在哪裡？",
  answer:
    "紀錄只存在這台裝置的瀏覽器裡，不需要登入。清除瀏覽器資料或換裝置後，紀錄不會跟著過去。",
};

const guides: Record<string, GameGuide> = {
  "tap-targets": {
    howTo: [
      "每一局 30 秒，畫面上一次只會出現一個圓點。",
      "圓點出現 1 秒後會換位置，在它消失前點中才算命中。",
      "點到空白處不扣分，也不加分。",
    ],
    controls: {
      touch: "直接點擊圓點。",
      desktop: "用滑鼠點擊；或用方向鍵移動焦點，按 Enter 擊中。",
    },
    scoring: "每次命中加 10 分，分數越高越好。",
    faq: [
      {
        question: "切到其他分頁時，時間會繼續跑嗎？",
        answer: "不會。視窗失去焦點或切到背景時遊戲會暫停，回來後再繼續。",
      },
      recordFaq,
    ],
    changelog: [{ date: "2026-11-15", note: "建立遊戲頁面，遊戲本體製作中。" }],
  },
  "lane-dodge": {
    howTo: [
      "畫面固定三條車道，障礙物會從上方往下移動。",
      "左右切換車道閃開障礙，撞到就結束。",
      "撐滿 60 秒即完成這一局。",
    ],
    controls: {
      touch: "點畫面下方的左、右按鈕，或左右滑動切換車道。",
      desktop: "左右方向鍵，或 A、D 鍵。",
    },
    scoring: "每存活完整一秒加 1 分，每通過一個障礙加 5 分，分數越高越好。",
    faq: [
      {
        question: "每一局的障礙位置都一樣嗎？",
        answer: "不一樣。每局會用不同的亂數種子產生配置。",
      },
      recordFaq,
    ],
    changelog: [{ date: "2026-11-15", note: "建立遊戲頁面，遊戲本體製作中。" }],
  },
  "memory-pairs": {
    howTo: [
      "4×4 共 16 張牌，藏著 8 組相同的圖案。",
      "一次最多翻開兩張；圖案不同的話，0.7 秒後會蓋回去。",
      "在 120 秒內翻出全部 8 組就算完成。",
    ],
    controls: {
      touch: "點選卡片翻牌。",
      desktop: "用滑鼠點選；或用 Tab、方向鍵選擇卡片，按 Enter 翻牌。",
    },
    scoring: "完成才會記錄成績，以完成時間計算，時間越短越好。超過 120 秒不記錄。",
    faq: [
      {
        question: "為什麼有時候點了牌沒有反應？",
        answer: "兩張牌翻開後、還沒蓋回去之前，暫時不能翻第三張，等牌蓋回去就可以繼續。",
      },
      recordFaq,
    ],
    changelog: [{ date: "2026-11-15", note: "建立遊戲頁面，遊戲本體製作中。" }],
  },
};

export function getGameGuide(slug: string): GameGuide | undefined {
  return guides[slug];
}
