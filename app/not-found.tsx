import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { t } from "@/lib/i18n/zh-TW";

export const metadata: Metadata = {
  title: "找不到這個頁面",
};

export default function NotFound() {
  return (
    <Container className="py-16 text-center sm:py-24">
      <p className="text-4xl font-black tabular-nums text-sign">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">這一站沒有停靠</h1>
      <p className="mx-auto mt-3 max-w-md text-lg text-muted">
        找不到這個頁面。網址可能打錯了，或這款遊戲已經下架。
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/games">{t.actions.allGames}</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          {t.actions.backHome}
        </ButtonLink>
      </div>
    </Container>
  );
}
