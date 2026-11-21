/**
 * 開發時取代 @vue/devtools-api（nuxt.config.ts 的 $development）。
 *
 * vue-router 的開發版會載入它，而它一載入就讀 localStorage、沒有處理例外；
 * 瀏覽器不允許儲存時（E2E 的 J2、R7、R14）整個網站在開發模式下就無法接手。
 * 這個專案沒有開 Vue Devtools，換成空的函式不影響功能；正式版本來就不含這段。
 */
export function setupDevtoolsPlugin(): void {}
