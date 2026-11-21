import { loginHref } from "@/lib/account/me-store";

/** 目前這一頁（拿掉登入結果參數），登入後回到這裡 */
function currentPath(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("login");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** 登入連結：伺服器產生的畫面先連到首頁，點下去時才換成目前這一頁 */
export const LOGIN_FALLBACK_HREF = loginHref("/");

export function pointLoginToCurrentPage(event: MouseEvent) {
  (event.currentTarget as HTMLAnchorElement).href = loginHref(currentPath());
}
