<script setup lang="ts">
import { FLAGS } from "@/lib/flags";

usePageMeta({ title: "隱私權政策", description: "遊戲小站會處理哪些資料、存在哪裡、用了哪些第三方服務。", canonical: "/privacy" });
const link = "font-bold text-sign underline underline-offset-2";
</script>

<template>
  <ProsePage title="隱私權政策" lead="說明這個網站會處理哪些資料。" draft>
    <!-- 登入開關打開時才換成有帳號的版本，和登入功能一起上線 -->
    <ProseSection v-if="FLAGS.login" title="登入是選擇性的">
      <p>玩遊戲不需要註冊或登入。想讓紀錄跟著帳號走，可以用 Google 登入；網站不會要求你提供姓名、信箱或電話。</p>
    </ProseSection>
    <ProseSection v-else title="不需要帳號">
      <p>玩遊戲不需要註冊或登入，網站不會要求你提供姓名、信箱或電話。</p>
    </ProseSection>
    <ProseSection title="存在你裝置上的資料">
      <p>最近玩過的遊戲、收藏、靜音設定與最佳紀錄，會存在你瀏覽器的本機儲存空間，不會上傳。清除瀏覽器資料就會刪除這些紀錄。</p>
    </ProseSection>
    <template v-if="FLAGS.login">
      <!-- 帳號相關的段落（帳號與登入設計稿「隱私權政策」畫板） -->
      <ProseSection title="用 Google 登入時保存的資料">
        <p>登入時只向 Google 要求帳號代碼（一串不會變的號碼），不取得名字、信箱和大頭貼。本站保存：</p>
        <ul class="list-disc space-y-1 pl-6">
          <li>Google 帳號代碼</li>
          <li>暱稱：站內隨機產生，或你自己改的名字，以及上次修改的時間</li>
          <li>帳號建立的時間、最後使用的時間</li>
          <li>登入狀態：一組隨機代碼，資料庫只存它的雜湊值</li>
        </ul>
        <p>資料存在 Cloudflare D1 資料庫。暱稱之後會顯示在排行榜上；Google 帳號代碼不會公開。</p>
      </ProseSection>
      <ProseSection title="Cookie">
        <ul class="list-disc space-y-1 pl-6">
          <li><code class="font-mono text-[15px]">gs_session</code>：記住你已經登入，最長 400 天，登出就刪除。</li>
          <li><code class="font-mono text-[15px]">gs_oauth</code>：登入過程中防止偽造請求，10 分鐘後失效。</li>
        </ul>
        <p>沒登入就不會設定這兩個 cookie。登入就表示同意本站用 cookie 記住你的登入狀態。</p>
      </ProseSection>
      <ProseSection title="保存多久、怎麼刪除">
        <p>
          帳號會一直保留，直到你在「<NuxtLink to="/me" :class="link">我的紀錄</NuxtLink>」頁按「刪除帳號」。刪除後資料立即從資料庫移除；資料庫的還原備份（Cloudflare
          D1 Time Travel）最多再保留 30 天後自動消失。
        </p>
        <p>
          你也可以寫信到<NuxtLink to="/contact" :class="link">聯絡我們</NuxtLink>
          ，要求查詢、閱覽、製給複本、補充或更正、停止蒐集處理利用或刪除你的資料。
        </p>
      </ProseSection>
      <ProseSection title="未成年">
        <p>未滿 13 歲請在家長同意後再登入。</p>
      </ProseSection>
    </template>
    <ProseSection title="遊玩次數統計">
      <p>熱門榜需要統計每款遊戲被玩了幾次。這項功能尚未啟用；啟用時，這裡會補上實際收集的欄位與保存期間。</p>
    </ProseSection>
    <ProseSection title="廣告與第三方服務">
      <p>
        目前網站沒有載入任何第三方廣告或分析程式，頁面上標示「廣告」的區塊是版位預留。正式接上廣告或分析服務前，這裡會列出服務名稱、用途與你可以做的選擇。
      </p>
    </ProseSection>
  </ProsePage>
</template>
