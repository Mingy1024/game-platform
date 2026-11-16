import type { Metadata } from "next";
import { defaultFontClass } from "@/app/fonts";
import { Container } from "@/components/layout/Container";
import { SiteShell } from "@/components/site/SiteShell";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { t } from "@/lib/i18n/zh-TW";
import "./globals.css";

export const metadata: Metadata = {
  title: `找不到這個頁面｜${t.brand}`,
};

/**
 * 網址對不到任何頁面時顯示。網站有兩個根版面（繁中、其他語言），
 * 所以 404 頁要自己帶完整的 HTML 外框。
 */
export default function GlobalNotFound() {
  return (
    <SiteShell locale="zh-TW" fontClass={defaultFontClass}>
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
    </SiteShell>
  );
}
