<!-- 遊戲畫面還沒準備好（下載中、下載失敗）時蓋住整個畫面 -->
<template>
  <div
    data-game-stage
    class="on-dark fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-canvas p-6 text-center text-white"
  >
    <slot>
      <span class="ps-spinner size-10 rounded-full border-4 border-white/20 border-t-edge" role="status" />
    </slot>
  </div>
</template>
