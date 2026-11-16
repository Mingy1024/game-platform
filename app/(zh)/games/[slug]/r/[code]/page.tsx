import type { Metadata } from "next";
import { SharedPage, sharedMetadata } from "@/lib/games/precise-stop/game-page";

type Props = { params: Promise<{ slug: string; code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, code } = await params;
  return sharedMetadata("zh-TW", slug, code);
}

/** 成績連結：/games/precise-stop/r/<代碼>。代碼是任意值，所以內容在請求時才產生。 */
export default function Page({ params }: Props) {
  return <SharedPage locale="zh-TW" code={params.then((value) => value.code)} />;
}
