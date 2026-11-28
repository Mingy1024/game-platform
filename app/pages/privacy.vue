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
      <p v-if="FLAGS.login && FLAGS.leaderboard">
        聲音設定與最佳紀錄會存在你瀏覽器的本機儲存空間。登入時最佳紀錄會存到帳號（見「帳號裡的遊戲紀錄」）；沒登入時，玩完一局的成績會用訪客暱稱上排行榜（見「排行榜與訪客代號」）。清除瀏覽器資料就會刪除這台裝置上的紀錄。
      </p>
      <p v-else-if="FLAGS.login">
        聲音設定與最佳紀錄會存在你瀏覽器的本機儲存空間。沒登入時不會上傳；登入時最佳紀錄會存到帳號（見「帳號裡的遊戲紀錄」）。清除瀏覽器資料就會刪除這台裝置上的紀錄。
      </p>
      <p v-else>聲音設定與最佳紀錄會存在你瀏覽器的本機儲存空間，不會上傳。清除瀏覽器資料就會刪除這些紀錄。</p>
    </ProseSection>
    <template v-if="FLAGS.login">
      <!-- 帳號相關的段落（帳號與登入設計稿「隱私權政策」畫板） -->
      <ProseSection title="用 Google 登入時保存的資料">
        <p>登入時只向 Google 要求帳號代碼（一串不會變的號碼），不取得名字、信箱和大頭貼。本站保存：</p>
        <ul class="list-disc space-y-1 pl-6">
          <li>Google 帳號代碼</li>
          <li>遊戲的最佳紀錄（見下一段）</li>
          <li>暱稱：站內隨機產生，或你自己改的名字，以及上次修改的時間</li>
          <li>帳號建立的時間、最後使用的時間</li>
          <li>登入狀態：一組隨機代碼，資料庫只存它的雜湊值</li>
        </ul>
        <p>資料存在 Cloudflare D1 資料庫。暱稱會顯示在排行榜上；Google 帳號代碼不會公開。</p>
      </ProseSection>
      <ProseSection title="帳號裡的遊戲紀錄">
        <p>登入時，遊戲的最佳紀錄會存到你的帳號，換裝置登入也看得到。目前保存精準停車的：</p>
        <ul class="list-disc space-y-1 pl-6">
          <li>每天今日挑戰的最佳分與創下的時間</li>
          <li>自由模式的最佳分與創下的時間</li>
          <li>累計完美停車次數</li>
        </ul>
        <p>以及下班逃離辦公室的：</p>
        <ul class="list-disc space-y-1 pl-6">
          <li>每天的最佳分與創下的時間</li>
          <li>歷史最佳分與創下的時間（沒有累計次數）</li>
        </ul>
        <p>以及礦坑大逃亡的：</p>
        <ul class="list-disc space-y-1 pl-6">
          <li>最高分與創下的時間</li>
          <li>最深的深度與創下的時間（沒有累計次數）</li>
        </ul>
        <p>以及和尚端湯上塔的：</p>
        <ul class="list-disc space-y-1 pl-6">
          <li>固定關卡與隨機模式各自的最佳分數、總時間與創下的時間（不存湯量、溫度與畫的路線）</li>
        </ul>
        <p>登入前在這台裝置玩的紀錄，登入時會一起併進帳號。登出時會清掉這台裝置上的紀錄，帳號裡的不受影響。</p>
      </ProseSection>
      <ProseSection v-if="FLAGS.leaderboard" title="排行榜與訪客代號">
        <p>排行榜公開的只有暱稱、名次、成績、創下的時間，以及是不是訪客。Google 帳號代碼和訪客代號都不會公開。</p>
        <p>
          沒登入的人玩完一局，成績也會上排行榜：第一次送出成績時，本站建立一個「訪客」，配一個隨機暱稱，並在你的瀏覽器存一個訪客代號（<code class="font-mono text-[15px]">gs_guest</code>
          cookie，資料庫只存它的雜湊值）。訪客保存的資料和帳號一樣：精準停車每天今日挑戰的最佳分、自由模式的最佳分、累計完美停車次數，下班逃離辦公室每天的最佳分與歷史最佳分，礦坑大逃亡的最高分與最深深度，和尚端湯上塔兩種模式的最佳分數與時間，以及建立和最後使用的時間。
        </p>
        <p>訪客 90 天沒玩會自動刪除，紀錄一起刪掉。之後用 Google 登入時，訪客的紀錄會併進帳號，訪客隨即刪除。</p>
        <p>歐洲經濟區、英國、瑞士的訪客，會先詢問要不要上排行榜，同意後才建立訪客；不同意照常可以玩，成績只存在這台裝置。這個選擇可以在「<NuxtLink to="/me" :class="link">我的紀錄</NuxtLink>」頁更改。</p>
        <p>想刪除訪客紀錄，可以在「<NuxtLink to="/me" :class="link">我的紀錄</NuxtLink>」頁按「刪除訪客紀錄」，排行榜上的成績和這台裝置上的紀錄會一起刪掉。</p>
      </ProseSection>
      <ProseSection title="Cookie">
        <ul class="list-disc space-y-1 pl-6">
          <li><code class="font-mono text-[15px]">gs_session</code>：記住你已經登入，最長 400 天，登出就刪除。</li>
          <li><code class="font-mono text-[15px]">gs_oauth</code>：登入過程中防止偽造請求，10 分鐘後失效。</li>
          <li v-if="FLAGS.leaderboard">
            <code class="font-mono text-[15px]">gs_guest</code>：沒登入時記住你的排行榜訪客，最長 400 天；登入 Google、刪除訪客紀錄或訪客 90 天沒玩被刪除時失效。
          </li>
        </ul>
        <p v-if="FLAGS.leaderboard">gs_session、gs_oauth 只在登入時設定；gs_guest 在第一次送出成績時設定（歐洲經濟區、英國、瑞士要先同意）。</p>
        <p v-else>沒登入就不會設定這兩個 cookie。登入就表示同意本站用 cookie 記住你的登入狀態。</p>
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
    <!-- 累計遊玩次數的開關打開時才換成實際的說明（docs/plans/play-count.md） -->
    <ProseSection v-if="FLAGS.playCount" title="遊玩次數統計">
      <p>
        每款遊戲的介紹頁會顯示「已被玩幾次」。你每玩完一局，瀏覽器會送出一個這一局專用的隨機代碼，本站把這款遊戲的總次數加一。資料庫只存每款遊戲的總次數，不存你的帳號、訪客代號、IP
        或玩的時間；隨機代碼只用來避免同一局被算兩次，2 天後刪除。
      </p>
    </ProseSection>
    <ProseSection v-else title="遊玩次數統計">
      <p>統計每款遊戲被玩了幾次的功能尚未啟用；啟用時，這裡會補上實際收集的欄位與保存期間。</p>
    </ProseSection>
    <ProseSection title="廣告與第三方服務">
      <p>
        目前網站沒有載入任何第三方廣告或分析程式，頁面上標示「廣告」的區塊是版位預留。正式接上廣告或分析服務前，這裡會列出服務名稱、用途與你可以做的選擇。
      </p>
    </ProseSection>
  </ProsePage>
</template>
