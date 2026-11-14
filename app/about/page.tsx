import type { Metadata } from "next";
import { ProsePage, ProseSection } from "@/components/layout/ProsePage";

export const metadata: Metadata = {
  title: "關於",
  description: "遊戲小站是什麼、遊戲從哪裡來、怎麼維護。",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <ProsePage
      title="關於遊戲小站"
      lead="一個打開瀏覽器就能玩的小遊戲站。"
      draft
    >
      <ProseSection title="這個網站在做什麼">
        <p>
          遊戲小站收錄可以直接在瀏覽器玩的小遊戲。不用下載、不用註冊，手機和電腦都能玩，一局大約一兩分鐘。
        </p>
      </ProseSection>
      <ProseSection title="遊戲從哪裡來">
        <p>
          站上的遊戲都是原創製作，規則、畫面與文字皆為自行設計。每款遊戲的頁面會說明玩法、操作方式與計分方式。
        </p>
      </ProseSection>
      <ProseSection title="怎麼維護">
        <p>
          新遊戲會不定期上線，新作排在目錄最前面。每款遊戲的更新內容記在各自頁面的更新紀錄裡。
        </p>
      </ProseSection>
    </ProsePage>
  );
}
