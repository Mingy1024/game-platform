import type { Metadata } from "next";
import { ProsePage, ProseSection } from "@/components/layout/ProsePage";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: "遊戲小站會處理哪些資料、存在哪裡、用了哪些第三方服務。",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <ProsePage title="隱私權政策" lead="說明這個網站會處理哪些資料。" draft>
      <ProseSection title="不需要帳號">
        <p>玩遊戲不需要註冊或登入，網站不會要求你提供姓名、信箱或電話。</p>
      </ProseSection>
      <ProseSection title="存在你裝置上的資料">
        <p>
          最近玩過的遊戲、收藏、靜音設定與最佳紀錄，會存在你瀏覽器的本機儲存空間，不會上傳。清除瀏覽器資料就會刪除這些紀錄。
        </p>
      </ProseSection>
      <ProseSection title="遊玩次數統計">
        <p>
          熱門榜需要統計每款遊戲被玩了幾次。這項功能尚未啟用；啟用時，這裡會補上實際收集的欄位與保存期間。
        </p>
      </ProseSection>
      <ProseSection title="廣告與第三方服務">
        <p>
          目前網站沒有載入任何第三方廣告或分析程式，頁面上標示「廣告」的區塊是版位預留。正式接上廣告或分析服務前，這裡會列出服務名稱、用途與你可以做的選擇。
        </p>
      </ProseSection>
    </ProsePage>
  );
}
