import { getRouterParam } from "h3";

/** 成績圖：/games/precise-stop/r/<代碼>/card */
export default defineEventHandler((event) =>
  cardResponse(getRouterParam(event, "code") ?? "", "zh-TW", (path) => readStaticAsset(event, path)),
);
