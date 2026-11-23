import { SITE_NOINDEX, robotsTxt } from "@/lib/site-metadata";

// 測試站（SITE_NOINDEX=1）禁止爬取；正式站允許。建置時決定
export default defineEventHandler((event) => {
  setHeader(event, "content-type", "text/plain; charset=utf-8");
  return robotsTxt(SITE_NOINDEX);
});
