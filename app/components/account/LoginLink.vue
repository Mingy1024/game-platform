<!-- 回到目前這一頁的登入連結（給「再試一次」這類自訂樣式的按鈕用） -->
<template>
  <a :href="LOGIN_FALLBACK_HREF" @click="pointLoginToCurrentPage"><slot /></a>
</template>
