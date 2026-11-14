import type { Metadata } from "next";
import { HotTable } from "@/components/catalog/HotTable";
import { Container } from "@/components/layout/Container";
import { PageHeading } from "@/components/layout/PageHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { t } from "@/lib/i18n/zh-TW";

export const metadata: Metadata = {
  title: "熱門榜",
  description: "遊戲小站的熱門遊戲排行，依遊玩次數排列，分為累計與本週。",
  alternates: { canonical: "/hot" },
};

const periodBase =
  "flex min-h-11 items-center rounded-full px-5 font-semibold";

export default function HotPage() {
  return (
    <Container className="py-10 sm:py-14">
      <PageHeading
        title="熱門榜"
        lead="依遊玩次數排列。按下開始、真的玩了一局才算一次。"
      />

      {/* 期間切換：統計 API 接上後改為可切換，目前固定在「累計」 */}
      <div role="group" aria-label="統計期間" className="mt-8 flex gap-2">
        <button type="button" aria-pressed="true" className={`${periodBase} bg-edge text-ink`}>
          累計
        </button>
        <button
          type="button"
          aria-pressed="false"
          disabled
          className={`${periodBase} cursor-not-allowed bg-card text-muted ring-1 ring-inset ring-line`}
        >
          本週
        </button>
      </div>

      <div className="mt-4">
        <HotTable entries={null} caption="累計熱門遊戲排行" />
      </div>

      <p className="mt-4 max-w-2xl text-sm text-muted">
        本週從週一 00:00（臺北時間）起算。次數是經過基本去重的遊玩量，不等於玩家人數。
      </p>

      <div className="mt-10">
        <ButtonLink href="/games" variant="secondary">
          {t.actions.allGames}
        </ButtonLink>
      </div>
    </Container>
  );
}
