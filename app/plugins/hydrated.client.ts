/**
 * 瀏覽器端接手（hydration）完成後在 <html> 標上 data-hydrated。
 * 自動測試等這個標記再操作（tests/e2e/fixtures.ts）：接手前的點擊 Vue 不會補做。
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:suspense:resolve", () => {
    document.documentElement.dataset.hydrated = "1";
  });
});
