import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MeAccount } from "@/components/account/MeAccount";
import { Container } from "@/components/layout/Container";
import { PageHeading } from "@/components/layout/PageHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon, type IconName } from "@/components/ui/Icon";
import { FLAGS } from "@/lib/flags";
import { t } from "@/lib/i18n/zh-TW";

export const metadata: Metadata = {
  title: "我的紀錄",
  description: "這台裝置上最近玩過的遊戲、收藏與最佳紀錄。",
  robots: { index: false },
};

export default function MePage() {
  // 三個區塊的內容之後由本機紀錄（localStorage）填入，目前顯示空狀態
  const panels = (
    <div className="mt-10 grid gap-5 lg:grid-cols-3">
      <RecordPanel id="recent" icon="clock" title="最近玩過">
        還沒有玩過的遊戲。玩過之後，最近的 20 款會列在這裡。
      </RecordPanel>
      <RecordPanel id="favorites" icon="heart" title="收藏">
        還沒有收藏。在遊戲頁按下收藏，之後就能從這裡快速找到。
      </RecordPanel>
      <RecordPanel id="bests" icon="restart" title="最佳紀錄">
        還沒有紀錄。完成一局之後，每款遊戲的最佳成績會留在這裡。
      </RecordPanel>
    </div>
  );

  return (
    <Container className="py-10 sm:py-14">
      <PageHeading title="我的紀錄" lead="最近玩過的遊戲、收藏和最佳紀錄都在這裡。" />

      {FLAGS.login ? (
        // 登入開關打開時，「只存在這台裝置」的提示併進帳號卡（components/account/MeAccount.tsx）
        <MeAccount labels={t.account}>
          {panels}
        </MeAccount>
      ) : (
        <>
          <p className="mt-6 flex max-w-2xl gap-3 rounded-xl border border-edge bg-edge-tint px-4 py-3 text-ink">
            <Icon name="device" size={24} className="mt-0.5 shrink-0" />
            <span>
              這些紀錄只存在這台裝置的瀏覽器裡，不會同步到其他裝置。清除瀏覽器資料後會消失。
            </span>
          </p>
          {panels}
        </>
      )}

      <div className="mt-10">
        <ButtonLink href="/games">{t.actions.allGames}</ButtonLink>
      </div>
    </Container>
  );
}

function RecordPanel({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-line bg-card p-5"
    >
      <h2 id={headingId} className="flex items-center gap-2 text-xl font-extrabold text-ink">
        <Icon name={icon} size={24} className="text-sign" />
        {title}
      </h2>
      <p className="mt-3 text-muted">{children}</p>
    </section>
  );
}
