import { cardResponse } from "@/lib/games/precise-stop/share/card-route";

/** 成績圖：/games/precise-stop/r/<代碼>/card */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  return cardResponse((await params).code, "zh-TW");
}
