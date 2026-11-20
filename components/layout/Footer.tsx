import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Container } from "./Container";
import { FLAGS } from "@/lib/flags";

/** 這幾頁目前只有繁體中文 */
const links = [
  { href: "/about", key: "about" },
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
  { href: "/contact", key: "contact" },
] as const;

export function Footer({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <footer className="on-dark mt-24 bg-sign-deep text-white">
      <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <p className="text-lg font-extrabold tracking-wide">{dict.brand}</p>
          <p className="mt-1 text-white/85">{dict.tagline}</p>
          <p className="mt-4 text-sm text-white/75">{FLAGS.login ? dict.footer.deviceNoteLoggedOut : dict.footer.deviceNote}</p>
        </div>
        <nav aria-label={dict.footer.label}>
          <ul className="flex flex-wrap gap-x-2 gap-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center rounded-full px-3 font-semibold underline-offset-4 hover:underline"
                >
                  {dict.footer[link.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
