import type { Metadata } from "next";
import { ProsePage, ProseSection } from "@/components/layout/ProsePage";

export const metadata: Metadata = {
  title: "聯絡與回報",
  description: "遇到遊戲問題時，回報前可以先準備哪些資訊。",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <ProsePage title="聯絡與回報" lead="遊戲卡住、畫面跑版，或有其他建議。" draft>
      <ProseSection title="聯絡方式">
        <p>聯絡管道會在網站正式上線時公布在這一頁。</p>
      </ProseSection>
      <ProseSection title="回報問題時請附上">
        <ul className="list-disc space-y-2 pl-6">
          <li>哪一款遊戲、在哪個畫面發生。</li>
          <li>使用的裝置與瀏覽器，例如 iPhone 的 Safari、Windows 的 Chrome。</li>
          <li>發生前做了什麼操作，以及是否每次都會發生。</li>
        </ul>
      </ProseSection>
    </ProsePage>
  );
}
